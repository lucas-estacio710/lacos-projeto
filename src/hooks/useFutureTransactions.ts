import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FutureTransaction } from '@/types';

export function useFutureTransactions() {
  const [futureTransactions, setFutureTransactions] = useState<FutureTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar transações futuras do Supabase
  const loadFutureTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data, error: supabaseError } = await supabase
        .from('future_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (supabaseError) {
        throw supabaseError;
      }

      setFutureTransactions(data || []);
    } catch (err) {
      console.error('Erro ao carregar transações futuras:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Adicionar múltiplas transações futuras
  const addFutureTransactions = async (newFutureTransactions: FutureTransaction[]) => {
    try {
      console.log('🔄 Iniciando addFutureTransactions com:', newFutureTransactions.length, 'transações');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Preparar dados para inserção com validação
      const transactionsToInsert = newFutureTransactions.map((transaction, index) => {
        // Garantir que todos os campos obrigatórios existem
        const cleanTransaction = {
          id: transaction.id,
          user_id: user.id,
          original_transaction_id: transaction.original_transaction_id || null,
          mes_vencimento: transaction.mes_vencimento || '',
          data_vencimento: transaction.data_vencimento || new Date().toISOString().split('T')[0],
          descricao_origem: transaction.descricao_origem || '',
          categoria: transaction.categoria || '',
          subtipo: transaction.subtipo || '',
          descricao: transaction.descricao || transaction.descricao_origem || '',
          valor: Number(transaction.valor) || 0,
          origem: transaction.origem || '',
          cc: transaction.cc || '',
          parcela_atual: Number(transaction.parcela_atual) || 1,
          parcela_total: Number(transaction.parcela_total) || 1,
          estabelecimento: transaction.estabelecimento || transaction.descricao_origem || '',
          status: transaction.status || 'projected'
        };

        // Log para debug do primeiro item
        if (index === 0) {
          console.log('📋 Exemplo de transação preparada:', cleanTransaction);
        }

        return cleanTransaction;
      });

      console.log('📝 Total de transações futuras para inserir:', transactionsToInsert.length);

      // ETAPA 1: Verificar quantas já existem com busca mais específica
      const existingIds = transactionsToInsert.map(t => t.id);
      console.log('🔍 Verificando IDs para duplicatas:');
      console.log('  📋 Primeiros 5 IDs:', existingIds.slice(0, 5));
      console.log('  📊 Total de IDs únicos a verificar:', new Set(existingIds).size);
      
      const { data: existingTransactions, error: checkError } = await supabase
        .from('future_transactions')
        .select('id')
        .eq('user_id', user.id)
        .in('id', existingIds);

      if (checkError) {
        console.error('❌ Erro ao verificar duplicatas:', checkError);
        throw checkError;
      }

      const existingIdSet = new Set(existingTransactions?.map(t => t.id) || []);
      const duplicatesCount = existingIds.filter(id => existingIdSet.has(id)).length;
      const newTransactions = transactionsToInsert.filter(t => !existingIdSet.has(t.id));

      console.log('🔍 Análise de duplicatas:');
      console.log('  📊 Total enviado:', transactionsToInsert.length);
      console.log('  ✅ Novas:', newTransactions.length);
      console.log('  🔄 Duplicatas encontradas:', duplicatesCount);
      console.log('  📋 IDs duplicados:', existingIds.filter(id => existingIdSet.has(id)).slice(0, 3));
      console.log('  📋 IDs existentes no banco:', Array.from(existingIdSet).slice(0, 3));

      // ETAPA 2: Inserir em lotes para evitar sobrecarga
      let insertedCount = 0;
      const BATCH_SIZE = 10;
      
      if (newTransactions.length > 0) {
        console.log('📤 Inserindo', newTransactions.length, 'novas transações em lotes...');
        
        for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
          const batch = newTransactions.slice(i, i + BATCH_SIZE);
          console.log(`📦 Lote ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} transações`);
          
          const { error: supabaseError } = await supabase
            .from('future_transactions')
            .insert(batch);

          if (supabaseError) {
            console.error('❌ Erro do Supabase no lote:', supabaseError);
            console.error('❌ Lote que causou erro:', batch[0]); 
            
            // Se for erro de duplicata, tentar continuar com próximo lote
            if (supabaseError.code === '23505') {
              console.log('⚠️ Erro de duplicata detectado, continuando...');
              continue;
            }
            
            throw supabaseError;
          }

          insertedCount += batch.length;
        }

        console.log('✅ Inserção realizada com sucesso:', insertedCount, 'registros');
      } else {
        console.log('ℹ️ Nenhuma transação nova para inserir (todas eram duplicatas)');
      }

      // ETAPA 3: Atualizar estado local (apenas com novas)
      setFutureTransactions(prev => {
        const prevIdSet = new Set(prev.map(t => t.id));
        const newOnes = newFutureTransactions.filter(t => !prevIdSet.has(t.id));
        console.log('✅ Adicionando ao estado local:', newOnes.length, 'novas transações futuras');
        return [...prev, ...newOnes];
      });

      console.log('✅ addFutureTransactions concluído com sucesso');
      
      // RETORNAR ESTATÍSTICAS BASEADAS NO QUE REALMENTE FOI INSERIDO
      return {
        success: true,
        stats: {
          total: transactionsToInsert.length,
          added: insertedCount,
          duplicates: duplicatesCount
        }
      };
      
    } catch (err) {
      console.error('❌ Erro completo:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar transações futuras');
      throw err;
    }
  };

  // Atualizar uma transação futura específica
  const updateFutureTransaction = async (updatedTransaction: FutureTransaction): Promise<FutureTransaction | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const transactionToUpdate = {
        mes_vencimento: updatedTransaction.mes_vencimento,
        data_vencimento: updatedTransaction.data_vencimento,
        descricao_origem: updatedTransaction.descricao_origem,
        categoria: updatedTransaction.categoria,
        subtipo: updatedTransaction.subtipo,
        descricao: updatedTransaction.descricao,
        valor: updatedTransaction.valor,
        origem: updatedTransaction.origem,
        cc: updatedTransaction.cc,
        parcela_atual: updatedTransaction.parcela_atual,
        parcela_total: updatedTransaction.parcela_total,
        estabelecimento: updatedTransaction.estabelecimento,
        status: updatedTransaction.status
      };

      const { data, error: supabaseError } = await supabase
        .from('future_transactions')
        .update(transactionToUpdate)
        .eq('id', updatedTransaction.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (supabaseError) {
        throw supabaseError;
      }

      // Atualizar estado local
      setFutureTransactions(prev => 
        prev.map(t => 
          t.id === updatedTransaction.id ? updatedTransaction : t
        )
      );

      return data;
    } catch (err) {
      console.error('Erro ao atualizar transação futura:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar transação futura');
      throw err;
    }
  };

  // Atualizar parcelas relacionadas quando uma é classificada
  const updateRelatedParcelas = async (originalTransactionId: string, categoria: string, subtipo: string, conta: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log(`🔄 Atualizando parcelas relacionadas para transação: ${originalTransactionId}`);
      console.log(`📋 Dados: categoria=${categoria}, subtipo=${subtipo}, conta=${conta}`);

      // Buscar a transação original para pegar a descrição
      const { data: originalTransaction, error: originalError } = await supabase
        .from('future_transactions')
        .select('descricao')
        .eq('id', originalTransactionId)
        .eq('user_id', user.id)
        .single();

      if (originalError) {
        console.error('❌ Erro ao buscar transação original:', originalError);
        throw originalError;
      }

      // Buscar todas as parcelas relacionadas
      const { data: relatedTransactions, error: fetchError } = await supabase
        .from('future_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('original_transaction_id', originalTransactionId);

      if (fetchError) {
        console.error('❌ Erro ao buscar parcelas relacionadas:', fetchError);
        throw fetchError;
      }

      console.log(`📊 Encontradas ${relatedTransactions?.length || 0} parcelas relacionadas`);

      if (relatedTransactions && relatedTransactions.length > 0) {
        // Atualizar todas as parcelas relacionadas com a MESMA DESCRIÇÃO da original
        const updatesData = relatedTransactions.map(t => ({
          id: t.id,
          user_id: user.id,
          original_transaction_id: t.original_transaction_id,
          mes_vencimento: t.mes_vencimento,
          data_vencimento: t.data_vencimento,
          descricao_origem: t.descricao_origem,
          categoria: categoria,
          subtipo: subtipo,
          descricao: originalTransaction.descricao, // USAR A DESCRIÇÃO DA TRANSAÇÃO ORIGINAL
          valor: t.valor,
          origem: t.origem,
          cc: t.cc,
          parcela_atual: t.parcela_atual,
          parcela_total: t.parcela_total,
          estabelecimento: t.estabelecimento,
          status: 'confirmed'
        }));

        console.log(`📤 Atualizando ${updatesData.length} parcelas com descrição: "${originalTransaction.descricao}"`);

        const { error: updateError } = await supabase
          .from('future_transactions')
          .upsert(updatesData, { onConflict: 'id' });

        if (updateError) {
          console.error('❌ Erro ao atualizar parcelas:', updateError);
          throw updateError;
        }

        // Atualizar estado local
        setFutureTransactions(prev => 
          prev.map(t => {
            const update = updatesData.find(u => u.id === t.id);
            if (update) {
              return { ...t, categoria, subtipo, descricao: originalTransaction.descricao, status: 'confirmed' as const };
            }
            return t;
          })
        );

        console.log(`✅ ${updatesData.length} parcelas relacionadas atualizadas com sucesso`);
      } else {
        console.log('ℹ️ Nenhuma parcela relacionada encontrada');
      }
    } catch (err) {
      console.error('❌ Erro ao atualizar parcelas relacionadas:', err);
      throw err;
    }
  };

  // Deletar uma transação futura
  const deleteFutureTransaction = async (transactionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error: supabaseError } = await supabase
        .from('future_transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (supabaseError) {
        throw supabaseError;
      }

      // Atualizar estado local
      setFutureTransactions(prev => prev.filter(t => t.id !== transactionId));
    } catch (err) {
      console.error('Erro ao deletar transação futura:', err);
      setError(err instanceof Error ? err.message : 'Erro ao deletar transação futura');
      throw err;
    }
  };

  // Limpar todas as transações futuras
  const clearAllFutureTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error: supabaseError } = await supabase
        .from('future_transactions')
        .delete()
        .eq('user_id', user.id);

      if (supabaseError) {
        throw supabaseError;
      }

      setFutureTransactions([]);
    } catch (err) {
      console.error('Erro ao limpar transações futuras:', err);
      setError(err instanceof Error ? err.message : 'Erro ao limpar transações futuras');
      throw err;
    }
  };

  // Carregar transações futuras na inicialização
  useEffect(() => {
    loadFutureTransactions();
  }, []);

  // Limpar erro após um tempo
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return {
    futureTransactions,
    loading,
    error,
    addFutureTransactions,
    updateFutureTransaction,
    updateRelatedParcelas,
    deleteFutureTransaction,
    clearAllFutureTransactions,
    refreshFutureTransactions: loadFutureTransactions
  };
}