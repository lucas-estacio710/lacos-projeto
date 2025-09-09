// lib/smartClassification.ts - SISTEMA COMPLETO COM TODAS AS EXPORTAÇÕES

import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { DatabaseConta as Conta, DatabaseCategoria as Categoria, DatabaseSubtipo as Subtipo } from '@/types/database';

// Note: Using proper database types instead of local interfaces

// ✅ FUNÇÃO HELPER para converter legado para subtipo_id
export const findSubtipoIdByNames = (
  contaCodigo: string, 
  categoriaNome: string, 
  subtipoNome: string,
  contas: Conta[],
  categorias: Categoria[], 
  subtipos: Subtipo[]
): string | null => {
  const conta = contas.find(c => c.codigo === contaCodigo);
  if (!conta) return null;
  
  const categoria = categorias.find(c => c.conta_id === conta.id && c.nome === categoriaNome);
  if (!categoria) return null;
  
  const subtipo = subtipos.find(s => s.categoria_id === categoria.id && s.nome === subtipoNome);
  return subtipo?.id || null;
};

/**
 * INTERFACE PARA SUGESTÃO INTELIGENTE
 */
export interface SmartSuggestion {
  // ✅ NOVA HIERARQUIA - usar subtipo_id
  subtipo_id: string;
  // Legacy fields para compatibilidade
  conta?: string;
  categoria?: string;
  subtipo?: string;
  descricao: string;
  confidence: number; // 0-1
  reason: string;
  sourceType: 'historic' | 'pattern' | 'keyword';
}

/**
 * OBTER BOTÕES DE AÇÃO RÁPIDA DINAMICAMENTE
 */
export const getQuickActionCategories = (
  contas: Conta[],
  categorias: Categoria[],
  subtipos: Subtipo[]
) => {
  return subtipos
    .filter(subtipo => subtipo.categoria_rapida)
    .map(subtipo => {
      const categoria = categorias.find(c => c.id === subtipo.categoria_id);
      const conta = categoria ? contas.find(c => c.id === categoria.conta_id) : null;
      
      // Definir cor baseada no subtipo ou usar padrão
      let color = 'bg-gray-600 hover:bg-gray-500'; // Padrão
      
      if (subtipo.cor_botao) {
        color = subtipo.cor_botao;
      } else {
        // Cores padrão baseadas no código do subtipo
        switch (subtipo.codigo) {
          case 'CARRO_PESSOAL':
            color = 'bg-blue-600 hover:bg-blue-700';
            break;
          case 'CARRO_RIP':
            color = 'bg-red-600 hover:bg-red-700';
            break;
          case 'RESTAURANTES':
            color = 'bg-orange-600 hover:bg-orange-700';
            break;
          case 'SUPERMERCADOS':
            color = 'bg-green-600 hover:bg-green-700';
            break;
          case 'FARMACIAS':
            color = 'bg-purple-600 hover:bg-purple-700';
            break;
          case 'ENTRECONTAS':
            color = 'bg-yellow-600 hover:bg-yellow-700';
            break;
          default:
            color = 'bg-gray-600 hover:bg-gray-500';
        }
      }
      
      return {
        id: subtipo.id,
        label: subtipo.icone || '📁', // Usar ícone da tabela ou padrão
        title: subtipo.nome,
        subtipo_id: subtipo.id,
        conta_codigo: conta?.codigo || '',
        categoria_nome: categoria?.nome || '',
        subtipo_nome: subtipo.nome,
        color: color,
        ordem_exibicao: subtipo.ordem_exibicao || 999
      };
    })
    .sort((a, b) => a.ordem_exibicao - b.ordem_exibicao); // Ordenar pela ordem_exibicao ao invés de alfabética
};

/**
 * INTERFACE PARA ITEM DO HISTÓRICO SIMILAR
 */
export interface HistoricItem {
  id: string;
  type: 'transaction' | 'card';
  descricao_origem: string;
  subtipo_id: string;
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
  selectedSubtipoId?: string;
  selectedDescricao?: string;
  
  // 🚨 DEPRECATED: Campos temporários para compatibilidade durante migração
  // TODO: Remover após migração completa do BatchClassificationModal
  selectedConta?: string;
  selectedCategoria?: string;
  selectedSubtipo?: string;
}

/**
 * PALAVRAS-CHAVE PARA CLASSIFICAÇÃO AUTOMÁTICA
 * TODO: Migrar para usar hierarquia dinâmica
 */
/* const KEYWORD_PATTERNS = [
  // Requer migração para estrutura hierárquica dinâmica
]; */

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
  
  // 1. SUGESTÕES BASEADAS EM PALAVRAS-CHAVE - DESABILITADO
  // TODO: Migrar para usar hierarquia dinâmica
  
  // 2. SUGESTÕES BASEADAS NO HISTÓRICO
  const historicSimilar = findSimilarHistoric(transaction, historicTransactions, historicCardTransactions);
  
  for (const historic of historicSimilar.slice(0, 3)) { // Top 3 históricos
    if (historic.similarity > 0.6) {
      suggestions.push({
        subtipo_id: historic.subtipo_id,
        descricao: historic.descricao,
        confidence: historic.similarity,
        reason: `Baseado em transação similar (${Math.round(historic.similarity * 100)}% compatível)`,
        sourceType: 'historic'
      });
    }
  }
  
  // 3. SUGESTÕES BASEADAS EM PADRÕES DE VALOR
  const valor = Math.abs(transaction.valor);
  
  // 3. SUGESTÕES BASEADAS EM PADRÕES DE VALOR - DESABILITADO
  // TODO: Migrar para usar hierarquia dinâmica
  
  // Remover duplicatas e ordenar por confiança
  const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
    index === self.findIndex(s => 
      s.subtipo_id === suggestion.subtipo_id
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
    .filter(t => t.realizado === 's' && t.subtipo_id && t.descricao)
    .forEach(t => {
      const similarity = calculateSimilarity(targetDescription, t.descricao_origem || '');
      
      if (similarity > 0.3) { // Filtro mínimo de 30% similaridade
        allHistoric.push({
          id: t.id,
          type: 'transaction',
          descricao_origem: t.descricao_origem || '',
          subtipo_id: t.subtipo_id || '',
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
    .filter(c => c.status === 'classified' && c.subtipo_id && c.descricao_classificada)
    .forEach(c => {
      const similarity = calculateSimilarity(targetDescription, c.descricao_origem || '');
      
      if (similarity > 0.3) {
        allHistoric.push({
          id: c.id,
          type: 'card',
          descricao_origem: c.descricao_origem,
          subtipo_id: c.subtipo_id || '',
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
 * APLICAR CLASSIFICAÇÃO RÁPIDA DINAMICAMENTE
 */
export const applyQuickClassification = (
  transaction: Transaction | CardTransaction,
  subtipoId: string
): any => {
  return {
    subtipo_id: subtipoId,
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
      selectedConta: '', // TODO: Resolve conta from subtipo_id if needed
      selectedCategoria: '', // TODO: Resolve categoria from subtipo_id if needed  
      selectedSubtipo: '', // TODO: Resolve subtipo name from subtipo_id if needed
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
  getQuickActionCategories,
  generateSmartSuggestions,
  findSimilarHistoric,
  applyQuickClassification,
  prepareBatchClassification,
  validateBatchClassification
};