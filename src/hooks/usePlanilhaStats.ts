// hooks/usePlanilhaStats.ts - HOOK PARA CARREGAR ESTATÍSTICAS DO SUPABASE

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PlanilhaStats {
  total_registros: number;
  data_inicio: string;
  data_fim: string;
  valor_total?: number;
  contratos_unicos?: number;
  transacoes_unicas?: number;
  uploaded_at: string;
}

export function usePlanilhaStats() {
  const [stats, setStats] = useState<{
    entradas_financeiras: PlanilhaStats | null;
    agenda_inter: PlanilhaStats | null;
    percentuais_contrato: PlanilhaStats | null;
  }>({
    entradas_financeiras: null,
    agenda_inter: null,
    percentuais_contrato: null
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      // Carregar estatísticas das 3 tabelas
      const results = await Promise.allSettled([
        loadEntradasFinanceirasStats(user.id),
        loadAgendaInterStats(user.id),
        loadPercentuaisContratoStats(user.id)
      ]);

      // Processar resultados
      const [entradasResult, agendaResult, percentuaisResult] = results;

      setStats({
        entradas_financeiras: entradasResult.status === 'fulfilled' ? entradasResult.value : null,
        agenda_inter: agendaResult.status === 'fulfilled' ? agendaResult.value : null,
        percentuais_contrato: percentuaisResult.status === 'fulfilled' ? percentuaisResult.value : null
      });

      // Log de erros (se houver)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const tableName = ['entradas_financeiras', 'agenda_inter', 'percentuais_contrato'][index];
          console.warn(`⚠️ Erro ao carregar stats de ${tableName}:`, result.reason);
        }
      });

    } catch (err) {
      console.error('❌ Erro ao carregar estatísticas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Carregar estatísticas da tabela entradas_financeiras
  const loadEntradasFinanceirasStats = async (userId: string): Promise<PlanilhaStats | null> => {
    const { data, error } = await supabase
      .from('entradas_financeiras')
      .select('data_hora, valor_final, id_contrato, uploaded_at')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Calcular estatísticas
    const datas = data.map(r => r.data_hora).filter(Boolean).sort();
    const contratos = new Set(data.map(r => r.id_contrato)).size;
    const valorTotal = data.reduce((sum, r) => sum + (r.valor_final || 0), 0);
    const uploadedAt = data[0]?.uploaded_at || new Date().toISOString();

    return {
      total_registros: data.length,
      data_inicio: datas[0] || '',
      data_fim: datas[datas.length - 1] || '',
      valor_total: valorTotal,
      contratos_unicos: contratos,
      uploaded_at: uploadedAt
    };
  };

  // Carregar estatísticas da tabela agenda_inter
  const loadAgendaInterStats = async (userId: string): Promise<PlanilhaStats | null> => {
    const { data, error } = await supabase
      .from('agenda_inter')
      .select('data_pagamento, valor_liquido, id_transacao, uploaded_at')
      .eq('user_id', userId)
      .eq('status', 'Pago'); // Só considerar os pagos

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Calcular estatísticas
    const datas = data.map(r => r.data_pagamento).filter(Boolean).sort();
    const transacoes = new Set(data.map(r => r.id_transacao)).size;
    const valorTotal = data.reduce((sum, r) => sum + (r.valor_liquido || 0), 0);
    const uploadedAt = data[0]?.uploaded_at || new Date().toISOString();

    return {
      total_registros: data.length,
      data_inicio: datas[0] || '',
      data_fim: datas[datas.length - 1] || '',
      valor_total: valorTotal,
      transacoes_unicas: transacoes,
      uploaded_at: uploadedAt
    };
  };

  // Carregar estatísticas da tabela percentuais_contrato
  const loadPercentuaisContratoStats = async (userId: string): Promise<PlanilhaStats | null> => {
    const { data, error } = await supabase
      .from('percentuais_contrato')
      .select('id_transacao, id_contrato, uploaded_at')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Calcular estatísticas
    const contratos = new Set(data.map(r => r.id_contrato)).size;
    const transacoes = new Set(data.map(r => r.id_transacao)).size;
    const uploadedAt = data[0]?.uploaded_at || new Date().toISOString();

    return {
      total_registros: data.length,
      data_inicio: '',
      data_fim: '',
      contratos_unicos: contratos,
      transacoes_unicas: transacoes,
      uploaded_at: uploadedAt
    };
  };

  // Carregar na inicialização
  useEffect(() => {
    loadStats();
  }, []);

  // Função para recarregar (chamada após upload)
  const refreshStats = () => {
    loadStats();
  };

  // Getters individuais
  const getStats = (tipo: 'entradas_financeiras' | 'agenda_inter' | 'percentuais_contrato') => {
    return stats[tipo];
  };

  const hasData = (tipo: 'entradas_financeiras' | 'agenda_inter' | 'percentuais_contrato') => {
    return !!stats[tipo];
  };

  // Verificar se mini-apps estão habilitadas
  const isPixInterEnabled = () => !!stats.entradas_financeiras;
  const isInterPagEnabled = () => !!(stats.agenda_inter && stats.percentuais_contrato);
  const isTonEnabled = () => !!stats.entradas_financeiras; // TON usa mesma fonte que PIX

  return {
    // Estado
    stats,
    loading,
    error,

    // Funções
    refreshStats,
    getStats,
    hasData,

    // Verificadores
    isPixInterEnabled,
    isInterPagEnabled,
    isTonEnabled,

    // Dados agregados
    totalPlanilhasCarregadas: Object.values(stats).filter(Boolean).length
  };
}