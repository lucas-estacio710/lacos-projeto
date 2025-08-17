// ComplexClassificationTab.tsx - VERSÃO ATUALIZADA COM TIPOS COMPATÍVEIS

import React, { useState, useRef } from 'react';
import { Upload, FileText, Calendar, Settings, Zap, PlusCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  Transaction,
  FinancialSheetData,
  LegacyFinancialSheetData,
  FinancialEntry,
  createSummaryFromEntries
} from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { useFinancialSheet } from '@/hooks/useFinancialSheet';
import { useUnifiedFinancialData } from '@/hooks/useFinancialSheetCompat';
import { PixInterConciliationModal } from '@/components/PixInterConciliationModal';
import { ManualEntryModal } from '@/components/ManualEntryModal';
import { 
  formatDateToLocal, 
  formatDateForDisplay, 
  parseBrazilianDate 
} from '@/lib/dateUtils';

// Helper functions para formatação
const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateSafe = (dateStr: string): string => {
  try {
    if (!dateStr || dateStr === '' || dateStr === 'undefined') return 'Data inválida';
    return formatDateForDisplay(dateStr);
  } catch {
    return 'Data inválida';
  }
};

interface ComplexClassificationTabProps {
  complexTransactions: Transaction[];
  complexCardTransactions: CardTransaction[];
  onEditTransaction: (transaction: Transaction) => void;
  onEditCardTransaction: (transaction: CardTransaction) => void;
  onRemoveFromComplex: (transactionId: string, type: 'transaction' | 'card') => Promise<void>;
  onApplyBatchClassification: (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => Promise<void>;
  // ✅ NOVA PROP PARA RECONCILIAÇÃO
  onReconcileTransactions?: (reconciliationData: any) => Promise<void>;
}

export function ComplexClassificationTab({
  complexTransactions,
  complexCardTransactions,
  onEditTransaction,
  onEditCardTransaction,
  onRemoveFromComplex,
  onApplyBatchClassification,
  onReconcileTransactions // ✅ NOVA PROP
}: ComplexClassificationTabProps) {
  // Estados dos modais
  const [showPixInterModal, setShowPixInterModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  
  // Estados para upload da planilha
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados da planilha compatível
  const [rawSheetData, setRawSheetData] = useState<FinancialSheetData | null>(null);
  
  // ✅ USAR HOOK DE COMPATIBILIDADE
  const unifiedSheetData = useUnifiedFinancialData(rawSheetData);
  const hasSheetData = !!unifiedSheetData;

  // ✅ CONTAR APENAS PIX INTER (NÃO INTERPAG) NÃO CLASSIFICADAS
  const pixInterCount = complexTransactions.filter(t => {
    // Verificar se é PIX Inter (origem Inter mas NÃO InterPag)
    const isPixInter = (
      t.origem === 'Inter' &&
      !t.descricao_origem?.toLowerCase().includes('inter pag')
    );
    
    // Verificar se não está classificada (múltiplas condições possíveis)
    const isNotClassified = (
      !t.categoria || 
      t.categoria === '' || 
      t.categoria === 'Não Classificado' ||
      t.categoria === 'Nao Classificado' ||
      t.categoria.toLowerCase().includes('não classificad') ||
      t.categoria.toLowerCase().includes('nao classificad') ||
      (!t.subtipo || t.subtipo === '') ||
      (t.realizado !== 's' && t.realizado !== 'r') // Não está executada nem reconciliada
    );
    
    return isPixInter && isNotClassified;
  }).length;

  const allComplexItems = [
    ...complexTransactions.map(t => ({ ...t, type: 'transaction' as const })),
    ...complexCardTransactions.map(c => ({ ...c, type: 'card' as const }))
  ];

  const totalValue = allComplexItems.reduce((sum, item) => sum + Math.abs(item.valor), 0);

  // ===== FUNÇÕES PARA UPLOAD DA PLANILHA =====
  
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(v => v.trim().replace(/^"|"$/g, ''));
  };

  const processFinancialCSV = async (csvText: string): Promise<FinancialSheetData> => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log('📊 Headers encontrados:', headers);
    
    const entries: FinancialEntry[] = [];
    let processedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      if (values.length < 20) continue;
      
      try {
        // ✅ USAR FUNÇÃO SEGURA PARA PROCESSAR DATA
        const rawDate = values[2]?.trim() || ''; // Coluna C
        const parsedDate = parseBrazilianDate(rawDate);
        
        // Processar valor brasileiro da coluna Q (índice 16)
        const rawValue = values[16]?.trim() || '0'; // Coluna Q - Valor final
        const parsedValue = parseBrazilianCurrency(rawValue);
        
        const entry: FinancialEntry = {
          id: values[0]?.trim() || `entry_${i}`,
          idContrato: values[1]?.trim() || '',
          dataHora: parsedDate, // ✅ DATA PROCESSADA COM FUNÇÃO SEGURA
          tipo: values[3]?.trim() || '',
          metodo: values[4]?.trim() || '',
          cc: values[5]?.trim() || '',
          valorFinal: parsedValue, // ✅ USAR CAMPO PADRONIZADO
          idTransacao: values[19]?.trim() || `trans_${i}`, // ✅ CAMPO OBRIGATÓRIO
        };
        
        entries.push(entry);
        processedCount++;
        
        if (processedCount % 100 === 0) {
          const progress = (processedCount / (lines.length - 1)) * 100;
          setProcessingProgress(progress);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
      } catch (error) {
        console.warn('Erro ao processar linha', i, ':', error);
      }
    }
    
    // ✅ CRIAR RESUMO USANDO FUNÇÃO PADRONIZADA
    const summary = createSummaryFromEntries(entries);
    
    console.log('✅ Processamento concluído:', {
      totalEntries: entries.length,
      dateRange: summary.dateRange,
      firstEntry: entries[0],
      lastEntry: entries[entries.length - 1]
    });
    
    return {
      entries,
      summary
    };
  };

