// lib/undoTypes.ts - Tipos e Utilitários para Sistema de Desfazer

import { Transaction, FutureTransaction } from '@/types';

// Tipos de operações que podem ser desfeitas
export type UndoableOperationType = 
  | 'UPDATE_TRANSACTION' 
  | 'UPDATE_FUTURE' 
  | 'DELETE_TRANSACTION' 
  | 'QUICK_CLASSIFY';

// Estado anterior para transações normais
export interface TransactionPreviousState {
  id: string;
  conta: string;
  categoria: string;
  subtipo: string;
  descricao: string;
  realizado: string;
  // Campos que podem ter sido alterados
  [key: string]: any;
}

// Estado anterior para transações futuras
export interface FutureTransactionPreviousState {
  id: string;
  categoria: string;
  subtipo: string;
  descricao: string;
  status: 'projected' | 'confirmed' | 'paid';
  // Campos que podem ter sido alterados
  [key: string]: any;
}

// Interface para ação de undo específica
export interface UndoActionDetails {
  type: UndoableOperationType;
  targetId: string;
  tableName: 'transactions' | 'future_transactions';
  previousState: TransactionPreviousState | FutureTransactionPreviousState;
  description: string;
}

// Mapeamento de tipos de operação para descrições legíveis
export const OPERATION_DESCRIPTIONS: Record<UndoableOperationType, string> = {
  'UPDATE_TRANSACTION': 'Edição de transação',
  'UPDATE_FUTURE': 'Edição de cartão',
  'DELETE_TRANSACTION': 'Exclusão de transação',
  'QUICK_CLASSIFY': 'Classificação rápida'
};

// Utilitários para criar descrições específicas
export const createUndoDescription = (
  type: UndoableOperationType, 
  details?: {
    conta?: string;
    categoria?: string;
    subtipo?: string;
    estabelecimento?: string;
    valor?: number;
  }
): string => {
  switch (type) {
    case 'UPDATE_TRANSACTION':
      if (details?.conta && details?.categoria) {
        return `Classificação como ${details.conta} > ${details.categoria}`;
      }
      return 'Edição de transação';

    case 'UPDATE_FUTURE':
      if (details?.categoria && details?.estabelecimento) {
        return `Classificação de ${details.estabelecimento} como ${details.categoria}`;
      }
      return 'Edição de transação futura';

    case 'DELETE_TRANSACTION':
      if (details?.valor) {
        return `Exclusão de transação (R$ ${Math.abs(details.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
      }
      return 'Exclusão de transação';

    case 'QUICK_CLASSIFY':
      if (details?.categoria && details?.conta) {
        return `Classificação rápida: ${details.conta} > ${details.categoria}`;
      }
      return 'Classificação rápida';

    default:
      return 'Operação desconhecida';
  }
};

// Função para extrair estado anterior de uma transação
export const extractTransactionState = (transaction: Transaction): TransactionPreviousState => {
  return {
    id: transaction.id,
    conta: transaction.conta,
    categoria: transaction.categoria,
    subtipo: transaction.subtipo,
    descricao: transaction.descricao,
    realizado: transaction.realizado,
    // Incluir outros campos que podem ser importantes
    mes: transaction.mes,
    data: transaction.data,
    descricao_origem: transaction.descricao_origem,
    valor: transaction.valor,
    origem: transaction.origem,
    cc: transaction.cc,
    linked_future_group: transaction.linked_future_group,
    is_from_reconciliation: transaction.is_from_reconciliation,
    future_subscription_id: transaction.future_subscription_id,
    reconciliation_metadata: transaction.reconciliation_metadata
  };
};

// Função para extrair estado anterior de uma transação futura
export const extractFutureTransactionState = (futureTransaction: FutureTransaction): FutureTransactionPreviousState => {
  return {
    id: futureTransaction.id,
    categoria: futureTransaction.categoria,
    subtipo: futureTransaction.subtipo,
    descricao: futureTransaction.descricao,
    status: futureTransaction.status,
    // Incluir outros campos importantes
    original_transaction_id: futureTransaction.original_transaction_id,
    mes_vencimento: futureTransaction.mes_vencimento,
    data_vencimento: futureTransaction.data_vencimento,
    descricao_origem: futureTransaction.descricao_origem,
    valor: futureTransaction.valor,
    origem: futureTransaction.origem,
    cc: futureTransaction.cc,
    parcela_atual: futureTransaction.parcela_atual,
    parcela_total: futureTransaction.parcela_total,
    estabelecimento: futureTransaction.estabelecimento,
    conta: futureTransaction.conta,
    subscription_fingerprint: futureTransaction.subscription_fingerprint,
    original_future_id: futureTransaction.original_future_id,
    reconciliation_group: futureTransaction.reconciliation_group,
    is_reconciled: futureTransaction.is_reconciled,
    fatura_fechada_id: futureTransaction.fatura_fechada_id,
    valor_original: futureTransaction.valor_original,
    reconciled_at: futureTransaction.reconciled_at,
    reconciled_with_transaction_id: futureTransaction.reconciled_with_transaction_id
  };
};

// Função para verificar se duas transações são diferentes (para otimizar undo)
export const hasTransactionChanged = (
  current: Transaction, 
  previous: TransactionPreviousState
): boolean => {
  return (
    current.conta !== previous.conta ||
    current.categoria !== previous.categoria ||
    current.subtipo !== previous.subtipo ||
    current.descricao !== previous.descricao ||
    current.realizado !== previous.realizado
  );
};

// Função para verificar se duas transações futuras são diferentes
export const hasFutureTransactionChanged = (
  current: FutureTransaction, 
  previous: FutureTransactionPreviousState
): boolean => {
  return (
    current.categoria !== previous.categoria ||
    current.subtipo !== previous.subtipo ||
    current.descricao !== previous.descricao ||
    current.status !== previous.status
  );
};

// Validar se um estado anterior é válido para undo
export const isValidPreviousState = (
  previousState: any, 
  type: UndoableOperationType
): boolean => {
  if (!previousState || typeof previousState !== 'object') {
    return false;
  }

  // Campos obrigatórios por tipo
  const requiredFields = {
    'UPDATE_TRANSACTION': ['id', 'conta', 'categoria', 'subtipo'],
    'UPDATE_FUTURE': ['id', 'categoria', 'subtipo'],
    'DELETE_TRANSACTION': ['id'],
    'QUICK_CLASSIFY': ['id', 'conta', 'categoria']
  };

  const required = requiredFields[type] || [];
  return required.every(field => previousState.hasOwnProperty(field));
};