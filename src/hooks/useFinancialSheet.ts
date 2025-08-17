// hooks/useFinancialSheet.ts - HOOK PARA GERENCIAR PLANILHA FINANCEIRA

import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';

// Interfaces (reutilizando do componente anterior)
export interface FinancialEntry {
  id: string;
  idContrato: string;
  dataHora: string;
  tipo: string;
  metodo: string;
  cc: string;
  valor: number;
  flagD: string;
  desconto: number;
  descontoPercent: number;
  descontoReal: number;
  valorComDesconto: number;
  flagT: string;
  taxa: number;
  taxaPercent: number;
  taxaReal: number;
  valorFinal: number;
  mesCompetencia: string;
  parcelamento: string;
  idTransacao: string;
}

export interface FinancialSheetData {
  entries: FinancialEntry[];
  lastUpdate: string;
  totalEntries: number;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalValue: number;
    totalDiscount: number;
    totalTax: number;
    netValue: number;
    byMethod: Record<string, number>;
    byType: Record<string, number>;
  };
}

// Interface para sugestão de matching
export interface FinancialMatch {
  entry: FinancialEntry;
  confidence: number; // 0-1
  matchType: 'exact_value' | 'similar_value' | 'date_value' | 'method_match';
  reason: string;
  suggestedClassification: {
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  };
}

