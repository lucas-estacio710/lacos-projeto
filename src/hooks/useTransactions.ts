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
          conta: transaction.conta
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