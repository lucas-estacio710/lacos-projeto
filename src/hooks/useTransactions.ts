// hooks/useTransactions.ts - VERSÃO CORRIGIDA COM TIPAGEM

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, countsInBalance, isExecuted } from '@/types';
import { CardTransaction } from './useCardTransactions';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

// ===== FUNÇÃO HELPER: Determinar conta baseada na categoria =====
const getContaFromCategoria = (categoria: string): string => {
  if (Object.keys(categoriesPJ).includes(categoria)) return 'PJ';
  if (Object.keys(categoriesPF).includes(categoria)) return 'PF';
  if (Object.keys(categoriesCONC).includes(categoria)) return 'CONC.';
  return 'PF';
};

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
      console.log('📄 Iniciando addTransactions com:', newTransactions.length, 'transações');
      
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
        subtipo: transaction.subtipo || '',
        categoria: transaction.categoria || '',
        descricao: transaction.descricao || transaction.descricao_origem,
        valor: transaction.valor,
        origem: transaction.origem,
        cc: transaction.cc,
        realizado: transaction.realizado,
        conta: transaction.conta || '',
        // Campos de reconciliação
        linked_future_group: transaction.linked_future_group || null,
        is_from_reconciliation: transaction.is_from_reconciliation || false,
        future_subscription_id: transaction.future_subscription_id || null,
        reconciliation_metadata: transaction.reconciliation_metadata || null
      }));

      console.log('📝 Total de transações para inserir:', transactionsToInsert.length);

      // Verificar duplicatas
      const existingIds = transactionsToInsert.map(t => t.id);
      const { data: existingTransactions, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .in('id', existingIds);

      if (checkError) {
        console.error('⌐ Erro ao verificar duplicatas:', checkError);
        throw checkError;
      }

      const existingIdSet = new Set(existingTransactions?.map(t => t.id) || []);
      const duplicatesCount = existingIds.filter(id => existingIdSet.has(id)).length;
      const newCount = transactionsToInsert.length - duplicatesCount;

      console.log('📊 Análise de duplicatas:');
      console.log('  📊 Total enviado:', transactionsToInsert.length);
      console.log('  ✅ Novas:', newCount);
      console.log('  📄 Duplicatas:', duplicatesCount);

      // Inserir com upsert
      const { error: supabaseError } = await supabase
        .from('transactions')
        .upsert(transactionsToInsert, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select();

      if (supabaseError) {
        console.error('⌐ Erro do Supabase:', supabaseError);
        throw supabaseError;
      }

      // Atualizar estado local
      setTransactions(prev => {
        const prevIdSet = new Set(prev.map(t => t.id));
        const newOnes = newTransactions.filter(t => !prevIdSet.has(t.id));
        console.log('✅ Adicionando ao estado local:', newOnes.length, 'novas transações');
        return [...prev, ...newOnes];
      });

      console.log('✅ addTransactions concluído com sucesso');
      
      return {
        success: true,
        stats: {
          total: transactionsToInsert.length,
          added: newCount,
          duplicates: duplicatesCount
        }
      };
      
    } catch (err) {
      console.error('⌐ Erro completo:', err);
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

  // ===== FUNÇÃO CORRIGIDA: Criar transactions a partir de card_transactions =====
  const createTransactionsFromCards = async (
    cardTransactions: CardTransaction[],
    linkedPaymentTransaction: Transaction, // ✅ Receber transaction completa
    faturaId: string
  ): Promise<{ success: boolean; created: number; errors: string[] }> => {
    try {
      console.log('📄 Criando transactions a partir de card_transactions...');
      console.log('💳 Cards:', cardTransactions.length);
      console.log('🔗 Payment Transaction:', linkedPaymentTransaction.id);
      console.log('🏦 Payment CC:', linkedPaymentTransaction.cc);
      console.log('📋 Fatura:', faturaId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Criar transactions baseadas nas card_transactions
      const newTransactions: Transaction[] = cardTransactions.map(card => {
        // Gerar ID único para a transaction
        const transactionId = `REC_${card.id}`;
        
        // Determinar o mês baseado na data (formato AAMM)
        const dateParts = card.data_transacao.split('-');
        const mes = dateParts.length === 3 
          ? `${dateParts[0].slice(-2)}${dateParts[1]}` 
          : '';

        // Determinar conta baseada na categoria
        const conta = card.categoria ? getContaFromCategoria(card.categoria) : '';

        return {
          id: transactionId,
          mes: mes,
          data: card.data_transacao,
          descricao_origem: card.descricao_origem,
          subtipo: card.subtipo || '',
          categoria: card.categoria || '',
          descricao: card.descricao_classificada || card.descricao_origem,
          valor: card.valor,
          origem: card.origem, // Mantém origem original (ex: "MasterCard", "VISA")
          cc: linkedPaymentTransaction.cc, // ✅ CORREÇÃO: Herda CC do pagamento!
          realizado: 's' as const, // ✅ Marcar como realizado normal (conta no saldo)
          conta: conta,
          // Metadata de reconciliação
          linked_future_group: faturaId,
          is_from_reconciliation: true,
          future_subscription_id: linkedPaymentTransaction.id,
          reconciliation_metadata: JSON.stringify({
            card_transaction_id: card.id,
            fatura_id: faturaId,
            payment_id: linkedPaymentTransaction.id,
            payment_cc: linkedPaymentTransaction.cc,
            original_card_cc: card.cc,
            reconciled_at: new Date().toISOString()
          })
        };
      });

      console.log('📝 Preparadas', newTransactions.length, 'novas transactions');
      console.log('🏦 Todas as transactions terão CC:', linkedPaymentTransaction.cc);

      // Inserir em lotes
      const BATCH_SIZE = 50;
      let createdCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
        const batch = newTransactions.slice(i, i + BATCH_SIZE);
        
        const batchToInsert = batch.map(t => ({
          ...t,
          user_id: user.id
        }));

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(batchToInsert);

        if (insertError) {
          console.error('⌐ Erro ao inserir batch:', insertError);
          errors.push(`Erro no batch ${i/BATCH_SIZE + 1}: ${insertError.message}`);
        } else {
          createdCount += batch.length;
        }
      }

      // Atualizar estado local
      await loadTransactions();

      console.log('✅ Criação concluída:', createdCount, 'transactions criadas com CC:', linkedPaymentTransaction.cc);

      return {
        success: createdCount > 0,
        created: createdCount,
        errors
      };

    } catch (err) {
      console.error('⌐ Erro ao criar transactions:', err);
      return {
        success: false,
        created: 0,
        errors: [err instanceof Error ? err.message : 'Erro desconhecido']
      };
    }
  };

  // ===== FUNÇÃO CORRIGIDA: Marcar transação como reconciliada =====
  const markAsReconciled = async (
    transaction: Transaction, 
    faturaId: string
  ): Promise<{ success: boolean }> => {
    try {
      console.log('🔗 Marcando transação como reconciliada:', transaction.id);
      console.log('📋 Fatura:', faturaId);
      console.log('💰 Valor original:', transaction.valor);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const reconciliationMetadata = {
        reconciled_at: new Date().toISOString(),
        fatura_id: faturaId,
        reconciled_by: 'manual',
        original_valor: transaction.valor,
        original_conta: transaction.conta,
        original_categoria: transaction.categoria,
        original_subtipo: transaction.subtipo,
        status: 'payment_reconciled'
      };

      const updatedTransaction: Transaction = {
        ...transaction,
        linked_future_group: faturaId,
        is_from_reconciliation: true,
        reconciliation_metadata: JSON.stringify(reconciliationMetadata),
        realizado: 'r' as const // ✅ MUDANÇA CRUCIAL: 'r' = reconciliado (não conta no saldo)
      };

      await updateTransaction(updatedTransaction);

      console.log('✅ Transação marcada como reconciliada e EXCLUÍDA dos cálculos de saldo');
      return { success: true };

    } catch (err) {
      console.error('⌐ Erro ao marcar como reconciliada:', err);
      throw err;
    }
  };

  // ===== FUNÇÃO ATUALIZADA: Executar reconciliação completa =====
  const executeReconciliation = async (
    paymentTransaction: Transaction,
    cardTransactions: CardTransaction[],
    faturaId: string
  ): Promise<{
    success: boolean;
    createdTransactions: number;
    errors: string[];
  }> => {
    try {
      console.log('🔗 Executando reconciliação completa...');
      console.log('💰 Pagamento:', paymentTransaction.descricao_origem, 'CC:', paymentTransaction.cc);
      console.log('💳 Cards para reconciliar:', cardTransactions.length);

      // ETAPA 1: Marcar pagamento como reconciliado (realizado = 'r')
      await markAsReconciled(paymentTransaction, faturaId);

      // ETAPA 2: Criar transactions a partir dos cards (COM CC CORRETO)
      const createResult = await createTransactionsFromCards(
        cardTransactions,
        paymentTransaction, // ✅ Passar transaction completa
        faturaId
      );

      if (!createResult.success) {
        throw new Error(`Falha ao criar transactions: ${createResult.errors.join(', ')}`);
      }

      console.log('✅ Reconciliação completa executada com sucesso');
      console.log(`💡 RESULTADO FINAL:`);
      console.log(`   - Pagamento ${paymentTransaction.cc}: realizado = 'r' (NÃO conta no saldo)`);
      console.log(`   - ${createResult.created} gastos: CC = "${paymentTransaction.cc}", realizado = 's' (conta no saldo)`);
      console.log(`   - Saldo final em ${paymentTransaction.cc}: apenas os gastos reconciliados`);

      return {
        success: true,
        createdTransactions: createResult.created,
        errors: createResult.errors
      };

    } catch (err) {
      console.error('⌐ Erro na reconciliação completa:', err);
      return {
        success: false,
        createdTransactions: 0,
        errors: [err instanceof Error ? err.message : 'Erro desconhecido']
      };
    }
  };

  // ===== FUNÇÃO CORRIGIDA: Dividir uma transação em múltiplas partes =====
  const splitTransaction = async (
    originalTransaction: Transaction, 
    parts: Array<{
      categoria: string;
      subtipo: string;
      descricao: string;
      valor: number;
    }>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('📄 Iniciando divisão da transação:', originalTransaction.id);

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
      
      // ✅ CORREÇÃO: Usar tipos literais corretos
      const newTransactions: Omit<Transaction, 'user_id'>[] = parts.map((part, index) => ({
        id: `${originalTransaction.id}-${index + 1}`,
        mes: originalTransaction.mes,
        data: originalTransaction.data,
        descricao_origem: originalTransaction.descricao_origem,
        subtipo: part.subtipo,
        categoria: part.categoria,
        descricao: part.descricao,
        valor: part.valor,
        origem: originalTransaction.origem,
        cc: originalTransaction.cc,
        realizado: 's' as const, // ✅ Usar 'as const' para garantir tipo literal
        conta: account,
        linked_future_group: originalTransaction.linked_future_group,
        is_from_reconciliation: originalTransaction.is_from_reconciliation,
        future_subscription_id: originalTransaction.future_subscription_id,
        reconciliation_metadata: originalTransaction.reconciliation_metadata
      }));

      const transactionsToInsert = newTransactions.map(nt => ({
        ...nt,
        user_id: user.id
      }));

      const { data: insertedTransactions, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log('✅ Novas transações criadas:', insertedTransactions?.length);

      // ETAPA 3: Atualizar estado local
      setTransactions(prev => {
        const withoutOriginal = prev.filter(t => t.id !== originalTransaction.id);
        
        // ✅ CORREÇÃO: Mapear corretamente com tipos seguros
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
          realizado: nt.realizado, // ✅ Agora está tipado corretamente como 's'
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
      console.error('⌐ Erro ao dividir transação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao dividir transação');
      throw err;
    }
  };

  // ===== FUNÇÃO NOVA: Criar lançamento manual =====
  const createManualTransaction = async (formData: {
    data: string;
    valor: number;
    origem: string;
    cc: string;
    descricao: string;
    conta: string;
    categoria: string;
    subtipo: string;
  }): Promise<Transaction> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Gerar campos automáticos
      const now = new Date();
      const transactionId = `MANUAL_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Gerar mês no formato AAMM
      const dateParts = formData.data.split('-');
      const mes = dateParts.length === 3 
        ? `${dateParts[0].slice(-2)}${dateParts[1]}` 
        : '';

      // Criar objeto Transaction
      const newTransaction: Transaction = {
        id: transactionId,
        mes: mes,
        data: formData.data,
        descricao_origem: formData.descricao,
        subtipo: formData.subtipo,
        categoria: formData.categoria,
        descricao: formData.descricao,
        valor: formData.valor,
        origem: formData.origem,
        cc: formData.cc,
        realizado: 's' as const, // ✅ Lançamento manual sempre realizado
        conta: formData.conta,
        // Campos de reconciliação vazios para lançamento manual
        linked_future_group: undefined,
        is_from_reconciliation: false,
        future_subscription_id: undefined,
        reconciliation_metadata: JSON.stringify({
          created_manually: true,
          created_at: now.toISOString(),
          form_data: formData
        })
      };

      console.log('📝 Criando lançamento manual:', {
        id: transactionId,
        valor: formData.valor,
        categoria: formData.categoria,
        subtipo: formData.subtipo
      });

      // Inserir no Supabase
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          ...newTransaction,
          user_id: user.id
        });

      if (insertError) {
        throw insertError;
      }

      // Atualizar estado local
      setTransactions(prev => [newTransaction, ...prev]);

      console.log('✅ Lançamento manual criado com sucesso:', transactionId);
      return newTransaction;

    } catch (err) {
      console.error('⛔ Erro ao criar lançamento manual:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar lançamento manual');
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

  // ===== FUNÇÕES AUXILIARES PARA FILTRAR POR TIPO DE REALIZADO =====
  
  // Transações que contam no saldo (apenas realizado = 's')
  const getBalanceTransactions = (): Transaction[] => {
    return transactions.filter(t => countsInBalance(t.realizado));
  };

  // Transações executadas (realizado = 's' ou 'r')
  const getExecutedTransactions = (): Transaction[] => {
    return transactions.filter(t => isExecuted(t.realizado));
  };

  // Transações pendentes (realizado = 'p')
  const getPendingTransactions = (): Transaction[] => {
    return transactions.filter(t => t.realizado === 'p');
  };

  // Transações reconciliadas (realizado = 'r')
  const getReconciledTransactions = (): Transaction[] => {
    return transactions.filter(t => t.realizado === 'r');
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
    // Estado
    transactions,
    loading,
    error,
    
    // Funções principais
    addTransactions,
    updateTransaction,
    deleteTransaction,
    clearAllTransactions,
    splitTransaction,
    markAsReconciled,
    createTransactionsFromCards,
    executeReconciliation,
    createManualTransaction, // ✅ NOVA FUNÇÃO
    
    // ✅ NOVAS FUNÇÕES AUXILIARES
    getBalanceTransactions,      // Só as que contam no saldo (realizado = 's')
    getExecutedTransactions,     // Executadas (realizado = 's' ou 'r')
    getPendingTransactions,      // Pendentes (realizado = 'p')
    getReconciledTransactions,   // Reconciliadas (realizado = 'r')
    
    // Refresh
    refreshTransactions: loadTransactions
  };
}