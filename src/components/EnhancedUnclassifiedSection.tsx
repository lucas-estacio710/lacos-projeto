import React, { useState } from 'react';
import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { BatchClassificationModal } from '@/components/BatchClassificationModal';
import { 
  getQuickActionCategories
} from '@/lib/smartClassification';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useHierarchy } from '@/hooks/useHierarchy';
import { useConfig } from '@/contexts/ConfigContext';
import { SUBTIPO_IDS } from '@/lib/constants';

interface EnhancedUnclassifiedSectionProps {
  title: string;
  type: 'transactions' | 'card_transactions';
  unclassified: (Transaction | CardTransaction)[];
  historicTransactions: Transaction[];
  historicCardTransactions: CardTransaction[];
  onMoveToComplexClassification?: (transaction: Transaction | CardTransaction) => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onEditCardTransaction?: (cardTransaction: CardTransaction) => void;
  onReconcileTransaction?: (transaction: Transaction) => void;
  canReconcile?: boolean;
  onApplyBatchClassification?: (transactions: {
    selectedIds: string[];
    conta: string;
    categoria: string;
    subtipo: string;
  }) => Promise<void>;
}

export function EnhancedUnclassifiedSection({
  title,
  type,
  unclassified,
  historicTransactions,
  historicCardTransactions,
  onMoveToComplexClassification,
  onEditTransaction,
  onEditCardTransaction,
  onReconcileTransaction,
  canReconcile = false,
  onApplyBatchClassification
}: EnhancedUnclassifiedSectionProps) {
  const { contas, categorias, subtipos } = useHierarchy();
  const { customAccounts } = useConfig();

  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  const handleMoveToComplexClassification = (item: Transaction | CardTransaction) => {
    if (onMoveToComplexClassification) {
      onMoveToComplexClassification(item);
    }
  };

  const handleQuickClassification = (item: Transaction | CardTransaction, subtipoId: string) => {
    if (onApplyBatchClassification) {
      onApplyBatchClassification({
        selectedIds: [item.id],
        conta: '',
        categoria: '', 
        subtipo: subtipoId
      });
    }
  };


  const setEditingTransaction = (item: Transaction | CardTransaction) => {
    const isTransaction = type === 'transactions';
    
    if (isTransaction && onEditTransaction) {
      onEditTransaction(item as Transaction);
    } else if (!isTransaction && onEditCardTransaction) {
      onEditCardTransaction(item as CardTransaction);
    }
  };

  if (unclassified.length === 0) return null;

  const config = {
    bgClass: 'bg-gray-800',
    borderClass: 'border-gray-700',
    hoverClass: 'hover:bg-gray-700/50',
    textClass: 'text-gray-100'
  };

  return (
    <>
      <div className={`rounded-lg ${config.bgClass} border ${config.borderClass}`}>
        {/* Header da seção - Modernizado */}
        <div className={`px-4 py-3 border-b ${config.borderClass} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-gray-100 text-sm">
              {title}
              <span className="ml-2 px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full">
                {unclassified.length}
                {type === 'transactions' ? ' Bancárias' : ' Cartões'}
              </span>
            </h3>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="p-0">
          {/* Visualização Comprimida com Expansão Individual */}
          <div className="max-h-80 overflow-y-auto">
            {unclassified.map((item, idx) => {
              const isTransaction = type === 'transactions';
              const transaction = item as Transaction;
              const cardTransaction = item as CardTransaction;
              
              return (
                <div key={`${item.id}-${idx}`} className="px-3 py-2 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    {/* Lado esquerdo: Data - Descrição */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-gray-200">
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDate(isTransaction ? transaction.data : cardTransaction.data_transacao)}
                        </span>
                        <span className="truncate">
                          {item.descricao_origem || 'Sem descrição'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Lado direito: Origem - Valor */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
                      <span>{item.origem}</span>
                      <span className={`font-medium ${item.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {item.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(item.valor || 0))}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedItem(expandedItem === item.id ? null : item.id);
                        }}
                        className="text-gray-500 hover:text-gray-300 transition-colors p-1"
                        title="Expandir item"
                      >
                        {expandedItem === item.id ? '▼' : '▶'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Conteúdo expandido individual - igual versão expandida original */}
                  {expandedItem === item.id && (
                    <div className="mt-3 space-y-3">
                      {/* Botões de Ação no topo */}
                      <div className="flex items-center gap-1">
                        
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
                        
                        
                        {/* Botão de Reconciliação */}
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

                      {/* Botões de Ação Rápida - Dinâmicos */}
                      <div className="flex flex-wrap gap-1">
                        {getQuickActionCategories(contas, categorias, subtipos).map(category => (
                          <button
                            key={category.id}
                            onClick={() => handleQuickClassification(item as Transaction | CardTransaction, category.id)}
                            className={`px-2 py-1 ${category.color} text-white rounded text-xs transition-colors hover:scale-105 flex items-center gap-1`}
                            title={`${category.title}: ${category.conta_codigo} > ${category.categoria_nome} > ${category.subtipo_nome}`}
                          >
                            <span>{category.label}</span>
                            <span className="text-[10px]">{category.title}</span>
                          </button>
                        ))}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </>
  );
}