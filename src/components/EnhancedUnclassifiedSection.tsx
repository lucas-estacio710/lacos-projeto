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
    customDescriptions?: Record<string, string>; // Adicionar suporte para descrições customizadas
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
  const [editingDescriptions, setEditingDescriptions] = useState<Record<string, string>>({});

  // Função para gerar cores únicas para cada origem
  const getOriginColor = (origem: string): string => {
    const colors = {
      // Bancos principais
      'INTER': 'text-orange-400',
      'ITAU': 'text-blue-400', 
      'BRADESCO': 'text-red-400',
      'SANTANDER': 'text-red-400',
      'CAIXA': 'text-blue-500',
      'BB': 'text-yellow-400',
      'NUBANK': 'text-purple-400',
      'C6': 'text-gray-300',
      'ORIGINAL': 'text-green-400',
      'NEON': 'text-cyan-400',
      'NEXT': 'text-green-500',
      
      // Cartões
      'MASTERCARD': 'text-red-500',
      'VISA': 'text-blue-600',
      'ELO': 'text-red-300',
      'HIPERCARD': 'text-orange-500',
      'AMERICAN': 'text-green-600',
      
      // Outros
      'PIX': 'text-pink-400',
      'TED': 'text-indigo-400',
      'DOC': 'text-teal-400',
      'BOLETO': 'text-amber-400',
      'DEPOSITO': 'text-lime-400',
      'SAQUE': 'text-rose-400',
      
      // Default para origens não mapeadas
      'DEFAULT': 'text-gray-400'
    };

    const origemUpper = origem.toUpperCase();
    
    // Busca exata primeiro (case-insensitive)
    if (colors[origemUpper]) {
      return colors[origemUpper];
    }

    // Busca parcial (para casos como "INTER PAGBANK", "NUBANK MASTERCARD", etc)
    for (const [key, color] of Object.entries(colors)) {
      if (origemUpper.includes(key)) {
        return color;
      }
    }

    // Se não encontrar, usa cor padrão
    return colors.DEFAULT;
  };
  
  const handleMoveToComplexClassification = (item: Transaction | CardTransaction) => {
    if (onMoveToComplexClassification) {
      onMoveToComplexClassification(item);
    }
  };

  // Função para classificação rápida com descrição editada
  const handleQuickClassificationWithDescription = (item: Transaction | CardTransaction, subtipoId: string) => {
    const editedDescription = editingDescriptions[item.id];
    
    if (onApplyBatchClassification) {
      // Usar nova funcionalidade de descrições customizadas
      const customDescriptions = editedDescription?.trim() 
        ? { [item.id]: editedDescription.trim() }
        : undefined;
        
      onApplyBatchClassification({
        selectedIds: [item.id],
        conta: '',
        categoria: '',
        subtipo: subtipoId,
        customDescriptions
      });
    }
    
    // Fechar expansão e limpar descrição editada
    setExpandedItem(null);
    const newDescriptions = { ...editingDescriptions };
    delete newDescriptions[item.id];
    setEditingDescriptions(newDescriptions);
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
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      <span className={getOriginColor(item.origem)}>{item.origem}</span>
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
                  
                  {/* Conteúdo expandido individual com informações detalhadas */}
                  {expandedItem === item.id && (
                    <div className="mt-3 space-y-3 bg-gray-700 p-3 rounded border border-gray-600">
                      {/* Informações detalhadas */}
                      <div className="space-y-2 text-sm">
                        {/* Primeira linha: Descrição + Botões */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-200 break-words">{item.descricao_origem || 'Sem descrição'}</div>
                          </div>
                          
                          {/* Botões de Ação na mesma linha */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Botão de Classificação Complexa */}
                            {onMoveToComplexClassification && (
                              <button
                                onClick={() => handleMoveToComplexClassification(item as Transaction | CardTransaction)}
                                className="w-7 h-7 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition-colors flex items-center justify-center shadow-sm"
                                title="Mover para Classificação Complexa"
                              >
                                🧩
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
                              className="w-7 h-7 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs transition-colors flex items-center justify-center shadow-sm"
                              title="Editar/Classificar"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                        
                        {/* Segunda linha: Cartão se necessário */}
                        {!isTransaction && cardTransaction.cc && (
                          <div>
                            <span className="text-gray-400 text-xs">Cartão:</span>
                            <div className="text-gray-200">{cardTransaction.cc}</div>
                          </div>
                        )}
                        
                        {/* Campo de edição de descrição */}
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Nova Descrição:</label>
                          <input
                            type="text"
                            value={editingDescriptions[item.id] || ''}
                            onChange={(e) => setEditingDescriptions(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder={item.descricao_origem || 'Digite uma descrição...'}
                            className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Botões de Ação Rápida com Descrição Editada - Grid 2x3 */}
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-600">
                        {getQuickActionCategories(contas, categorias, subtipos).map(category => (
                          <button
                            key={category.id}
                            onClick={() => handleQuickClassificationWithDescription(item as Transaction | CardTransaction, category.id)}
                            className={`px-2 py-1 ${category.color} text-white rounded text-xs transition-colors hover:scale-105 flex items-center gap-1 justify-center`}
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