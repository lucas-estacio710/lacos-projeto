// hooks/useUltimosLancamentos.ts - Últimos 30 lançamentos de transactions e card_transactions

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface UltimoLancamento {
  id: string;
  tipo: 'transaction' | 'card';
  data: string;
  descricao_origem: string;
  descricao: string | null;
  valor: number;
  origem: string;
  cc: string;
  status: 's' | 'p' | 'r' | 'pending' | 'classified' | 'reconciled';
  updated_at: string;
  // Hierarquia enriquecida
  conta_nome?: string;
  categoria_nome?: string;
  subtipo_nome?: string;
  subtipo_id?: string | null;
}

export function useUltimosLancamentos() {
  const [items, setItems] = useState<UltimoLancamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      // Buscar 30 últimos de transactions
      const { data: txns, error: txnError } = await supabase
        .from('transactions')
        .select('id, data, descricao_origem, descricao, valor, origem, cc, realizado, subtipo_id, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(30);

      if (txnError) throw txnError;

      // Buscar 30 últimos de card_transactions
      const { data: cards, error: cardError } = await supabase
        .from('card_transactions')
        .select('id, data_transacao, descricao_origem, descricao_classificada, valor, origem, cc, status, subtipo_id, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(30);

      if (cardError) throw cardError;

      // Coletar subtipo_ids para enriquecer com hierarquia
      const allSubtipoIds = [
        ...(txns || []).filter(t => t.subtipo_id).map(t => t.subtipo_id),
        ...(cards || []).filter(c => c.subtipo_id).map(c => c.subtipo_id),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      let hierarchyMap: Record<string, any> = {};

      if (allSubtipoIds.length > 0) {
        const { data: hierarchyData } = await supabase
          .from('vw_hierarquia_completa')
          .select('subtipo_id, conta_nome, categoria_nome, subtipo_nome')
          .in('subtipo_id', allSubtipoIds);

        if (hierarchyData) {
          hierarchyMap = hierarchyData.reduce((acc: Record<string, any>, item: any) => {
            acc[item.subtipo_id] = item;
            return acc;
          }, {});
        }
      }

      // Mapear transactions
      const txnItems: UltimoLancamento[] = (txns || []).map(t => {
        const h = t.subtipo_id ? hierarchyMap[t.subtipo_id] : null;
        return {
          id: t.id,
          tipo: 'transaction' as const,
          data: t.data,
          descricao_origem: t.descricao_origem,
          descricao: t.descricao,
          valor: t.valor,
          origem: t.origem,
          cc: t.cc,
          status: t.realizado,
          updated_at: t.updated_at,
          subtipo_id: t.subtipo_id,
          conta_nome: h?.conta_nome,
          categoria_nome: h?.categoria_nome,
          subtipo_nome: h?.subtipo_nome,
        };
      });

      // Mapear card_transactions
      const cardItems: UltimoLancamento[] = (cards || []).map(c => {
        const h = c.subtipo_id ? hierarchyMap[c.subtipo_id] : null;
        return {
          id: c.id,
          tipo: 'card' as const,
          data: c.data_transacao,
          descricao_origem: c.descricao_origem,
          descricao: c.descricao_classificada,
          valor: c.valor,
          origem: c.origem,
          cc: c.cc,
          status: c.status,
          updated_at: c.updated_at,
          subtipo_id: c.subtipo_id,
          conta_nome: h?.conta_nome,
          categoria_nome: h?.categoria_nome,
          subtipo_nome: h?.subtipo_nome,
        };
      });

      // Combinar e ordenar por updated_at DESC
      const combined = [...txnItems, ...cardItems].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setItems(combined);
    } catch (err) {
      console.error('Erro ao buscar últimos lançamentos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  // Voltar lançamento para pendente (desclassificar)
  const revertToPending = useCallback(async (item: UltimoLancamento) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (item.tipo === 'transaction') {
        const { error } = await supabase
          .from('transactions')
          .update({ realizado: 'p', subtipo_id: null })
          .eq('id', item.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('card_transactions')
          .update({ status: 'pending', subtipo_id: null, descricao_classificada: null })
          .eq('id', item.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }

      // Atualizar lista local
      setItems(prev => prev.map(i =>
        i.id === item.id && i.tipo === item.tipo
          ? { ...i, status: item.tipo === 'transaction' ? 'p' : 'pending', subtipo_id: null, conta_nome: undefined, categoria_nome: undefined, subtipo_nome: undefined }
          : i
      ));
    } catch (err) {
      console.error('Erro ao reverter para pendente:', err);
      throw err;
    }
  }, []);

  // Excluir lançamento
  const deleteItem = useCallback(async (item: UltimoLancamento) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const table = item.tipo === 'transaction' ? 'transactions' : 'card_transactions';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', item.id)
        .eq('user_id', user.id);
      if (error) throw error;

      // Remover da lista local
      setItems(prev => prev.filter(i => !(i.id === item.id && i.tipo === item.tipo)));
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, loading, error, refresh: fetchData, revertToPending, deleteItem };
}
