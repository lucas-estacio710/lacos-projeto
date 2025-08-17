// lib/smartClassification.ts - SISTEMA COMPLETO COM TODAS AS EXPORTAÇÕES

import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

/**
 * INTERFACE PARA SUGESTÃO INTELIGENTE
 */
export interface SmartSuggestion {
  conta: string;
  categoria: string;
  subtipo: string;
  descricao: string;
  confidence: number; // 0-1
  reason: string;
  sourceType: 'historic' | 'pattern' | 'keyword';
}

/**
 * CONFIGURAÇÃO DOS BOTÕES DE AÇÃO RÁPIDA
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
    label: '🚚',
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
 * INTERFACE PARA ITEM DO HISTÓRICO SIMILAR
 */
export interface HistoricItem {
  id: string;
  type: 'transaction' | 'card';
  descricao_origem: string;
  conta: string;
  categoria: string;
  subtipo: string;
  descricao: string; // Descrição classificada
  similarity: number; // 0-1
  data: string;
  valor: number;
  origem: string;
}

/**
 * INTERFACE PARA CLASSIFICAÇÃO EM LOTE
 */
export interface BatchClassificationItem {
  id: string;
  transaction: Transaction | CardTransaction;
  historicSimilar: HistoricItem[];
  selectedConta?: string;
  selectedCategoria?: string;
  selectedSubtipo?: string;
  selectedDescricao?: string;
}

/**
 * PALAVRAS-CHAVE PARA CLASSIFICAÇÃO AUTOMÁTICA
 */
const KEYWORD_PATTERNS = [
  // Supermercados
  {
    keywords: ['mercado', 'supermercado', 'mart', 'atacadao', 'assai', 'carrefour', 'pao de acucar'],
    classification: { conta: 'PF', categoria: 'Contas Necessárias', subtipo: 'SUPERMERCADOS' },
    confidence: 0.9
  },
  // Postos de combustível
  {
    keywords: ['posto', 'shell', 'petrobras', 'ipiranga', 'br distribuidora', 'combustivel'],
    classification: { conta: 'PF', categoria: 'Contas Necessárias', subtipo: 'CARRO PESSOAL' },
    confidence: 0.85
  },
  // Restaurantes
  {
    keywords: ['restaurante', 'lanchonete', 'pizzaria', 'mcdonald', 'burguer', 'ifood', 'uber eats'],
    classification: { conta: 'PF', categoria: 'Contas Supérfluas', subtipo: 'RESTAURANTES' },
    confidence: 0.8
  },
  // Farmácias
  {
    keywords: ['farmacia', 'drogaria', 'drogasil', 'pacheco', 'raia', 'extrafarma'],
    classification: { conta: 'PF', categoria: 'Contas Necessárias', subtipo: 'FARMÁCIAS' },
    confidence: 0.9
  },
  // PIX e transferências
  {
    keywords: ['pix', 'transferencia', 'ted', 'doc'],
    classification: { conta: 'CONC.', categoria: 'Entrecontas', subtipo: 'ENTRECONTAS' },
    confidence: 0.7
  }
];

/**
 * CALCULAR SIMILARIDADE ENTRE DUAS STRINGS
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Match exato
  if (s1 === s2) return 1.0;
  
  // Calcular distância de Levenshtein normalizada
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  if (maxLength === 0) return 1.0;
  
  return 1 - (distance / maxLength);
};

/**
 * DISTÂNCIA DE LEVENSHTEIN
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

/**
 * GERAR SUGESTÕES INTELIGENTES
 */
export const generateSmartSuggestions = (
  transaction: Transaction | CardTransaction,
  historicTransactions: Transaction[],
  historicCardTransactions: CardTransaction[] = []
): SmartSuggestion[] => {
  const suggestions: SmartSuggestion[] = [];
  const targetDescription = transaction.descricao_origem?.toLowerCase().trim() || '';
  
  if (!targetDescription) return [];
  
  // 1. SUGESTÕES BASEADAS EM PALAVRAS-CHAVE
  for (const pattern of KEYWORD_PATTERNS) {
    const matchedKeyword = pattern.keywords.find(keyword => 
      targetDescription.includes(keyword.toLowerCase())
    );
    
    if (matchedKeyword) {
      suggestions.push({
        conta: pattern.classification.conta,
        categoria: pattern.classification.categoria,
        subtipo: pattern.classification.subtipo,
        descricao: transaction.descricao_origem || 'Classificação automática',
        confidence: pattern.confidence,
        reason: `Palavra-chave detectada: "${matchedKeyword}"`,
        sourceType: 'keyword'
      });
    }
  }
  
  // 2. SUGESTÕES BASEADAS NO HISTÓRICO
  const historicSimilar = findSimilarHistoric(transaction, historicTransactions, historicCardTransactions);
  
  for (const historic of historicSimilar.slice(0, 3)) { // Top 3 históricos
    if (historic.similarity > 0.6) {
      suggestions.push({
        conta: historic.conta,
        categoria: historic.categoria,
        subtipo: historic.subtipo,
        descricao: historic.descricao,
        confidence: historic.similarity,
        reason: `Baseado em transação similar (${Math.round(historic.similarity * 100)}% compatível)`,
        sourceType: 'historic'
      });
    }
  }
  
  // 3. SUGESTÕES BASEADAS EM PADRÕES DE VALOR
  const valor = Math.abs(transaction.valor);
  
  if (valor < 10) {
    suggestions.push({
      conta: 'PF',
      categoria: 'Contas Supérfluas',
      subtipo: 'OUTROS LAZER',
      descricao: 'Pequena despesa',
      confidence: 0.5,
      reason: 'Valor baixo (< R$ 10) sugere despesa supérflua',
      sourceType: 'pattern'
    });
  } else if (valor > 1000) {
    suggestions.push({
      conta: 'PF',
      categoria: 'Aquisições',
      subtipo: 'AQUISIÇÕES PESSOAIS',
      descricao: 'Grande aquisição',
      confidence: 0.6,
      reason: 'Valor alto (> R$ 1000) sugere aquisição importante',
      sourceType: 'pattern'
    });
  }
  
  // Remover duplicatas e ordenar por confiança
  const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
    index === self.findIndex(s => 
      s.conta === suggestion.conta && 
      s.categoria === suggestion.categoria && 
      s.subtipo === suggestion.subtipo
    )
  );
  
  return uniqueSuggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5); // Máximo 5 sugestões
};

