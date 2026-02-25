// hooks/useTransactions.ts - VERSÃO CORRIGIDA COM TIPAGEM E SUPORTE INTER PAG

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, countsInBalance, isExecuted, InterPagSplitResult } from '@/types';
import { CardTransaction } from './useCardTransactions';
// Função legacy removida - usar apenas subtipo_id

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

      // Primeira tentativa: carregar transações SEM JOIN
      const { data: rawTransactions, error: supabaseError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      // Segunda consulta: buscar hierarquia para todas as transações que têm subtipo_id
      const transactionsWithSubtipo = rawTransactions?.filter(t => t.subtipo_id) || [];
      const subtipoIds = [...new Set(transactionsWithSubtipo.map(t => t.subtipo_id))];
      
      let hierarchyMap: Record<string, any> = {};
      
      if (subtipoIds.length > 0) {
        const { data: hierarchyData, error: hierarchyError } = await supabase
          .from('vw_hierarquia_completa')
          .select('*')
          .in('subtipo_id', subtipoIds);
        
        if (hierarchyError) {
          console.warn('Erro ao carregar hierarquia:', hierarchyError);
        } else {
          hierarchyMap = (hierarchyData || []).reduce((acc, item) => {
            acc[item.subtipo_id] = item;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Combinar dados: adicionar hierarchy a cada transação
      const data = rawTransactions?.map(transaction => ({
        ...transaction,
        hierarchy: transaction.subtipo_id ? hierarchyMap[transaction.subtipo_id] : null
      })) || [];

      console.log('🔍 loadTransactions - Total loaded:', data.length);
      console.log('🔍 loadTransactions - With hierarchy:', data.filter(t => t.hierarchy).length);
      console.log('🔍 loadTransactions - CONC transactions:', data.filter(t => t.hierarchy?.conta_codigo === 'CONC').length);

      setTransactions(data);
    } catch (err) {
      console.error('Erro ao carregar transações:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

// ✅ FUNÇÃO OTIMIZADA - substitua sua addTransactions por esta:

const addTransactions = async (newTransactions: Transaction[]) => {
  try {
    console.log('📄 Iniciando addTransactions com:', newTransactions.length, 'transações');
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // Preparar dados para inserção (sem conta/categoria/subtipo - preenchidos por trigger)
    const transactionsToInsert = newTransactions.map(transaction => ({
      id: transaction.id,
      user_id: user.id,
      mes: transaction.mes,
      data: transaction.data,
      descricao_origem: transaction.descricao_origem,
      descricao: transaction.descricao || transaction.descricao_origem,
      valor: transaction.valor,
      origem: transaction.origem,
      cc: transaction.cc,
      realizado: transaction.realizado,
      // ✅ APENAS subtipo_id - trigger preencherá conta/categoria/subtipo automaticamente
      subtipo_id: transaction.subtipo_id || null,
      // Campos de reconciliação
      linked_future_group: transaction.linked_future_group || null,
      is_from_reconciliation: transaction.is_from_reconciliation || false,
      future_subscription_id: transaction.future_subscription_id || null,
      reconciliation_metadata: transaction.reconciliation_metadata || null
    }));

    console.log('📊 Total de transações para inserir:', transactionsToInsert.length);

    // ✅ OTIMIZAÇÃO 1: Verificar duplicatas de forma mais eficiente
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
    
    // ✅ OTIMIZAÇÃO 2: Filtrar apenas as novas ANTES de enviar
    const onlyNewTransactions = transactionsToInsert.filter(t => !existingIdSet.has(t.id));
    const newCount = onlyNewTransactions.length;

    console.log('📊 Análise de duplicatas:');
    console.log('  📊 Total enviado:', transactionsToInsert.length);
    console.log('  ✅ Novas:', newCount);
    console.log('  📄 Duplicatas:', duplicatesCount);

    // Se não há nada novo para inserir
    if (onlyNewTransactions.length === 0) {
      console.log('⏭️ Nenhuma transação nova para inserir');
      
      return {
        success: true,
        stats: {
          total: transactionsToInsert.length,
          added: 0,
          duplicates: duplicatesCount
        }
      };
    }

    // ✅ OTIMIZAÇÃO 3: INSERT direto das novas (sem .select() lento)
    console.log('🚀 Inserindo', onlyNewTransactions.length, 'transações novas...');
    // console.log('🔍 Dados sendo enviados para Supabase:', JSON.stringify(onlyNewTransactions, null, 2));
    const startTime = Date.now();

    // console.log('🔍 Tentando inserir no Supabase...');
    const { data: insertResult, error: supabaseError } = await supabase
      .from('transactions')
      .insert(onlyNewTransactions)
      .select(); // Adicionar select para ver o que retorna
    
    // console.log('🔍 Resultado da inserção:', insertResult);
    // console.log('🔍 Erro da inserção:', supabaseError);

    const endTime = Date.now();
    console.log(`⚡ Inserção concluída em ${endTime - startTime}ms`);

    if (supabaseError) {
      console.error('❌ Erro do Supabase - code:', supabaseError.code);
      console.error('❌ Erro do Supabase - message:', supabaseError.message);
      console.error('❌ Erro do Supabase - details:', supabaseError.details);
      console.error('❌ Erro do Supabase - hint:', supabaseError.hint);
      console.error('❌ Erro do Supabase - full object:', JSON.stringify(supabaseError, null, 2));
      throw supabaseError;
    }

    // ✅ OTIMIZAÇÃO 4: Atualizar estado local apenas com as novas
    setTransactions(prev => {
      const newTransactionsToAdd = newTransactions.filter(t => !existingIdSet.has(t.id));
      console.log('✅ Adicionando ao estado local:', newTransactionsToAdd.length, 'novas transações');
      return [...prev, ...newTransactionsToAdd];
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
    console.error('❌ Erro completo:', err);
    setError(err instanceof Error ? err.message : 'Erro ao salvar transações');
    throw err;
  }
};

  // Atualizar uma transação específica
  const updateTransaction = async (updatedTransaction: Transaction): Promise<Transaction | null> => {
    const transactionToUpdate = {
      mes: updatedTransaction.mes,
      data: updatedTransaction.data,
      descricao_origem: updatedTransaction.descricao_origem,
      // ✅ SÓ SUBTIPO_ID - os outros campos não existem mais
      subtipo_id: updatedTransaction.subtipo_id || null,
      descricao: updatedTransaction.descricao,
      valor: updatedTransaction.valor,
      origem: updatedTransaction.origem,
      cc: updatedTransaction.cc,
      realizado: updatedTransaction.realizado,
      linked_future_group: updatedTransaction.linked_future_group || null,
      is_from_reconciliation: updatedTransaction.is_from_reconciliation || false,
      future_subscription_id: updatedTransaction.future_subscription_id || null,
      reconciliation_metadata: updatedTransaction.reconciliation_metadata || null,
      updated_at: new Date().toISOString()
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // ✅ VERIFICAR SE A TRANSAÇÃO EXISTE ANTES DE ATUALIZAR
      const { data: existingTransaction, error: checkError } = await supabase
        .from('transactions')
        .select('id, user_id')
        .eq('id', updatedTransaction.id)
        .single();

      if (checkError) {
        console.error('❌ Erro ao verificar transação existente:', checkError);
        console.error('❌ ID procurado:', updatedTransaction.id);
        throw new Error(`Transação não encontrada: ${updatedTransaction.id}`);
      }

      if (existingTransaction.user_id !== user.id) {
        throw new Error('Transação pertence a outro usuário');
      }

      const { data, error: supabaseError } = await supabase
        .from('transactions')
        .update(transactionToUpdate)
        .eq('id', updatedTransaction.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ Erro no update:', supabaseError);
        console.error('❌ Dados enviados:', transactionToUpdate);
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
      console.error('❌ Erro COMPLETO ao atualizar transação:', err);
      console.error('❌ Dados que tentei enviar:', transactionToUpdate);
      console.error('❌ Transaction original:', updatedTransaction);
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
        // ✅ USAR data da transação de pagamento (regime de competência)
        const dateParts = linkedPaymentTransaction.data.split('-');
        const mes = dateParts.length === 3
          ? `${dateParts[0].slice(-2)}${dateParts[1]}`
          : '';

        // Conta será determinada por trigger no banco baseada no subtipo_id

        return {
          id: transactionId,
          mes: mes,
          data: card.data_transacao,
          descricao_origem: card.descricao_origem,
          subtipo_id: card.subtipo_id ?? null, // ✅ HERDAR classificação do card_transaction
          descricao: card.descricao_classificada || card.descricao_origem,
          valor: card.valor,
          origem: card.origem, // Mantém origem original (ex: "MasterCard", "VISA")
          cc: linkedPaymentTransaction.cc, // ✅ CORREÇÃO: Herda CC do pagamento!
          realizado: 's' as const,
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

      console.log('📊 Preparadas', newTransactions.length, 'novas transactions');
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
          console.error('❌ Erro ao inserir batch:', insertError);
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
      console.error('❌ Erro ao criar transactions:', err);
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
        original_subtipo_id: transaction.subtipo_id,
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
      console.error('❌ Erro ao marcar como reconciliada:', err);
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
      console.error('❌ Erro na reconciliação completa:', err);
      return {
        success: false,
        createdTransactions: 0,
        errors: [err instanceof Error ? err.message : 'Erro desconhecido']
      };
    }
  };

  // ===== NOVA FUNÇÃO: Executar quebra Inter Pag =====
  const executeInterPagSplit = async (
    originalTransactions: Transaction[],
    splitResults: InterPagSplitResult[]
  ): Promise<{
    success: boolean;
    createdTransactions: number;
    reconciledTransactions: number;
    errors: string[];
  }> => {
    try {
      console.log('🟠 Executando quebra Inter Pag...');
      console.log('📊 Transações originais:', originalTransactions.length);
      console.log('📈 Resultados de quebra:', splitResults.length);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      let createdCount = 0;
      let reconciledCount = 0;
      const errors: string[] = [];

      // ETAPA 1: Marcar transações originais como reconciliadas (realizado = 'r')
      for (const transaction of originalTransactions) {
        try {
          const reconciliationMetadata = {
            reconciled_at: new Date().toISOString(),
            reconciled_by: 'interpag_split',
            original_valor: transaction.valor,
            split_type: 'interpag_percentage',
            status: 'split_reconciled'
          };

          const updatedTransaction: Transaction = {
            ...transaction,
            is_from_reconciliation: true,
            reconciliation_metadata: JSON.stringify(reconciliationMetadata),
            realizado: 'r' as const // ✅ CRUCIAL: 'r' = reconciliado (não conta no saldo)
          };

          await updateTransaction(updatedTransaction);
          reconciledCount++;

          console.log(`✅ Transação ${transaction.id} marcada como reconciliada`);

        } catch (error) {
          console.error(`❌ Erro ao reconciliar transação ${transaction.id}:`, error);
          errors.push(`Erro ao reconciliar ${transaction.id}: ${error}`);
        }
      }

      // ETAPA 2: Criar novas transações quebradas
      const allNewTransactions: Transaction[] = [];

      for (const splitResult of splitResults) {
        // Adicionar transação de catálogo (se valor > 0)
        if (splitResult.catalogoTransaction.valor && splitResult.catalogoTransaction.valor > 0) {
          allNewTransactions.push(splitResult.catalogoTransaction as Transaction);
        }

        // Adicionar transação de planos (se valor > 0)
        if (splitResult.planosTransaction.valor && splitResult.planosTransaction.valor > 0) {
          allNewTransactions.push(splitResult.planosTransaction as Transaction);
        }
      }

      // Inserir as novas transações
      if (allNewTransactions.length > 0) {
        const transactionsToInsert = allNewTransactions.map(transaction => ({
          ...transaction,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactionsToInsert);

        if (insertError) {
          console.error('❌ Erro ao inserir transações quebradas:', insertError);
          errors.push(`Erro ao inserir transações: ${insertError.message}`);
        } else {
          createdCount = allNewTransactions.length;
          console.log(`✅ ${createdCount} novas transações criadas`);
        }
      }

      // ETAPA 3: Recarregar dados
      await loadTransactions();

      console.log('✅ Quebra Inter Pag concluída:', {
        reconciledCount,
        createdCount,
        errorsCount: errors.length
      });

      return {
        success: createdCount > 0 && reconciledCount > 0,
        createdTransactions: createdCount,
        reconciledTransactions: reconciledCount,
        errors
      };

    } catch (err) {
      console.error('❌ Erro na quebra Inter Pag:', err);
      return {
        success: false,
        createdTransactions: 0,
        reconciledTransactions: 0,
        errors: [err instanceof Error ? err.message : 'Erro desconhecido']
      };
    }
  };

  // ===== FUNÇÃO CORRIGIDA: Dividir uma transação em múltiplas partes =====
  const splitTransaction = async (
    originalTransaction: Transaction, 
    parts: Array<{
      subtipo_id: string;
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

      // Account será determinado por trigger no banco

      // ETAPA 1: Marcar transação original como reconciliada (auditoria)
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          realizado: 'r',
          descricao: `${originalTransaction.descricao} (DIVIDIDA)`
        })
        .eq('id', originalTransaction.id)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      console.log('✅ Transação original marcada como reconciliada para auditoria');

      // ETAPA 2: Criar novas transações divididas
      
      // ✅ CORREÇÃO: Usar apenas subtipo_id e adicionar referência à transação original
      const newTransactions: Omit<Transaction, 'user_id'>[] = parts.map((part, index) => ({
        id: `${originalTransaction.id}-SPLIT-${index + 1}`,
        mes: originalTransaction.mes,
        data: originalTransaction.data,
        descricao_origem: `${originalTransaction.descricao_origem} (parte ${index + 1}/${parts.length})`,
        subtipo_id: part.subtipo_id,
        descricao: part.descricao,
        valor: part.valor,
        origem: `${originalTransaction.origem} - Divisão`,
        cc: originalTransaction.cc,
        realizado: 's' as const,
        linked_future_group: originalTransaction.id, // ✅ Link para transação original
        is_from_reconciliation: originalTransaction.is_from_reconciliation,
        future_subscription_id: originalTransaction.future_subscription_id,
        reconciliation_metadata: JSON.stringify({
          ...JSON.parse(originalTransaction.reconciliation_metadata || '{}'),
          split_from: originalTransaction.id
        })
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
        // Atualizar transação original para realizado = 'r' (auditoria)
        const updatedOriginal = prev.map(t =>
          t.id === originalTransaction.id
            ? { ...t, realizado: 'r' as const, descricao: `${t.descricao} (DIVIDIDA)` }
            : t
        );

        // ✅ CORREÇÃO: Mapear corretamente com tipos seguros
        const newTransactionObjects: Transaction[] = newTransactions.map(nt => ({
          id: nt.id,
          mes: nt.mes,
          data: nt.data,
          descricao_origem: nt.descricao_origem,
          subtipo_id: nt.subtipo_id,
          descricao: nt.descricao,
          valor: nt.valor,
          origem: nt.origem,
          cc: nt.cc,
          realizado: nt.realizado,
          linked_future_group: nt.linked_future_group,
          is_from_reconciliation: nt.is_from_reconciliation,
          future_subscription_id: nt.future_subscription_id,
          reconciliation_metadata: nt.reconciliation_metadata
        }));

        // Adicionar novas transações divididas ao estado atualizado
        return [...updatedOriginal, ...newTransactionObjects];
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

  // ===== FUNÇÃO NOVA: Criar lançamento manual =====
  const createManualTransaction = async (formData: {
    data: string;
    valor: number;
    origem: string;
    cc: string;
    descricao: string;
    subtipo_id: string; // ✅ NOVO: Apenas subtipo_id
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

      // ✅ NOVO: Criar objeto Transaction apenas com subtipo_id
      const newTransaction: Transaction = {
        id: transactionId,
        mes: mes,
        data: formData.data,
        descricao_origem: formData.descricao,
        descricao: formData.descricao,
        valor: formData.valor,
        origem: formData.origem,
        cc: formData.cc,
        realizado: formData.subtipo_id ? 's' as const : 'p' as const, // ✅ Se tem classificação = realizado, senão = pendente
        subtipo_id: formData.subtipo_id || null, // ✅ ÚNICO campo de hierarquia - null se vazio
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

      console.log('📊 Criando lançamento manual:', {
        id: transactionId,
        valor: formData.valor,
        subtipo_id: formData.subtipo_id
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
    executeInterPagSplit, // ✅ NOVA FUNÇÃO PARA INTER PAG
    
    // ✅ NOVAS FUNÇÕES AUXILIARES
    getBalanceTransactions,      // Só as que contam no saldo (realizado = 's')
    getExecutedTransactions,     // Executadas (realizado = 's' ou 'r')
    getPendingTransactions,      // Pendentes (realizado = 'p')
    getReconciledTransactions,   // Reconciliadas (realizado = 'r')
    
    // Refresh
    refreshTransactions: loadTransactions
  };
}