export function useFinancialSheet() {
  const [sheetData, setSheetData] = useState<FinancialSheetData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Carregar dados salvos na inicialização
  useEffect(() => {
    const savedData = localStorage.getItem('financial-sheet-data');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setSheetData(data);
        console.log('📊 Planilha financeira carregada:', data.totalEntries, 'registros');
      } catch (error) {
        console.warn('Erro ao carregar planilha salva:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  // Função para atualizar dados da planilha
  const updateSheetData = useCallback((data: FinancialSheetData) => {
    setSheetData(data);
    localStorage.setItem('financial-sheet-data', JSON.stringify(data));
    console.log('✅ Planilha financeira atualizada:', data.totalEntries, 'registros');
  }, []);

  // Função para limpar dados
  const clearSheetData = useCallback(() => {
    setSheetData(null);
    localStorage.removeItem('financial-sheet-data');
    console.log('🗑️ Planilha financeira removida');
  }, []);

  // FUNÇÃO PRINCIPAL: Buscar matches para uma transação
  const findMatches = useCallback((
    transaction: Transaction | CardTransaction
  ): FinancialMatch[] => {
    if (!sheetData || !sheetData.entries.length) return [];

    const matches: FinancialMatch[] = [];
    const transactionValue = Math.abs(transaction.valor);
    const transactionDate = getTransactionDate(transaction);

    console.log('🔍 Buscando matches para:', {
      valor: transactionValue,
      data: transactionDate,
      descricao: transaction.descricao_origem
    });

    sheetData.entries.forEach(entry => {
      const entryValue = Math.abs(entry.valorFinal);
      const entryDate = new Date(entry.dataHora);
      
      // 1. MATCH EXATO POR VALOR
      if (Math.abs(entryValue - transactionValue) < 0.01) {
        matches.push({
          entry,
          confidence: 0.95,
          matchType: 'exact_value',
          reason: `Valor exato: R$ ${entryValue.toFixed(2)}`,
          suggestedClassification: classifyFromEntry(entry)
        });
      }
      
      // 2. MATCH SIMILAR POR VALOR (±5%)
      else if (Math.abs(entryValue - transactionValue) / transactionValue <= 0.05) {
        const confidence = 1 - (Math.abs(entryValue - transactionValue) / transactionValue);
        matches.push({
          entry,
          confidence: confidence * 0.8, // Reduzir confiança para matches similares
          matchType: 'similar_value',
          reason: `Valor similar: R$ ${entryValue.toFixed(2)} (diferença: ${Math.abs(entryValue - transactionValue).toFixed(2)})`,
          suggestedClassification: classifyFromEntry(entry)
        });
      }

      // 3. MATCH POR DATA + VALOR PRÓXIMO (±10%) se mesmo dia
      if (transactionDate && isSameDay(entryDate, transactionDate)) {
        if (Math.abs(entryValue - transactionValue) / transactionValue <= 0.10) {
          const valueConfidence = 1 - (Math.abs(entryValue - transactionValue) / transactionValue);
          matches.push({
            entry,
            confidence: valueConfidence * 0.85,
            matchType: 'date_value',
            reason: `Mesma data + valor próximo: ${entryDate.toLocaleDateString('pt-BR')}`,
            suggestedClassification: classifyFromEntry(entry)
          });
        }
      }

      // 4. MATCH POR MÉTODO DE PAGAMENTO + VALOR
      if (matchesPaymentMethod(transaction, entry) && 
          Math.abs(entryValue - transactionValue) / transactionValue <= 0.15) {
        const confidence = 1 - (Math.abs(entryValue - transactionValue) / transactionValue);
        matches.push({
          entry,
          confidence: confidence * 0.7,
          matchType: 'method_match',
          reason: `Método: ${entry.metodo} + valor compatível`,
          suggestedClassification: classifyFromEntry(entry)
        });
      }
    });

    // Remover duplicatas e ordenar por confiança
    const uniqueMatches = matches.filter((match, index, self) => 
      index === self.findIndex(m => m.entry.id === match.entry.id)
    );

    const sortedMatches = uniqueMatches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5 matches

    console.log('🎯 Encontrados', sortedMatches.length, 'matches');
    
    return sortedMatches;
  }, [sheetData]);

  // FUNÇÃO: Buscar todas as transações não matcheadas
  const findUnmatchedTransactions = useCallback((
    transactions: (Transaction | CardTransaction)[]
  ): (Transaction | CardTransaction)[] => {
    if (!sheetData) return transactions;

    return transactions.filter(transaction => {
      const matches = findMatches(transaction);
      return matches.length === 0 || matches[0].confidence < 0.8;
    });
  }, [sheetData, findMatches]);

  // FUNÇÃO: Estatísticas de matching
  const getMatchingStats = useCallback((
    transactions: (Transaction | CardTransaction)[]
  ) => {
    if (!sheetData) return { matched: 0, unmatched: transactions.length, confidence: 0 };

    let matched = 0;
    let totalConfidence = 0;

    transactions.forEach(transaction => {
      const matches = findMatches(transaction);
      if (matches.length > 0 && matches[0].confidence >= 0.8) {
        matched++;
        totalConfidence += matches[0].confidence;
      }
    });

    return {
      matched,
      unmatched: transactions.length - matched,
      confidence: matched > 0 ? totalConfidence / matched : 0
    };
  }, [sheetData, findMatches]);

  // HELPER: Extrair data da transação com validação segura
  const getTransactionDate = (transaction: Transaction | CardTransaction): Date | null => {
    try {
      let dateStr: string = '';
      
      // Verificar se é CardTransaction ou Transaction
      if ('data_transacao' in transaction) {
        // É CardTransaction - usar data_transacao
        dateStr = transaction.data_transacao || '';
      } else {
        // É Transaction - usar data
        dateStr = transaction.data || '';
      }
      
      if (!dateStr || dateStr === '' || dateStr === 'undefined') return null;
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      
      return date;
    } catch {
      return null;
    }
  };

  // HELPER: Verificar se é o mesmo dia
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // HELPER: Verificar match de método de pagamento
  const matchesPaymentMethod = (
    transaction: Transaction | CardTransaction, 
    entry: FinancialEntry
  ): boolean => {
    const transactionCC = transaction.cc?.toLowerCase() || '';
    const entryMethod = entry.metodo?.toLowerCase() || '';
    const entryCC = entry.cc?.toLowerCase() || '';

    // Matches diretos
    if (transactionCC.includes(entryMethod) || entryMethod.includes(transactionCC)) return true;
    if (transactionCC.includes(entryCC) || entryCC.includes(transactionCC)) return true;

    // Matches por mapeamento
    const methodMap: Record<string, string[]> = {
      'pix': ['pix', 'inter', 'bb', 'santander'],
      'cartao': ['visa', 'mastercard', 'elo'],
      'stone': ['stone', 'ton'],
      'inter': ['inter', 'pix'],
      'bb': ['bb', 'banco do brasil'],
      'santander': ['santander']
    };

    for (const [method, aliases] of Object.entries(methodMap)) {
      if (aliases.some(alias => 
        transactionCC.includes(alias) && entryMethod.includes(method)
      )) {
        return true;
      }
    }

    return false;
  };

  // HELPER: Classificar baseado na entrada da planilha
  const classifyFromEntry = (entry: FinancialEntry) => {
    // Lógica de classificação baseada nos dados da planilha
    let conta = 'PJ'; // Default para empresa
    let categoria = 'Receita Nova';
    let subtipo = 'REC. N. C. COL.';
    
    // Personalizar baseado no tipo e método
    if (entry.tipo.toLowerCase().includes('receita')) {
      categoria = entry.metodo === 'PIX' ? 'Receita Nova' : 'Receita Antiga';
      
      if (entry.metodo === 'PIX') {
        subtipo = entry.parcelamento === 'Avista' ? 'REC. N. P. IND.' : 'REC. N. P. COL.';
      } else {
        subtipo = entry.parcelamento === 'Avista' ? 'REC. A. C. IND.' : 'REC. A. C. COL.';
      }
    }

    return {
      conta,
      categoria,
      subtipo,
      descricao: `${entry.tipo} - ${entry.metodo} - Contrato ${entry.idContrato}`
    };
  };

  return {
    // Estado
    sheetData,
    isLoaded,
    hasData: !!sheetData,
    
    // Funções de gerenciamento
    updateSheetData,
    clearSheetData,
    
    // Funções de matching
    findMatches,
    findUnmatchedTransactions,
    getMatchingStats,
    
    // Estatísticas
    stats: sheetData ? {
      totalEntries: sheetData.totalEntries,
      dateRange: sheetData.dateRange,
      lastUpdate: sheetData.lastUpdate,
      summary: sheetData.summary
    } : null
  };
}