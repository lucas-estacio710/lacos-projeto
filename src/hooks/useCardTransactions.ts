// hooks/useCardTransactions.ts - ALGORITMO DE MATCHING CORRIGIDO

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

// Interface para resultado de importação
export interface ImportResult {
  success: boolean;
  stats: {
    total: number;
    added: number;
    duplicates: number;
    matched?: number;
  };
  matches?: FaturaMatch[];
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

  // ===== ALGORITMO DE MATCHING CORRIGIDO =====
  const compareTransactions = (
    existing: CardTransaction[], 
    incoming: CardTransaction[]
  ): FaturaMatch[] => {
    console.log('🔄 Iniciando comparação inteligente...');
    console.log('📋 Existentes:', existing.length);
    console.log('📦 Novas:', incoming.length);

    const matches: FaturaMatch[] = [];
    const processedExisting = new Set<string>();
    const processedIncoming = new Set<string>();

    // ETAPA 1: Matches por fingerprint (mais confiável)
    console.log('🔍 ETAPA 1: Matching por fingerprint...');
    
    const existingByFingerprint = new Map<string, CardTransaction>();
    existing.forEach(e => {
      if (e.fingerprint) {
        existingByFingerprint.set(e.fingerprint, e);
      }
    });

    incoming.forEach(nova => {
      if (nova.fingerprint && existingByFingerprint.has(nova.fingerprint)) {
        const existente = existingByFingerprint.get(nova.fingerprint)!;
        
        matches.push({
          tipo: 'PERFEITO',
          transacaoExistente: existente,
          transacaoNova: nova
        });
        
        processedExisting.add(existente.id);
        processedIncoming.add(nova.id);
        
        console.log(`✅ Match perfeito por fingerprint: ${nova.descricao_origem.substring(0, 30)}`);
      }
    });

    // ETAPA 2: Matching individual para múltiplas transações iguais
    console.log('🔍 ETAPA 2: Matching individual para transações similares...');
    
    const remainingExisting = existing.filter(e => !processedExisting.has(e.id));
    const remainingIncoming = incoming.filter(i => !processedIncoming.has(i.id));

    // Agrupar transações similares (mesmo valor + descrição similar)
    const groupExisting = groupSimilarTransactions(remainingExisting);
    const groupIncoming = groupSimilarTransactions(remainingIncoming);

    // Comparar grupos e fazer matching 1:1 dentro de cada grupo
    Object.keys(groupIncoming).forEach(groupKey => {
      const incomingGroup = groupIncoming[groupKey];
      const existingGroup = groupExisting[groupKey] || [];

      console.log(`🔍 Comparando grupo "${groupKey}": ${existingGroup.length} existentes vs ${incomingGroup.length} novas`);

      // Fazer matching 1:1 dentro do grupo
      const maxMatches = Math.min(existingGroup.length, incomingGroup.length);
      
      for (let i = 0; i < maxMatches; i++) {
        const existente = existingGroup[i];
        const nova = incomingGroup[i];
        
        // Calcular similaridade
        const similarity = calculateDetailedSimilarity(existente, nova);
        
        if (similarity.score >= 0.9) {
          matches.push({
            tipo: 'PERFEITO',
            transacaoExistente: existente,
            transacaoNova: nova
          });
          console.log(`✅ Match perfeito ${i+1}/${maxMatches}: ${nova.descricao_origem.substring(0, 30)}`);
        } else if (similarity.score >= 0.7) {
          matches.push({
            tipo: 'QUASE_PERFEITO',
            transacaoExistente: existente,
            transacaoNova: nova,
            diferenca: similarity.differences
          });
          console.log(`⚠️ Match suspeito ${i+1}/${maxMatches}: ${nova.descricao_origem.substring(0, 30)} (${Math.round(similarity.score * 100)}%)`);
        } else {
          // Não é um match válido, tratar como novo
          matches.push({
            tipo: 'NOVO',
            transacaoNova: nova
          });
          console.log(`🆕 Nova transação: ${nova.descricao_origem.substring(0, 30)}`);
        }
        
        processedExisting.add(existente.id);
        processedIncoming.add(nova.id);
      }

      // Transações restantes do grupo incoming = novas
      for (let i = maxMatches; i < incomingGroup.length; i++) {
        const nova = incomingGroup[i];
        matches.push({
          tipo: 'NOVO',
          transacaoNova: nova
        });
        processedIncoming.add(nova.id);
        console.log(`🆕 Nova transação (grupo excedente): ${nova.descricao_origem.substring(0, 30)}`);
      }

      // Transações restantes do grupo existing = removidas
      for (let i = maxMatches; i < existingGroup.length; i++) {
        const existente = existingGroup[i];
        matches.push({
          tipo: 'REMOVIDO',
          transacaoExistente: existente
        });
        processedExisting.add(existente.id);
        console.log(`🗑️ Transação removida (grupo excedente): ${existente.descricao_origem.substring(0, 30)}`);
      }
    });

    // ETAPA 3: Transações completamente novas (não estão em nenhum grupo existing)
    const finalRemainingIncoming = incoming.filter(i => !processedIncoming.has(i.id));
    finalRemainingIncoming.forEach(nova => {
      matches.push({
        tipo: 'NOVO',
        transacaoNova: nova
      });
      console.log(`🆕 Transação completamente nova: ${nova.descricao_origem.substring(0, 30)}`);
    });

    // ETAPA 4: Transações que sumiram (estavam no existing mas não no incoming)
    const finalRemainingExisting = existing.filter(e => !processedExisting.has(e.id));
    finalRemainingExisting.forEach(existente => {
      matches.push({
        tipo: 'REMOVIDO',
        transacaoExistente: existente
      });
      console.log(`🗑️ Transação que sumiu: ${existente.descricao_origem.substring(0, 30)}`);
    });

    console.log('✅ Comparação concluída:');
    console.log(`  📊 ${matches.filter(m => m.tipo === 'PERFEITO').length} matches perfeitos`);
    console.log(`  ⚠️ ${matches.filter(m => m.tipo === 'QUASE_PERFEITO').length} matches suspeitos`);
    console.log(`  🆕 ${matches.filter(m => m.tipo === 'NOVO').length} transações novas`);
    console.log(`  🗑️ ${matches.filter(m => m.tipo === 'REMOVIDO').length} transações removidas`);

    return matches;
  };

