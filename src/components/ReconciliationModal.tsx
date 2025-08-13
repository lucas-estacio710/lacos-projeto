// components/ReconciliationModal.tsx - VERSÃO SIMPLIFICADA PARA CARD_TRANSACTIONS

import React, { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { formatCurrency, formatMonth, formatDate } from '@/lib/utils';

interface ReconciliationModalProps {
  isOpen: boolean;
  transaction: Transaction | null; // Pagamento bancário
  availableFaturas: Array<{
    faturaId: string;
    transactions: CardTransaction[];
    totalValue: number;
    month: string;
    cardCount: number;
  }>;
  onClose: () => void;
  onConfirm: (faturaId: string, cardTransactionIds: string[]) => void;
}

export function ReconciliationModal({ 
  isOpen, 
  transaction,
  availableFaturas,
  onClose, 
  onConfirm
}: ReconciliationModalProps) {
  const [selectedFaturaId, setSelectedFaturaId] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);

  // Reset quando modal abre/fecha
  useEffect(() => {
    if (isOpen && availableFaturas.length > 0) {
      // Pré-selecionar a fatura com valor mais próximo
      const closestFatura = findClosestValueFatura();
      if (closestFatura) {
        setSelectedFaturaId(closestFatura.faturaId);
        // Pré-selecionar todas as transações da fatura
        const allIds = new Set(closestFatura.transactions.map(t => t.id));
        setSelectedCards(allIds);
      }
      setShowDetails(false);
      setSelectAll(true);
    }
  }, [isOpen, availableFaturas]);

  // Encontrar fatura com valor mais próximo ao pagamento
  const findClosestValueFatura = () => {
    if (!transaction || availableFaturas.length === 0) return null;
    
    const paymentValue = Math.abs(transaction.valor);
    
    return availableFaturas.reduce((closest, current) => {
      const currentDiff = Math.abs(current.totalValue - paymentValue);
      const closestDiff = closest ? Math.abs(closest.totalValue - paymentValue) : Infinity;
      
      return currentDiff < closestDiff ? current : closest;
    }, null as typeof availableFaturas[0] | null);
  };

  // Toggle seleção de card
  const toggleCardSelection = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
      setSelectAll(false);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  // Toggle selecionar todos
  const handleSelectAll = () => {
    const selectedFatura = availableFaturas.find(f => f.faturaId === selectedFaturaId);
    if (!selectedFatura) return;

    if (selectAll) {
      setSelectedCards(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(selectedFatura.transactions.map(t => t.id));
      setSelectedCards(allIds);
      setSelectAll(true);
    }
  };

  // Confirmar reconciliação
  const handleConfirm = () => {
    if (selectedFaturaId && selectedCards.size > 0) {
      onConfirm(selectedFaturaId, Array.from(selectedCards));
      onClose();
    }
  };

  if (!isOpen || !transaction) return null;

  const selectedFatura = availableFaturas.find(f => f.faturaId === selectedFaturaId);
  const selectedTotal = selectedFatura 
    ? selectedFatura.transactions
        .filter(t => selectedCards.has(t.id))
        .reduce((sum, t) => sum + Math.abs(t.valor), 0)
    : 0;

  const valueDifference = Math.abs(transaction.valor) - selectedTotal;
  const isExactMatch = Math.abs(valueDifference) < 0.01;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center">
            <span className="mr-2">🔗</span>
            Reconciliar Pagamento com Fatura
          </h3>
          
          {/* Informações do pagamento */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-4 border border-blue-700">
            <h4 className="font-medium text-blue-100 mb-3">💳 Pagamento Bancário</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-blue-300">Data</label>
                <p className="text-blue-100">{formatDate(transaction.data)}</p>
              </div>
              <div>
                <label className="text-sm text-blue-300">Valor</label>
                <p className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-blue-300">Descrição</label>
                <p className="text-blue-100 break-words text-sm">{transaction.descricao_origem}</p>
              </div>
              <div>
                <label className="text-sm text-blue-300">Banco</label>
                <p className="text-blue-100">{transaction.cc}</p>
              </div>
              <div>
                <label className="text-sm text-blue-300">Mês</label>
                <p className="text-blue-100">{formatMonth(transaction.mes)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Seleção de fatura */}
          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-2">
              Selecione a fatura de cartão para reconciliar:
            </label>
            
            {availableFaturas.length === 0 ? (
              <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-center">
                <span className="text-2xl mb-2 block">⚠️</span>
                <p className="text-yellow-100">Nenhuma fatura disponível para reconciliação</p>
                <p className="text-yellow-300 text-sm mt-1">
                  Importe uma fatura de cartão e classifique as transações primeiro
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableFaturas.map(fatura => {
                  const isSelected = selectedFaturaId === fatura.faturaId;
                  const valueDiff = Math.abs(Math.abs(transaction.valor) - fatura.totalValue);
                  const isClosest = fatura === findClosestValueFatura();
                  
                  return (
                    <button
                      key={fatura.faturaId}
                      onClick={() => {
                        setSelectedFaturaId(fatura.faturaId);
                        // Auto-selecionar todas as transações
                        const allIds = new Set(fatura.transactions.map(t => t.id));
                        setSelectedCards(allIds);
                        setSelectAll(true);
                      }}
                      className={`w-full p-4 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? 'bg-blue-900 border-blue-600'
                          : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-100">
                              {fatura.faturaId}
                            </span>
                            {isClosest && (
                              <span className="text-xs bg-green-700 text-green-100 px-2 py-1 rounded">
                                Melhor match
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 mt-1">
                            {formatMonth(fatura.month)} • {fatura.cardCount} transações
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-400">
                            R$ {formatCurrency(fatura.totalValue)}
                          </p>
                          {valueDiff < 0.01 ? (
                            <p className="text-xs text-green-400">✅ Valor exato</p>
                          ) : (
                            <p className="text-xs text-yellow-400">
                              Diferença: R$ {formatCurrency(valueDiff)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detalhes da fatura selecionada */}
          {selectedFatura && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-100">
                  📋 Transações da Fatura
                </h4>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  {showDetails ? '▼ Ocultar' : '▶ Mostrar'} detalhes
                </button>
              </div>
              
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="text-xs text-gray-400">Total da Fatura</label>
                  <p className="text-gray-200 font-medium">
                    R$ {formatCurrency(selectedFatura.totalValue)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Selecionadas</label>
                  <p className="text-blue-400 font-medium">
                    {selectedCards.size}/{selectedFatura.cardCount}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Total Selecionado</label>
                  <p className={`font-medium ${
                    isExactMatch ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    R$ {formatCurrency(selectedTotal)}
                  </p>
                </div>
              </div>

              {/* Checkbox selecionar todos */}
              <div className="mb-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="rounded border-gray-500 bg-gray-600"
                  />
                  Selecionar todas as transações
                </label>
              </div>

              {/* Lista de transações */}
              {showDetails && (
                <div className="border-t border-gray-600 pt-3 mt-3">
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {selectedFatura.transactions.map(cardTx => (
                      <label
                        key={cardTx.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCards.has(cardTx.id)}
                          onChange={() => toggleCardSelection(cardTx.id)}
                          className="rounded border-gray-500 bg-gray-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">
                            {cardTx.descricao_origem}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(cardTx.data_transacao)}
                            {cardTx.categoria && (
                              <span className="text-blue-400 ml-2">
                                • {cardTx.categoria} → {cardTx.subtipo}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="text-sm text-red-400 font-medium">
                          R$ {formatCurrency(Math.abs(cardTx.valor))}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validação de valores */}
          {selectedFaturaId && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isExactMatch 
                ? 'bg-green-900 border-green-700'
                : 'bg-yellow-900 border-yellow-700'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${
                    isExactMatch ? 'text-green-100' : 'text-yellow-100'
                  }`}>
                    {isExactMatch ? '✅ Valores conferem!' : '⚠️ Diferença de valores'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isExactMatch ? 'text-green-300' : 'text-yellow-300'
                  }`}>
                    Pagamento: R$ {formatCurrency(Math.abs(transaction.valor))} | 
                    Selecionado: R$ {formatCurrency(selectedTotal)}
                  </p>
                </div>
                {!isExactMatch && (
                  <div className="text-right">
                    <p className="text-yellow-100 font-bold">
                      {valueDifference > 0 ? '+' : ''}R$ {formatCurrency(Math.abs(valueDifference))}
                    </p>
                    <p className="text-yellow-300 text-xs">
                      {valueDifference > 0 ? 'Falta' : 'Sobra'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Informações sobre reconciliação */}
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 mt-4">
            <h4 className="text-blue-100 font-medium mb-2">ℹ️ O que acontecerá:</h4>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• O pagamento será marcado como reconciliado</li>
              <li>• As transações do cartão selecionadas serão marcadas como pagas</li>
              <li>• O vínculo entre pagamento e fatura será registrado</li>
              <li>• Você poderá desfazer se necessário</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-850">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedFaturaId || selectedCards.size === 0}
              className={`flex-1 py-2 px-4 rounded transition-colors font-medium ${
                selectedFaturaId && selectedCards.size > 0
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              🔗 Reconciliar {selectedCards.size > 0 && `(${selectedCards.size} transações)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}