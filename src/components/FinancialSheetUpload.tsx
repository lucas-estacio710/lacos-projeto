// FinancialSheetUpload.tsx - COMPONENTE COM PARSING BRASILEIRO APRIMORADO

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Eye, Download } from 'lucide-react';
import { FinancialSheetData, FinancialEntry } from '@/types';
import { 
  parseBrazilianDate, 
  detectDateFormat, 
  formatDateForDisplay, 
  isValidDate,
  debugDate 
} from '@/lib/dateUtils';

interface FinancialSheetUploadProps {
  onDataLoaded: (data: FinancialSheetData) => void;
  isLoading?: boolean;
}

interface ParseResult {
  success: boolean;
  data?: FinancialSheetData;
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    processedRows: number;
    skippedRows: number;
    dateFormats: Record<string, number>;
    dateFailures: number;
  };
}

interface PreviewData {
  headers: string[];
  sample: Record<string, any>[];
  detectiveReport: {
    dateColumns: string[];
    numericColumns: string[];
    textColumns: string[];
    suspiciousColumns: string[];
  };
}

export function FinancialSheetUpload({ onDataLoaded, isLoading = false }: FinancialSheetUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [rawFileContent, setRawFileContent] = useState<string>('');
  const [forceRefresh, setForceRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Função aprimorada para parsing de datas brasileiras
   * Prioriza formato DD/MM/YYYY e detecta problemas automaticamente
   */
  const parseBrazilianDateWithValidation = (dateStr: string, rowIndex: number): {
    isoDate: string;
    format: string;
    confidence: 'high' | 'medium' | 'low';
    issues: string[];
  } => {
    if (!dateStr || typeof dateStr !== 'string') {
      return {
        isoDate: '',
        format: 'UNKNOWN',
        confidence: 'low',
        issues: ['Data vazia ou inválida']
      };
    }

    const cleanStr = dateStr.trim();
    const detectedFormat = detectDateFormat(cleanStr);
    const issues: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'high';

    // Tentar parsing brasileiro primeiro
    const brazilianParsed = parseBrazilianDate(cleanStr);
    
    if (brazilianParsed && isValidDate(brazilianParsed)) {
      // Verificar se há ambiguidade potencial
      if (detectedFormat === 'DD/MM/YYYY' || detectedFormat === 'MM/DD/YYYY') {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          
          if (day <= 12 && month <= 12) {
            issues.push('Data ambígua - pode ser DD/MM ou MM/DD');
            confidence = 'medium';
          }
        }
      }

      return {
        isoDate: brazilianParsed,
        format: detectedFormat,
        confidence,
        issues
      };
    }

    // Fallback para outros métodos se o parsing brasileiro falhou
    try {
      const fallbackDate = new Date(cleanStr);
      if (!isNaN(fallbackDate.getTime())) {
        const year = fallbackDate.getFullYear();
        const month = String(fallbackDate.getMonth() + 1).padStart(2, '0');
        const day = String(fallbackDate.getDate()).padStart(2, '0');
        
        issues.push('Usou parsing de fallback');
        confidence = 'low';
        
        return {
          isoDate: `${year}-${month}-${day}`,
          format: 'FALLBACK',
          confidence,
          issues
        };
      }
    } catch (error) {
      issues.push(`Erro no parsing: ${error}`);
    }

    return {
      isoDate: '',
      format: 'UNKNOWN',
      confidence: 'low',
      issues: [...issues, 'Não foi possível converter a data']
    };
  };

  /**
   * Função para analisar preview dos dados antes do processamento
   */
  const analyzeFileContent = (content: string): PreviewData => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return {
        headers: [],
        sample: [],
        detectiveReport: {
          dateColumns: [],
          numericColumns: [],
          textColumns: [],
          suspiciousColumns: []
        }
      };
    }

    // Detectar separador (vírgula ou ponto e vírgula)
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    
    // Extrair headers
    const headers = firstLine.split(separator).map(h => h.trim().replace(/['"]/g, ''));
    
    // Pegar amostra de dados (máximo 5 linhas)
    const sampleLines = lines.slice(1, 6);
    const sample = sampleLines.map((line, index) => {
      const values = line.split(separator).map(v => v.trim().replace(/['"]/g, ''));
      const row: Record<string, any> = { _rowIndex: index + 2 }; // +2 porque começamos da linha 2
      
      headers.forEach((header, headerIndex) => {
        row[header] = values[headerIndex] || '';
      });
      
      return row;
    });

    // Análise detective dos tipos de colunas
    const detectiveReport = {
      dateColumns: [] as string[],
      numericColumns: [] as string[],
      textColumns: [] as string[],
      suspiciousColumns: [] as string[]
    };

    headers.forEach(header => {
      const values = sample.map(row => row[header]).filter(v => v && v !== '');
      
      if (values.length === 0) {
        detectiveReport.suspiciousColumns.push(header);
        return;
      }

      // Detectar colunas de data
      const dateCount = values.filter(v => {
        const format = detectDateFormat(v);
        return format !== 'UNKNOWN';
      }).length;

      if (dateCount / values.length > 0.7) {
        detectiveReport.dateColumns.push(header);
        return;
      }

      // Detectar colunas numéricas
      const numericCount = values.filter(v => {
        const num = parseFloat(v.toString().replace(/[,\.]/g, '.'));
        return !isNaN(num);
      }).length;

      if (numericCount / values.length > 0.7) {
        detectiveReport.numericColumns.push(header);
        return;
      }

      // Resto é texto
      detectiveReport.textColumns.push(header);
    });

    return {
      headers,
      sample,
      detectiveReport
    };
  };

  /**
   * Função principal de parsing do arquivo
   */
  const parseFinancialData = (content: string): ParseResult => {
    console.log('🔄 Iniciando parsing de dados financeiros...');
    
    const result: ParseResult = {
      success: false,
      errors: [],
      warnings: [],
      stats: {
        totalRows: 0,
        processedRows: 0,
        skippedRows: 0,
        dateFormats: {},
        dateFailures: 0
      }
    };

    try {
      const lines = content.split('\n').filter(line => line.trim());
      result.stats.totalRows = lines.length - 1; // -1 para excluir header

      if (lines.length < 2) {
        result.errors.push('Arquivo deve conter pelo menos uma linha de dados além do cabeçalho');
        return result;
      }

      // Detectar separador
      const separator = lines[0].includes(';') ? ';' : ',';
      console.log(`📊 Separador detectado: "${separator}"`);

      // Extrair headers
      const headers = lines[0].split(separator).map(h => h.trim().replace(/['"]/g, ''));
      console.log('📋 Headers encontrados:', headers);

      // Mapear colunas esperadas (flexível para diferentes formatos de planilha)
      const columnMap = {
        dataHora: headers.find(h => 
          h.toLowerCase().includes('data') || 
          h.toLowerCase().includes('hora') ||
          h.toLowerCase().includes('timestamp')
        ) || headers[0],
        tipo: headers.find(h => 
          h.toLowerCase().includes('tipo') ||
          h.toLowerCase().includes('category')
        ) || headers[1],
        metodo: headers.find(h => 
          h.toLowerCase().includes('método') ||
          h.toLowerCase().includes('metodo') ||
          h.toLowerCase().includes('method') ||
          h.toLowerCase().includes('forma')
        ) || headers[2],
        idContrato: headers.find(h => 
          h.toLowerCase().includes('contrato') ||
          h.toLowerCase().includes('contract') ||
          h.toLowerCase().includes('id')
        ) || headers[3],
        idTransacao: headers.find(h => 
          h.toLowerCase().includes('transacao') ||
          h.toLowerCase().includes('transação') ||
          h.toLowerCase().includes('transaction') ||
          h.toLowerCase().includes('ref')
        ) || headers[4],
        valorFinal: headers.find(h => 
          h.toLowerCase().includes('valor') ||
          h.toLowerCase().includes('total') ||
          h.toLowerCase().includes('amount') ||
          h.toLowerCase().includes('final')
        ) || headers[5],
        cc: headers.find(h => 
          h.toLowerCase().includes('cc') ||
          h.toLowerCase().includes('centro') ||
          h.toLowerCase().includes('cost') ||
          h.toLowerCase().includes('conta')
        ) || headers[6]
      };

      console.log('🗂️ Mapeamento de colunas:', columnMap);

      // Verificar se encontramos as colunas essenciais
      const missingColumns = Object.entries(columnMap).filter(([, value]) => !value);
      if (missingColumns.length > 0) {
        result.warnings.push(`Colunas não encontradas automaticamente: ${missingColumns.map(([key]) => key).join(', ')}`);
      }

      const entries: FinancialEntry[] = [];
      const dateTracker = {
        earliest: '',
        latest: '',
        formats: new Set<string>()
      };

      // Processar cada linha de dados
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
          result.stats.skippedRows++;
          continue;
        }

        const values = line.split(separator).map(v => v.trim().replace(/['"]/g, ''));
        
        try {
          // Extrair dados da linha
          const rawDataHora = values[headers.indexOf(columnMap.dataHora)] || '';
          const tipo = values[headers.indexOf(columnMap.tipo)] || '';
          const metodo = values[headers.indexOf(columnMap.metodo)] || '';
          const idContrato = values[headers.indexOf(columnMap.idContrato)] || '';
          const idTransacao = values[headers.indexOf(columnMap.idTransacao)] || '';
          const rawValor = values[headers.indexOf(columnMap.valorFinal)] || '0';
          const cc = values[headers.indexOf(columnMap.cc)] || '';

          // Processar data com validation
          const dateResult = parseBrazilianDateWithValidation(rawDataHora, i + 1);
          
          if (!dateResult.isoDate) {
            result.warnings.push(`Linha ${i + 1}: Data inválida "${rawDataHora}" - ${dateResult.issues.join(', ')}`);
            result.stats.dateFailures++;
            result.stats.skippedRows++;
            continue;
          }

          // Registrar estatísticas de formato
          if (!result.stats.dateFormats[dateResult.format]) {
            result.stats.dateFormats[dateResult.format] = 0;
          }
          result.stats.dateFormats[dateResult.format]++;
          dateTracker.formats.add(dateResult.format);

          // Processar valor numérico
          const valorFinal = parseFloat(rawValor.replace(/[,]/g, '.')) || 0;

          // Criar entrada
          const entry: FinancialEntry = {
            id: `entry_${i}_${Date.now()}`,
            dataHora: dateResult.isoDate,
            tipo: tipo || 'N/A',
            metodo: metodo || 'N/A',
            idContrato: idContrato || 'N/A',
            idTransacao: idTransacao || `auto_${i}`,
            valorFinal,
            cc: cc || 'N/A'
          };

          entries.push(entry);
          result.stats.processedRows++;

          // Atualizar range de datas
          if (!dateTracker.earliest || dateResult.isoDate < dateTracker.earliest) {
            dateTracker.earliest = dateResult.isoDate;
          }
          if (!dateTracker.latest || dateResult.isoDate > dateTracker.latest) {
            dateTracker.latest = dateResult.isoDate;
          }

          // Avisos sobre qualidade dos dados
          if (dateResult.confidence === 'medium') {
            result.warnings.push(`Linha ${i + 1}: ${dateResult.issues.join(', ')}`);
          }

        } catch (error) {
          result.errors.push(`Linha ${i + 1}: Erro ao processar - ${error}`);
          result.stats.skippedRows++;
        }
      }

      // Calcular estatísticas finais
      const totalValue = entries.reduce((sum, entry) => sum + entry.valorFinal, 0);
      const byMethod = entries.reduce((acc, entry) => {
        acc[entry.metodo] = (acc[entry.metodo] || 0) + entry.valorFinal;
        return acc;
      }, {} as Record<string, number>);
      
      const byType = entries.reduce((acc, entry) => {
        acc[entry.tipo] = (acc[entry.tipo] || 0) + entry.valorFinal;
        return acc;
      }, {} as Record<string, number>);

      // Criar resultado final
      result.data = {
        entries,
        summary: {
          totalEntries: entries.length,
          totalValue,
          dateRange: {
            start: dateTracker.earliest,
            end: dateTracker.latest
          },
          byMethod,
          byType
        }
      };

      result.success = true;

      // Avisos sobre qualidade dos dados
      if (result.stats.dateFailures > 0) {
        result.warnings.push(`${result.stats.dateFailures} datas não puderam ser processadas`);
      }

      if (dateTracker.formats.size > 1) {
        result.warnings.push(`Múltiplos formatos de data detectados: ${Array.from(dateTracker.formats).join(', ')}`);
      }

      console.log('✅ Parsing concluído:', result);
      return result;

    } catch (error) {
      result.errors.push(`Erro geral no parsing: ${error}`);
      console.error('❌ Erro no parsing:', error);
      return result;
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;

    console.log('📁 Arquivo selecionado:', file.name, file.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRawFileContent(content);
      
      // Fazer preview primeiro
      const preview = analyzeFileContent(content);
      setPreviewData(preview);
      setShowPreview(true);
      
      // Fazer parsing automaticamente
      const result = parseFinancialData(content);
      setParseResult(result);
      
      if (result.success && result.data) {
        onDataLoaded(result.data);
      }
    };

    reader.readAsText(file, 'utf-8');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const downloadSampleFile = () => {
    const sampleData = [
      'Data,Tipo,Método,ID Contrato,ID Transação,Valor Final,CC',
      '15/01/2024,Individual,PIX,12345,TXN001,150.00,PJ',
      '16/01/2024,Coletiva,PIX,12346,TXN002,300.00,PJ',
      '17/01/2024,Individual,Cartão,12347,TXN003,200.00,PJ'
    ].join('\n');

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_planilha_financeira.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-500/10' 
            : isLoading 
              ? 'border-gray-600 bg-gray-800' 
              : 'border-gray-600 hover:border-gray-500 bg-gray-800'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <FileSpreadsheet className={`mx-auto h-12 w-12 mb-4 ${
            isLoading ? 'text-gray-500 animate-pulse' : 'text-gray-400'
          }`} />
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-100">
              {isLoading ? 'Processando arquivo...' : 'Upload da Planilha Financeira'}
            </h3>
            <p className="text-gray-400">
              Arraste um arquivo CSV ou clique para selecionar
            </p>
            <p className="text-sm text-gray-500">
              Formatos suportados: CSV com datas brasileiras (DD/MM/AAAA)
            </p>
          </div>

          {!isLoading && (
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Selecionar Arquivo
              </button>
              
              <button
                onClick={downloadSampleFile}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar Exemplo
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && previewData && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-100 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview dos Dados
            </h4>
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              ×
            </button>
          </div>

          {/* Detective Report */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-green-900/30 border border-green-600 rounded p-3">
              <div className="text-green-300 text-sm font-medium">Colunas de Data</div>
              <div className="text-green-100 text-xs mt-1">
                {previewData.detectiveReport.dateColumns.length > 0 
                  ? previewData.detectiveReport.dateColumns.join(', ')
                  : 'Nenhuma detectada'
                }
              </div>
            </div>
            
            <div className="bg-blue-900/30 border border-blue-600 rounded p-3">
              <div className="text-blue-300 text-sm font-medium">Colunas Numéricas</div>
              <div className="text-blue-100 text-xs mt-1">
                {previewData.detectiveReport.numericColumns.length > 0 
                  ? previewData.detectiveReport.numericColumns.join(', ')
                  : 'Nenhuma detectada'
                }
              </div>
            </div>
            
            <div className="bg-gray-900/30 border border-gray-600 rounded p-3">
              <div className="text-gray-300 text-sm font-medium">Colunas de Texto</div>
              <div className="text-gray-100 text-xs mt-1">
                {previewData.detectiveReport.textColumns.length > 0 
                  ? previewData.detectiveReport.textColumns.join(', ')
                  : 'Nenhuma detectada'
                }
              </div>
            </div>
            
            <div className="bg-red-900/30 border border-red-600 rounded p-3">
              <div className="text-red-300 text-sm font-medium">Colunas Suspeitas</div>
              <div className="text-red-100 text-xs mt-1">
                {previewData.detectiveReport.suspiciousColumns.length > 0 
                  ? previewData.detectiveReport.suspiciousColumns.join(', ')
                  : 'Nenhuma encontrada'
                }
              </div>
            </div>
          </div>

          {/* Sample Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  {previewData.headers.map(header => (
                    <th key={header} className="text-left p-2 text-gray-300 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.sample.map((row, index) => (
                  <tr key={index} className="border-b border-gray-700">
                    {previewData.headers.map(header => (
                      <td key={header} className="p-2 text-gray-200">
                        {row[header] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Parse Results */}
      {parseResult && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            {parseResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <h4 className="text-lg font-medium text-gray-100">
              Resultado do Processamento
            </h4>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="bg-gray-700 rounded p-3 text-center">
              <div className="text-gray-400 text-xs">Total</div>
              <div className="text-white font-bold">{parseResult.stats.totalRows}</div>
            </div>
            <div className="bg-green-700 rounded p-3 text-center">
              <div className="text-green-300 text-xs">Processadas</div>
              <div className="text-white font-bold">{parseResult.stats.processedRows}</div>
            </div>
            <div className="bg-yellow-700 rounded p-3 text-center">
              <div className="text-yellow-300 text-xs">Ignoradas</div>
              <div className="text-white font-bold">{parseResult.stats.skippedRows}</div>
            </div>
            <div className="bg-red-700 rounded p-3 text-center">
              <div className="text-red-300 text-xs">Datas Falhas</div>
              <div className="text-white font-bold">{parseResult.stats.dateFailures}</div>
            </div>
            <div className="bg-blue-700 rounded p-3 text-center">
              <div className="text-blue-300 text-xs">Formatos</div>
              <div className="text-white font-bold">{Object.keys(parseResult.stats.dateFormats).length}</div>
            </div>
          </div>

          {/* Date Formats Distribution */}
          {Object.keys(parseResult.stats.dateFormats).length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-300 mb-2">Distribuição de Formatos de Data:</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(parseResult.stats.dateFormats).map(([format, count]) => (
                  <span key={format} className="px-2 py-1 bg-blue-600 text-blue-100 rounded text-xs">
                    {format}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {parseResult.errors.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-red-300 mb-2">Erros:</h5>
              <div className="space-y-1">
                {parseResult.errors.map((error, index) => (
                  <div key={index} className="text-red-200 text-xs p-2 bg-red-900/20 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {parseResult.warnings.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-yellow-300 mb-2">Avisos:</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {parseResult.warnings.map((warning, index) => (
                  <div key={index} className="text-yellow-200 text-xs p-2 bg-yellow-900/20 rounded">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Summary */}
          {parseResult.success && parseResult.data && (
            <div className="bg-green-900/20 border border-green-600 rounded p-3">
              <h5 className="text-green-300 font-medium mb-2">Dados Carregados com Sucesso!</h5>
              <div className="text-green-200 text-sm">
                • {parseResult.data.entries.length} entradas processadas<br />
                • Período: {formatDateForDisplay(parseResult.data.summary.dateRange.start)} até {formatDateForDisplay(parseResult.data.summary.dateRange.end)}<br />
                • Valor total: R$ {parseResult.data.summary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br />
                • Métodos: {Object.keys(parseResult.data.summary.byMethod).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}