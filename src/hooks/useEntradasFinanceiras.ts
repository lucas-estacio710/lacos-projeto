// hooks/useEntradasFinanceiras.ts - HOOK PARA CARREGAR ENTRADAS FINANCEIRAS DO SUPABASE

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Interface para entrada da planilha financeira (mesmo do modal)
export interface EntradaFinanceira {
  id: string;
  csv_id: string;
  id_contrato: string;
  data_hora: string; // ISO format
  tipo: string;
  metodo: string;
  cc: string;
  valor: number;
  desconto: number;
  desconto_percent: number;
  desconto_real: number;
  valor_com_desconto: number;
  flag_d: string;
  flag_t: string;
  taxa: number;
  taxa_percent: number;
  taxa_real: number;
  valor_final: number; // Campo principal para reconciliação
  mes_competencia: string;
  parcelamento: string;
  id_transacao: string; // Chave para matching
  uploaded_at: string;
  user_id: string;
  utilizada?: boolean; // ✅ NOVO: Marca se a entrada já foi utilizada em classificação
}

// Estatísticas das entradas
export interface EntradasStats {
  total: number;
  totalValue: number;
  byMetodo: Record<string, number>;
  byTipo: Record<string, number>;
  byContrato: Record<string, number>;
  dateRange: {
    start: string;
    end: string;
  };
}

// Filtros para busca
export interface EntradasFilters {
  metodo?: string;
  tipo?: string;
  contrato?: string;
  dateFrom?: string;
  dateTo?: string;
  valorMin?: number;
  valorMax?: number;
}

