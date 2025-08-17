// hooks/useCardTransactions.ts - ATUALIZADO COM FUNÇÃO SPLIT PARA CARTÕES

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Interface para transações de cartão
export interface CardTransaction {
  id: string;
  user_id?: string;
  fingerprint?: string; // Identificador determinístico para deduplicação
  fatura_id: string; // ex: "NUBANK_2508"
  data_transacao: string; // ISO format YYYY-MM-DD
  descricao_origem: string;
  valor: number;
  categoria?: string | null;
  subtipo?: string | null;
  descricao_classificada?: string | null;
  status: 'pending' | 'classified' | 'reconciled';
  origem: string; // "Nubank", "Santander", etc
  cc: string; // Cartão/Banco
  created_at?: string;
  updated_at?: string;
}

// Interface para matching de faturas
export interface FaturaMatch {
  tipo: 'PERFEITO' | 'QUASE_PERFEITO' | 'NOVO' | 'REMOVIDO';
  transacaoExistente?: CardTransaction;
  transacaoNova?: CardTransaction;
  diferenca?: {
    campo: string;
    valorAntigo: any;
    valorNovo: any;
  }[];
}

// Interface para resultado de importação - SIMPLIFICADA
export interface ImportResult {
  success: boolean;
  stats: {
    total: number;
    added: number;
    duplicates: number;
    matched?: number;
  };
  // ✅ SEMPRE mostrar SimpleDiff agora
  requiresSimpleDiff: boolean;
  existingBill: CardTransaction[];
  newBill: CardTransaction[];
  faturaId: string;
}

