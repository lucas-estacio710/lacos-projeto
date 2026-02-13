import React, { useState } from 'react';
import { CheckSquare } from 'lucide-react';
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
  // Props para MassiveChangeSubtipo
  massiveChangeMode?: boolean;
  selectedItems?: Set<string>;
  onToggleItemSelection?: (itemId: string) => void;
  individualDescriptions?: Record<string, string>;
  onUpdateIndividualDescription?: (itemId: string, description: string) => void;
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
  onApplyBatchClassification,
  massiveChangeMode = false,
  selectedItems = new Set(),
  onToggleItemSelection,
  individualDescriptions = {},
  onUpdateIndividualDescription
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
    if (colors[origemUpper as keyof typeof colors]) {
      return colors[origemUpper as keyof typeof colors];
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
                <div key={`${item.id}-${idx}`} className="py-2 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center gap-2">
                    {/* Checkbox à esquerda do box */}
                    <div className="flex-shrink-0 flex items-center justify-center pl-1">
                      {onToggleItemSelection && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleItemSelection(item.id);
                          }}
                          className={`w-8 h-8 rounded transition-colors flex items-center justify-center shadow-sm ${
                            selectedItems.has(item.id)
                              ? 'bg-blue-600 hover:bg-blue-500 text-white'
                              : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                          }`}
                          title={selectedItems.has(item.id) ? "Desmarcar item" : "Marcar item"}
                        >
                          <CheckSquare size={16} />
                        </button>
                      )}
                    </div>

                    {/* Conteúdo principal */}
                    <div className="flex-1 grid grid-cols-12 text-sm gap-y-1">
                      {/* Linha 1: Data | Descrição | Origem | Valor | Setinha */}
                      {/* Data - 2 colunas */}
                      <div className="col-span-2 row-span-2 flex flex-col justify-center items-center text-center">
                        <div className="text-xs text-gray-400">
                          {formatDate(isTransaction ? transaction.data : cardTransaction.data_transacao)}
                        </div>
                        <div className="text-xs font-bold text-gray-300 mt-0.5">
                          {(() => {
                            const date = new Date(isTransaction ? transaction.data : cardTransaction.data_transacao);
                            const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                            return diasSemana[date.getDay()];
                          })()}
                        </div>
                      </div>

                      {/* Descrição - 5 colunas */}
                      <div className="col-span-5 row-span-2 flex items-center">
                        <div className="text-gray-200 leading-tight line-clamp-2" title={item.descricao_origem || 'Sem descrição'}>
                          {item.descricao_origem || 'Sem descrição'}
                        </div>
                      </div>

                      {/* Origem - 1 coluna */}
                      <div className="col-span-1 row-span-2 flex items-center justify-end">
                        <span className={`text-xs ${getOriginColor(item.origem)}`} title={item.origem}>
                          {item.origem.length > 5 ? item.origem.substring(0, 5) + '...' : item.origem}
                        </span>
                      </div>

                      {/* Valor - 3 colunas */}
                      <div className="col-span-3 flex items-center justify-end">
                        <span className={`font-medium text-sm ${item.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(item.valor || 0))}
                        </span>
                      </div>

                      {/* Setinha expandir - 1 coluna */}
                      <div className="col-span-1 flex items-center justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedItem(expandedItem === item.id ? null : item.id);
                          }}
                          className="w-8 h-8 text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center"
                          title="Expandir item"
                        >
                          {expandedItem === item.id ? '▼' : '▶'}
                        </button>
                      </div>

                      {/* Linha 2: Botões de ação */}
                      {/* Classificação Complexa */}
                      <div className="col-span-2 flex items-center justify-center">
                        {onMoveToComplexClassification && (
                          <button
                            onClick={() => handleMoveToComplexClassification(item as Transaction | CardTransaction)}
                            className="w-8 h-8 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors flex items-center justify-center shadow-sm"
                            title="Mover para Classificação Complexa"
                          >
                            🧩
                          </button>
                        )}
                      </div>

                      {/* Edição - empurrado para a direita */}
                      <div className="col-span-1 col-start-12 flex items-center justify-center">
                        <button
                          onClick={() => {
                            if (isTransaction && onEditTransaction) {
                              onEditTransaction(transaction);
                            } else if (!isTransaction && onEditCardTransaction) {
                              onEditCardTransaction(cardTransaction);
                            }
                          }}
                          className="w-8 h-8 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors flex items-center justify-center shadow-sm"
                          title="Editar/Classificar"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Conteúdo expandido individual com informações detalhadas */}
                  {expandedItem === item.id && (
                    <div className="mt-3 space-y-3 bg-gray-700 rounded border border-gray-600">
                      {/* Informações detalhadas */}
                      <div className="space-y-2 text-sm p-3">
                        {/* Descrição completa */}
                        <div>
                          <span className="text-gray-400 text-xs block mb-1">Descrição Completa:</span>
                          <div className="text-gray-200 break-words">{item.descricao_origem || 'Sem descrição'}</div>
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

                        {/* Descrição Individual para MassiveChangeSubtipo */}
                        {selectedItems.has(item.id) && onUpdateIndividualDescription && (
                          <div>
                            <label className="text-pink-400 text-xs block mb-1">Descrição Individual:</label>
                            <input
                              type="text"
                              value={individualDescriptions[item.id] || ''}
                              onChange={(e) => onUpdateIndividualDescription(item.id, e.target.value)}
                              placeholder={item.descricao_origem || 'Digite uma descrição individual...'}
                              className="w-full px-2 py-1 bg-pink-50 border border-pink-300 rounded text-pink-900 text-sm placeholder-pink-400 focus:border-pink-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação Rápida com Descrição Editada - Grid 2x3 */}
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-600">
                        {getQuickActionCategories(contas, categorias, subtipos).map(category => (
                          <button
                            key={category.id}
                            onClick={() => handleQuickClassificationWithDescription(item as Transaction | CardTransaction, category.id)}
                            className={`px-2 py-2 ${category.color} text-white rounded text-xs transition-colors hover:scale-105 flex items-center gap-1 justify-center`}
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