// hooks/useFutureTransactions.ts - VERSÃO CORRIGIDA

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FutureTransaction, Transaction, FaturaAnalysis, ReconciliationGroup } from '@/types';
import { compareFaturas } from '@/lib/faturaComparison';
import { getAllReconciliationGroups } from '@/lib/reconciliationService';

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
    } catch (err: any) {
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

      // Preparar dados para inserção com validação e novos campos
      const transactionsToInsert = newFutureTransactions.map((transaction, index) => {
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
          status: transaction.status || 'projected',
          // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
          subscription_fingerprint: transaction.subscription_fingerprint || null,
          original_future_id: transaction.original_future_id || null,
          reconciliation_group: transaction.reconciliation_group || null,
          is_reconciled: transaction.is_reconciled || false,
          fatura_fechada_id: transaction.fatura_fechada_id || null,
          valor_original: transaction.valor_original || null,
          reconciled_at: transaction.reconciled_at || null,
          reconciled_with_transaction_id: transaction.reconciled_with_transaction_id || null
        };

        if (index === 0) {
          console.log('📋 Exemplo de transação preparada:', cleanTransaction);
        }

        return cleanTransaction;
      });

      console.log('📝 Total de transações futuras para inserir:', transactionsToInsert.length);

      // ETAPA 1: Verificar duplicatas
      const existingIds = transactionsToInsert.map(t => t.id);
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

      // ETAPA 2: Inserir em lotes
      let insertedCount = 0;
      const BATCH_SIZE = 10;
      
      if (newTransactions.length > 0) {
        console.log('📤 Inserindo', newTransactions.length, 'novas transações em lotes...');
        
        for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
          const batch = newTransactions.slice(i, i + BATCH_SIZE);
          
          const { error: supabaseError } = await supabase
            .from('future_transactions')
            .insert(batch);

          if (supabaseError) {
            console.error('❌ Erro do Supabase no lote:', supabaseError);
            
            if (supabaseError.code === '23505') {
              console.log('⚠️ Erro de duplicata detectado, continuando...');
              continue;
            }
            
            throw supabaseError;
          }

          insertedCount += batch.length;
        }

        console.log('✅ Inserção realizada com sucesso:', insertedCount, 'registros');
      }

      // ETAPA 3: Atualizar estado local
      setFutureTransactions(prev => {
        const prevIdSet = new Set(prev.map(t => t.id));
        const newOnes = newFutureTransactions.filter(t => !prevIdSet.has(t.id));
        console.log('✅ Adicionando ao estado local:', newOnes.length, 'novas transações futuras');
        return [...prev, ...newOnes];
      });

      console.log('✅ addFutureTransactions concluído com sucesso');
      
      return {
        success: true,
        stats: {
          total: transactionsToInsert.length,
          added: insertedCount,
          duplicates: duplicatesCount
        }
      };
      
    } catch (err: any) {
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
        status: updatedTransaction.status,
        // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
        subscription_fingerprint: updatedTransaction.subscription_fingerprint || null,
        original_future_id: updatedTransaction.original_future_id || null,
        reconciliation_group: updatedTransaction.reconciliation_group || null,
        is_reconciled: updatedTransaction.is_reconciled || false,
        fatura_fechada_id: updatedTransaction.fatura_fechada_id || null,
        valor_original: updatedTransaction.valor_original || null,
        reconciled_at: updatedTransaction.reconciled_at || null,
        reconciled_with_transaction_id: updatedTransaction.reconciled_with_transaction_id || null
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
    } catch (err: any) {
      console.error('Erro ao atualizar transação futura:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar transação futura');
      throw err;
    }
  };

  // ===== NOVA FUNÇÃO: Comparar fatura fechada =====
  const compareFaturaFechada = (projected: FutureTransaction[], real: Transaction[]): FaturaAnalysis => {
    console.log('🔍 Comparando fatura projetada vs fechada');
    console.log('📊 Futures projetadas:', projected.length);
    console.log('📊 Transações reais:', real.length);
    
    return compareFaturas(projected, real);
  };

  // ===== NOVA FUNÇÃO: Aplicar correções da fatura =====
  const applyFaturaCorrections = async (corrections: FaturaAnalysis): Promise<{
    success: boolean;
    updatedCount: number;
    createdCount: number;
    deletedCount: number;
    errors: string[];
  }> => {
    try {
      console.log('🔧 Aplicando correções da fatura...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      let updatedCount = 0;
      let createdCount = 0;
      let deletedCount = 0;
      const errors: string[] = [];

      // ETAPA 1: Atualizar transações que mudaram
      if (corrections.changed.length > 0) {
        console.log('⚠️ Atualizando', corrections.changed.length, 'transações alteradas...');
        
        for (const change of corrections.changed) {
          const updatedFuture: FutureTransaction = {
            ...change.future,
            valor: change.newValue,
            valor_original: change.future.valor,
            status: 'confirmed'
          };
          
          await updateFutureTransaction(updatedFuture);
          updatedCount++;
        }
      }

      // ETAPA 2: Criar futures para transações adicionadas
      if (corrections.added.length > 0) {
        console.log('➕ Criando', corrections.added.length, 'novas futures...');
        
        const newFutures: FutureTransaction[] = corrections.added.map(transaction => ({
          id: `REAL_${transaction.id}`,
          mes_vencimento: transaction.mes,
          data_vencimento: transaction.data,
          descricao_origem: transaction.descricao_origem,
          categoria: '',
          subtipo: '',
          descricao: transaction.descricao_origem,
          valor: transaction.valor,
          origem: transaction.origem,
          cc: transaction.cc,
          parcela_atual: 1,
          parcela_total: 1,
          estabelecimento: transaction.descricao_origem,
          status: 'confirmed',
          fatura_fechada_id: transaction.id
        }));

        await addFutureTransactions(newFutures);
        createdCount = newFutures.length;
      }

      // ETAPA 3: Remover futures que não apareceram
      if (corrections.removed.length > 0) {
        console.log('❌ Removendo', corrections.removed.length, 'futures não confirmadas...');
        
        for (const future of corrections.removed) {
          await deleteFutureTransaction(future.id);
          deletedCount++;
        }
      }

      console.log('✅ Correções aplicadas com sucesso');
      console.log(`  📊 Atualizadas: ${updatedCount}`);
      console.log(`  ➕ Criadas: ${createdCount}`);
      console.log(`  ❌ Removidas: ${deletedCount}`);

      return {
        success: true,
        updatedCount,
        createdCount,
        deletedCount,
        errors
      };

    } catch (err: any) {
      console.error('❌ Erro ao aplicar correções:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      
      return {
        success: false,
        updatedCount: 0,
        createdCount: 0,
        deletedCount: 0,
        errors: [errorMessage]
      };
    }
  };

  // ===== NOVA FUNÇÃO: Obter todos os grupos de reconciliação =====
  const getAllReconciliationGroupsFromState = (): ReconciliationGroup[] => {
    return getAllReconciliationGroups(futureTransactions);
  };

  // ===== NOVA FUNÇÃO: Reconciliar com pagamento =====
  const reconcileWithPayment = async (
    transaction: Transaction, 
    futures: FutureTransaction[]
  ): Promise<{
    success: boolean;
    convertedCount: number;
    errors: string[];
  }> => {
    try {
      console.log('🔗 Iniciando reconciliação...');
      console.log('💳 Transação:', transaction.id);
      console.log('📋 Futures:', futures.length);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      let convertedCount = 0;
      const errors: string[] = [];

      // ETAPA 1: Marcar futures como reconciliadas
      const reconciliationGroup = futures[0]?.reconciliation_group || 
                                 `${transaction.origem}_${transaction.mes}`;
      const reconciliationTimestamp = new Date().toISOString();

      for (const future of futures) {
        const reconciledFuture: FutureTransaction = {
          ...future,
          is_reconciled: true,
          reconciled_at: reconciliationTimestamp,
          reconciled_with_transaction_id: transaction.id,
          reconciliation_group: reconciliationGroup
        };

        await updateFutureTransaction(reconciledFuture);
        convertedCount++;
      }

      // ETAPA 2: Atualizar estado local para remover futures reconciliadas
      setFutureTransactions(prev => 
        prev.filter(f => !futures.find(rf => rf.id === f.id))
      );

      console.log('✅ Reconciliação concluída com sucesso');
      console.log(`  📊 Futures reconciliadas: ${convertedCount}`);

      return {
        success: true,
        convertedCount,
        errors
      };

    } catch (err: any) {
      console.error('❌ Erro na reconciliação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      
      return {
        success: false,
        convertedCount: 0,
        errors: [errorMessage]
      };
    }
  };

  // ===== NOVA FUNÇÃO: Verificar assinaturas existentes =====
  const checkExistingSubscriptions = async (transaction: Transaction): Promise<boolean> => {
    try {
      console.log('🔍 Verificando assinaturas existentes para:', transaction.descricao_origem);
      return false;
    } catch (err: any) {
      console.error('❌ Erro ao verificar assinaturas existentes:', err);
      return false;
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
        // Atualizar todas as parcelas relacionadas
        const updatesData = relatedTransactions.map(t => ({
          id: t.id,
          user_id: user.id,
          original_transaction_id: t.original_transaction_id,
          mes_vencimento: t.mes_vencimento,
          data_vencimento: t.data_vencimento,
          descricao_origem: t.descricao_origem,
          categoria: categoria,
          subtipo: subtipo,
          descricao: originalTransaction.descricao,
          valor: t.valor,
          origem: t.origem,
          cc: t.cc,
          parcela_atual: t.parcela_atual,
          parcela_total: t.parcela_total,
          estabelecimento: t.estabelecimento,
          status: 'confirmed',
          // Manter campos de reconciliação existentes
          subscription_fingerprint: t.subscription_fingerprint,
          original_future_id: t.original_future_id,
          reconciliation_group: t.reconciliation_group,
          is_reconciled: t.is_reconciled,
          fatura_fechada_id: t.fatura_fechada_id,
          valor_original: t.valor_original,
          reconciled_at: t.reconciled_at,
          reconciled_with_transaction_id: t.reconciled_with_transaction_id
        }));

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
      }
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
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
    refreshFutureTransactions: loadFutureTransactions,
    // ===== NOVAS FUNÇÕES PARA RECONCILIAÇÃO =====
    compareFaturaFechada,
    applyFaturaCorrections,
    getAllReconciliationGroups: getAllReconciliationGroupsFromState,
    reconcileWithPayment,
    checkExistingSubscriptions
  };
}