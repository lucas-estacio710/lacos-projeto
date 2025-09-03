// components/BBSummaryCard.tsx

import React from 'react';
import { useBBTransactionsSummary } from '@/hooks/useBBTransactionsSummary';
import { formatCurrency } from '@/lib/utils';

export function BBSummaryCard() {
  const { totalTransactions, totalValue, loading, error } = useBBTransactionsSummary();

  if (loading) {
    return (
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <h3 className="text-blue-200 font-medium mb-2">🏦 Banco do Brasil - Realizadas</h3>
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          Carregando...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
        <h3 className="text-red-200 font-medium mb-2">🏦 Banco do Brasil - Erro</h3>
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
      <h3 className="text-blue-200 font-medium mb-3">🏦 Banco do Brasil - Realizadas</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-blue-100 text-2xl font-bold">{totalTransactions}</p>
          <p className="text-blue-300 text-sm">Transações</p>
        </div>
        
        <div>
          <p className="text-blue-100 text-2xl font-bold">R$ {formatCurrency(Math.abs(totalValue))}</p>
          <p className="text-blue-300 text-sm">Valor Total</p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-blue-700/50">
        <p className="text-blue-400 text-xs">
          Origem: BB • Status: Pago (p) ou Saque (s)
        </p>
      </div>
    </div>
  );
}