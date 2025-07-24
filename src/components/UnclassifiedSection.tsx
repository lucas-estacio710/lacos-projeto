import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction } from '@/types';

interface UnclassifiedSectionProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
}

export function UnclassifiedSection({ transactions, onEditTransaction }: UnclassifiedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const unclassified = transactions.filter(t => t.realizado === 'p');
  
  if (unclassified.length === 0) return null;
  
  return (
    <div className="bg-yellow-900 rounded-lg shadow-lg overflow-hidden border border-yellow-700 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-yellow-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div className="text-left">
            <p className="font-semibold text-yellow-100">Não Classificados</p>
            <p className="text-xs text-yellow-300">{unclassified.length} lançamentos pendentes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="w-5 h-5 text-yellow-400" /> : <ChevronDown className="w-5 h-5 text-yellow-400" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-yellow-700">
          <div className="max-h-64 overflow-y-auto">
            {unclassified.map((transaction, idx) => (
              <div key={`${transaction.id}-${idx}`} className="px-4 py-3 border-b border-yellow-700 last:border-b-0 hover:bg-yellow-800 flex items-center">
                <div className="flex-1">
                  <p className="text-sm text-yellow-100 font-medium">
                    {transaction.descricao_origem || transaction.descricao || 'Sem descrição'}
                  </p>
                  <p className="text-xs text-yellow-300 mt-1">
                    {transaction.data ? formatDate(transaction.data) : 'Sem data'} - 
                    Origem: {transaction.origem || 'N/A'} - 
                    CC: {transaction.cc || 'N/A'}
                  </p>
                </div>
                <span className={`font-medium text-sm mx-4 ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''} R$ {formatCurrency(Math.abs(transaction.valor || 0))}
                </span>
                <button
                  onClick={() => onEditTransaction(transaction)}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-sm transition-colors"
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}