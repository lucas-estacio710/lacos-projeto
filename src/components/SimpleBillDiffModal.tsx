// components/SimpleBillDiffModal.tsx - VERSÃO REORGANIZADA COM 2 BLOCOS

import React, { useState, useEffect } from 'react';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Check, X } from 'lucide-react';

export interface BillChanges {
  toAdd: CardTransaction[];    // Novas transações para criar
  toKeep: string[];           // IDs das existentes para manter
  toRemove: string[];         // IDs das existentes para excluir
}

interface SimpleBillDiffModalProps {
  isOpen: boolean;
  faturaId: string;
  oldBill: CardTransaction[]; // Fatura que já existia (pode ser vazia)
  newBill: CardTransaction[]; // Fatura nova que você baixou
  onClose: () => void;
  onApply: (changes: BillChanges) => void;
  onCancel: () => void;
  onReplaceAll?: () => void;
}

interface DiffItem {
  type: 'existing' | 'new';
  transaction: CardTransaction;
  key: string;
  selected: boolean;
  matchedWith?: string; // ID da transação correspondente (se houver)
  similarity?: number;  // 0-1 score de similaridade
}

export function SimpleBillDiffModal({
  isOpen,
  faturaId,
  oldBill,
  newBill,
  onClose,
  onApply,
  onCancel,
  onReplaceAll
}: SimpleBillDiffModalProps) {
  const [leftItems, setLeftItems] = useState<DiffItem[]>([]);   // Coluna da esquerda (existentes)
  const [rightItems, setRightItems] = useState<DiffItem[]>([]); // Coluna da direita (novas)
  const [existingTab, setExistingTab] = useState<'matched' | 'unmatched'>('matched');
  const [newTab, setNewTab] = useState<'matched' | 'unmatched'>('unmatched');

  // ===== FUNÇÃO PARA CALCULAR SIMILARIDADE =====
  const calculateSimilarity = (t1: CardTransaction, t2: CardTransaction): number => {
    let score = 0;

    // Similaridade de data (peso: 0.3)
    if (t1.data_transacao === t2.data_transacao) {
      score += 0.3;
    }

    // Similaridade de valor (peso: 0.4)
    if (Math.abs(t1.valor - t2.valor) < 0.01) {
      score += 0.4;
    }

    // Similaridade de descrição (peso: 0.3)
    const desc1 = t1.descricao_origem.toLowerCase().trim();
    const desc2 = t2.descricao_origem.toLowerCase().trim();
    
    if (desc1 === desc2) {
      score += 0.3;
    } else if (desc1.includes(desc2) || desc2.includes(desc1)) {
      score += 0.15;
    }

    return score;
  };

  // ===== INICIALIZAÇÃO DOS DADOS =====
  useEffect(() => {
    if (!isOpen) return;

    console.log('📄 Processando diff da fatura:', faturaId);
    console.log('📋 Existentes:', oldBill.length);
    console.log('📦 Novas:', newBill.length);

    // ===== ETAPA 1: Criar items da esquerda (existentes) =====
    const newLeftItems: DiffItem[] = oldBill.map((transaction, index) => ({
      type: 'existing' as const,
      transaction,
      key: `left_${transaction.id}_${index}`,
      selected: true, // ✅ POR PADRÃO, marcar TODAS as transações da fatura existente
      matchedWith: undefined,
      similarity: 0
    }));

    // ===== ETAPA 2: Criar items da direita (novas) =====
    const newRightItems: DiffItem[] = newBill.map((transaction, index) => ({
      type: 'new' as const,
      transaction,
      key: `right_${transaction.id}_${index}`,
      selected: true, // Por padrão, adicionar todas as novas não matcheadas
      matchedWith: undefined,
      similarity: 0
    }));

    // ===== ETAPA 3: Detectar matches entre existentes e novas =====
    if (oldBill.length > 0 && newBill.length > 0) {
      console.log('🔍 Detectando matches...');
      
      const usedLeftItems = new Set<string>(); // Para evitar múltiplos matches
      
      newRightItems.forEach(rightItem => {
        let bestMatchItem: DiffItem | null = null;
        let bestMatchSimilarity = 0;
        
        newLeftItems.forEach(leftItem => {
          if (usedLeftItems.has(leftItem.key)) return; // Já foi matcheado
          
          const similarity = calculateSimilarity(leftItem.transaction, rightItem.transaction);
          
          if (similarity > 0.7 && similarity > bestMatchSimilarity) {
            bestMatchItem = leftItem;
            bestMatchSimilarity = similarity;
          }
        });
        
        if (bestMatchItem !== null && bestMatchSimilarity > 0) {
          // Marcar como matched
          rightItem.matchedWith = bestMatchItem.transaction.id;
          rightItem.similarity = bestMatchSimilarity;
          rightItem.selected = false; // ✅ MATCH PERFEITO = desmarcada por padrão na nova
          
          bestMatchItem.matchedWith = rightItem.transaction.id;
          bestMatchItem.similarity = bestMatchSimilarity;
          
          usedLeftItems.add(bestMatchItem.key); // Marcar como usado
          
          console.log(`🔗 Match encontrado: ${rightItem.transaction.descricao_origem.substring(0, 30)} (${Math.round(bestMatchSimilarity * 100)}%)`);
        }
      });
    }

    setLeftItems(newLeftItems);
    setRightItems(newRightItems);
  }, [isOpen, faturaId, oldBill, newBill]);

  // ===== FUNÇÃO DE ORDENAÇÃO POR DATA CRESCENTE =====
  const sortByDate = (items: DiffItem[]) => {
    return items.sort((a, b) => {
      const dateA = new Date(a.transaction.data_transacao).getTime();
      const dateB = new Date(b.transaction.data_transacao).getTime();
      return dateA - dateB; // Crescente
    });
  };

  // ===== FILTROS PARA AS ABAS =====
  const existingMatched = sortByDate(leftItems.filter(item => item.matchedWith));
  const existingUnmatched = sortByDate(leftItems.filter(item => !item.matchedWith));
  const newMatched = sortByDate(rightItems.filter(item => item.matchedWith));
  const newUnmatched = sortByDate(rightItems.filter(item => !item.matchedWith));

  // ===== FUNÇÃO PARA CALCULAR RESULTADO =====
  const calculateResult = () => {
    const toKeep = leftItems.filter(item => item.selected).map(item => item.transaction.id);
    const toRemove = leftItems.filter(item => !item.selected).map(item => item.transaction.id);
    const toAdd = rightItems.filter(item => item.selected).map(item => item.transaction);

    const willKeep = toKeep.length;
    const willAdd = toAdd.length;
    const willRemove = toRemove.length;
    const finalCount = willKeep + willAdd;

    // Calcular valor final
    const keptValue = leftItems
      .filter(item => item.selected)
      .reduce((sum, item) => sum + item.transaction.valor, 0);
    
    const addedValue = toAdd.reduce((sum, t) => sum + t.valor, 0);
    const finalValue = keptValue + addedValue;

    return {
      toKeep,
      toRemove,
      toAdd,
      summary: {
        willKeep,
        willAdd,
        willRemove,
        finalCount,
        finalValue: Math.abs(finalValue)
      }
    };
  };

  // ===== APLICAR MUDANÇAS =====
  const handleApply = () => {
    const result = calculateResult();
    onApply({
      toAdd: result.toAdd,
      toKeep: result.toKeep,
      toRemove: result.toRemove
    });
  };

  if (!isOpen) return null;

  const result = calculateResult();

  // ===== ESTATÍSTICAS RESUMIDAS =====
  const stats = {
    faturaExistente: {
      transacoes: oldBill.length,
      valor: oldBill.reduce((sum, t) => sum + t.valor, 0)
    },
    faturaNova: {
      transacoes: newBill.length,
      valor: newBill.reduce((sum, t) => sum + t.valor, 0)
    },
    matches: {
      transacoes: newMatched.length,
      valor: newMatched.reduce((sum, item) => sum + item.transaction.valor, 0)
    },
    novas: {
      transacoes: newUnmatched.length,
      valor: newUnmatched.reduce((sum, item) => sum + item.transaction.valor, 0)
    }
  };

  const renderTransactionCard = (item: DiffItem, onToggle: (key: string) => void) => (
    <div key={item.key} className={`border rounded p-2 md:p-3 ${
      item.type === 'existing' 
        ? (item.matchedWith ? 'bg-blue-900/20 border-blue-600' : 'bg-red-900/20 border-red-600')
        : (item.matchedWith ? 'bg-yellow-900/20 border-yellow-600' : 'bg-green-900/20 border-green-600')
    }`}>
      <label className="flex items-start cursor-pointer">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={() => onToggle(item.key)}
          className="mt-1 mr-2 md:mr-3 w-4 h-4 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-white font-medium text-sm md:text-base truncate">
            {item.transaction.descricao_origem}
          </div>
          <div className="text-gray-300 text-xs md:text-sm">
            {formatDate(item.transaction.data_transacao)} • R$ {formatCurrency(Math.abs(item.transaction.valor))}
            {(item.matchedWith && item.similarity && item.similarity > 0.01) ? (
              <span className="ml-2 text-gray-400">• Match: {Math.round(item.similarity * 100)}%</span>
            ) : null}
          </div>
        </div>
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full h-[95vh] md:h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg md:text-xl font-semibold text-gray-100 truncate pr-2">
              📄 {faturaId}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl md:text-2xl flex-shrink-0">
              ×
            </button>
          </div>

          {/* RESUMO ESTATÍSTICO EM UMA LINHA */}
          <div className="text-xs text-gray-300 flex items-center gap-4 flex-wrap">
            <span className="text-blue-300">📋 {stats.faturaExistente.transacoes} existentes</span>
            <span className="text-green-300">📦 {stats.faturaNova.transacoes} novas</span>
            <span className="text-yellow-300">🔗 {stats.matches.transacoes} matches</span>
            <span className="text-purple-300 font-medium">🎯 {result.summary.finalCount} final</span>
          </div>
        </div>

        {/* LAYOUT DE 2 BLOCOS */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          
          {/* BLOCO 1: FATURA EXISTENTE */}
          <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-700 min-h-0">
            <div className="p-3 md:p-4 border-b border-gray-700">
              <h4 className="text-base md:text-lg font-semibold text-blue-200 mb-3">
                📋 Fatura Existente ({oldBill.length}) | R$ {formatCurrency(Math.abs(stats.faturaExistente.valor))}
              </h4>
              
              {/* Abas do bloco existente */}
              <div className="flex">
                <button
                  onClick={() => setExistingTab('matched')}
                  className={`px-3 py-2 text-xs md:text-sm border-r border-gray-600 ${
                    existingTab === 'matched' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  🔗 Match ({existingMatched.length})
                </button>
                <button
                  onClick={() => setExistingTab('unmatched')}
                  className={`px-3 py-2 text-xs md:text-sm ${
                    existingTab === 'unmatched' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  ❌ Não Achou ({existingUnmatched.length})
                </button>
              </div>
            </div>
            
            {/* Conteúdo do bloco existente */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0">
              <div className="mb-3">
                <label className="flex items-center text-xs md:text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={existingTab === 'matched' 
                      ? existingMatched.every(item => item.selected)
                      : existingUnmatched.every(item => item.selected)
                    }
                    onChange={(e) => {
                      const allSelected = e.target.checked;
                      setLeftItems(prev => prev.map(item => {
                        const shouldUpdate = existingTab === 'matched' 
                          ? item.matchedWith 
                          : !item.matchedWith;
                        return shouldUpdate ? { ...item, selected: allSelected } : item;
                      }));
                    }}
                    className="mr-2 w-4 h-4"
                  />
                  Todas
                </label>
              </div>
              
              <div className="space-y-2">
                {(existingTab === 'matched' ? existingMatched : existingUnmatched).map(item =>
                  renderTransactionCard(item, (key) => {
                    setLeftItems(prev => prev.map(i => 
                      i.key === key ? { ...i, selected: !i.selected } : i
                    ));
                  })
                )}
              </div>
            </div>
          </div>

          {/* BLOCO 2: FATURA NOVA */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 md:p-4 border-b border-gray-700">
              <h4 className="text-base md:text-lg font-semibold text-green-200 mb-3">
                📦 Fatura Nova ({newBill.length}) | R$ {formatCurrency(Math.abs(stats.faturaNova.valor))}
              </h4>
              
              {/* Abas do bloco novo */}
              <div className="flex">
                <button
                  onClick={() => setNewTab('matched')}
                  className={`px-3 py-2 text-xs md:text-sm border-r border-gray-600 ${
                    newTab === 'matched' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  🔄 Match ({newMatched.length})
                </button>
                <button
                  onClick={() => setNewTab('unmatched')}
                  className={`px-3 py-2 text-xs md:text-sm ${
                    newTab === 'unmatched' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  ✨ Novas ({newUnmatched.length})
                </button>
              </div>
            </div>
            
            {/* Conteúdo do bloco novo */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0">
              <div className="mb-3">
                <label className="flex items-center text-xs md:text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={newTab === 'matched' 
                      ? newMatched.every(item => item.selected)
                      : newUnmatched.every(item => item.selected)
                    }
                    onChange={(e) => {
                      const allSelected = e.target.checked;
                      setRightItems(prev => prev.map(item => {
                        const shouldUpdate = newTab === 'matched' 
                          ? item.matchedWith 
                          : !item.matchedWith;
                        return shouldUpdate ? { ...item, selected: allSelected } : item;
                      }));
                    }}
                    className="mr-2 w-4 h-4"
                  />
                  Todas {newTab === 'matched' && '(⚠️ desmarcadas por padrão)'}
                </label>
              </div>
              
              <div className="space-y-2">
                {(newTab === 'matched' ? newMatched : newUnmatched).map(item =>
                  renderTransactionCard(item, (key) => {
                    setRightItems(prev => prev.map(i => 
                      i.key === key ? { ...i, selected: !i.selected } : i
                    ));
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER COMPACTO */}
        <div className="p-2 md:p-3 border-t border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs md:text-sm text-purple-300">
              {result.summary.finalCount} transações | R$ {formatCurrency(result.summary.finalValue)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs md:text-sm"
              >
                ❌ Cancelar
              </button>
              {onReplaceAll && (
                <button
                  onClick={onReplaceAll}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs md:text-sm"
                >
                  🔄 Substituir Tudo
                </button>
              )}
              <button
                onClick={handleApply}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded font-medium text-xs md:text-sm"
              >
                ✅ Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}