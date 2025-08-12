// hooks/useIntegratedUndo.ts - Hook Integrado para Sistema de Desfazer

import { useCallback } from 'react';
import { Transaction, FutureTransaction } from '@/types';
import { useSimpleUndo } from '@/hooks/useSimpleUndo';
import { UndoExecutor, UndoResult } from '@/lib/undoExecutor';
import { 
  extractTransactionState, 
  extractFutureTransactionState,
  createUndoDescription,
  hasTransactionChanged,
  hasFutureTransactionChanged
} from '@/lib/undoTypes';

export function useIntegratedUndo() {
  const {
    pushUndoAction,
    popLastAction,
    getLastAction,
    canUndo,
    setUndoInProgress,
    formatActionTime,
    clearHistory,
    historySize
  } = useSimpleUndo();

  // ===== FUNÇÕES PARA REGISTRAR AÇÕES =====

  // Registrar edição de transação ANTES da operação
  const registerTransactionUpdate = useCallback((
    originalTransaction: Transaction,
    operation: 'edit' | 'quick_classify' = 'edit'
  ) => {
    const previousState = extractTransactionState(originalTransaction);
    const type = operation === 'quick_classify' ? 'QUICK_CLASSIFY' : 'UPDATE_TRANSACTION';
    
    const description = createUndoDescription(type, {
      conta: originalTransaction.conta,
      categoria: originalTransaction.categoria,
      subtipo: originalTransaction.subtipo,
      valor: originalTransaction.valor
    });

    pushUndoAction({
      type,
      previousState,
      targetId: originalTransaction.id,
      tableName: 'transactions',
      description
    });

    console.log('📝 Registrado para undo:', description);
  }, [pushUndoAction]);

  // Registrar edição de transação futura ANTES da operação
  const registerFutureTransactionUpdate = useCallback((originalTransaction: FutureTransaction) => {
    const previousState = extractFutureTransactionState(originalTransaction);
    
    const description = createUndoDescription('UPDATE_FUTURE', {
      categoria: originalTransaction.categoria,
      subtipo: originalTransaction.subtipo,
      estabelecimento: originalTransaction.estabelecimento,
      valor: originalTransaction.valor
    });

    pushUndoAction({
      type: 'UPDATE_FUTURE',
      previousState,
      targetId: originalTransaction.id,
      tableName: 'future_transactions',
      description
    });

    console.log('📝 Registrado para undo (future):', description);
  }, [pushUndoAction]);

  // Registrar exclusão ANTES da operação
  const registerTransactionDelete = useCallback((transactionToDelete: Transaction) => {
    const previousState = extractTransactionState(transactionToDelete);
    
    const description = createUndoDescription('DELETE_TRANSACTION', {
      valor: transactionToDelete.valor
    });

    pushUndoAction({
      type: 'DELETE_TRANSACTION',
      previousState,
      targetId: transactionToDelete.id,
      tableName: 'transactions',
      description
    });

    console.log('📝 Registrado delete para undo:', description);
  }, [pushUndoAction]);

  // ===== FUNÇÃO PRINCIPAL DE UNDO =====

  const executeUndo = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    restoredItem?: Transaction | FutureTransaction;
  }> => {
    const lastAction = getLastAction();
    
    if (!lastAction) {
      return {
        success: false,
        message: 'Nenhuma ação disponível para desfazer'
      };
    }

    if (!canUndo()) {
      return {
        success: false,
        message: 'Não é possível desfazer neste momento'
      };
    }

    setUndoInProgress(true);

    try {
      // Validar se o undo ainda é possível
      const validation = await UndoExecutor.validateUndoAction(lastAction);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.reason || 'Ação não pode ser desfeita'
        };
      }

      // Executar o undo
      const result: UndoResult = await UndoExecutor.executeUndo(lastAction);
      
      if (result.success) {
        // Remover a ação do histórico apenas se bem-sucedida
        popLastAction();
        
        return {
          success: true,
          message: `✅ ${lastAction.description} foi desfeita`,
          restoredItem: result.restoredItem
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao desfazer operação'
        };
      }

    } catch (error) {
      console.error('❌ Erro no executeUndo:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro inesperado'
      };
    } finally {
      setUndoInProgress(false);
    }
  }, [getLastAction, canUndo, setUndoInProgress, popLastAction]);

  // ===== FUNÇÕES DE UTILIDADE =====

  // Obter descrição da última ação para mostrar no tooltip
  const getLastActionDescription = useCallback((): string | null => {
    const lastAction = getLastAction();
    if (!lastAction) return null;
    
    const timeAgo = formatActionTime(lastAction.timestamp);
    return `${lastAction.description} (${timeAgo})`;
  }, [getLastAction, formatActionTime]);

  // Verificar se uma transação mudou o suficiente para registrar undo
  const shouldRegisterTransactionChange = useCallback((
    current: Transaction, 
    original: Transaction
  ): boolean => {
    return hasTransactionChanged(current, extractTransactionState(original));
  }, []);

  // Verificar se uma transação futura mudou o suficiente para registrar undo
  const shouldRegisterFutureChange = useCallback((
    current: FutureTransaction, 
    original: FutureTransaction
  ): boolean => {
    return hasFutureTransactionChanged(current, extractFutureTransactionState(original));
  }, []);

  // Estatísticas do sistema de undo
  const getUndoStats = useCallback(() => {
    const lastAction = getLastAction();
    return {
      hasActions: canUndo(),
      totalActions: historySize,
      lastActionDescription: lastAction?.description || null,
      lastActionTime: lastAction ? formatActionTime(lastAction.timestamp) : null,
      canExecuteUndo: canUndo()
    };
  }, [getLastAction, canUndo, historySize, formatActionTime]);

  // Função para debug - listar todas as ações
  const debugHistory = useCallback(() => {
    const lastAction = getLastAction();
    console.log('🔍 Sistema de Undo - Debug:');
    console.log('  - Pode desfazer:', canUndo());
    console.log('  - Total de ações:', historySize);
    console.log('  - Última ação:', lastAction?.description || 'Nenhuma');
    
    if (lastAction) {
      console.log('  - Detalhes da última ação:', {
        type: lastAction.type,
        targetId: lastAction.targetId,
        timestamp: lastAction.timestamp,
        tableName: lastAction.tableName
      });
    }
  }, [getLastAction, canUndo, historySize]);

  return {
    // Funções principais de undo
    executeUndo,
    canUndo,
    
    // Funções para registrar ações (usar ANTES das operações)
    registerTransactionUpdate,
    registerFutureTransactionUpdate, 
    registerTransactionDelete,
    
    // Informações sobre o estado do undo
    getLastActionDescription,
    getUndoStats,
    
    // Utilitários
    shouldRegisterTransactionChange,
    shouldRegisterFutureChange,
    clearHistory,
    debugHistory,
    
    // Estado
    historySize,
    hasActions: canUndo()
  };
}