  // ===== FUNÇÃO AUXILIAR: Agrupar transações similares =====
  const groupSimilarTransactions = (transactions: CardTransaction[]): Record<string, CardTransaction[]> => {
    const groups: Record<string, CardTransaction[]> = {};
    
    transactions.forEach(transaction => {
      // Criar chave de agrupamento: valor + descrição normalizada
      const valor = Math.round(Math.abs(transaction.valor) * 100); // Centavos para evitar problemas de float
      const descricaoNormalizada = transaction.descricao_origem
        .toLowerCase()
        .replace(/[^a-záéíóúâêîôûàèìòùãõç0-9\s]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, ' ') // Normaliza espaços
        .trim();
      
      const groupKey = `${valor}_${descricaoNormalizada}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(transaction);
    });
    
    // Ordenar cada grupo por data para matching consistente
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.data_transacao.localeCompare(b.data_transacao));
    });
    
    return groups;
  };

  // ===== FUNÇÃO AUXILIAR: Calcular similaridade detalhada =====
  const calculateDetailedSimilarity = (
    existing: CardTransaction, 
    incoming: CardTransaction
  ): { score: number; differences: Array<{campo: string; valorAntigo: any; valorNovo: any}> } => {
    let score = 0;
    const differences: Array<{campo: string; valorAntigo: any; valorNovo: any}> = [];
    
    // Comparar data (peso: 3)
    if (existing.data_transacao === incoming.data_transacao) {
      score += 3;
    } else {
      differences.push({
        campo: 'data',
        valorAntigo: existing.data_transacao,
        valorNovo: incoming.data_transacao
      });
    }
    
    // Comparar valor (peso: 4)
    if (Math.abs(existing.valor - incoming.valor) < 0.01) {
      score += 4;
    } else {
      differences.push({
        campo: 'valor',
        valorAntigo: existing.valor,
        valorNovo: incoming.valor
      });
    }
    
    // Comparar descrição (peso: 3)
    const descSimilarity = calculateStringSimilarity(
      existing.descricao_origem.toLowerCase(),
      incoming.descricao_origem.toLowerCase()
    );
    
    if (descSimilarity >= 0.95) {
      score += 3;
    } else if (descSimilarity >= 0.8) {
      score += 2;
      differences.push({
        campo: 'descricao',
        valorAntigo: existing.descricao_origem,
        valorNovo: incoming.descricao_origem
      });
    } else {
      differences.push({
        campo: 'descricao',
        valorAntigo: existing.descricao_origem,
        valorNovo: incoming.descricao_origem
      });
    }
    
    // Score máximo: 10
    return {
      score: score / 10,
      differences
    };
  };

  // ===== FUNÇÃO AUXILIAR: Similaridade de strings =====
  const calculateStringSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // ===== FUNÇÃO AUXILIAR: Distância de Levenshtein =====
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // ===== RESTO DAS FUNÇÕES (mantidas igual) =====

  // Adicionar múltiplas transações de cartão
  const addCardTransactions = async (
    newTransactions: CardTransaction[], 
    checkDuplicates: boolean = true
  ): Promise<ImportResult> => {
    try {
      console.log('🔄 Iniciando addCardTransactions com:', newTransactions.length, 'transações');
      
      if (newTransactions.length === 0) {
        return {
          success: true,
          stats: { total: 0, added: 0, duplicates: 0 }
        };
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Verificar se é re-upload da mesma fatura
      if (checkDuplicates) {
        const faturaId = newTransactions[0].fatura_id;
        const existingTransactions = await checkExistingFatura(faturaId);
        
        if (existingTransactions.length > 0) {
          console.log('⚠️ Fatura já existe:', faturaId);
          
          // Usar algoritmo de matching corrigido
          const matches = compareTransactions(existingTransactions, newTransactions);
          
          return {
            success: true,
            stats: {
              total: newTransactions.length,
              added: 0,
              duplicates: existingTransactions.length,
              matched: matches.filter(m => m.tipo === 'PERFEITO' || m.tipo === 'QUASE_PERFEITO').length
            },
            matches
          };
        }
      }

      // Inserir normalmente se não há duplicatas
      const transactionsToInsert = newTransactions.map(transaction => ({
        ...transaction,
        user_id: user.id,
        status: transaction.status || 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const BATCH_SIZE = 50;
      let insertedCount = 0;
      
      for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
        const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
        
        const { error: insertError } = await supabase
          .from('card_transactions')
          .insert(batch);

        if (insertError) {
          throw insertError;
        }

        insertedCount += batch.length;
      }

      await loadCardTransactions();
      
      return {
        success: true,
        stats: {
          total: newTransactions.length,
          added: insertedCount,
          duplicates: 0
        }
      };
      
    } catch (err) {
      console.error('❌ Erro ao adicionar transações de cartão:', err);
      return {
        success: false,
        stats: { total: newTransactions.length, added: 0, duplicates: 0 }
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

  // Substituir fatura existente
  const replaceFatura = async (
    faturaId: string, 
    newTransactions: CardTransaction[]
  ): Promise<ImportResult> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error: deleteError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('fatura_id', faturaId);

      if (deleteError) throw deleteError;

      return await addCardTransactions(newTransactions, false);
    } catch (err) {
      console.error('Erro ao substituir fatura:', err);
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
      
      // Funções principais
      addCardTransactions,
      updateCardTransaction,
      updateMultipleCardTransactions,
      deleteCardTransaction, // ← ADICIONAR ESTA LINHA
      replaceFatura,
      markAsReconciled,
      
      // Funções auxiliares
      checkExistingFatura,
      compareTransactions,
      getTransactionsByFatura,
      getUnclassifiedTransactions,
      getTransactionsForReconciliation,
      
      // Refresh
      refreshCardTransactions: loadCardTransactions
    };
}