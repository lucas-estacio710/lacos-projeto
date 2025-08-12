// hooks/useTransactions.ts - VERSÃO ATUALIZADA COM RECONCILIAÇÃO

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar transações do Supabase
  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data, error: supabaseError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      setTransactions(data || []);
    } catch (err) {
      console.error('Erro ao carregar transações:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Adicionar múltiplas transações
  const addTransactions = async (newTransactions: Transaction[]) => {
    try {
      console.log('🔄 Iniciando addTransactions com:', newTransactions.length, 'transações');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Preparar dados para inserção
      const transactionsToInsert = newTransactions.map(transaction => ({
        id: transaction.id,
        user_id: user.id,
        mes: transaction.mes,
        data: transaction.data,
        descricao_origem: transaction.descricao_origem,
        subtipo: transaction.subtipo,
        categoria: transaction.categoria,
        descricao: transaction.descricao,
        valor: transaction.valor,
        origem: transaction.origem,
        cc: transaction.cc,
        realizado: transaction.realizado,
        conta: transaction.conta,
        // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
        linked_future_group: transaction.linked_future_group || null,
        is_from_reconciliation: transaction.is_from_reconciliation || false,
        future_subscription_id: transaction.future_subscription_id || null,
        reconciliation_metadata: transaction.reconciliation_metadata || null
      }));

      console.log('📝 Total de transações para inserir:', transactionsToInsert.length);

      // ETAPA 1: Verificar quantas já existem (para contar duplicatas)
      const existingIds = transactionsToInsert.map(t => t.id);
      const { data: existingTransactions, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .in('id', existingIds);

      if (checkError) {
        console.error('❌ Erro ao verificar duplicatas:', checkError);
        throw checkError;
      }

      const existingIdSet = new Set(existingTransactions?.map(t => t.id) || []);
      const duplicatesCount = existingIds.filter(id => existingIdSet.has(id)).length;
      const newCount = transactionsToInsert.length - duplicatesCount;

      console.log('🔍 Análise de duplicatas:');
      console.log('  📊 Total enviado:', transactionsToInsert.length);
      console.log('  ✅ Novas:', newCount);
      console.log('  🔄 Duplicatas:', duplicatesCount);

      // ETAPA 2: Inserir com upsert (funciona independente de duplicatas)
      const { data: _, error: supabaseError } = await supabase
        .from('transactions')
        .upsert(transactionsToInsert, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select();

      if (supabaseError) {
        console.error('❌ Erro do Supabase:', supabaseError);
        throw supabaseError;
      }

      // ETAPA 3: Atualizar estado local (apenas com novas)
      setTransactions(prev => {
        const prevIdSet = new Set(prev.map(t => t.id));
        const newOnes = newTransactions.filter(t => !prevIdSet.has(t.id));
        console.log('✅ Adicionando ao estado local:', newOnes.length, 'novas transações');
        return [...prev, ...newOnes];
      });

      console.log('✅ addTransactions concluído com sucesso');
      
      // RETORNAR ESTATÍSTICAS SIMPLES E CONFIÁVEIS
      return {
        success: true,
        stats: {
          total: transactionsToInsert.length,
          added: newCount,
          duplicates: duplicatesCount
        }
      };
      
    } catch (err) {
      console.error('❌ Erro completo:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar transações');
      throw err;
    }
  };

  // Atualizar uma transação específica
  const updateTransaction = async (updatedTransaction: Transaction): Promise<Transaction | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const transactionToUpdate = {
        mes: updatedTransaction.mes,
        data: updatedTransaction.data,
        descricao_origem: updatedTransaction.descricao_origem,
        subtipo: updatedTransaction.subtipo,
        categoria: updatedTransaction.categoria,
        descricao: updatedTransaction.descricao,
        valor: updatedTransaction.valor,
        origem: updatedTransaction.origem,
        cc: updatedTransaction.cc,
        realizado: updatedTransaction.realizado,
        conta: updatedTransaction.conta,
        // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
        linked_future_group: updatedTransaction.linked_future_group || null,
        is_from_reconciliation: updatedTransaction.is_from_reconciliation || false,
        future_subscription_id: updatedTransaction.future_subscription_id || null,
        reconciliation_metadata: updatedTransaction.reconciliation_metadata || null
      };

      const { data, error: supabaseError } = await supabase
        .from('transactions')
        .update(transactionToUpdate)
        .eq('id', updatedTransaction.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (supabaseError) {
        throw supabaseError;
      }

      // Atualizar estado local
      setTransactions(prev => 
        prev.map(t => 
          t.id === updatedTransaction.id ? updatedTransaction : t
        )
      );

      return data;
    } catch (err) {
      console.error('Erro ao atualizar transação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar transação');
      throw err;
    }
  };

  // ===== NOVA FUNÇÃO: Marcar transação como reconciliada =====
  const markAsReconciled = async (transaction: Transaction, futureGroup: string) => {
    try {
      console.log('🔗 Marcando transação como reconciliada:', transaction.id);
      console.log('📋 Grupo de futures:', futureGroup);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const reconciliationMetadata = {
        reconciled_at: new Date().toISOString(),
        future_group: futureGroup,
        reconciled_by: 'manual'
      };

      const updatedTransaction: Transaction = {
        ...transaction,
        linked_future_group: futureGroup,
        is_from_reconciliation: true,
        reconciliation_metadata: JSON.stringify(reconciliationMetadata),
        realizado: 's' // Marcar como realizado
      };

      await updateTransaction(updatedTransaction);

      console.log('✅ Transação marcada como reconciliada');
      return { success: true };

    } catch (err) {
      console.error('❌ Erro ao marcar como reconciliada:', err);
      throw err;
    }
  };

  // Deletar uma transação
  const deleteTransaction = async (transactionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error: supabaseError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (supabaseError) {
        throw supabaseError;
      }

      // Atualizar estado local
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
    } catch (err) {
      console.error('Erro ao deletar transação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao deletar transação');
      throw err;
    }
  };

  // Limpar todas as transações
  const clearAllTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error: supabaseError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (supabaseError) {
        throw supabaseError;
      }

      setTransactions([]);
    } catch (err) {
      console.error('Erro ao limpar transações:', err);
      setError(err instanceof Error ? err.message : 'Erro ao limpar transações');
      throw err;
    }
  };

  // Dividir uma transação em múltiplas partes
  const splitTransaction = async (originalTransaction: Transaction, parts: Array<{
    categoria: string;
    subtipo: string;
    descricao: string;
    valor: number;
  }>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('🔄 Iniciando divisão da transação:', originalTransaction.id);

      // Função para determinar a conta automaticamente
      const getAccountForTransaction = (transaction: Transaction): string => {
        if (transaction.descricao_origem?.toLowerCase().includes('pix') || 
            transaction.descricao_origem?.toLowerCase().includes('transferencia')) {
          return 'PJ';
        }
        return 'PF';
      };

      // ETAPA 1: Deletar transação original
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', originalTransaction.id)
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      console.log('✅ Transação original deletada');

      // ETAPA 2: Criar novas transações divididas
      const account = getAccountForTransaction(originalTransaction);
      const newTransactions = parts.map((part, index) => ({
        id: `${originalTransaction.id}-${index + 1}`,
        user_id: user.id,
        mes: originalTransaction.mes,
        data: originalTransaction.data,
        descricao_origem: originalTransaction.descricao_origem,
        subtipo: part.subtipo,
        categoria: part.categoria,
        descricao: part.descricao,
        valor: part.valor,
        origem: originalTransaction.origem,
        cc: originalTransaction.cc,
        realizado: 's', // Automaticamente marca como realizado
        conta: account,
        // Manter dados de reconciliação se existirem
        linked_future_group: originalTransaction.linked_future_group,
        is_from_reconciliation: originalTransaction.is_from_reconciliation,
        future_subscription_id: originalTransaction.future_subscription_id,
        reconciliation_metadata: originalTransaction.reconciliation_metadata
      }));

      const { data: insertedTransactions, error: insertError } = await supabase
        .from('transactions')
        .insert(newTransactions)
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log('✅ Novas transações criadas:', insertedTransactions?.length);

      // ETAPA 3: Atualizar estado local
      setTransactions(prev => {
        // Remove a transação original
        const withoutOriginal = prev.filter(t => t.id !== originalTransaction.id);
        
        // Adiciona as novas transações
        const newTransactionObjects: Transaction[] = newTransactions.map(nt => ({
          id: nt.id,
          mes: nt.mes,
          data: nt.data,
          descricao_origem: nt.descricao_origem,
          subtipo: nt.subtipo,
          categoria: nt.categoria,
          descricao: nt.descricao,
          valor: nt.valor,
          origem: nt.origem,
          cc: nt.cc,
          realizado: nt.realizado,
          conta: nt.conta,
          linked_future_group: nt.linked_future_group,
          is_from_reconciliation: nt.is_from_reconciliation,
          future_subscription_id: nt.future_subscription_id,
          reconciliation_metadata: nt.reconciliation_metadata
        }));
        
        return [...withoutOriginal, ...newTransactionObjects];
      });

      console.log('✅ Divisão da transação concluída com sucesso');
      
      return {
        success: true,
        partsCreated: parts.length
      };

    } catch (err) {
      console.error('❌ Erro ao dividir transação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao dividir transação');
      throw err;
    }
  };

  // Carregar transações na inicialização
  useEffect(() => {
    loadTransactions();
  }, []);

  // Limpar erro após um tempo
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return {
    transactions,
    loading,
    error,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    clearAllTransactions,
    splitTransaction,
    markAsReconciled, // ===== NOVA FUNÇÃO =====
    refreshTransactions: loadTransactions
  };
}