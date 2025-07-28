import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FutureTransaction } from '@/types';
import { formatCurrency, formatMonth } from '@/lib/utils';

interface UnclassifiedCardsSectionProps {
  futureTransactions: FutureTransaction[]; // Já vem filtrado pela aba pai
  onEditTransaction: (transaction: FutureTransaction) => void;
}

export function UnclassifiedCardsSection({ futureTransactions, onEditTransaction }: UnclassifiedCardsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    
    // Se já está no formato brasileiro
    if (dateStr.includes('/')) return dateStr;
    
    // Se está no formato ISO (YYYY-MM-DD)
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    
    return dateStr;
  };

  // Função para gerar disclaimer dinâmico das parcelas
  const getParcelaDisclaimer = (parcelaAtual: number, parcelaTotal: number): { texto: string; cor: string } => {
    if (parcelaTotal <= 1) return { texto: '', cor: '' };
    
    const restantes = parcelaTotal - parcelaAtual + 1; // Inclui a parcela atual (ainda não paga)
    
    if (parcelaAtual === parcelaTotal) {
      // Última parcela
      return { texto: 'Última parcela', cor: 'text-green-300' };
    } else if (parcelaAtual === parcelaTotal - 1) {
      // Penúltima parcela
      return { texto: 'Penúltima parcela', cor: 'text-yellow-300' };
    } else {
      // Parcelas restantes (incluindo a atual)
      return { 
        texto: `Faltam ${restantes} parcelas`, 
        cor: 'text-blue-300' 
      };
    }
  };

  // Filtrar apenas transações não classificadas da fatura (não as parcelas futuras)
  // IMPORTANTE: futureTransactions já vem filtrado pelos filtros da aba pai
  const unclassifiedCards = futureTransactions.filter(t => 
    (!t.categoria || t.categoria === '') &&
    !t.original_transaction_id // Apenas transações da fatura, não as parcelas geradas
  );
  
  if (unclassifiedCards.length === 0) return null;
  
  return (
    <div className="bg-purple-900 rounded-lg shadow-lg overflow-hidden border border-purple-700 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-purple-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">💳</span>
          <div className="text-left">
            <p className="font-semibold text-purple-100">Cartões Não Classificados</p>
            <p className="text-xs text-purple-300">{unclassifiedCards.length} lançamentos pendentes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="w-5 h-5 text-purple-400" /> : <ChevronDown className="w-5 h-5 text-purple-400" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-purple-700">
          <div className="max-h-64 overflow-y-auto">
            {unclassifiedCards.map((transaction, idx) => {
              const showParcelas = transaction.parcela_total > 1;
              const parcelaInfo = showParcelas ? getParcelaDisclaimer(transaction.parcela_atual, transaction.parcela_total) : null;
              
              return (
                <div key={`${transaction.id}-${idx}`} className="px-4 py-3 border-b border-purple-700 last:border-b-0 hover:bg-purple-800">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm text-purple-100 font-medium">
                        {transaction.estabelecimento || transaction.descricao_origem || 'Sem descrição'}
                      </p>
                      <div className="text-xs text-purple-300 mt-1 space-y-1">
                        <p>
                          Compra: {formatDate(transaction.data_vencimento)} • Fatura: {formatMonth(transaction.mes_vencimento)}
                        </p>
                        <p>
                          Origem: {transaction.origem || 'N/A'} - CC: {transaction.cc || 'N/A'}
                        </p>
                        {/* Parcelas com disclaimer dinâmico */}
                        {showParcelas && (
                          <p className="text-yellow-300 font-medium">
                            📅 Parcela {transaction.parcela_atual}/{transaction.parcela_total}
                            {parcelaInfo && (
                              <span className={`ml-2 text-xs px-2 py-1 rounded ${
                                parcelaInfo.cor === 'text-green-300' ? 'bg-green-800' :
                                parcelaInfo.cor === 'text-yellow-300' ? 'bg-yellow-800' :
                                'bg-blue-800'
                              }`}>
                                {parcelaInfo.texto}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`font-medium text-sm ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {transaction.valor >= 0 ? '+' : ''} R$ {formatCurrency(Math.abs(transaction.valor || 0))}
                      </span>
                      <button
                        onClick={() => onEditTransaction(transaction)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
                      >
                        Classificar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}