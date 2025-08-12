// lib/undoTypes.ts - Tipos para sistema de desfazer simplificado

import { Transaction, FutureTransaction } from '@/types';

export interface UndoAction {
  id: string;
  type: 'UPDATE_TRANSACTION' | 'UPDATE_FUTURE' | 'DELETE_TRANSACTION' | 'QUICK_CLASSIFY';
  timestamp: string;
  previousState: any;
  targetId: string;
  description: string;
}

export interface UndoableTransactionUpdate {
  type: 'UPDATE_TRANSACTION';
  targetId: string;
  previousState: Transaction;
  description: string;
}

export interface UndoableFutureUpdate {
  type: 'UPDATE_FUTURE';
  targetId: string;
  previousState: FutureTransaction;
  description: string;
}

export interface UndoableTransactionDelete {
  type: 'DELETE_TRANSACTION';
  targetId: string;
  previousState: Transaction;
  description: string;
}

export interface UndoableQuickClassify {
  type: 'QUICK_CLASSIFY';
  targetId: string;
  previousState: Transaction | FutureTransaction;
  description: string;
}

export type UndoableAction = 
  | UndoableTransactionUpdate 
  | UndoableFutureUpdate 
  | UndoableTransactionDelete 
  | UndoableQuickClassify;

export interface UndoSystemState {
  actions: UndoAction[];
  maxActions: number;
}

export const UNDO_ACTION_DESCRIPTIONS = {
  UPDATE_TRANSACTION: 'Edição de transação',
  UPDATE_FUTURE: 'Edição de cartão',
  DELETE_TRANSACTION: 'Exclusão de transação',
  QUICK_CLASSIFY: 'Classificação rápida'
} as const;