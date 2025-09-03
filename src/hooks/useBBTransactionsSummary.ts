// hooks/useBBTransactionsSummary.ts

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface BBSummary {
  totalTransactions: number;
  totalValue: number;
  loading: boolean;
  error: string | null;
}

export function useBBTransactionsSummary(): BBSummary {
  const [summary, setSummary] = useState<BBSummary>({
    totalTransactions: 0,
    totalValue: 0,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchBBSummary = async () => {
      try {
        setSummary(prev => ({ ...prev, loading: true, error: null }));

        // Query: origem = 'BB' AND realizado IN ('p', 's')
        const { data, error } = await supabase
          .from('transactions')
          .select('valor')
          .eq('origem', 'BB')
          .in('realizado', ['p', 's']);

        if (error) {
          console.error('❌ Erro ao buscar transações BB:', error);
          setSummary(prev => ({ 
            ...prev, 
            loading: false, 
            error: error.message 
          }));
          return;
        }

        // Calcular totais
        const totalTransactions = data?.length || 0;
        const totalValue = data?.reduce((sum, transaction) => sum + (transaction.valor || 0), 0) || 0;

        console.log(`📊 BB Summary: ${totalTransactions} transações, R$ ${totalValue.toFixed(2)}`);

        setSummary({
          totalTransactions,
          totalValue,
          loading: false,
          error: null
        });

      } catch (err) {
        console.error('❌ Erro inesperado:', err);
        setSummary(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Erro inesperado ao carregar dados' 
        }));
      }
    };

    fetchBBSummary();
  }, []);

  return summary;
}