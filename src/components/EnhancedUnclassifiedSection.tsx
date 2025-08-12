// components/EnhancedUnclassifiedSection.tsx - SEÇÃO ATUALIZADA COM AS 3 SOLUÇÕES

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction, FutureTransaction } from '@/types';
import { BatchClassificationModal } from '@/components/BatchClassificationModal';
import { 
  QUICK_ACTION_CATEGORIES, 
  generateSmartSuggestions, 
  applyQuickClassification,
  SmartSuggestion 
} from '@/lib/smartClassification';
import { formatCurrency, formatDate } from '@/lib/utils';

interface EnhancedUnclassifiedSectionProps {
  transactions: (Transaction | FutureTransaction)[];
  historicTransactions: Transaction[];
  onEditTransaction: (transaction: Transaction | FutureTransaction) => void;
  onReconcileTransaction?: (transaction: Transaction) => void;
  onApplyQuickClassification?: (transactionId: string, classification: any) => Promise<void>;
  onApplyBatchClassification?: (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => Promise<void>;
  availableGroupsCount?: number;
  type?: 'transactions' | 'futures'; // Diferenciar o tipo
}

export function EnhancedUnclassifiedSection({ 
  transactions,
  historicTransactions,
  onEditTransaction,
  onReconcileTransaction,
  onApplyQuickClassification,
  onApplyBatchClassification,
  availableGroupsCount = 0,
  type = 'transactions'
}: EnhancedUnclassifiedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<Record<string, SmartSuggestion[]>>({});

  // Filtrar apenas não classificados
  const unclassified = transactions.filter(t => {
    if (type === 'transactions') {
      return (t as Transaction).realizado === 'p';
    } else {
      return !t.categoria || t.categoria === '';
    }
  });
  
  if (unclassified.length === 0) return null;

  // Gerar sugestões para uma transação específica
  const loadSuggestions = (transactionId: string) => {
    console.log('🤖 Carregando sugestões para transação:', transactionId);
    
    const transaction = unclassified.find(t => t.id === transactionId);
    if (!transaction) {
      console.error('❌ Transação não encontrada:', transactionId);
      return;
    }

    console.log('📋 Transação encontrada:', transaction.descricao_origem);
    console.log('📊 Histórico disponível:', historicTransactions.length, 'transações');

    // Gerar sugestões
    const generatedSuggestions = generateSmartSuggestions(transaction, historicTransactions);
    console.log('💡 Sugestões geradas:', generatedSuggestions.length);

    // Atualizar estado
    setSuggestions(prev => ({
      ...prev,
      [transactionId]: generatedSuggestions
    }));
    
    setShowSuggestions(prev => ({
      ...prev,
      [transactionId]: true
    }));

    console.log('✅ Estado atualizado para transação:', transactionId);
  };

  // Fechar sugestões
  const closeSuggestions = (transactionId: string) => {
    setShowSuggestions(prev => ({
      ...prev,
      [transactionId]: false
    }));
  };

  // Aplicar classificação rápida
  const handleQuickClassification = async (transaction: Transaction | FutureTransaction, quickCategoryId: string) => {
    if (!onApplyQuickClassification) return;

    try {
      const classification = applyQuickClassification(transaction, quickCategoryId);
      await onApplyQuickClassification(transaction.id, classification);
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
  };

  const sectionConfig = {
    transactions: {
      title: 'Não Classificados',
      icon: '⚠️',
      color: 'yellow',
      bgClass: 'bg-yellow-900',
      borderClass: 'border-yellow-700',
      hoverClass: 'hover:bg-yellow-800'
    },
    futures: {
      title: 'Cartões Não Classificados',
      icon: '💳',
      color: 'purple',
      bgClass: 'bg-purple-900',
      borderClass: 'border-purple-700',
      hoverClass: 'hover:bg-purple-800'
    }
  };

  const config = sectionConfig[type];
  
  return (
    <>
      <div className={`${config.bgClass} rounded-lg shadow-lg overflow-hidden border ${config.borderClass} mb-4`}>
        {/* Header da seção - SIMPLIFICADO */}
        <div className="p-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-3 ${config.hoverClass} transition-colors rounded p-2 -m-2 w-full`}
          >
            <span className="text-xl">{config.icon}</span>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-100">{config.title}</p>
              <p className="text-xs text-gray-300">{unclassified.length} lançamentos pendentes</p>
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
              {unclassified.map((transaction, idx) => {
                const transactionSuggestions = suggestions[transaction.id] || [];
                const showingSuggestions = showSuggestions[transaction.id] || false;
                
                return (
                  <div key={`${transaction.id}-${idx}`} className={`px-3 py-3 border-b ${config.borderClass} last:border-b-0 ${config.hoverClass}`}>
                    
                    {/* Linha Principal */}
                    <div className="flex items-center gap-3">
                      
                      {/* COLUNA 1: Descrição e dados */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-gray-100 font-medium leading-tight break-words">
                            {transaction.descricao_origem || 'Sem descrição'}
                          </p>
                          
                          {/* Badge de parcelas para futures */}
                          {type === 'futures' && 'parcela_total' in transaction && transaction.parcela_total > 1 && (
                            <span className="text-xs bg-blue-700 text-blue-200 px-2 py-1 rounded">
                              {transaction.parcela_atual}/{transaction.parcela_total}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-300 truncate">
                          {formatDate('data' in transaction ? transaction.data : transaction.data_vencimento)} • 
                          {transaction.origem || 'N/A'} • 
                          {transaction.cc || 'N/A'}
                          {type === 'transactions' && (transaction as Transaction).is_from_reconciliation && (
                            <span className="text-blue-300 ml-1">
                              🔗 {(transaction as Transaction).linked_future_group?.split('_')[0] || 'REC'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* COLUNA 2: Valor */}
                      <div className="flex-shrink-0 text-right min-w-[70px]">
                        <span className={`font-medium text-sm block ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor || 0))}
                        </span>
                      </div>
                      
                      {/* COLUNA 3: Botões de Ação */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        
                        {/* Botão de Sugestões IA */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('🤖 Clique no botão de sugestões para:', transaction.id);
                            if (showSuggestions[transaction.id]) {
                              closeSuggestions(transaction.id);
                            } else {
                              loadSuggestions(transaction.id);
                            }
                          }}
                          className={`w-7 h-7 rounded text-xs transition-colors flex items-center justify-center ${
                            showSuggestions[transaction.id] 
                              ? 'bg-green-500 text-white' 
                              : 'bg-green-600 hover:bg-green-500 text-white'
                          }`}
                          title={showSuggestions[transaction.id] ? "Fechar sugestões" : "Sugestões IA"}
                        >
                          {showSuggestions[transaction.id] ? '❌' : '🤖'}
                        </button>
                        
                        {/* Botão de Reconciliação (apenas para transactions) */}
                        {onReconcileTransaction && type === 'transactions' && (
                          <button
                            onClick={() => onReconcileTransaction(transaction as Transaction)}
                            className={`w-7 h-7 rounded text-xs transition-colors flex items-center justify-center ${
                              availableGroupsCount > 0 && !(transaction as Transaction).is_from_reconciliation
                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-sm'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                            disabled={availableGroupsCount === 0 || (transaction as Transaction).is_from_reconciliation}
                            title={
                              (transaction as Transaction).is_from_reconciliation 
                                ? 'Já reconciliada'
                                : availableGroupsCount > 0 
                                  ? `Reconciliar (${availableGroupsCount} grupos)`
                                  : 'Nenhum grupo disponível'
                            }
                          >
                            🔗
                          </button>
                        )}
                        
                        {/* Botão de Edição */}
                        <button
                          onClick={() => onEditTransaction(transaction)}
                          className="w-7 h-7 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors flex items-center justify-center shadow-sm"
                          title="Editar transação"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>

                    {/* Botões de Ação Rápida (expandidos) */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {QUICK_ACTION_CATEGORIES.map(category => (
                        <button
                          key={category.id}
                          onClick={() => handleQuickClassification(transaction, category.id)}
                          className={`px-2 py-1 ${category.color} text-white rounded text-xs transition-colors hover:scale-105 flex items-center gap-1`}
                          title={`${category.title}: ${category.conta} > ${category.categoria} > ${category.subtipo}`}
                        >
                          <span>{category.label}</span>
                          <span className="hidden sm:inline">{category.title}</span>
                        </button>
                      ))}
                    </div>

                    {/* Sugestões Inteligentes */}
                    {showingSuggestions && transactionSuggestions.length > 0 && (
                      <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-medium text-gray-300 flex items-center gap-1">
                            <span>🤖</span>
                            Sugestões Inteligentes ({transactionSuggestions.length})
                          </h5>
                          <button
                            onClick={() => closeSuggestions(transaction.id)}
                            className="text-gray-400 hover:text-gray-200 text-xs"
                          >
                            Fechar ❌
                          </button>
                        </div>
                        <div className="space-y-1">
                          {transactionSuggestions.map((suggestion, suggIdx) => (
                            <button
                              key={suggIdx}
                              onClick={() => {
                                console.log('✅ Aplicando sugestão:', suggestion);
                                if (onApplyQuickClassification) {
                                  const classification = {
                                    conta: suggestion.conta,
                                    categoria: suggestion.categoria,
                                    subtipo: suggestion.subtipo,
                                    descricao: transaction.descricao_origem || 'Sem descrição',
                                    realizado: type === 'transactions' ? 's' : undefined
                                  };
                                  onApplyQuickClassification(transaction.id, classification);
                                  closeSuggestions(transaction.id);
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
                        
                        {/* Aviso se não há histórico suficiente */}
                        {historicTransactions.length < 10 && (
                          <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/20 rounded p-2">
                            💡 Dica: Importe mais transações históricas para sugestões mais precisas (atual: {historicTransactions.length})
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mensagem quando não há sugestões */}
                    {showingSuggestions && transactionSuggestions.length === 0 && (
                      <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-medium text-gray-300 flex items-center gap-1">
                            <span>🤖</span>
                            Sugestões Inteligentes
                          </h5>
                          <button
                            onClick={() => closeSuggestions(transaction.id)}
                            className="text-gray-400 hover:text-gray-200 text-xs"
                          >
                            Fechar ❌
                          </button>
                        </div>
                        <div className="text-center py-4">
                          <p className="text-gray-400 text-xs">
                            {historicTransactions.length === 0 
                              ? "📚 Nenhum histórico disponível para gerar sugestões"
                              : "🔍 Nenhuma sugestão encontrada para esta transação"
                            }
                          </p>
                          {historicTransactions.length === 0 && (
                            <p className="text-yellow-400 text-xs mt-1">
                              💡 Classifique algumas transações manualmente primeiro
                            </p>
                          )}
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
          unclassifiedTransactions={unclassified}
          historicTransactions={historicTransactions}
          onApplyBatch={handleBatchClassification}
        />
      )}
    </>
  );
}