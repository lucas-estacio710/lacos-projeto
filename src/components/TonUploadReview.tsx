// components/TonUploadReview.tsx - Modal de revisão e seleção de transações TON antes da importação

import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, Circle } from 'lucide-react';
import { Transaction } from '@/types';

interface TonUploadReviewProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onConfirm: (selectedTransactions: Transaction[]) => Promise<void>;
  currentBalance: number; // Saldo atual do TON/Stone
}

export const TonUploadReview: React.FC<TonUploadReviewProps> = ({
  isOpen,
  onClose,
  transactions,
  onConfirm,
  currentBalance
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(transactions.map(t => t.id))
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Calcular totais
  const { totalSelected, positiveCount, negativeCount, zeroCount } = useMemo(() => {
    let total = 0;
    let positive = 0;
    let negative = 0;
    let zero = 0;

    transactions.forEach(t => {
      if (selectedIds.has(t.id)) {
        total += t.valor;
        if (t.valor > 0) positive++;
        else if (t.valor < 0) negative++;
        else zero++;
      }
    });

    return {
      totalSelected: total,
      positiveCount: positive,
      negativeCount: negative,
      zeroCount: zero
    };
  }, [transactions, selectedIds]);

  // Saldo final após importação
  const finalBalance = currentBalance + totalSelected;

  // Toggle seleção individual
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Selecionar todos
  const selectAll = () => {
    setSelectedIds(new Set(transactions.map(t => t.id)));
  };

  // Desselecionar todos
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Confirmar importação
  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      alert('⚠️ Selecione pelo menos uma transação para importar');
      return;
    }

    setIsProcessing(true);
    try {
      const selectedTransactions = transactions.filter(t => selectedIds.has(t.id));
      await onConfirm(selectedTransactions);
    } catch (error) {
      console.error('Erro ao confirmar importação:', error);
      alert('❌ Erro ao importar transações. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    const prefix = value >= 0 ? '' : '-';
    return `${prefix}R$ ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full h-[98vh] sm:h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-100">
              📋 Revisar Transações TON
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Selecione as transações que deseja importar
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Placar de Saldo */}
        <div className="p-4 sm:p-6 bg-gray-700/50 border-b border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Saldo Atual */}
            <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Saldo Atual TON</div>
              <div className={`text-lg sm:text-2xl font-bold ${currentBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {formatCurrency(currentBalance)}
              </div>
            </div>

            {/* Lote Selecionado */}
            <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Lote Selecionado ({selectedIds.size}/{transactions.length})
              </div>
              <div className={`text-lg sm:text-2xl font-bold ${totalSelected >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalSelected >= 0 ? '+' : ''}{formatCurrency(totalSelected)}
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                {positiveCount > 0 && (
                  <span className="text-green-400">↑ {positiveCount}</span>
                )}
                {negativeCount > 0 && (
                  <span className="text-red-400">↓ {negativeCount}</span>
                )}
                {zeroCount > 0 && (
                  <span className="text-gray-400">= {zeroCount}</span>
                )}
              </div>
            </div>

            {/* Saldo Final */}
            <div className="bg-gray-700 rounded-lg p-3 sm:p-4 border-2 border-purple-500">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Saldo Final (Prévia)</div>
              <div className={`text-lg sm:text-2xl font-bold ${finalBalance >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {formatCurrency(finalBalance)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {finalBalance >= currentBalance ? '📈' : '📉'} {formatCurrency(Math.abs(finalBalance - currentBalance))}
              </div>
            </div>
          </div>
        </div>

        {/* Ações de Seleção */}
        <div className="p-3 sm:p-4 border-b border-gray-700 flex gap-2">
          <button
            onClick={selectAll}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            ✓ Selecionar Todos
          </button>
          <button
            onClick={deselectAll}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            ✗ Desselecionar Todos
          </button>
          <div className="flex-1" />
          <div className="text-sm text-gray-400 flex items-center">
            {selectedIds.size} de {transactions.length} selecionadas
          </div>
        </div>

        {/* Lista de Transações */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="space-y-2">
            {transactions.map(transaction => {
              const isSelected = selectedIds.has(transaction.id);

              return (
                <div
                  key={transaction.id}
                  onClick={() => !isProcessing && toggleSelection(transaction.id)}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-900/30 border-blue-500 hover:bg-blue-900/40'
                      : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  } ${isProcessing ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox Visual */}
                    <div className="flex-shrink-0 mt-1">
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-500" />
                      )}
                    </div>

                    {/* Conteúdo da Transação */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm sm:text-base truncate">
                            {transaction.descricao_origem}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <span>📅 {transaction.data}</span>
                            <span>•</span>
                            <span>🏦 {transaction.origem}</span>
                            <span>•</span>
                            <span className="font-mono">{transaction.mes}</span>
                          </div>
                        </div>

                        {/* Valor */}
                        <div className="flex-shrink-0 text-right">
                          <div className={`text-base sm:text-lg font-bold ${
                            transaction.valor > 0
                              ? 'text-green-400'
                              : transaction.valor < 0
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}>
                            {transaction.valor >= 0 ? '+' : ''}{formatCurrency(transaction.valor)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {transaction.realizado === 'p' ? '⏳ Pendente' : '✓ Realizado'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {transactions.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">Nenhuma transação para revisar</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-400 hidden sm:block">
              {selectedIds.size > 0 ? (
                <>
                  {selectedIds.size} transaç{selectedIds.size !== 1 ? 'ões' : 'ão'} selecionada{selectedIds.size !== 1 ? 's' : ''}
                  {' • '}
                  Total: {formatCurrency(totalSelected)}
                </>
              ) : (
                'Nenhuma transação selecionada'
              )}
            </div>

            <div className="flex gap-2 flex-1 sm:flex-initial justify-end">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedIds.size === 0 || isProcessing}
                className={`px-4 py-2 rounded font-medium transition-colors text-sm flex items-center gap-2 ${
                  selectedIds.size > 0 && !isProcessing
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Importar ({selectedIds.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TonUploadReview;
