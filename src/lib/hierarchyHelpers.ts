// lib/hierarchyHelpers.ts - Helpers para usar hierarquia em transações

import { Transaction, CardTransaction } from '@/types';
import { VisaoPlana } from '@/types/database';

// ===== HELPERS PARA TRANSAÇÕES =====

/**
 * Obtém dados completos da hierarquia de uma transação
 */
export function getTransactionHierarchy(
  transaction: Transaction, 
  visaoPlana: VisaoPlana[]
): VisaoPlana | null {
  // Sistema novo apenas - subtipo_id
  if (transaction.subtipo_id) {
    return visaoPlana.find(item => item.subtipo_id === transaction.subtipo_id) || null;
  }
  
  return null;
}

/**
 * Obtém o ícone da transação baseado na hierarquia
 */
export function getTransactionIcon(
  transaction: Transaction,
  visaoPlana: VisaoPlana[]
): string | null {
  const hierarchy = getTransactionHierarchy(transaction, visaoPlana);
  return hierarchy?.subtipo_icone || hierarchy?.categoria_icone || hierarchy?.conta_icone || null;
}

/**
 * Obtém o caminho completo da classificação
 */
export function getTransactionPath(
  transaction: Transaction,
  visaoPlana: VisaoPlana[]
): string {
  const hierarchy = getTransactionHierarchy(transaction, visaoPlana);
  
  if (hierarchy?.caminho_completo) {
    return hierarchy.caminho_completo;
  }
  
  // Se não tem hierarquia, retorna caminho padrão
  return 'Não classificado';
}

/**
 * Verifica se transação está usando novo sistema
 */
export function isUsingNewHierarchy(transaction: Transaction): boolean {
  return !!transaction.subtipo_id;
}

/**
 * Encontra subtipo_id baseado nos campos legados (DEPRECATED - manter apenas para migração)
 */
export function findSubtipoIdFromLegacy(
  transaction: any,
  visaoPlana: VisaoPlana[]
): string | null {
  // Esta função está deprecated pois não existem mais campos legados
  // Retorna null sempre
  return null;
}

// ===== HELPERS PARA COMPONENTES =====

/**
 * Prepara dados para dropdown de classificação
 */
export function prepareClassificationOptions(
  visaoPlana: VisaoPlana[],
  contaFiltro?: string
): Array<{ value: string; label: string; conta: string }> {
  let items = visaoPlana;
  
  // Filtrar por conta se especificado
  if (contaFiltro) {
    items = items.filter(item => item.conta_codigo === contaFiltro);
  }
  
  return items.map(item => ({
    value: item.subtipo_id,
    label: item.caminho_completo,
    conta: item.conta_codigo
  })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Agrupa opções por conta para dropdown hierárquico
 */
export function groupClassificationByAccount(
  visaoPlana: VisaoPlana[]
): Record<string, Array<{ value: string; label: string }>> {
  const groups: Record<string, Array<{ value: string; label: string }>> = {};
  
  visaoPlana.forEach(item => {
    if (!groups[item.conta_nome]) {
      groups[item.conta_nome] = [];
    }
    
    groups[item.conta_nome].push({
      value: item.subtipo_id,
      label: `${item.categoria_nome} > ${item.subtipo_nome}`
    });
  });
  
  // Ordenar dentro de cada grupo
  Object.keys(groups).forEach(conta => {
    groups[conta].sort((a, b) => a.label.localeCompare(b.label));
  });
  
  return groups;
}

// ===== HELPERS PARA CARD TRANSACTIONS =====

/**
 * Determina a conta baseada na origem do cartão
 */
export function determineAccountFromCardOrigin(origem: string): string {
  // TODO: Migrar para usar hierarquia dinâmica
  /* const origemMap: Record<string, string> = {
    // Requer migração para estrutura hierárquica dinâmica
  }; */
  
  return 'OUTRAS'; // Fallback temporário
}

/**
 * Obtém dados completos da hierarquia de uma card transaction
 */
export function getCardTransactionHierarchy(
  cardTransaction: CardTransaction, 
  visaoPlana: VisaoPlana[]
): VisaoPlana | null {
  // Se tem subtipo_id (novo sistema), usa ele
  if (cardTransaction.subtipo_id) {
    return visaoPlana.find(item => item.subtipo_id === cardTransaction.subtipo_id) || null;
  }
  
  // Se não tem subtipo_id, não há classificação
  return null;
}

/**
 * Obtém o ícone da card transaction baseado na hierarquia
 */
export function getCardTransactionIcon(
  cardTransaction: CardTransaction,
  visaoPlana: VisaoPlana[]
): string | null {
  const hierarchy = getCardTransactionHierarchy(cardTransaction, visaoPlana);
  // TODO: Definir campos corretos dos ícones na VisaoPlana
  return null; // Temporário até definir campos de ícones
}

/**
 * Obtém o caminho completo da classificação da card transaction
 */
export function getCardTransactionPath(
  cardTransaction: CardTransaction,
  visaoPlana: VisaoPlana[]
): string {
  const hierarchy = getCardTransactionHierarchy(cardTransaction, visaoPlana);
  
  if (hierarchy?.caminho_completo) {
    return hierarchy.caminho_completo;
  }
  
  // Fallback para campos legados
  const conta = determineAccountFromCardOrigin(cardTransaction.origem);
  // Se não tem hierarquia, retorna caminho padrão
  return 'Não classificado';
}


/**
 * Atualiza card transaction com novo subtipo_id
 */
export function upgradeCardTransactionToNewHierarchy(
  cardTransaction: CardTransaction,
  visaoPlana: VisaoPlana[]
): CardTransaction {
  if (cardTransaction.subtipo_id) {
    return cardTransaction; // Já está no novo sistema
  }
  
  const subtipo_id = null; // Não há mais campos legados
  
  return {
    ...cardTransaction,
    subtipo_id: subtipo_id || null
  };
}

// ===== HELPERS PARA MIGRAÇÃO =====

/**
 * Atualiza transação com novo subtipo_id
 */
export function upgradeTransactionToNewHierarchy(
  transaction: Transaction,
  visaoPlana: VisaoPlana[]
): Transaction {
  if (transaction.subtipo_id) {
    return transaction; // Já está no novo sistema
  }
  
  const subtipo_id = findSubtipoIdFromLegacy(transaction, visaoPlana);
  
  return {
    ...transaction,
    subtipo_id: subtipo_id || null
  };
}

/**
 * Valida se todos os campos de classificação estão consistentes
 */
export function validateTransactionClassification(
  transaction: Transaction,
  visaoPlana: VisaoPlana[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Se tem subtipo_id, valida se existe
  if (transaction.subtipo_id) {
    const found = visaoPlana.find(item => item.subtipo_id === transaction.subtipo_id);
    if (!found) {
      issues.push('subtipo_id não encontrado na hierarquia');
    }
  }
  
  // Validação do novo sistema apenas
  if (!transaction.subtipo_id) {
    issues.push('subtipo_id obrigatório não informado');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}