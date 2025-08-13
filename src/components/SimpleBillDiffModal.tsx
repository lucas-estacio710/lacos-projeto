// components/SimpleBillDiffModal.tsx - COMPARAÇÃO DIRETA E SIMPLES

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
  oldBill: CardTransaction[]; // Fatura que já existia
  newBill: CardTransaction[]; // Fatura nova que você baixou
  onClose: () => void;
  onApply: (changes: BillChanges) => void;
  onCancel: () => void;
}

interface DiffItem {
  type: 'same' | 'new' | 'removed' | 'changed';
  oldTransaction?: CardTransaction;
  newTransaction?: CardTransaction;
  key: string;
  changes?: string[]; // Lista das mudanças detectadas
}

export function SimpleBillDiffModal({
  isOpen,
  faturaId,
  oldBill,
  newBill,
  onClose,
  onApply,
  onCancel
}: SimpleBillDiffModalProps) {
  const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
  const [changes, setChanges] = useState<BillChanges>({
    toAdd: [],
    toKeep: [],
    toRemove: []
  });

  // Função para criar uma "assinatura" da transação
  const createSignature = (tx: CardTransaction): string => {
    // Assinatura SEM valor para detectar mudanças de preço
    const desc = tx.descricao_origem.toLowerCase().replace(/[^a-z0-9]/g, '');
    const data = tx.data_transacao.replace(/-/g, '');
    return `${desc}_${data}`;
  };

  // Função para detectar se duas transações são "similares" mas com diferenças
  const areTransactionsSimilar = (tx1: CardTransaction, tx2: CardTransaction): boolean => {
    const sig1 = createSignature(tx1);
    const sig2 = createSignature(tx2);
    return sig1 === sig2; // Mesma data e descrição
  };

  // Função para detectar diferenças específicas
  const detectChanges = (oldTx: CardTransaction, newTx: CardTransaction): string[] => {
    const changes: string[] = [];
    
    if (Math.abs(oldTx.valor - newTx.valor) > 0.01) {
      changes.push(`Valor: R$ ${formatCurrency(Math.abs(oldTx.valor))} → R$ ${formatCurrency(Math.abs(newTx.valor))}`);
    }
    
    if (oldTx.data_transacao !== newTx.data_transacao) {
      changes.push(`Data: ${formatDate(oldTx.data_transacao)} → ${formatDate(newTx.data_transacao)}`);
    }
    
    if (oldTx.descricao_origem !== newTx.descricao_origem) {
      changes.push(`Descrição: "${oldTx.descricao_origem}" → "${newTx.descricao_origem}"`);
    }
    
    return changes;
  };

  // Comparar faturas de forma super simples
  useEffect(() => {
    if (!isOpen) return;

    console.log('🔍 Comparando faturas...');
    console.log('📋 Fatura antiga:', oldBill.length, 'transações');
    console.log('📦 Fatura nova:', newBill.length, 'transações');

    // Criar mapas por assinatura (SEM valor para detectar mudanças de preço)
    const oldMap = new Map<string, CardTransaction[]>();
    const newMap = new Map<string, CardTransaction[]>();

    // Agrupar transações antigas por assinatura
    oldBill.forEach(tx => {
      const sig = createSignature(tx);
      if (!oldMap.has(sig)) oldMap.set(sig, []);
      oldMap.get(sig)!.push(tx);
    });

    // Agrupar transações novas por assinatura
    newBill.forEach(tx => {
      const sig = createSignature(tx);
      if (!newMap.has(sig)) newMap.set(sig, []);
      newMap.get(sig)!.push(tx);
    });

    const items: DiffItem[] = [];
    const allSignatures = new Set([...oldMap.keys(), ...newMap.keys()]);

    allSignatures.forEach(signature => {
      const oldTxs = oldMap.get(signature) || [];
      const newTxs = newMap.get(signature) || [];

      console.log(`🔍 Assinatura "${signature}": ${oldTxs.length} antigas vs ${newTxs.length} novas`);

      if (oldTxs.length === 0 && newTxs.length > 0) {
        // NOVAS: Só existem na nova fatura
        newTxs.forEach((tx, index) => {
          items.push({
            type: 'new',
            newTransaction: tx,
            key: `new_${signature}_${index}`
          });
        });
        console.log(`  ➕ ${newTxs.length} transações novas`);
      }
      else if (oldTxs.length > 0 && newTxs.length === 0) {
        // REMOVIDAS: Só existiam na antiga
        oldTxs.forEach((tx, index) => {
          items.push({
            type: 'removed',
            oldTransaction: tx,
            key: `removed_${signature}_${index}`
          });
        });
        console.log(`  🗑️ ${oldTxs.length} transações removidas`);
      }
      else {
        // COMPARAÇÃO DETALHADA: Detectar mudanças sutis
        const maxCount = Math.max(oldTxs.length, newTxs.length);
        const minCount = Math.min(oldTxs.length, newTxs.length);

        // Comparar transações par a par
        for (let i = 0; i < minCount; i++) {
          const oldTx = oldTxs[i];
          const newTx = newTxs[i];
          
          // Detectar mudanças
          const changes = detectChanges(oldTx, newTx);
          
          if (changes.length === 0) {
            // Completamente igual
            items.push({
              type: 'same',
              oldTransaction: oldTx,
              newTransaction: newTx,
              key: `same_${signature}_${i}`
            });
          } else {
            // Tem mudanças! 🎯
            items.push({
              type: 'changed',
              oldTransaction: oldTx,
              newTransaction: newTx,
              key: `changed_${signature}_${i}`,
              changes: changes
            });
            console.log(`  🔄 Mudança detectada: ${changes.join(', ')}`);
          }
        }

        // Transações extras na nova fatura
        if (newTxs.length > oldTxs.length) {
          for (let i = minCount; i < newTxs.length; i++) {
            items.push({
              type: 'new',
              newTransaction: newTxs[i],
              key: `new_extra_${signature}_${i}`
            });
          }
          console.log(`  ➕ ${newTxs.length - oldTxs.length} transações extras adicionadas`);
        }

        // Transações extras na antiga fatura
        if (oldTxs.length > newTxs.length) {
          for (let i = minCount; i < oldTxs.length; i++) {
            items.push({
              type: 'removed',
              oldTransaction: oldTxs[i],
              key: `removed_extra_${signature}_${i}`
            });
          }
          console.log(`  🗑️ ${oldTxs.length - newTxs.length} transações extras removidas`);
        }
      }
    });

    // Ordenar por tipo (mudanças primeiro para destacar, depois iguais, novas, removidas)
    items.sort((a, b) => {
      if (a.type === b.type) return 0;
      if (a.type === 'changed') return -1;
      if (b.type === 'changed') return 1;
      if (a.type === 'same') return -1;
      if (b.type === 'same') return 1;
      if (a.type === 'new') return -1;
      if (b.type === 'new') return 1;
      return 0;
    });

    setDiffItems(items);

    // Configurar mudanças padrão
    const defaultChanges: BillChanges = {
      toAdd: [
        ...items.filter(item => item.type === 'new').map(item => item.newTransaction!),
        ...items.filter(item => item.type === 'changed').map(item => item.newTransaction!) // Mudanças = nova versão
      ],
      toKeep: items
        .filter(item => item.type === 'same')
        .map(item => item.oldTransaction!.id),
      toRemove: [
        ...items.filter(item => item.type === 'removed').map(item => item.oldTransaction!.id),
        ...items.filter(item => item.type === 'changed').map(item => item.oldTransaction!.id) // Remove versão antiga
      ]
    };

    setChanges(defaultChanges);

    console.log('✅ Comparação concluída:');
    console.log(`  ✅ ${items.filter(i => i.type === 'same').length} transações iguais`);
    console.log(`  🔄 ${items.filter(i => i.type === 'changed').length} transações modificadas`);
    console.log(`  ➕ ${items.filter(i => i.type === 'new').length} transações novas`);
    console.log(`  🗑️ ${items.filter(i => i.type === 'removed').length} transações removidas`);

  }, [isOpen, oldBill, newBill]);

  // Aplicar mudanças
  const handleApply = () => {
    onApply(changes);
    onClose();
  };

  // Calcular resultado final
  const finalCount = changes.toKeep.length + changes.toAdd.length;
  const finalValue = [
    ...changes.toAdd,
    ...oldBill.filter(tx => changes.toKeep.includes(tx.id))
  ].reduce((sum, tx) => sum + Math.abs(tx.valor), 0);

  const originalNewValue = newBill.reduce((sum, tx) => sum + Math.abs(tx.valor), 0);
  const isCorrect = Math.abs(finalValue - originalNewValue) < 0.01;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold text-gray-100">
              📊 Comparação de Faturas: {faturaId}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-2xl">
              ×
            </button>
          </div>

          <div className="bg-blue-900 border border-blue-700 rounded-lg p-3">
            <p className="text-blue-100 text-sm">
              🔍 <strong>Comparando:</strong> Fatura antiga ({oldBill.length} transações) vs Nova fatura ({newBill.length} transações)
            </p>
            <p className="text-blue-200 text-xs mt-1">
              Aceite as mudanças sugeridas ou ajuste manualmente
            </p>
          </div>
        </div>

        {/* Lista de diferenças */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {diffItems.map((item) => (
              <div 
                key={item.key}
                className={`border rounded-lg p-3 ${
                  item.type === 'same' ? 'border-green-600 bg-green-900/20' :
                  item.type === 'changed' ? 'border-yellow-600 bg-yellow-900/20' :
                  item.type === 'new' ? 'border-blue-600 bg-blue-900/20' :
                  'border-red-600 bg-red-900/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Status */}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.type === 'same' ? 'bg-green-600 text-green-100' :
                      item.type === 'changed' ? 'bg-yellow-600 text-yellow-100' :
                      item.type === 'new' ? 'bg-blue-600 text-blue-100' :
                      'bg-red-600 text-red-100'
                    }`}>
                      {item.type === 'same' ? '✅ Igual' :
                       item.type === 'changed' ? '🔄 Modificada' :
                       item.type === 'new' ? '➕ Nova' :
                       '🗑️ Removida'}
                    </span>

                    {/* Descrição */}
                    <div>
                      <p className="text-sm text-gray-100 font-medium">
                        {(item.newTransaction || item.oldTransaction)!.descricao_origem}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate((item.newTransaction || item.oldTransaction)!.data_transacao)} • 
                        {(item.newTransaction || item.oldTransaction)!.origem}
                      </p>
                    </div>
                  </div>

                  {/* Valor */}
                  <div className="text-right">
                    <span className="font-medium text-sm text-red-400">
                      R$ {formatCurrency(Math.abs((item.newTransaction || item.oldTransaction)!.valor))}
                    </span>
                  </div>
                </div>

                {/* Ação planejada */}
                <div className="mt-2 text-xs">
                  {item.type === 'same' && (
                    <p className="text-green-300">✅ Será mantida na fatura</p>
                  )}
                  {item.type === 'changed' && (
                    <div>
                      <p className="text-yellow-300">🔄 Será atualizada com a nova versão</p>
                      <div className="mt-1 bg-yellow-900/30 rounded p-2">
                        <p className="text-yellow-200 font-medium text-xs mb-1">Mudanças detectadas:</p>
                        {item.changes?.map((change, idx) => (
                          <p key={idx} className="text-yellow-100 text-xs">• {change}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.type === 'new' && (
                    <p className="text-blue-300">➕ Será adicionada à fatura</p>
                  )}
                  {item.type === 'removed' && (
                    <p className="text-red-300">🗑️ Será removida da fatura</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer com resultado */}
        <div className="p-4 border-t border-gray-700 bg-gray-850">
          {/* Resumo do resultado */}
          <div className="bg-gray-700 rounded-lg p-3 mb-4">
            <h5 className="font-medium text-gray-100 mb-3">📊 Resultado Final:</h5>
            
            <div className="grid grid-cols-4 gap-4 text-sm mb-3">
              <div className="text-center">
                <p className="text-green-400 font-medium text-lg">{changes.toKeep.length}</p>
                <p className="text-gray-300 text-xs">Manter</p>
              </div>
              <div className="text-center">
                <p className="text-blue-400 font-medium text-lg">{changes.toAdd.length}</p>
                <p className="text-gray-300 text-xs">Adicionar</p>
              </div>
              <div className="text-center">
                <p className="text-red-400 font-medium text-lg">{changes.toRemove.length}</p>
                <p className="text-gray-300 text-xs">Remover</p>
              </div>
              <div className="text-center">
                <p className="text-yellow-400 font-medium text-lg">{finalCount}</p>
                <p className="text-gray-300 text-xs">Total Final</p>
              </div>
            </div>

            {/* Validação de valor */}
            <div className="border-t border-gray-600 pt-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-300 text-sm">Valor da fatura resultante:</p>
                  <p className={`font-bold text-lg ${isCorrect ? 'text-green-400' : 'text-yellow-400'}`}>
                    R$ {formatCurrency(finalValue)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Valor esperado:</p>
                  <p className="font-bold text-lg text-blue-400">
                    R$ {formatCurrency(originalNewValue)}
                  </p>
                  <div className="mt-1">
                    {isCorrect ? (
                      <span className="text-green-400 text-xs">✅ Valores conferem!</span>
                    ) : (
                      <span className="text-yellow-400 text-xs">⚠️ Diferença detectada</span>
                    )}
                  </div>
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
            <button
              onClick={() => { onClose(); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              🔄 Substituir Tudo
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors font-medium"
            >
              ✅ Aplicar Mudanças {isCorrect ? '(Valores conferem!)' : '⚠️'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}