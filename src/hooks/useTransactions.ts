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
      console.log('👤 User:', user?.id);
      
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
        conta: transaction.conta
      }));

      console.log('📝 Total de transações para inserir:', transactionsToInsert.length);
      console.log('📝 Primeira transação:', transactionsToInsert[0]);
      console.log('📝 Estrutura completa da primeira:', JSON.stringify(transactionsToInsert[0], null, 2));

      // Inserir no Supabase com upsert para evitar duplicatas
      const { data, error: supabaseError } = await supabase
        .from('transactions')
        .upsert(transactionsToInsert, { 
          onConflict: 'id,user_id',
          ignoreDuplicates: false 
        })
        .select();

      console.log('🔄 Resposta Supabase data:', data);
      console.log('🔄 Resposta Supabase error:', supabaseError);
      console.log('🔄 Resposta completa:', { data, error: supabaseError });

      if (supabaseError) {
        console.error('❌ Erro do Supabase:', supabaseError);
        throw supabaseError;
      }

      // Atualizar estado local
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const newOnes = newTransactions.filter(t => !existingIds.has(t.id));
        console.log('✅ Adicionando ao estado local:', newOnes.length, 'novas transações');
        return [...prev, ...newOnes];
      });

      console.log('✅ addTransactions concluído com sucesso');
      return data;
    } catch (err) {
      console.error('❌ Erro completo:', err);
      console.error('❌ Erro tipo:', typeof err);
      console.error('❌ Erro stringified:', JSON.stringify(err, null, 2));
      console.error('❌ Erro message:', err instanceof Error ? err.message : 'Sem message');
      console.error('❌ Erro stack:', err instanceof Error ? err.stack : 'Sem stack');
      
      setError(err instanceof Error ? err.message : 'Erro ao salvar transações');
      throw err;
    }
  };

  // Atualizar uma transação específica
  const updateTransaction = async (updatedTransaction: Transaction) => {
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
        conta: updatedTransaction.conta
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
    refreshTransactions: loadTransactions
  };
}