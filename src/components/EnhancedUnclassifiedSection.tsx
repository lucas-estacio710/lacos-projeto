// components/EnhancedUnclassifiedSection.tsx - CORRIGIDO

import React, { useState } from 'react';
import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { BatchClassificationModal } from '@/components/BatchClassificationModal';
import { 
  QUICK_ACTION_CATEGORIES, 
  generateSmartSuggestions, 
  applyQuickClassification,
  SmartSuggestion 
} from '@/lib/smartClassification';
import { formatCurrency, formatDate } from '@/lib/utils';

interface EnhancedUnclassifiedSectionProps {
  transactions?: Transaction[];
  cardTransactions?: CardTransaction[];
  historicTransactions: Transaction[];
  historicCardTransactions?: CardTransaction[];
  onEditTransaction?: (transaction: Transaction) => void;
  onEditCardTransaction?: (transaction: CardTransaction) => void;
  onReconcileTransaction?: (transaction: Transaction) => void;
  onApplyQuickClassification?: (transactionId: string, classification: any) => Promise<void>;
  onApplyBatchClassification?: (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => Promise<void>;
  onMoveToComplexClassification?: (transactionId: string) => Promise<void>;
  canReconcile?: boolean;
  type: 'transactions' | 'cards';
  title?: string;
}

export function EnhancedUnclassifiedSection({ 
  transactions = [],
  cardTransactions = [],
  historicTransactions,
  historicCardTransactions = [],
  onEditTransaction,
  onEditCardTransaction,
  onReconcileTransaction,
  onApplyQuickClassification,
  onApplyBatchClassification,
  onMoveToComplexClassification,
  canReconcile = false,
  type,
  title
}: EnhancedUnclassifiedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<Record<string, SmartSuggestion[]>>({});

  // Filtrar não classificados baseado no tipo
  const unclassified = type === 'transactions' 
    ? transactions.filter(t => t.realizado === 'p')
    : cardTransactions.filter(c => c.status === 'pending');
  
  if (unclassified.length === 0) return null;

  // Gerar sugestões para uma transação específica
  const loadSuggestions = (transactionId: string) => {
    const item = type === 'transactions'
      ? transactions.find(t => t.id === transactionId)
      : cardTransactions.find(c => c.id === transactionId);
      
    if (!item) return;

    const generatedSuggestions = generateSmartSuggestions(
      item as Transaction | CardTransaction,
      historicTransactions,
      historicCardTransactions
    );

    setSuggestions(prev => ({
      ...prev,
      [transactionId]: generatedSuggestions
    }));
    
    setShowSuggestions(prev => ({
      ...prev,
      [transactionId]: true
    }));
  };

  // Fechar sugestões
  const closeSuggestions = (transactionId: string) => {
    setShowSuggestions(prev => ({
      ...prev,
      [transactionId]: false
    }));
  };

  // Aplicar classificação rápida
  const handleQuickClassification = async (item: Transaction | CardTransaction, quickCategoryId: string) => {
    if (!onApplyQuickClassification) return;

    try {
      const classification = applyQuickClassification(item, quickCategoryId);
      await onApplyQuickClassification(item.id, classification);
    } catch (error) {
      console.error('❌ Erro na classificação rápida:', error);
      alert('❌ Erro ao aplicar classificação rápida');
    }
  };

  // Aplicar classificação em lote
  const handleBatchClassification = async (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => {
    if (!onApplyBatchClassification) return;
    await onApplyBatchClassification(classifications);
    setShowBatchModal(false);
  };

  // Mover para classificação complexa
  const handleMoveToComplexClassification = async (item: Transaction | CardTransaction) => {
    if (!onMoveToComplexClassification) return;

    try {
      await onMoveToComplexClassification(item.id);
      alert('✅ Transação movida para Classificação Complexa!');
    } catch (error) {
      console.error('❌ Erro ao mover para classificação complexa:', error);
      alert('❌ Erro ao mover transação');
    }
  };

  const sectionConfig = {
    transactions: {
      title: title || 'Não Classificados',
      icon: '⚠️',
      bgClass: 'bg-yellow-900',
      borderClass: 'border-yellow-700',
      hoverClass: 'hover:bg-yellow-800',
      description: 'lançamentos pendentes'
    },
    cards: {
      title: title || 'Cartões Não Classificados',
      icon: '💳',
      bgClass: 'bg-purple-900',
      borderClass: 'border-purple-700',
      hoverClass: 'hover:bg-purple-800',
      description: 'transações pendentes'
    }
  };

  const config = sectionConfig[type];
  
  return (
    <>
      <div className={`${config.bgClass} rounded-lg shadow-lg overflow-hidden border ${config.borderClass} mb-4`}>
        {/* Header da seção */}
        <div className="p-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-3 ${config.hoverClass} transition-colors rounded p-2 -m-2 w-full`}
          >
            <span className="text-xl">{config.icon}</span>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-100">{config.title}</p>
              <p className="text-xs text-gray-300">{unclassified.length} {config.description}</p>
            </div>
            <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
          </button>
        </div>
        
        {isExpanded && (
          <div className={`border-t ${config.borderClass}`}>
            {/* Barra de Ações Global */}
            <div className="bg-gray-800 p-3 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">Ações em lote:</span>
                  {onApplyBatchClassification && (
                    <button
                      onClick={() => setShowBatchModal(true)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors flex items-center gap-1"
                    >
                      <span>⚡</span>
                      <span>Classificação em Lote</span>
                    </button>
                  )}
                </div>
                
                <div className="text-sm text-gray-400">
                  💡 Use botões rápidos ou sugestões IA para acelerar
                </div>
              </div>
            </div>

            {/* Lista de Transações */}
            <div className="max-h-80 overflow-y-auto">
              {unclassified.map((item, idx) => {
                const itemSuggestions = suggestions[item.id] || [];
                const showingSuggestions = showSuggestions[item.id] || false;
                const isTransaction = type === 'transactions';
                const transaction = item as Transaction;
                const cardTransaction = item as CardTransaction;
                
                return (
                  <div key={`${item.id}-${idx}`} className={`px-3 py-3 border-b ${config.borderClass} last:border-b-0 ${config.hoverClass}`}>
                    
                    {/* Linha Principal */}
                    <div className="flex items-center gap-3">
                      
                      {/* COLUNA 1: Descrição e dados */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-gray-100 font-medium leading-tight break-words">
                            {item.descricao_origem || 'Sem descrição'}
                          </p>
                          
                          {/* Badge da fatura para cards */}
                          {!isTransaction && (
                            <span className="text-xs bg-purple-700 text-purple-200 px-2 py-1 rounded">
                              {cardTransaction.fatura_id}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-300">
                          {formatDate(isTransaction ? transaction.data : cardTransaction.data_transacao)} •
                          {item.origem || 'N/A'} •
                          {item.cc || 'N/A'}
                          {isTransaction && (transaction as any).is_from_reconciliation && (
                            <span className="text-blue-300 ml-1">
                              🔗 Reconciliada
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* COLUNA 2: Valor */}
                      <div className="flex-shrink-0 text-right min-w-[70px]">
                        <span className={`font-medium text-sm block ${item.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(item.valor || 0))}
                        </span>
                      </div>
                      
                      {/* COLUNA 3: Botões de Ação */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        
                        {/* Botão de Classificação Complexa */}
                        {onMoveToComplexClassification && (
                          <button
                            onClick={() => handleMoveToComplexClassification(item as Transaction | CardTransaction)}
                            className="w-7 h-7 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs transition-colors flex items-center justify-center shadow-sm"
                            title="Mover para Classificação Complexa"
                          >
                            🧩
                          </button>
                        )}
                        
                        {/* Botão de Sugestões IA */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (showSuggestions[item.id]) {
                              closeSuggestions(item.id);
                            } else {
                              loadSuggestions(item.id);
                            }
                          }}
                          className={`w-7 h-7 rounded text-xs transition-colors flex items-center justify-center ${
                            showSuggestions[item.id] 
                              ? 'bg-green-500 text-white' 
                              : 'bg-green-600 hover:bg-green-500 text-white'
                          }`}
                          title={showSuggestions[item.id] ? "Fechar sugestões" : "Sugestões IA"}
                        >
                          {showSuggestions[item.id] ? '❌' : '🤖'}
                        </button>
                        
                        {/* Botão de Reconciliação (apenas para transactions) */}
                        {onReconcileTransaction && isTransaction && canReconcile && !(transaction as any).is_from_reconciliation && (
                          <button
                            onClick={() => onReconcileTransaction(transaction)}
                            className="w-7 h-7 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition-colors flex items-center justify-center shadow-sm"
                            title="Reconciliar com fatura"
                          >
                            🔗
                          </button>
                        )}
                        
                        {/* Botão de Edição */}
                        <button
                          onClick={() => {
                            if (isTransaction && onEditTransaction) {
                              onEditTransaction(transaction);
                            } else if (!isTransaction && onEditCardTransaction) {
                              onEditCardTransaction(cardTransaction);
                            }
                          }}
                          className="w-7 h-7 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors flex items-center justify-center shadow-sm"
                          title="Editar/Classificar"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>

                    {/* Botões de Ação Rápida */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {QUICK_ACTION_CATEGORIES.map(category => (
                        <button
                          key={category.id}
                          onClick={() => handleQuickClassification(item as Transaction | CardTransaction, category.id)}
                          className={`px-2 py-1 ${category.color} text-white rounded text-xs transition-colors hover:scale-105 flex items-center gap-1`}
                          title={`${category.title}: ${category.conta} > ${category.categoria} > ${category.subtipo}`}
                        >
                          <span>{category.label}</span>
                          <span className="hidden sm:inline">{category.title}</span>
                        </button>
                      ))}
                    </div>

                    {/* Sugestões Inteligentes */}
                    {showingSuggestions && itemSuggestions.length > 0 && (
                      <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-medium text-gray-300 flex items-center gap-1">
                            <span>🤖</span>
                            Sugestões Inteligentes ({itemSuggestions.length})
                          </h5>
                          <button
                            onClick={() => closeSuggestions(item.id)}
                            className="text-gray-400 hover:text-gray-200 text-xs"
                          >
                            Fechar ❌
                          </button>
                        </div>
                        <div className="space-y-1">
                          {itemSuggestions.map((suggestion, suggIdx) => (
                            <button
                              key={suggIdx}
                              onClick={() => {
                                if (onApplyQuickClassification) {
                                  const classification = {
                                    conta: suggestion.conta,
                                    categoria: suggestion.categoria,
                                    subtipo: suggestion.subtipo,
                                    descricao: suggestion.descricao,
                                    realizado: isTransaction ? 's' : undefined
                                  };
                                  onApplyQuickClassification(item.id, classification);
                                  closeSuggestions(item.id);
                                }
                              }}
                              className="w-full text-left p-2 hover:bg-gray-700 rounded text-xs transition-colors border border-gray-600"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-gray-200 font-medium">
                                    {suggestion.conta} → {suggestion.categoria} → {suggestion.subtipo}
                                  </p>
                                  <p className="text-gray-400 text-xs mt-0.5">{suggestion.reason}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    suggestion.confidence > 0.8 ? 'bg-green-700 text-green-200' :
                                    suggestion.confidence > 0.6 ? 'bg-yellow-700 text-yellow-200' :
                                    'bg-gray-700 text-gray-300'
                                  }`}>
                                    {Math.round(suggestion.confidence * 100)}%
                                  </span>
                                  <span className="text-blue-400 text-xs">→</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mensagem quando não há sugestões */}
                    {showingSuggestions && itemSuggestions.length === 0 && (
                      <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-medium text-gray-300 flex items-center gap-1">
                            <span>🤖</span>
                            Sugestões Inteligentes
                          </h5>
                          <button
                            onClick={() => closeSuggestions(item.id)}
                            className="text-gray-400 hover:text-gray-200 text-xs"
                          >
                            Fechar ❌
                          </button>
                        </div>
                        <div className="text-center py-4">
                          <p className="text-gray-400 text-xs">
                            {historicTransactions.length === 0 
                              ? "📚 Nenhum histórico disponível para gerar sugestões"
                              : "🔍 Nenhuma sugestão encontrada"
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Classificação em Lote */}
      {showBatchModal && onApplyBatchClassification && (
        <BatchClassificationModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          unclassifiedTransactions={unclassified as (Transaction | CardTransaction)[]}
          historicTransactions={historicTransactions}
          historicCardTransactions={historicCardTransactions}
          onApplyBatch={handleBatchClassification}
          onMoveToComplexClassification={onMoveToComplexClassification ? async (transactionIds: string[]) => {
            // Executar para cada transação individualmente
            for (const id of transactionIds) {
              await onMoveToComplexClassification(id);
            }
          } : undefined}
        />
      )}
    </>
  );
}