export function useCardTransactions() {
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar transações de cartão do Supabase
  const loadCardTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data, error: supabaseError } = await supabase
        .from('card_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('data_transacao', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      setCardTransactions(data || []);
    } catch (err) {
      console.error('Erro ao carregar transações de cartão:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Verificar se já existe uma fatura
  const checkExistingFatura = async (faturaId: string): Promise<CardTransaction[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('card_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('fatura_id', faturaId);

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.error('Erro ao verificar fatura existente:', err);
      return [];
    }
  };

  // ===== FUNÇÃO PRINCIPAL: addCardTransactions - SEMPRE VAI PARA SIMPLEDIFF =====
  const addCardTransactions = async (
    newTransactions: CardTransaction[]
  ): Promise<ImportResult> => {
    try {
      console.log('📄 Iniciando addCardTransactions (NOVO FLUXO)');
      console.log('📦 Transações recebidas:', newTransactions.length);
      
      if (newTransactions.length === 0) {
        return {
          success: false,
          stats: { total: 0, added: 0, duplicates: 0 },
          requiresSimpleDiff: false,
          existingBill: [],
          newBill: [],
          faturaId: ''
        };
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const faturaId = newTransactions[0].fatura_id;
      console.log('📋 Verificando fatura existente:', faturaId);
      
      // ✅ SEMPRE verificar se existe fatura, mesmo que vazia
      const existingTransactions = await checkExistingFatura(faturaId);
      
      console.log('📊 Resultado da verificação:');
      console.log('  📋 Existentes:', existingTransactions.length);
      console.log('  📦 Novas:', newTransactions.length);
      
      // ✅ SEMPRE retornar para SimpleDiff (mesmo se não houver conflito)
      return {
        success: true,
        stats: {
          total: newTransactions.length,
          added: 0, // Ainda não foi adicionado
          duplicates: existingTransactions.length
        },
        requiresSimpleDiff: true, // ✅ SEMPRE TRUE
        existingBill: existingTransactions,
        newBill: newTransactions,
        faturaId: faturaId
      };
      
    } catch (err) {
      console.error('❌ Erro ao processar addCardTransactions:', err);
      return {
        success: false,
        stats: { total: newTransactions.length, added: 0, duplicates: 0 },
        requiresSimpleDiff: false,
        existingBill: [],
        newBill: [],
        faturaId: ''
      };
    }
  };

  // ===== NOVA FUNÇÃO: Aplicar mudanças do SimpleDiff =====
  const applySimpleDiffChanges = async (changes: {
    toAdd: CardTransaction[];
    toKeep: string[];
    toRemove: string[];
  }): Promise<{ success: boolean; stats: { added: number; kept: number; removed: number } }> => {
    try {
      console.log('📄 Aplicando mudanças do SimpleDiff...');
      console.log('  ➕ Para adicionar:', changes.toAdd.length);
      console.log('  ✅ Para manter:', changes.toKeep.length);
      console.log('  🗑️ Para remover:', changes.toRemove.length);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let addedCount = 0;
      let removedCount = 0;

      // ===== ETAPA 1: Remover transações marcadas para remoção =====
      if (changes.toRemove.length > 0) {
        console.log('🗑️ Removendo transações...');
        
        const { error: deleteError } = await supabase
          .from('card_transactions')
          .delete()
          .eq('user_id', user.id)
          .in('id', changes.toRemove);

        if (deleteError) {
          console.error('❌ Erro ao remover:', deleteError);
          throw deleteError;
        }

        removedCount = changes.toRemove.length;
        console.log(`✅ ${removedCount} transações removidas`);
      }

      // ===== ETAPA 2: Adicionar novas transações =====
      if (changes.toAdd.length > 0) {
        console.log('➕ Adicionando novas transações...');
        
        const transactionsToInsert = changes.toAdd.map(transaction => ({
          ...transaction,
          user_id: user.id,
          status: transaction.status || 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const BATCH_SIZE = 50;
        
        for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
          const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
          
          const { error: insertError } = await supabase
            .from('card_transactions')
            .insert(batch);

          if (insertError) {
            console.error('❌ Erro ao inserir batch:', insertError);
            throw insertError;
          }

          addedCount += batch.length;
        }

        console.log(`✅ ${addedCount} transações adicionadas`);
      }

      // ===== ETAPA 3: Recarregar dados =====
      await loadCardTransactions();
      
      console.log('✅ SimpleDiff aplicado com sucesso');
      
      return {
        success: true,
        stats: {
          added: addedCount,
          kept: changes.toKeep.length,
          removed: removedCount
        }
      };
      
    } catch (err) {
      console.error('❌ Erro ao aplicar SimpleDiff:', err);
      return {
        success: false,
        stats: { added: 0, kept: 0, removed: 0 }
      };
    }
  };

  // ===== FUNÇÃO SIMPLIFICADA: Substituir fatura completa =====
  const replaceFaturaComplete = async (
    faturaId: string, 
    newTransactions: CardTransaction[]
  ): Promise<{ success: boolean; stats: { added: number; removed: number } }> => {
    try {
      console.log('📄 Substituição completa da fatura:', faturaId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Remover todas as transações da fatura
      const { error: deleteError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('fatura_id', faturaId);

      if (deleteError) throw deleteError;

      // Adicionar todas as novas
      const transactionsToInsert = newTransactions.map(transaction => ({
        ...transaction,
        user_id: user.id,
        status: transaction.status || 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('card_transactions')
        .insert(transactionsToInsert);

      if (insertError) throw insertError;

      await loadCardTransactions();
      
      return {
        success: true,
        stats: {
          added: newTransactions.length,
          removed: 0 // Não sabemos quantas foram removidas
        }
      };
      
    } catch (err) {
      console.error('❌ Erro na substituição completa:', err);
      return {
        success: false,
        stats: { added: 0, removed: 0 }
      };
    }
  };

  // Atualizar uma transação de cartão
  const updateCardTransaction = async (updatedTransaction: CardTransaction): Promise<CardTransaction | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const transactionToUpdate = {
        ...updatedTransaction,
        updated_at: new Date().toISOString(),
        status: updatedTransaction.categoria && updatedTransaction.subtipo ? 'classified' : 'pending'
      };

      const { data, error: supabaseError } = await supabase
        .from('card_transactions')
        .update(transactionToUpdate)
        .eq('id', updatedTransaction.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (supabaseError) throw supabaseError;

      setCardTransactions(prev => 
        prev.map(t => t.id === updatedTransaction.id ? data : t)
      );

      return data;
    } catch (err) {
      console.error('Erro ao atualizar transação de cartão:', err);
      throw err;
    }
  };

  // Atualizar múltiplas transações
  const updateMultipleCardTransactions = async (
    updates: Array<{id: string; categoria: string; subtipo: string; descricao_classificada: string}>
  ): Promise<number> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let updatedCount = 0;
      
      for (const update of updates) {
        const { error } = await supabase
          .from('card_transactions')
          .update({
            categoria: update.categoria,
            subtipo: update.subtipo,
            descricao_classificada: update.descricao_classificada,
            status: 'classified',
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id)
          .eq('user_id', user.id);

        if (!error) updatedCount++;
      }

      await loadCardTransactions();
      return updatedCount;
    } catch (err) {
      console.error('Erro ao atualizar múltiplas transações:', err);
      throw err;
    }
  };

  // ===== NOVA FUNÇÃO: Dividir transação de cartão =====
  const splitCardTransaction = async (
    originalTransaction: CardTransaction, 
    parts: Array<{
      categoria: string;
      subtipo: string;
      descricao_classificada: string;
      valor: number;
    }>
  ): Promise<{ success: boolean; partsCreated: number }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('📄 Iniciando divisão da transação de cartão:', originalTransaction.id);

      // ETAPA 1: Deletar transação original
      const { error: deleteError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('id', originalTransaction.id)
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      console.log('✅ Transação original deletada');

      // ETAPA 2: Criar novas transações divididas
      const newCardTransactions = parts.map((part, index) => ({
        id: `${originalTransaction.id}-${index + 1}`,
        user_id: user.id,
        fingerprint: `${originalTransaction.fingerprint || originalTransaction.id}-${index + 1}`,
        fatura_id: originalTransaction.fatura_id,
        data_transacao: originalTransaction.data_transacao,
        descricao_origem: originalTransaction.descricao_origem,
        valor: part.valor,
        categoria: part.categoria,
        subtipo: part.subtipo,
        descricao_classificada: part.descricao_classificada,
        status: 'classified' as const,
        origem: originalTransaction.origem,
        cc: originalTransaction.cc,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data: insertedTransactions, error: insertError } = await supabase
        .from('card_transactions')
        .insert(newCardTransactions)
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log('✅ Novas transações de cartão criadas:', insertedTransactions?.length);

      // ETAPA 3: Atualizar estado local
      setCardTransactions(prev => {
        const withoutOriginal = prev.filter(t => t.id !== originalTransaction.id);
        
        const newTransactionObjects: CardTransaction[] = newCardTransactions.map(nt => ({
          id: nt.id,
          fingerprint: nt.fingerprint,
          fatura_id: nt.fatura_id,
          data_transacao: nt.data_transacao,
          descricao_origem: nt.descricao_origem,
          valor: nt.valor,
          categoria: nt.categoria,
          subtipo: nt.subtipo,
          descricao_classificada: nt.descricao_classificada,
          status: nt.status,
          origem: nt.origem,
          cc: nt.cc,
          created_at: nt.created_at,
          updated_at: nt.updated_at
        }));
        
        return [...withoutOriginal, ...newTransactionObjects];
      });

      console.log('✅ Divisão da transação de cartão concluída com sucesso');
      
      return {
        success: true,
        partsCreated: parts.length
      };

    } catch (err) {
      console.error('❌ Erro ao dividir transação de cartão:', err);
      setError(err instanceof Error ? err.message : 'Erro ao dividir transação de cartão');
      throw err;
    }
  };

  // Marcar transações como reconciliadas
  const markAsReconciled = async (transactionIds: string[]): Promise<number> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let reconciledCount = 0;
      
      for (const id of transactionIds) {
        const { error } = await supabase
          .from('card_transactions')
          .update({
            status: 'reconciled',
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id);

        if (!error) reconciledCount++;
      }

      await loadCardTransactions();
      return reconciledCount;
    } catch (err) {
      console.error('Erro ao marcar como reconciliadas:', err);
      throw err;
    }
  };

  // Deletar transação individual
  const deleteCardTransaction = async (transactionId: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error: supabaseError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (supabaseError) throw supabaseError;

      // Atualizar estado local
      setCardTransactions(prev => prev.filter(t => t.id !== transactionId));
      
      console.log('✅ Transação de cartão deletada:', transactionId);
    } catch (err) {
      console.error('Erro ao deletar transação de cartão:', err);
      setError(err instanceof Error ? err.message : 'Erro ao deletar transação');
      throw err;
    }
  };

  // Funções auxiliares
  const getTransactionsByFatura = (faturaId: string): CardTransaction[] => {
    return cardTransactions.filter(t => t.fatura_id === faturaId);
  };

  const getUnclassifiedTransactions = (): CardTransaction[] => {
    return cardTransactions.filter(t => t.status === 'pending');
  };

  const getTransactionsForReconciliation = (faturaId?: string): CardTransaction[] => {
    return cardTransactions.filter(t => 
      t.status === 'classified' && 
      (!faturaId || t.fatura_id === faturaId)
    );
  };

  // Carregar na inicialização
  useEffect(() => {
    loadCardTransactions();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return {
    // Estado
    cardTransactions,
    loading,
    error,
    
    // ===== FUNÇÕES PRINCIPAIS ATUALIZADAS =====
    addCardTransactions,                    // ✅ Sempre vai para SimpleDiff
    applySimpleDiffChanges,                // ✅ NOVA - Aplica mudanças do SimpleDiff
    replaceFaturaComplete,                 // ✅ NOVA - Substituição completa
    splitCardTransaction,                  // ✅ NOVA - Dividir transação de cartão
    
    // Funções existentes mantidas
    updateCardTransaction,
    updateMultipleCardTransactions,
    deleteCardTransaction,
    markAsReconciled,
    
    // Funções auxiliares
    checkExistingFatura,
    getTransactionsByFatura,
    getUnclassifiedTransactions,
    getTransactionsForReconciliation,
    
    // Refresh
    refreshCardTransactions: loadCardTransactions
  };
}