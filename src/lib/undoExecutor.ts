// lib/undoExecutor.ts - Executor de Operações de Desfazer

import { supabase } from '@/lib/supabase';
import { Transaction, FutureTransaction } from '@/types';
import { UndoAction } from '@/hooks/useSimpleUndo';
import { 
  TransactionPreviousState, 
  FutureTransactionPreviousState,
  isValidPreviousState 
} from '@/lib/undoTypes';

export interface UndoResult {
  success: boolean;
  error?: string;
  restoredItem?: Transaction | FutureTransaction;
}

// Executor principal de undo
export class UndoExecutor {
  
  // Executar undo de uma ação específica
  static async executeUndo(action: UndoAction): Promise<UndoResult> {
    console.log('🔄 Executando undo:', action.description);
    
    try {
      // Validar estrutura da ação
      if (!isValidPreviousState(action.previousState, action.type)) {
        throw new Error('Estado anterior inválido para esta operação');
      }

      // Verificar se usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Executar o undo baseado no tipo de operação
      switch (action.type) {
        case 'UPDATE_TRANSACTION':
          return await this.undoTransactionUpdate(action.targetId, action.previousState as TransactionPreviousState, user.id);
          
        case 'UPDATE_FUTURE':
          return await this.undoFutureTransactionUpdate(action.targetId, action.previousState as FutureTransactionPreviousState, user.id);
          
        case 'DELETE_TRANSACTION':
          return await this.undoTransactionDelete(action.previousState as TransactionPreviousState, user.id);
          
        case 'QUICK_CLASSIFY':
          return await this.undoQuickClassify(action.targetId, action.previousState as TransactionPreviousState, user.id);
          
        default:
          throw new Error(`Tipo de operação não suportada: ${action.type}`);
      }
      
    } catch (error) {
      console.error('❌ Erro no undo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  // Desfazer atualização de transação
  private static async undoTransactionUpdate(
    transactionId: string, 
    previousState: TransactionPreviousState,
    userId: string
  ): Promise<UndoResult> {
    
    console.log('↩️ Desfazendo atualização de transação:', transactionId);
    
    // Restaurar estado anterior
    const { data, error } = await supabase
      .from('transactions')
      .update({
        conta: previousState.conta,
        categoria: previousState.categoria,
        subtipo: previousState.subtipo,
        descricao: previousState.descricao,
        realizado: previousState.realizado,
        // Restaurar outros campos se necessário
        mes: previousState.mes,
        data: previousState.data,
        descricao_origem: previousState.descricao_origem,
        valor: previousState.valor,
        origem: previousState.origem,
        cc: previousState.cc,
        linked_future_group: previousState.linked_future_group || null,
        is_from_reconciliation: previousState.is_from_reconciliation || false,
        future_subscription_id: previousState.future_subscription_id || null,
        reconciliation_metadata: previousState.reconciliation_metadata || null
      })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao desfazer atualização: ${error.message}`);
    }

    return {
      success: true,
      restoredItem: data as Transaction
    };
  }

  // Desfazer atualização de transação futura
  private static async undoFutureTransactionUpdate(
    transactionId: string, 
    previousState: FutureTransactionPreviousState,
    userId: string
  ): Promise<UndoResult> {
    
    console.log('↩️ Desfazendo atualização de transação futura:', transactionId);
    
    const { data, error } = await supabase
      .from('future_transactions')
      .update({
        categoria: previousState.categoria,
        subtipo: previousState.subtipo,
        descricao: previousState.descricao,
        status: previousState.status,
        // Restaurar outros campos
        original_transaction_id: previousState.original_transaction_id || null,
        mes_vencimento: previousState.mes_vencimento,
        data_vencimento: previousState.data_vencimento,
        descricao_origem: previousState.descricao_origem,
        valor: previousState.valor,
        origem: previousState.origem,
        cc: previousState.cc,
        parcela_atual: previousState.parcela_atual,
        parcela_total: previousState.parcela_total,
        estabelecimento: previousState.estabelecimento,
        subscription_fingerprint: previousState.subscription_fingerprint || null,
        original_future_id: previousState.original_future_id || null,
        reconciliation_group: previousState.reconciliation_group || null,
        is_reconciled: previousState.is_reconciled || false,
        fatura_fechada_id: previousState.fatura_fechada_id || null,
        valor_original: previousState.valor_original || null,
        reconciled_at: previousState.reconciled_at || null,
        reconciled_with_transaction_id: previousState.reconciled_with_transaction_id || null
      })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao desfazer atualização de transação futura: ${error.message}`);
    }

    return {
      success: true,
      restoredItem: data as FutureTransaction
    };
  }

  // Desfazer exclusão de transação (recriar)
  private static async undoTransactionDelete(
    previousState: TransactionPreviousState,
    userId: string
  ): Promise<UndoResult> {
    
    console.log('↩️ Recriando transação deletada:', previousState.id);
    
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...previousState,
        user_id: userId
      })
      .select()
      .single();

    if (error) {
      // Se erro for de duplicate key, a transação já existe
      if (error.code === '23505') {
        throw new Error('A transação já foi restaurada ou ainda existe');
      }
      throw new Error(`Erro ao restaurar transação: ${error.message}`);
    }

    return {
      success: true,
      restoredItem: data as Transaction
    };
  }

  // Desfazer classificação rápida (mesmo que update_transaction, mas com contexto)
  private static async undoQuickClassify(
    transactionId: string, 
    previousState: TransactionPreviousState,
    userId: string
  ): Promise<UndoResult> {
    
    console.log('↩️ Desfazendo classificação rápida:', transactionId);
    
    // Lógica igual ao update_transaction
    return await this.undoTransactionUpdate(transactionId, previousState, userId);
  }

  // Utilitário para verificar se item ainda existe antes do undo
  static async checkItemExists(itemId: string, tableName: 'transactions' | 'future_transactions'): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  // Validar se o undo ainda é possível
  static async validateUndoAction(action: UndoAction): Promise<{valid: boolean, reason?: string}> {
    
    // Verificar se a ação não é muito antiga (limite de 24 horas)
    const actionTime = new Date(action.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - actionTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      return {
        valid: false,
        reason: 'Ação muito antiga (mais de 24 horas)'
      };
    }

    // Para DELETE, não verificar existência (queremos recriar)
    if (action.type === 'DELETE_TRANSACTION') {
      return { valid: true };
    }

    // Para outros tipos, verificar se o item ainda existe
    const exists = await this.checkItemExists(action.targetId, action.tableName);
    if (!exists) {
      return {
        valid: false,
        reason: 'Item não encontrado (pode ter sido deletado)'
      };
    }

    return { valid: true };
  }
}