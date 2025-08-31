// hooks/useAgendaInter.ts - HOOK PARA CARREGAR DADOS DA AGENDA INTER E PERCENTUAIS

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Interfaces (copiadas do InterPagModal)
export interface AgendaInter {
  id_transacao: string;
  data_hora: string;
  tipo: string;
  status: string;
  parcela: string;
  bandeira: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_antecipacao: number;
  valor_liquido: number;
  data_pagamento: string;
  uploaded_at: string;
  user_id: string;
}

export interface PercentualContrato {
  id_transacao: string;
  id_contrato: string;
  percentual_catalogo: number; // 0-100
  percentual_planos: number;   // 0-100
  uploaded_at: string;
  user_id: string;
}

export function useAgendaInter() {
  // Estados principais
  const [agendaEntries, setAgendaEntries] = useState<AgendaInter[]>([]);
  const [percentuaisEntries, setPercentuaisEntries] = useState<PercentualContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados da agenda inter
  const loadAgendaInter = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data, error: supabaseError } = await supabase
        .from('agenda_inter')
        .select('*')
        .eq('user_id', user.id)
        .order('data_pagamento', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      setAgendaEntries(data || []);
      console.log(`✅ ${(data || []).length} entradas da agenda inter carregadas`);

    } catch (err) {
      console.error('❌ Erro ao carregar agenda inter:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  // Carregar dados dos percentuais
  const loadPercentuaisContrato = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data, error: supabaseError } = await supabase
        .from('percentuais_contrato')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      setPercentuaisEntries(data || []);
      console.log(`✅ ${(data || []).length} entradas de percentuais carregadas`);

    } catch (err) {
      console.error('❌ Erro ao carregar percentuais:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  // Carregar ambos os dados
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    await Promise.all([
      loadAgendaInter(),
      loadPercentuaisContrato()
    ]);
    
    setLoading(false);
  };

  // Refresh dos dados
  const refreshData = async () => {
    await loadData();
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadData();
  }, []);

  // Filtros úteis
  const getAgendaPaga = (): AgendaInter[] => {
    return agendaEntries.filter(entry => 
      entry.status?.toLowerCase() === 'pago' && 
      entry.bandeira !== 'Utilizado'
    );
  };

  const getPercentualByTransactionId = (idTransacao: string): PercentualContrato | undefined => {
    return percentuaisEntries.find(p => p.id_transacao === idTransacao);
  };

  const hasAgendaData = (): boolean => {
    return getAgendaPaga().length > 0;
  };

  const hasPercentuaisData = (): boolean => {
    return percentuaisEntries.length > 0;
  };

  return {
    // Estado
    agendaEntries,
    percentuaisEntries,
    loading,
    error,

    // Funções principais
    loadData,
    refreshData,
    loadAgendaInter,
    loadPercentuaisContrato,

    // Filtros específicos
    getAgendaPaga,
    getPercentualByTransactionId,

    // Verificações
    hasAgendaData,
    hasPercentuaisData,

    // Dados calculados
    totalAgenda: agendaEntries.length,
    totalPercentuais: percentuaisEntries.length,
    agendaPaga: getAgendaPaga(),
    agendaPagaCount: getAgendaPaga().length
  };
}