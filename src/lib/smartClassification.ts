// lib/smartClassification.ts - SERVIÇO DE CLASSIFICAÇÃO INTELIGENTE

import { Transaction, FutureTransaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

/**
 * CONFIGURAÇÃO DOS BOTÕES DE AÇÃO RÁPIDA
 * Baseado nas suas categorias mais usadas
 */
export const QUICK_ACTION_CATEGORIES = [
  {
    id: 'supermercados',
    label: '🛒',
    title: 'Supermercados',
    conta: 'PF',
    categoria: 'Contas Necessárias',
    subtipo: 'SUPERMERCADOS',
    color: 'bg-green-600 hover:bg-green-500'
  },
  {
    id: 'restaurantes',
    label: '🍽️',
    title: 'Restaurantes',
    conta: 'PF',
    categoria: 'Contas Supérfluas',
    subtipo: 'RESTAURANTES',
    color: 'bg-orange-600 hover:bg-orange-500'
  },
  {
    id: 'carro_pessoal',
    label: '🚗',
    title: 'Carro Pessoal',
    conta: 'PF',
    categoria: 'Contas Necessárias',
    subtipo: 'CARRO PESSOAL',
    color: 'bg-blue-600 hover:bg-blue-500'
  },
  {
    id: 'carro_rip',
    label: '🚐',
    title: 'Carro RIP',
    conta: 'PJ',
    categoria: 'Custos Operacionais',
    subtipo: 'CARRO RIP',
    color: 'bg-purple-600 hover:bg-purple-500'
  },
  {
    id: 'entrecontas',
    label: '🔄',
    title: 'Entrecontas',
    conta: 'CONC.',
    categoria: 'Entrecontas',
    subtipo: 'ENTRECONTAS',
    color: 'bg-gray-600 hover:bg-gray-500'
  }
] as const;

/**
 * CATEGORIAS BLOQUEADAS PARA SUGESTÕES IA
 * Categorias que são muito específicas e causam erros
 */
const BLOCKED_SUGGESTIONS = [
  // PJ - Receitas (muito específicas)
  { conta: 'PJ', categoria: 'Receita Nova' },
  { conta: 'PJ', categoria: 'Receita Antiga' },
  
  // CONC - Entrecontas (muito específico)
  { conta: 'CONC.', categoria: 'Entrecontas' },
  
  // CONC - Movimentações financeiras (muito específicas)
  { conta: 'CONC.', categoria: 'Mov. Financeira Pessoal' },
  { conta: 'CONC.', categoria: 'Mov. Financeira PJ' },
  
  // CONC - Receitas específicas
  { conta: 'CONC.', categoria: 'Receita Legada PF' },
  { conta: 'CONC.', categoria: 'Receitas Mamu' },
  { conta: 'CONC.', categoria: 'Gastos Mamu' }
] as const;

/**
 * Verifica se uma classificação está na lista de bloqueadas
 */
const isBlockedSuggestion = (conta: string, categoria: string): boolean => {
  return BLOCKED_SUGGESTIONS.some(blocked => 
    blocked.conta === conta && blocked.categoria === categoria
  );
};

/**
 * INTERFACE PARA SUGESTÕES INTELIGENTES
 */
export interface SmartSuggestion {
  conta: string;
  categoria: string;
  subtipo: string;
  confidence: number; // 0-1
  reason: string;
  matchType: 'exact' | 'partial' | 'pattern';
}

/**
 * INTERFACE PARA CLASSIFICAÇÃO EM LOTE
 */
export interface BatchClassificationItem {
  id: string;
  transaction: Transaction | FutureTransaction;
  suggestedClassification?: SmartSuggestion;
  selectedConta?: string;
  selectedCategoria?: string;
  selectedSubtipo?: string;
  selectedDescricao?: string;
}

/**
 * GERAR SUGESTÕES INTELIGENTES baseadas no histórico
 * Analisa até 3 padrões diferentes para maximizar chances de acerto
 */
export const generateSmartSuggestions = (
  transaction: Transaction | FutureTransaction,
  historicTransactions: Transaction[]
): SmartSuggestion[] => {
  const suggestions: SmartSuggestion[] = [];
  const descricao = transaction.descricao_origem?.toLowerCase() || '';
  
  console.log('🤖 Gerando sugestões para:', descricao.substring(0, 30));
  
  // ETAPA 1: Busca exata por descrição
  const exactMatches = historicTransactions.filter(t => 
    t.descricao_origem?.toLowerCase() === descricao &&
    t.categoria && t.subtipo && t.realizado === 's' &&
    !isBlockedSuggestion(t.conta, t.categoria) // ✅ FILTRO ADICIONADO
  );
  
  if (exactMatches.length > 0) {
    const mostRecent = exactMatches[exactMatches.length - 1];
    suggestions.push({
      conta: mostRecent.conta,
      categoria: mostRecent.categoria,
      subtipo: mostRecent.subtipo,
      confidence: 0.95,
      reason: `Match exato: "${mostRecent.descricao_origem}"`,
      matchType: 'exact'
    });
  }
  
  // ETAPA 2: Busca parcial por palavras-chave
  const keywords = extractKeywords(descricao);
  if (keywords.length > 0) {
    const partialMatches = historicTransactions.filter(t => {
      if (!t.categoria || !t.subtipo || t.realizado !== 's') return false;
      if (isBlockedSuggestion(t.conta, t.categoria)) return false; // ✅ FILTRO ADICIONADO
      
      const transactionDesc = t.descricao_origem?.toLowerCase() || '';
      return keywords.some(keyword => 
        transactionDesc.includes(keyword) && keyword.length > 3
      );
    });
    
    if (partialMatches.length > 0) {
      // Agrupar por classificação e pegar a mais comum
      const classificationCounts = new Map<string, { count: number; example: Transaction }>();
      
      partialMatches.forEach(t => {
        const key = `${t.conta}_${t.categoria}_${t.subtipo}`;
        const current = classificationCounts.get(key) || { count: 0, example: t };
        classificationCounts.set(key, { count: current.count + 1, example: t });
      });
      
      const mostCommon = Array.from(classificationCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)[0];
      
      if (mostCommon && !suggestions.find(s => 
        s.conta === mostCommon[1].example.conta && 
        s.categoria === mostCommon[1].example.categoria &&
        s.subtipo === mostCommon[1].example.subtipo
      )) {
        const confidence = Math.min(0.85, 0.5 + (mostCommon[1].count * 0.1));
        suggestions.push({
          conta: mostCommon[1].example.conta,
          categoria: mostCommon[1].example.categoria,
          subtipo: mostCommon[1].example.subtipo,
          confidence,
          reason: `${mostCommon[1].count} transações similares`,
          matchType: 'partial'
        });
      }
    }
  }
  
  // ETAPA 3: Padrões por valor e origem
  const valorRange = Math.abs(transaction.valor);
  const origem = transaction.origem;
  
  const patternMatches = historicTransactions.filter(t => {
    if (!t.categoria || !t.subtipo || t.realizado !== 's') return false;
    if (isBlockedSuggestion(t.conta, t.categoria)) return false; // ✅ FILTRO ADICIONADO
    
    const sameOrigin = t.origem === origem;
    const similarValue = Math.abs(Math.abs(t.valor) - valorRange) < (valorRange * 0.1);
    
    return sameOrigin || similarValue;
  });
  
  if (patternMatches.length > 0) {
    const patternCounts = new Map<string, { count: number; example: Transaction }>();
    
    patternMatches.forEach(t => {
      const key = `${t.conta}_${t.categoria}_${t.subtipo}`;
      const current = patternCounts.get(key) || { count: 0, example: t };
      patternCounts.set(key, { count: current.count + 1, example: t });
    });
    
    const topPattern = Array.from(patternCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)[0];
    
    if (topPattern && !suggestions.find(s => 
      s.conta === topPattern[1].example.conta && 
      s.categoria === topPattern[1].example.categoria &&
      s.subtipo === topPattern[1].example.subtipo
    )) {
      const confidence = Math.min(0.75, 0.3 + (topPattern[1].count * 0.1));
      suggestions.push({
        conta: topPattern[1].example.conta,
        categoria: topPattern[1].example.categoria,
        subtipo: topPattern[1].example.subtipo,
        confidence,
        reason: `Padrão: ${origem} ou valor similar`,
        matchType: 'pattern'
      });
    }
  }
  
  // Retornar no máximo 3 sugestões, ordenadas por confiança
  const finalSuggestions = suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  
  console.log(`💡 ${finalSuggestions.length} sugestões válidas geradas para "${descricao.substring(0, 20)}"`);
  finalSuggestions.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.conta} > ${s.categoria} > ${s.subtipo} (${Math.round(s.confidence * 100)}%) - ${s.reason}`);
  });
  
  return finalSuggestions;
};

/**
 * APLICAR CLASSIFICAÇÃO RÁPIDA
 * Aplica uma das categorias pré-definidas
 */
export const applyQuickClassification = (
  transaction: Transaction | FutureTransaction,
  quickCategoryId: string
): Partial<Transaction | FutureTransaction> => {
  const quickCategory = QUICK_ACTION_CATEGORIES.find(c => c.id === quickCategoryId);
  
  if (!quickCategory) {
    throw new Error('Categoria rápida não encontrada');
  }
  
  return {
    conta: quickCategory.conta,
    categoria: quickCategory.categoria,
    subtipo: quickCategory.subtipo,
    descricao: transaction.descricao_origem || 'Sem descrição',
    realizado: 's' // Marcar como realizado automaticamente
  };
};

/**
 * PREPARAR DADOS PARA CLASSIFICAÇÃO EM LOTE
 */
export const prepareBatchClassification = (
  unclassifiedTransactions: (Transaction | FutureTransaction)[],
  historicTransactions: Transaction[]
): BatchClassificationItem[] => {
  console.log('📊 Preparando classificação em lote para', unclassifiedTransactions.length, 'transações');
  
  return unclassifiedTransactions.map(transaction => {
    const suggestions = generateSmartSuggestions(transaction, historicTransactions);
    const topSuggestion = suggestions[0];
    
    return {
      id: transaction.id,
      transaction,
      suggestedClassification: topSuggestion,
      selectedConta: topSuggestion?.conta,
      selectedCategoria: topSuggestion?.categoria,
      selectedSubtipo: topSuggestion?.subtipo,
      selectedDescricao: transaction.descricao_origem || 'Sem descrição'
    };
  });
};

/**
 * VALIDAR CLASSIFICAÇÃO EM LOTE
 */
export const validateBatchClassification = (items: BatchClassificationItem[]): {
  valid: BatchClassificationItem[];
  invalid: BatchClassificationItem[];
  errors: string[];
} => {
  const valid: BatchClassificationItem[] = [];
  const invalid: BatchClassificationItem[] = [];
  const errors: string[] = [];
  
  items.forEach(item => {
    if (!item.selectedConta || !item.selectedCategoria || !item.selectedSubtipo || !item.selectedDescricao) {
      invalid.push(item);
      errors.push(`Transação ${item.id}: campos obrigatórios não preenchidos`);
    } else {
      valid.push(item);
    }
  });
  
  return { valid, invalid, errors };
};

// ===== FUNÇÕES AUXILIARES =====

/**
 * Extrair palavras-chave relevantes de uma descrição
 */
const extractKeywords = (description: string): string[] => {
  const stopWords = ['de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'os', 'as', 'em', 'no', 'na', 'com', 'por', 'para'];
  
  return description
    .toLowerCase()
    .replace(/[^a-záéíóúâêîôûàèìòùãõç\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5); // Limitar a 5 palavras-chave
};

/**
 * Calcular similaridade entre duas strings
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

/**
 * Calcular distância de Levenshtein
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

export default {
  QUICK_ACTION_CATEGORIES,
  generateSmartSuggestions,
  applyQuickClassification,
  prepareBatchClassification,
  validateBatchClassification
};