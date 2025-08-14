// components/SimpleBillDiffModal.tsx - REBUILD COMPLETO COM SELEÇÃO MANUAL

import React, { useState, useEffect } from 'react';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { formatCurrency, formatDate } from '@/lib/utils';

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
  onReplaceAll?: () => void; // ✅ NOVA PROP: Callback para substituir tudo
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
  onReplaceAll // ✅ NOVA PROP
}: SimpleBillDiffModalProps) {
  const [leftItems, setLeftItems] = useState<DiffItem[]>([]);   // Coluna da esquerda (existentes)
  const [rightItems, setRightItems] = useState<DiffItem[]>([]); // Coluna da direita (novas)
  const [selectAllLeft, setSelectAllLeft] = useState(false);
  const [selectAllRight, setSelectAllRight] = useState(true);   // Por padrão, selecionar todas as novas

  // ===== FUNÇÃO PARA CALCULAR SIMILARIDADE =====
  const calculateSimilarity = (t1: CardTransaction, t2: CardTransaction): number => {
    let score = 0;
    
    // Mesma data (peso 3)
    if (t1.data_transacao === t2.data_transacao) score += 3;
    
    // Mesmo valor absoluto (peso 4)
    if (Math.abs(Math.abs(t1.valor) - Math.abs(t2.valor)) < 0.01) score += 4;
    
    // Descrição similar (peso 3)
    const desc1 = t1.descricao_origem.toLowerCase();
    const desc2 = t2.descricao_origem.toLowerCase();
    if (desc1 === desc2) {
      score += 3;
    } else if (desc1.includes(desc2.substring(0, 10)) || desc2.includes(desc1.substring(0, 10))) {
      score += 2;
    }
    
    return score / 10; // Normalizar para 0-1
  };

  // ===== PROCESSAR DADOS QUANDO MODAL ABRE =====
  useEffect(() => {
    if (!isOpen) return;

    console.log('🔄 Processando diff da fatura:', faturaId);
    console.log('📋 Existentes:', oldBill.length);
    console.log('📦 Novas:', newBill.length);

    // ===== ETAPA 1: Criar items da esquerda (existentes) =====
    const newLeftItems: DiffItem[] = oldBill.map((transaction, index) => ({
      type: 'existing' as const,
      transaction,
      key: `left_${transaction.id}_${index}`,
      selected: false, // Por padrão, não manter existentes
      matchedWith: undefined,
      similarity: 0
    }));

    // ===== ETAPA 2: Criar items da direita (novas) =====
    const newRightItems: DiffItem[] = newBill.map((transaction, index) => ({
      type: 'new' as const,
      transaction,
      key: `right_${transaction.id}_${index}`,
      selected: true, // Por padrão, adicionar todas as novas
      matchedWith: undefined,
      similarity: 0
    }));

    // ===== ETAPA 3: Detectar matches entre existentes e novas =====
    if (oldBill.length > 0 && newBill.length > 0) {
      console.log('🔍 Detectando matches...');
      
      newRightItems.forEach(rightItem => {
        let bestMatchItem: DiffItem | null = null;
        let bestMatchSimilarity = 0;
        
        newLeftItems.forEach(leftItem => {
          const similarity = calculateSimilarity(leftItem.transaction, rightItem.transaction);
          
          if (similarity > 0.7 && similarity > bestMatchSimilarity) {
            bestMatchItem = leftItem;
            bestMatchSimilarity = similarity;
          }
        });
        
        if (bestMatchItem !== null && bestMatchSimilarity > 0) {
          // Marcar como matched
          rightItem.matchedWith = (bestMatchItem as DiffItem).transaction.id;
          rightItem.similarity = bestMatchSimilarity;
          (bestMatchItem as DiffItem).matchedWith = rightItem.transaction.id;
          (bestMatchItem as DiffItem).similarity = bestMatchSimilarity;
          
          console.log(`🔗 Match encontrado: ${rightItem.transaction.descricao_origem.substring(0, 20)} (${Math.round(bestMatchSimilarity * 100)}%)`);
        }
      });
    }

    setLeftItems(newLeftItems);
    setRightItems(newRightItems);
    setSelectAllLeft(false);
    setSelectAllRight(true);

    console.log('✅ Processamento concluído');
  }, [isOpen, oldBill, newBill, faturaId]);

  // ===== FUNÇÃO PARA TOGGLE DE SELEÇÃO INDIVIDUAL =====
  const toggleSelection = (side: 'left' | 'right', key: string) => {
    if (side === 'left') {
      setLeftItems(prev => prev.map(item => 
        item.key === key ? { ...item, selected: !item.selected } : item
      ));
    } else {
      setRightItems(prev => prev.map(item => 
        item.key === key ? { ...item, selected: !item.selected } : item
      ));
    }
  };

  // ===== FUNÇÃO PARA SELECIONAR/DESSELECIONAR TODOS =====
  const toggleSelectAll = (side: 'left' | 'right') => {
    if (side === 'left') {
      const newSelected = !selectAllLeft;
      setSelectAllLeft(newSelected);
      setLeftItems(prev => prev.map(item => ({ ...item, selected: newSelected })));
    } else {
      const newSelected = !selectAllRight;
      setSelectAllRight(newSelected);
      setRightItems(prev => prev.map(item => ({ ...item, selected: newSelected })));
    }
  };

  // ===== CALCULAR RESULTADO FINAL =====
  const calculateResult = (): BillChanges & { summary: any } => {
    // Type assertions to help TypeScript understand the types
    const selectedLeft: DiffItem[] = leftItems.filter((item: DiffItem) => item.selected);
    const selectedRight: DiffItem[] = rightItems.filter((item: DiffItem) => item.selected);
    
    const toKeep: string[] = selectedLeft.map((item: DiffItem) => item.transaction.id);
    const toAdd: CardTransaction[] = selectedRight.map((item: DiffItem) => item.transaction);
    const toRemove: string[] = leftItems.filter((item: DiffItem) => !item.selected).map((item: DiffItem) => item.transaction.id);
    
    const finalCount = toKeep.length + toAdd.length;
    const finalValue = [
      ...selectedLeft.map((item: DiffItem) => item.transaction),
      ...toAdd
    ].reduce((sum, t) => sum + t.valor, 0);
    
    return {
      toAdd,
      toKeep,
      toRemove,
      summary: {
        finalCount,
        finalValue,
        willKeep: toKeep.length,
        willAdd: toAdd.length,
        willRemove: toRemove.length
      }
    };
  };

  // ===== HANDLER PARA SUBSTITUIR TUDO =====
  const handleReplaceAll = () => {
    const confirmReplace = window.confirm(
      `🔄 Substituir toda a fatura?\n\n` +
      `Isso irá:\n` +
      `• Remover TODAS as ${oldBill.length} transações existentes\n` +
      `• Adicionar TODAS as ${newBill.length} transações novas\n` +
      `• Resultado: ${newBill.length} transações na base\n\n` +
      `Esta ação não pode ser desfeita. Continuar?`
    );

    if (confirmReplace && onReplaceAll) {
      console.log('🔄 Usuário confirmou substituição completa');
      onReplaceAll();
      onClose();
    }
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

  // ===== FUNÇÃO PARA RENDERIZAR TRANSAÇÃO =====
  const renderTransaction = (item: DiffItem, side: 'left' | 'right') => {
    const transaction = item.transaction;
    const isMatched = item.matchedWith !== undefined;
    const similarity = item.similarity || 0;
    
    // Determinar cor da borda baseado no tipo e match
    let borderColor = 'border-gray-600';
    let bgColor = 'bg-gray-800';
    
    if (side === 'left') {
      if (isMatched) {
        if (similarity >= 0.9) {
          borderColor = 'border-green-500';
          bgColor = 'bg-green-900/20';
        } else {
          borderColor = 'border-yellow-500'; 
          bgColor = 'bg-yellow-900/20';
        }
      } else {
        borderColor = 'border-red-500';
        bgColor = 'bg-red-900/20';
      }
    } else {
      if (isMatched) {
        if (similarity >= 0.9) {
          borderColor = 'border-green-500';
          bgColor = 'bg-green-900/20';
        } else {
          borderColor = 'border-yellow-500';
          bgColor = 'bg-yellow-900/20';
        }
      } else {
        borderColor = 'border-blue-500';
        bgColor = 'bg-blue-900/20';
      }
    }
    
    return (
      <div 
        key={item.key}
        className={`border rounded-lg p-3 transition-all ${
          item.selected ? borderColor + ' ' + bgColor : 'border-gray-600 bg-gray-800'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="mt-1">
            <input
              type="checkbox"
              checked={item.selected}
              onChange={() => toggleSelection(side, item.key)}
              className="w-4 h-4 rounded border-gray-500 bg-gray-700"
            />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            {/* Header com badges */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* Badge do tipo */}
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  side === 'left' 
                    ? 'bg-purple-600 text-purple-100' 
                    : 'bg-blue-600 text-blue-100'
                }`}>
                  {side === 'left' ? '📋 Existente' : '📦 Nova'}
                </span>
                
                {/* Badge de match */}
                {isMatched && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    similarity >= 0.9 
                      ? 'bg-green-600 text-green-100' 
                      : 'bg-yellow-600 text-yellow-100'
                  }`}>
                    {similarity >= 0.9 ? '✅ Match Perfeito' : '⚠️ Similar'} ({Math.round(similarity * 100)}%)
                  </span>
                )}
                
                {/* Badge de não encontrado */}
                {side === 'left' && !isMatched && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-red-100">
                    🗑️ Não Encontrado
                  </span>
                )}
                
                {side === 'right' && !isMatched && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-blue-100">
                    🆕 Completamente Nova
                  </span>
                )}
                
                {/* Badge de status */}
                {transaction.status === 'classified' && (
                  <span className="px-2 py-1 rounded text-xs bg-green-700 text-green-200">
                    🏷️ Classificada
                  </span>
                )}
              </div>
              
              <div className="text-right">
                <span className={`font-medium text-sm ${
                  transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                </span>
              </div>
            </div>

            {/* Descrição */}
            <p className="text-sm text-gray-100 font-medium mb-1">
              {transaction.descricao_origem}
            </p>

            {/* Detalhes */}
            <div className="text-xs text-gray-400">
              {formatDate(transaction.data_transacao)} • {transaction.origem}
              {transaction.categoria && (
                <span className="text-blue-400 ml-2">
                  • {transaction.categoria} → {transaction.subtipo}
                </span>
              )}
            </div>

            {/* Efeito da seleção */}
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                {item.selected ? (
                  side === 'left' 
                    ? '✅ Será mantida na base de dados'
                    : '✅ Será adicionada à base de dados'
                ) : (
                  side === 'left'
                    ? '🗑️ Será removida da base de dados' 
                    : '❌ Não será importada'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const result = calculateResult();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-100">
              🔄 Revisão da Fatura: {faturaId}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-2xl">
              ×
            </button>
          </div>

          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
            <p className="text-blue-100 text-sm">
              📝 <strong>Instruções:</strong> Selecione exatamente quais transações deseja manter/adicionar na base de dados. 
              Transações similares são automaticamente detectadas e destacadas.
            </p>
          </div>
        </div>

        {/* Conteúdo principal - Duas colunas */}
        <div className="flex-1 overflow-hidden flex">
          
          {/* ===== COLUNA DA ESQUERDA: EXISTENTES ===== */}
          <div className="w-1/2 border-r border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700 bg-gray-850">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-100 flex items-center gap-2">
                  <span>📋</span>
                  Transações Existentes ({leftItems.length})
                </h4>
                {leftItems.length > 0 && (
                  <button
                    onClick={() => toggleSelectAll('left')}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
                  >
                    {selectAllLeft ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {leftItems.filter(i => i.selected).length} selecionadas para manter
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {leftItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">📋 Nenhuma transação existente</p>
                  <p className="text-gray-500 text-sm mt-2">Esta é uma fatura nova</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leftItems.map(item => renderTransaction(item, 'left'))}
                </div>
              )}
            </div>
          </div>

          {/* ===== COLUNA DA DIREITA: NOVAS ===== */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b border-gray-700 bg-gray-850">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-100 flex items-center gap-2">
                  <span>📦</span>
                  Transações Novas ({rightItems.length})
                </h4>
                {rightItems.length > 0 && (
                  <button
                    onClick={() => toggleSelectAll('right')}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
                  >
                    {selectAllRight ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {rightItems.filter(i => i.selected).length} selecionadas para adicionar
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {rightItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">📦 Nenhuma transação nova</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rightItems.map(item => renderTransaction(item, 'right'))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer com resultado */}
        <div className="p-4 border-t border-gray-700 bg-gray-850">
          {/* Resumo do resultado */}
          <div className="bg-gray-700 rounded-lg p-3 mb-4">
            <h5 className="font-medium text-gray-100 mb-3">📊 Resultado da Seleção:</h5>
            
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <p className="text-green-400 font-medium text-lg">{result.summary.willKeep}</p>
                <p className="text-gray-300 text-xs">Manter Existentes</p>
              </div>
              <div className="text-center">
                <p className="text-blue-400 font-medium text-lg">{result.summary.willAdd}</p>
                <p className="text-gray-300 text-xs">Adicionar Novas</p>
              </div>
              <div className="text-center">
                <p className="text-red-400 font-medium text-lg">{result.summary.willRemove}</p>
                <p className="text-gray-300 text-xs">Remover Existentes</p>
              </div>
              <div className="text-center">
                <p className="text-yellow-400 font-medium text-lg">{result.summary.finalCount}</p>
                <p className="text-gray-300 text-xs">Total Final</p>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-300 text-sm">Valor total da fatura resultante:</p>
                  <p className="font-bold text-lg text-blue-400">
                    R$ {formatCurrency(Math.abs(result.summary.finalValue))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              ❌ Cancelar Importação
            </button>
            
            {/* ✅ NOVO BOTÃO: Substituir Tudo */}
            <button
              onClick={handleReplaceAll}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              title="Substitui toda a fatura existente pela nova"
            >
              🔄 Substituir Tudo
            </button>
            
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors font-medium"
            >
              ✅ Salvar Seleção ({result.summary.finalCount} transações | R$ {formatCurrency(Math.abs(result.summary.finalValue))})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}