export function useEntradasFinanceiras() {
  // Estados principais
  const [entradas, setEntradas] = useState<EntradaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EntradasStats | null>(null);

  // Carregar todas as entradas financeiras
  const loadEntradas = async (filters?: EntradasFilters) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      // 📊 Carregando entradas financeiras do Supabase...

      // Construir query base
      let query = supabase
        .from('entradas_financeiras')
        .select('*')
        .eq('user_id', user.id)
        .order('data_hora', { ascending: false });

      // Aplicar filtros se fornecidos
      if (filters) {
        if (filters.metodo) {
          query = query.ilike('metodo', `%${filters.metodo}%`);
        }
        if (filters.tipo) {
          query = query.ilike('tipo', `%${filters.tipo}%`);
        }
        if (filters.contrato) {
          query = query.ilike('id_contrato', `%${filters.contrato}%`);
        }
        if (filters.dateFrom) {
          query = query.gte('data_hora', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('data_hora', filters.dateTo);
        }
        if (filters.valorMin) {
          query = query.gte('valor_final', filters.valorMin);
        }
        if (filters.valorMax) {
          query = query.lte('valor_final', filters.valorMax);
        }
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) {
        console.error('❌ Erro do Supabase:', supabaseError);
        throw supabaseError;
      }

      const entradasData = data || [];
      console.log(`✅ ${entradasData.length} entradas carregadas`);

      setEntradas(entradasData);
      
      // Calcular estatísticas
      if (entradasData.length > 0) {
        const statsData = calculateStats(entradasData);
        setStats(statsData);
      } else {
        setStats(null);
      }

    } catch (err) {
      console.error('❌ Erro ao carregar entradas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Calcular estatísticas das entradas
  const calculateStats = (entradas: EntradaFinanceira[]): EntradasStats => {
    const totalValue = entradas.reduce((sum, entry) => sum + entry.valor_final, 0);
    
    const byMetodo = entradas.reduce((acc, entry) => {
      const metodo = entry.metodo || 'Indefinido';
      acc[metodo] = (acc[metodo] || 0) + entry.valor_final;
      return acc;
    }, {} as Record<string, number>);

    const byTipo = entradas.reduce((acc, entry) => {
      const tipo = entry.tipo || 'Indefinido';
      acc[tipo] = (acc[tipo] || 0) + entry.valor_final;
      return acc;
    }, {} as Record<string, number>);

    const byContrato = entradas.reduce((acc, entry) => {
      const contrato = entry.id_contrato || 'Indefinido';
      acc[contrato] = (acc[contrato] || 0) + entry.valor_final;
      return acc;
    }, {} as Record<string, number>);

    // Range de datas
    const dates = entradas
      .map(e => e.data_hora)
      .filter(date => date && date !== '')
      .sort();

    return {
      total: entradas.length,
      totalValue,
      byMetodo,
      byTipo,
      byContrato,
      dateRange: {
        start: dates[0] || '',
        end: dates[dates.length - 1] || ''
      }
    };
  };

  // Filtrar apenas entradas PIX (excluir já utilizadas)
  const getPixEntries = (): EntradaFinanceira[] => {
    return entradas.filter(entry => 
      entry.metodo?.toLowerCase().includes('pix') && !entry.utilizada
    );
  };

  // Filtrar apenas entradas TON (excluir já utilizadas)
  const getTonEntries = (): EntradaFinanceira[] => {
    return entradas.filter(entry => 
      entry.cc === 'Ton' && !entry.utilizada
    );
  };

  // Filtrar por método específico
  const getEntriesByMethod = (metodo: string): EntradaFinanceira[] => {
    return entradas.filter(entry => 
      entry.metodo?.toLowerCase().includes(metodo.toLowerCase())
    );
  };

  // Filtrar por contrato
  const getEntriesByContract = (contrato: string): EntradaFinanceira[] => {
    return entradas.filter(entry => 
      entry.id_contrato?.toLowerCase().includes(contrato.toLowerCase())
    );
  };

  // Filtrar por data específica (para matching)
  const getEntriesByDate = (targetDate: string): EntradaFinanceira[] => {
    return entradas.filter(entry => {
      if (!entry.data_hora) return false;
      
      // Converter ambas as datas para formato YYYY-MM-DD para comparação
      const entryDate = entry.data_hora.split('T')[0]; // Remove horário se houver
      const targetDateFormatted = targetDate.split('T')[0];
      
      return entryDate === targetDateFormatted;
    });
  };

  // Buscar entrada por ID de transação
  const getEntryByTransactionId = (idTransacao: string): EntradaFinanceira | undefined => {
    return entradas.find(entry => entry.id_transacao === idTransacao);
  };

  // Verificar se existem dados PIX
  const hasPixData = (): boolean => {
    return getPixEntries().length > 0;
  };

  // Verificar se existem dados TON
  const hasTonData = (): boolean => {
    return getTonEntries().length > 0;
  };

  // Obter contratos únicos
  const getUniqueContracts = (): string[] => {
    const contracts = entradas
      .map(entry => entry.id_contrato)
      .filter(Boolean);
    return Array.from(new Set(contracts)).sort();
  };

  // Obter métodos únicos
  const getUniqueMethods = (): string[] => {
    const methods = entradas
      .map(entry => entry.metodo)
      .filter(Boolean);
    return Array.from(new Set(methods)).sort();
  };

  // Obter tipos únicos
  const getUniqueTypes = (): string[] => {
    const types = entradas
      .map(entry => entry.tipo)
      .filter(Boolean);
    return Array.from(new Set(types)).sort();
  };


  // Refresh dos dados
  const refreshEntradas = async (filters?: EntradasFilters) => {
    await loadEntradas(filters);
  };

  // Limpar dados
  const clearEntradas = () => {
    setEntradas([]);
    setStats(null);
    setError(null);
  };

  // ✅ MARCAR ENTRADAS COMO UTILIZADAS
  const markEntriesAsUsed = async (entryIds: string[]): Promise<void> => {
    if (!entryIds || entryIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Marcando entradas como utilizadas:', entryIds);

      // Verificar se o campo utilizada existe na tabela
      const { data: tableInfo, error: tableError } = await supabase
        .from('entradas_financeiras')
        .select('utilizada')
        .limit(1);

      if (tableError && (tableError.code === 'PGRST116' || tableError.code === 'PGRST204')) {
        // Campo não existe na tabela
        console.log('⚠️ Campo utilizada não existe na tabela. Saltando marcação...');
        console.log('⚠️ Para implementar completamente, adicione o campo na tabela:');
        console.log('   ALTER TABLE entradas_financeiras ADD COLUMN utilizada BOOLEAN DEFAULT FALSE;');
        return;
      }

      // Atualizar no Supabase - marcar como utilizada
      const { error: updateError } = await supabase
        .from('entradas_financeiras')
        .update({ 
          utilizada: true
        })
        .in('id', entryIds);

      if (updateError) {
        console.error('❌ Erro ao marcar entradas como utilizadas:', updateError);
        throw updateError;
      }

      console.log('✅ Entradas marcadas como utilizadas com sucesso');

      // Atualizar estado local
      setEntradas(prev => prev.map(entry => 
        entryIds.includes(entry.id) 
          ? { ...entry, utilizada: true }
          : entry
      ));

    } catch (err) {
      const error = err as any;
      console.error('❌ Erro ao marcar entradas como utilizadas:');
      console.error('  - Erro completo:', JSON.stringify(error, null, 2));
      console.error('  - Message:', error.message);
      console.error('  - Code:', error.code);
      console.error('  - Details:', error.details);
      setError(`Erro ao marcar entradas como utilizadas: ${error.message || 'Erro desconhecido'}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadEntradas();
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
    entradas,
    loading,
    error,
    stats,

    // Funções principais
    loadEntradas,
    refreshEntradas,
    clearEntradas,
    markEntriesAsUsed, // ✅ NOVO: Marcar entradas como utilizadas

    // Filtros específicos
    getPixEntries,
    getTonEntries,
    getEntriesByMethod,
    getEntriesByContract,
    getEntriesByDate,
    getEntryByTransactionId,

    // Verificações
    hasPixData,
    hasTonData,

    // Helpers de dados únicos
    getUniqueContracts,
    getUniqueMethods,
    getUniqueTypes,

    // Dados calculados
    totalEntries: entradas.length,
    totalValue: stats?.totalValue || 0,
    pixEntries: getPixEntries(),
    pixCount: getPixEntries().length
  };
}