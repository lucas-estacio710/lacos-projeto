// InterPagUpload.tsx - VERSÃO SIMPLIFICADA PARA EVITAR LOOPS

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { InterPagSheetData, InterPagEntry, InterPagPercentual, parseInterPagPercentage } from '@/types';
import { 
  parseBrazilianDate, 
  formatDateForDisplay, 
  isValidDate
} from '@/lib/dateUtils';

interface InterPagUploadProps {
  onDataLoaded: (data: InterPagSheetData) => void;
  isLoading?: boolean;
}

interface ParseResult {
  success: boolean;
  data?: InterPagSheetData;
  errors: string[];
  warnings: string[];
  stats: {
    agendaEntries: number;
    percentualEntries: number;
    matchedEntries: number;
    unmatchedEntries: number;
  };
}

export function InterPagUpload({ onDataLoaded, isLoading = false }: InterPagUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [agendaFile, setAgendaFile] = useState<{ name: string; content: string } | null>(null);
  const [percentualFile, setPercentualFile] = useState<{ name: string; content: string } | null>(null);
  
  const agendaInputRef = useRef<HTMLInputElement>(null);
  const percentualInputRef = useRef<HTMLInputElement>(null);

  /**
   * Processar Agenda do Inter
   */
  const parseAgendaInter = (content: string): InterPagEntry[] => {
    console.log('📊 Processando Agenda Inter...');
    const lines = content.split('\n').filter(line => line.trim());
    const entries: InterPagEntry[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const values = line.split(';').map(v => v.trim().replace(/[\r"]/g, ''));
        if (values.length < 11) continue;
        
        const rawDate = values[1]?.split(' - ')[0] || '';
        const isoDate = parseBrazilianDate(rawDate);
        
        if (!isoDate || !isValidDate(isoDate)) continue;
        
        const entry: InterPagEntry = {
          idTransacao: values[0] || '',
          dataHora: isoDate,
          tipo: values[2] || '',
          status: values[3] || '',
          parcela: values[4] || '',
          bandeira: values[5] || '',
          valorBruto: parseFloat(values[6]?.replace(',', '.')) || 0,
          valorTaxa: parseFloat(values[7]?.replace(',', '.')) || 0,
          valorAntecipacao: parseFloat(values[8]?.replace(',', '.')) || 0,
          valorLiquido: parseFloat(values[9]?.replace(',', '.')) || 0,
          dataPagamento: values[10] || ''
        };
        
        entries.push(entry);
      } catch (error) {
        console.warn(`Erro linha ${i + 1}:`, error);
      }
    }
    
    console.log(`✅ Agenda: ${entries.length} entradas`);
    return entries;
  };

  /**
   * Processar Percentuais
   */
  const parsePercentualData = (content: string): InterPagPercentual[] => {
    console.log('📋 Processando Percentuais...');
    const lines = content.split('\n').filter(line => line.trim());
    const percentuais: InterPagPercentual[] = [];
    
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const values = line.split(',').map(v => v.trim().replace(/[\r"]/g, ''));
        if (values.length < 5) continue;
        
        const idTransacao = values[0];
        const idContrato = values[1];
        const rawCatalogo = values[2] || '0';
        const rawPlanos = values[3] || '0';
        
        if (!idTransacao || !idContrato) continue;
        
        const percentualCatalogo = parseInterPagPercentage(rawCatalogo);
        const percentualPlanos = parseInterPagPercentage(rawPlanos);
        
        percentuais.push({
          idTransacao,
          idContrato,
          percentualCatalogo,
          percentualPlanos,
          totalPercentual: percentualCatalogo + percentualPlanos
        });
      } catch (error) {
        console.warn(`Erro percentual linha ${i + 1}:`, error);
      }
    }
    
    console.log(`✅ Percentuais: ${percentuais.length} entradas`);
    return percentuais;
  };

  /**
   * Processar dados quando ambos arquivos estão carregados
   */
  const processData = async () => {
    if (!agendaFile || !percentualFile) return;
    
    setProcessing(true);
    console.log('🚀 Iniciando processamento...');
    
    try {
      const agendaEntries = parseAgendaInter(agendaFile.content);
      const percentuais = parsePercentualData(percentualFile.content);
      
      if (agendaEntries.length === 0) {
        throw new Error('Nenhuma entrada válida na agenda');
      }
      
      if (percentuais.length === 0) {
        throw new Error('Nenhum percentual válido encontrado');
      }
      
      // Fazer matching
      const percentualMap = new Map<string, InterPagPercentual>();
      percentuais.forEach(p => percentualMap.set(p.idTransacao, p));
      
      let matchedCount = 0;
      agendaEntries.forEach(entry => {
        if (percentualMap.has(entry.idTransacao)) {
          matchedCount++;
        }
      });
      
      // Calcular estatísticas
      const totalValue = agendaEntries.reduce((sum, entry) => sum + entry.valorLiquido, 0);
      const dates = agendaEntries
        .map(entry => entry.dataHora)
        .filter(date => date && date !== '')
        .sort();
      
      const result: ParseResult = {
        success: true,
        data: {
          agendaEntries,
          percentuais,
          summary: {
            totalEntries: agendaEntries.length,
            totalValue,
            dateRange: {
              start: dates[0] || '',
              end: dates[dates.length - 1] || ''
            },
            matchedEntries: matchedCount,
            unmatchedEntries: agendaEntries.length - matchedCount
          }
        },
        errors: [],
        warnings: matchedCount < agendaEntries.length ? [`${agendaEntries.length - matchedCount} entradas sem percentual`] : [],
        stats: {
          agendaEntries: agendaEntries.length,
          percentualEntries: percentuais.length,
          matchedEntries: matchedCount,
          unmatchedEntries: agendaEntries.length - matchedCount
        }
      };
      
      setParseResult(result);
      
      if (result.data) {
        console.log('✅ Chamando onDataLoaded...');
        onDataLoaded(result.data);
      }
      
    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      setParseResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
        warnings: [],
        stats: { agendaEntries: 0, percentualEntries: 0, matchedEntries: 0, unmatchedEntries: 0 }
      });
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Handler para upload de arquivo
   */
  const handleFileSelect = (file: File, type: 'agenda' | 'percentual') => {
    if (!file) return;

    console.log(`📁 Carregando ${type}:`, file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      if (type === 'agenda') {
        setAgendaFile({ name: file.name, content });
      } else {
        setPercentualFile({ name: file.name, content });
      }
      
      console.log(`✅ ${type} carregado:`, file.name);
    };

    reader.onerror = (error) => {
      console.error(`❌ Erro ao ler ${type}:`, error);
    };

    reader.readAsText(file, 'utf-8');
  };

  /**
   * Reset completo
   */
  const handleReset = () => {
    setAgendaFile(null);
    setPercentualFile(null);
    setParseResult(null);
    setProcessing(false);
    
    if (agendaInputRef.current) agendaInputRef.current.value = '';
    if (percentualInputRef.current) percentualInputRef.current.value = '';
    
    console.log('🔄 Reset completo');
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
    if (files && files.length > 0) {
      handleFileSelect(files[0], 'agenda');
      if (files.length > 1) {
        handleFileSelect(files[1], 'percentual');
      }
    }
  };

  const bothFilesLoaded = agendaFile && percentualFile;
  const canProcess = bothFilesLoaded && !processing;

  return (
    <div className="space-y-6">
      
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive 
            ? 'border-orange-500 bg-orange-500/10' 
            : 'border-gray-600 hover:border-gray-500 bg-gray-800'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <FileSpreadsheet className="mx-auto h-12 w-12 mb-4 text-orange-400" />
          
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            🟠 Upload das Planilhas Inter Pag
          </h3>
          <p className="text-gray-400 mb-6">
            São necessários 2 arquivos: Agenda Inter + Planilha de Percentuais
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Upload Agenda */}
            <div className="border border-gray-600 rounded-lg p-4">
              <h4 className="font-medium text-gray-200 mb-2">📊 Agenda Inter</h4>
              <p className="text-sm text-gray-400 mb-3">CSV com transações</p>
              
              <button
                onClick={() => agendaInputRef.current?.click()}
                className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  agendaFile 
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-orange-600 hover:bg-orange-500 text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                {agendaFile ? '✅ Carregado' : 'Selecionar Agenda'}
              </button>

              {agendaFile && (
                <div className="mt-2 text-xs text-green-300">📁 {agendaFile.name}</div>
              )}

              <input
                ref={agendaInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'agenda')}
                className="hidden"
              />
            </div>

            {/* Upload Percentuais */}
            <div className="border border-gray-600 rounded-lg p-4">
              <h4 className="font-medium text-gray-200 mb-2">📋 Percentuais</h4>
              <p className="text-sm text-gray-400 mb-3">CSV com percentuais</p>
              
              <button
                onClick={() => percentualInputRef.current?.click()}
                className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  percentualFile 
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                {percentualFile ? '✅ Carregado' : 'Selecionar Percentuais'}
              </button>

              {percentualFile && (
                <div className="mt-2 text-xs text-green-300">📁 {percentualFile.name}</div>
              )}

              <input
                ref={percentualInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'percentual')}
                className="hidden"
              />
            </div>
          </div>

          {/* Controles */}
          {bothFilesLoaded && (
            <div className="mt-6 flex gap-2 justify-center">
              <button
                onClick={processData}
                disabled={!canProcess}
                className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  canProcess
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-600 text-gray-400'
                }`}
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Processar Dados
                  </>
                )}
              </button>
              
              <button
                onClick={handleReset}
                disabled={processing}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status dos Arquivos */}
      {(agendaFile || percentualFile) && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h4 className="text-lg font-medium text-gray-100 mb-3">📂 Status dos Arquivos</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`border rounded p-3 ${
              agendaFile ? 'border-green-600 bg-green-900/20' : 'border-gray-600 bg-gray-800'
            }`}>
              <div className="flex items-center gap-2">
                {agendaFile ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                )}
                <span className="font-medium text-gray-200">Agenda Inter</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {agendaFile ? `✅ ${agendaFile.name}` : 'Aguardando arquivo'}
              </p>
            </div>
            
            <div className={`border rounded p-3 ${
              percentualFile ? 'border-green-600 bg-green-900/20' : 'border-gray-600 bg-gray-800'
            }`}>
              <div className="flex items-center gap-2">
                {percentualFile ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                )}
                <span className="font-medium text-gray-200">Percentuais</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {percentualFile ? `✅ ${percentualFile.name}` : 'Aguardando arquivo'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {parseResult && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            {parseResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <h4 className="text-lg font-medium text-gray-100">Resultado do Processamento</h4>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-700 rounded p-3 text-center">
              <div className="text-gray-400 text-xs">Agenda</div>
              <div className="text-white font-bold">{parseResult.stats.agendaEntries}</div>
            </div>
            <div className="bg-gray-700 rounded p-3 text-center">
              <div className="text-gray-400 text-xs">Percentuais</div>
              <div className="text-white font-bold">{parseResult.stats.percentualEntries}</div>
            </div>
            <div className="bg-green-700 rounded p-3 text-center">
              <div className="text-green-300 text-xs">Matches</div>
              <div className="text-white font-bold">{parseResult.stats.matchedEntries}</div>
            </div>
            <div className="bg-red-700 rounded p-3 text-center">
              <div className="text-red-300 text-xs">Sem Match</div>
              <div className="text-white font-bold">{parseResult.stats.unmatchedEntries}</div>
            </div>
          </div>

          {/* Erros */}
          {parseResult.errors.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-red-300 mb-2">Erros:</h5>
              {parseResult.errors.map((error, index) => (
                <div key={index} className="text-red-200 text-xs p-2 bg-red-900/20 rounded mb-1">
                  {error}
                </div>
              ))}
            </div>
          )}

          {/* Avisos */}
          {parseResult.warnings.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-yellow-300 mb-2">Avisos:</h5>
              {parseResult.warnings.map((warning, index) => (
                <div key={index} className="text-yellow-200 text-xs p-2 bg-yellow-900/20 rounded mb-1">
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Sucesso */}
          {parseResult.success && parseResult.data && (
            <div className="bg-green-900/20 border border-green-600 rounded p-3">
              <h5 className="text-green-300 font-medium mb-2">✅ Dados Inter Pag Carregados!</h5>
              <div className="text-green-200 text-sm space-y-1">
                <div>• {parseResult.data.agendaEntries.length} entradas da agenda</div>
                <div>• {parseResult.data.percentuais.length} percentuais carregados</div>
                <div>• {parseResult.stats.matchedEntries} matches identificados</div>
                <div>• Período: {formatDateForDisplay(parseResult.data.summary.dateRange.start)} até {formatDateForDisplay(parseResult.data.summary.dateRange.end)}</div>
                <div>• Valor total: R$ {parseResult.data.summary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}