  // Função para processar moeda brasileira
  const parseBrazilianCurrency = (valueStr: string): number => {
    if (!valueStr) return 0;
    
    try {
      // Remover símbolos de moeda e espaços
      let cleanStr = valueStr.toString()
        .replace(/R\$|RS/gi, '')
        .replace(/\s+/g, '')
        .trim();
      
      // Se tem ponto E vírgula: formato brasileiro (1.259,00)
      if (cleanStr.includes('.') && cleanStr.includes(',')) {
        // Remover pontos (separadores de milhares) e trocar vírgula por ponto
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      }
      // Se tem apenas vírgula: decimal brasileiro (259,00)
      else if (cleanStr.includes(',') && !cleanStr.includes('.')) {
        cleanStr = cleanStr.replace(',', '.');
      }
      // Se tem apenas pontos: verificar se é decimal ou separador de milhares
      else if (cleanStr.includes('.')) {
        const parts = cleanStr.split('.');
        // Se o último grupo tem 2 dígitos, é decimal (1259.00)
        if (parts[parts.length - 1].length === 2) {
          // Manter como está (formato americano)
        } else {
          // Remover pontos (separadores de milhares: 1.259)
          cleanStr = cleanStr.replace(/\./g, '');
        }
      }
      
      const result = parseFloat(cleanStr) || 0;
      console.log(`💰 Valor convertido: "${valueStr}" → ${result}`);
      return result;
      
    } catch (error) {
      console.warn(`⚠️ Erro ao converter valor: "${valueStr}"`, error);
      return 0;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadStatus('error');
      setStatusMessage('⛔ Por favor, selecione um arquivo CSV');
      return;
    }
    
    setIsUploading(true);
    setUploadStatus('processing');
    setStatusMessage('📊 Lendo arquivo...');
    setProcessingProgress(0);
    
    try {
      const text = await file.text();
      setStatusMessage('📄 Processando dados...');
      
      const data = await processFinancialCSV(text);
      
      setStatusMessage('✅ Dados processados com sucesso!');
      setUploadStatus('success');
      setProcessingProgress(100);
      
      // ✅ ATUALIZAR COM DADOS COMPATÍVEIS
      setRawSheetData(data);
      
      console.log('✅ Upload concluído:', {
        entries: data.entries.length,
        dateRange: data.summary.dateRange,
        totalValue: data.summary.totalValue
      });
      
    } catch (error) {
      console.error('⛔ Erro no upload:', error);
      setUploadStatus('error');
      setStatusMessage('⛔ Erro ao processar arquivo: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemoveFromComplex = async (item: any) => {
    try {
      await onRemoveFromComplex(item.id, item.type);
      alert('✅ Transação removida da Classificação Complexa');
    } catch (error) {
      console.error('⛔ Erro ao remover:', error);
      alert('⛔ Erro ao remover transação');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              🧩 Classificação Complexa
            </h2>
            <p className="text-sm opacity-90 mt-1">
              Ferramentas avançadas para classificação de transações complexas
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-sm opacity-75">PIX Inter Pendentes</p>
            <p className="text-2xl font-bold">{pixInterCount} transações</p>
          </div>
        </div>
      </div>

      {/* 📊 BARRA DISCRETA: Upload da Planilha Financeira */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-gray-400" />
            <div>
              {hasSheetData && unifiedSheetData ? (
                <div>
                  <p className="text-sm text-gray-200 font-medium">📊 Planilha Financeira</p>
                  <p className="text-xs text-gray-400">
                    {unifiedSheetData.summary.totalEntries.toLocaleString()} registros • 
                    Período: {formatDateForDisplay(unifiedSheetData.summary.dateRange.start)} até {formatDateForDisplay(unifiedSheetData.summary.dateRange.end)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-200">📊 Planilha Financeira</p>
                  <p className="text-xs text-gray-400">Nenhuma planilha carregada</p>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-2 ${
              isUploading 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isUploading ? (
              <>
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Upload className="w-3 h-3" />
                <span>{hasSheetData ? 'Atualizar' : 'Carregar'}</span>
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
        </div>

        {/* Status de processamento */}
        {uploadStatus !== 'idle' && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            {uploadStatus === 'processing' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-blue-200">
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                  {statusMessage}
                </div>
                {processingProgress > 0 && (
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-blue-400 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            
            {uploadStatus === 'success' && (
              <div className="flex items-center gap-2 text-xs text-green-300">
                <CheckCircle className="w-3 h-3" />
                {statusMessage}
              </div>
            )}
            
            {uploadStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="w-3 h-3" />
                {statusMessage}
              </div>
            )}
          </div>
        )}
        
        {/* Informações da planilha carregada */}
        {hasSheetData && unifiedSheetData && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-700 rounded p-2 text-center">
                <div className="text-gray-400">Entradas</div>
                <div className="text-white font-bold">{unifiedSheetData.summary.totalEntries}</div>
              </div>
              <div className="bg-gray-700 rounded p-2 text-center">
                <div className="text-gray-400">Valor Total</div>
                <div className="text-white font-bold">R$ {formatCurrency(unifiedSheetData.summary.totalValue)}</div>
              </div>
              <div className="bg-gray-700 rounded p-2 text-center">
                <div className="text-gray-400">Métodos</div>
                <div className="text-white font-bold">{Object.keys(unifiedSheetData.summary.byMethod).length}</div>
              </div>
              <div className="bg-gray-700 rounded p-2 text-center">
                <div className="text-gray-400">Tipos</div>
                <div className="text-white font-bold">{Object.keys(unifiedSheetData.summary.byType).length}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🎯 MINI-APLICAÇÕES - Layout Original */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* 🟣 PIX INTER - Funcional */}
        <button
          onClick={() => setShowPixInterModal(true)}
          className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer relative group"
        >
          <div className="flex flex-col items-center text-center h-full justify-center">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
              🟣
            </div>
            <h3 className="font-bold text-lg mb-2">PIX Inter</h3>
            <p className="text-sm opacity-90 leading-tight">
              Reconciliação cronológica com planilha
            </p>
            <div className="absolute top-2 right-2">
              {hasSheetData ? (
                <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  📊 Pronto
                </span>
              ) : (
                <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  📋 Planilha
                </span>
              )}
            </div>
            {pixInterCount > 0 && (
              <div className="absolute top-2 left-2">
                <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  {pixInterCount}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* 🟠 INTERPAG - Em construção */}
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white p-6 rounded-xl shadow-lg relative opacity-60 cursor-not-allowed">
          <div className="flex flex-col items-center text-center h-full justify-center">
            <div className="text-4xl mb-3">
              🟠
            </div>
            <h3 className="font-bold text-lg mb-2">InterPag</h3>
            <p className="text-sm opacity-90 leading-tight">
              Identificação automática de receitas
            </p>
            <div className="absolute top-2 right-2">
              <span className="bg-yellow-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                🚧 Em breve
              </span>
            </div>
          </div>
        </div>

        {/* 🟢 TON - Em construção */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 text-white p-6 rounded-xl shadow-lg relative opacity-60 cursor-not-allowed">
          <div className="flex flex-col items-center text-center h-full justify-center">
            <div className="text-4xl mb-3">
              🟢
            </div>
            <h3 className="font-bold text-lg mb-2">Ton</h3>
            <p className="text-sm opacity-90 leading-tight">
              Processamento de vendas e taxas
            </p>
            <div className="absolute top-2 right-2">
              <span className="bg-yellow-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                🚧 Em breve
              </span>
            </div>
          </div>
        </div>

        {/* ⚪ LANÇAMENTO MANUAL - Funcional */}
        <button
          onClick={() => setShowManualEntryModal(true)}
          className="bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group"
        >
          <div className="flex flex-col items-center text-center h-full justify-center">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
              ⚪
            </div>
            <h3 className="font-bold text-lg mb-2">Lançamento Manual</h3>
            <p className="text-sm opacity-90 leading-tight">
              Criar transação do zero
            </p>
          </div>
        </button>
      </div>

      {/* ===== MODAIS ===== */}
      
      {/* Modal PIX Inter */}
      <PixInterConciliationModal
        isOpen={showPixInterModal}
        onClose={() => setShowPixInterModal(false)}
        complexTransactions={complexTransactions}
        sheetData={unifiedSheetData} // ✅ PASSA DADOS UNIFICADOS
        onApplyClassification={onApplyBatchClassification}
        onReconcileTransactions={onReconcileTransactions} // ✅ NOVA FUNÇÃO
      />

      {/* Modal Lançamento Manual */}
      <ManualEntryModal
        isOpen={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
      />

      {/* Informações sobre desenvolvimento */}
      <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
        <h4 className="font-medium text-blue-100 mb-2">🚀 Status das Mini-Aplicações</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-200">
          <div>✅ PIX Inter: Reconciliação cronológica com calendário</div>
          <div>✅ Lançamento Manual: Formulário completo</div>
          <div>🚧 InterPag: Identificação automática (em breve)</div>
          <div>🚧 Ton: Processamento de vendas (em breve)</div>
        </div>
        <div className="mt-3 pt-3 border-t border-blue-700">
          <p className="text-xs text-blue-300">
            💡 Use o PIX Inter para reconciliar transações em ordem cronológica. 
            O sistema mostra um calendário linear e exige match perfeito de valores por dia.
          </p>
        </div>
      </div>
    </div>
  );
}