/**
 * BUSCAR ITENS SIMILARES NO HISTÓRICO
 */
export const findSimilarHistoric = (
  transaction: Transaction | CardTransaction,
  historicTransactions: Transaction[],
  historicCardTransactions: CardTransaction[] = []
): HistoricItem[] => {
  const targetDescription = transaction.descricao_origem?.toLowerCase().trim() || '';
  
  if (!targetDescription) return [];
  
  const allHistoric: HistoricItem[] = [];
  
  // Processar transações bancárias
  historicTransactions
    .filter(t => t.realizado === 's' && t.categoria && t.subtipo && t.descricao)
    .forEach(t => {
      const similarity = calculateSimilarity(targetDescription, t.descricao_origem || '');
      
      if (similarity > 0.3) { // Filtro mínimo de 30% similaridade
        allHistoric.push({
          id: t.id,
          type: 'transaction',
          descricao_origem: t.descricao_origem || '',
          conta: t.conta,
          categoria: t.categoria,
          subtipo: t.subtipo,
          descricao: t.descricao,
          similarity,
          data: t.data,
          valor: t.valor,
          origem: t.origem
        });
      }
    });
  
  // Processar transações de cartão
  historicCardTransactions
    .filter(c => c.status === 'classified' && c.categoria && c.subtipo && c.descricao_classificada)
    .forEach(c => {
      const similarity = calculateSimilarity(targetDescription, c.descricao_origem || '');
      
      if (similarity > 0.3) {
        // Determinar conta baseada na categoria
        let conta = 'PF';
        if (Object.keys(categoriesPJ).includes(c.categoria || '')) conta = 'PJ';
        else if (Object.keys(categoriesCONC).includes(c.categoria || '')) conta = 'CONC.';
        
        allHistoric.push({
          id: c.id,
          type: 'card',
          descricao_origem: c.descricao_origem,
          conta: conta,
          categoria: c.categoria || '',
          subtipo: c.subtipo || '',
          descricao: c.descricao_classificada || '',
          similarity,
          data: c.data_transacao,
          valor: c.valor,
          origem: c.origem
        });
      }
    });
  
  // Ordenar por similaridade (maior primeiro) e pegar os top 8
  return allHistoric
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
};

/**
 * APLICAR CLASSIFICAÇÃO RÁPIDA
 */
export const applyQuickClassification = (
  transaction: Transaction | CardTransaction,
  quickCategoryId: string
): any => {
  const quickCategory = QUICK_ACTION_CATEGORIES.find(c => c.id === quickCategoryId);
  
  if (!quickCategory) {
    throw new Error('Categoria rápida não encontrada');
  }
  
  return {
    conta: quickCategory.conta,
    categoria: quickCategory.categoria,
    subtipo: quickCategory.subtipo,
    descricao: transaction.descricao_origem || 'Sem descrição',
    realizado: 's'
  };
};

/**
 * PREPARAR DADOS PARA CLASSIFICAÇÃO EM LOTE
 */
export const prepareBatchClassification = (
  unclassifiedTransactions: (Transaction | CardTransaction)[],
  historicTransactions: Transaction[],
  historicCardTransactions: CardTransaction[] = []
): BatchClassificationItem[] => {
  console.log('📊 Preparando classificação em lote para', unclassifiedTransactions.length, 'transações');
  
  return unclassifiedTransactions.map(transaction => {
    const similarItems = findSimilarHistoric(transaction, historicTransactions, historicCardTransactions);
    const topMatch = similarItems[0]; // Melhor match
    
    return {
      id: transaction.id,
      transaction,
      historicSimilar: similarItems,
      selectedConta: topMatch?.conta || '',
      selectedCategoria: topMatch?.categoria || '',
      selectedSubtipo: topMatch?.subtipo || '',
      selectedDescricao: topMatch?.descricao || transaction.descricao_origem || 'Sem descrição'
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
  
  items.forEach((item, index) => {
    const hasAnyField = item.selectedConta || item.selectedCategoria || item.selectedSubtipo;
    const hasAllRequiredFields = item.selectedConta && item.selectedCategoria && item.selectedSubtipo && item.selectedDescricao;
    
    if (!hasAnyField || hasAllRequiredFields) {
      valid.push(item);
    } else {
      invalid.push(item);
      errors.push(`Transação ${index + 1}: Preencha todos os campos ou deixe todos vazios`);
    }
  });
  
  return { valid, invalid, errors };
};

// Exportação default
export default {
  QUICK_ACTION_CATEGORIES,
  generateSmartSuggestions,
  findSimilarHistoric,
  applyQuickClassification,
  prepareBatchClassification,
  validateBatchClassification
};