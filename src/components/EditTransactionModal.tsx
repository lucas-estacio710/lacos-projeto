// components/EditTransactionModal.tsx - VERSÃO ATUALIZADA COM RECONCILIAÇÃO

import React, { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void; // Função para divisão
  onReconcile?: (transaction: Transaction) => void; // ===== NOVA PROP PARA RECONCILIAÇÃO =====
  availableGroupsCount?: number; // Contador de grupos disponíveis
}

export function EditTransactionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onSave, 
  onSplit, 
  onReconcile,
  availableGroupsCount = 0
}: EditTransactionModalProps) {
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  useEffect(() => {
    if (transaction) {
      const conta = transaction.conta || 'PF';
      const categoria = transaction.categoria || '';
      
      setEditForm({
        id: transaction.id,
        mes: transaction.mes,
        data: transaction.data,
        descricao_origem: transaction.descricao_origem,
        conta: conta,
        categoria: categoria,
        subtipo: transaction.subtipo || '',
        descricao: transaction.descricao || transaction.descricao_origem || '',
        valor: transaction.valor,
        origem: transaction.origem,
        cc: transaction.cc,
        realizado: transaction.realizado,
        // Campos de reconciliação
        linked_future_group: transaction.linked_future_group,
        is_from_reconciliation: transaction.is_from_reconciliation
      });
    }
  }, [transaction]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getCategoriesForAccount = (account: string) => {
    switch(account) {
      case 'PJ': return categoriesPJ;
      case 'PF': return categoriesPF;
      case 'CONC.': return categoriesCONC;
      default: return {};
    }
  };

  const handleSave = () => {
    if (transaction && editForm.conta && editForm.categoria && editForm.subtipo && editForm.descricao) {
      const updatedTransaction: Transaction = {
        ...transaction,
        conta: editForm.conta,
        categoria: editForm.categoria,
        subtipo: editForm.subtipo,
        descricao: editForm.descricao,
        realizado: 's'
      };
      onSave(updatedTransaction);
      onClose();
    }
  };

  const handleReconcile = () => {
    if (transaction && onReconcile) {
      onReconcile(transaction);
      onClose();
    }
  };

  if (!isOpen || !transaction) return null;

  // Verificar se pode ser reconciliado
  const canReconcile = onReconcile && 
                      availableGroupsCount > 0 && 
                      !transaction.is_from_reconciliation &&
                      transaction.realizado === 'p'; // Apenas transações não classificadas

  // Verificar se pode ser dividido
  const canSplit = onSplit && 
                  (!editForm.categoria || !editForm.subtipo) &&
                  !transaction.is_from_reconciliation;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4">Editar Transação</h3>
          
          {/* Informações da transação */}
          <div className="space-y-3 mb-6">
            <div>
              <label className="text-sm text-gray-400">Data</label>
              <p className="text-gray-200">{editForm.data || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Descrição Origem</label>
              <p className="text-gray-200 break-words">{editForm.descricao_origem || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Valor</label>
                <p className={`font-bold ${(editForm.valor || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(editForm.valor || 0) >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(editForm.valor || 0))}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Origem</label>
                <p className="text-gray-200">{editForm.origem || 'N/A'}</p>
              </div>
            </div>

            {/* Indicador de reconciliação */}
            {transaction.is_from_reconciliation && (
              <div className="bg-blue-900 border border-blue-700 rounded p-3">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🔗</span>
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Transação Reconciliada</p>
                    <p className="text-blue-300 text-xs">
                      Grupo: {transaction.linked_future_group || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Formulário de edição */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Conta *</label>
              <select
                value={editForm.conta || ''}
                onChange={(e) => setEditForm({...editForm, conta: e.target.value, categoria: '', subtipo: ''})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                disabled={transaction.is_from_reconciliation} // Não editar se reconciliada
              >
                <option value="">Selecione...</option>
                <option value="PF">PF - Pessoa Física</option>
                <option value="PJ">PJ - Pessoa Jurídica</option>
                <option value="CONC.">CONC - Conciliação</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 block mb-1">Categoria *</label>
              <select
                value={editForm.categoria || ''}
                onChange={(e) => setEditForm({...editForm, categoria: e.target.value, subtipo: ''})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                disabled={!editForm.conta || transaction.is_from_reconciliation}
              >
                <option value="">Selecione...</option>
                {Object.keys(getCategoriesForAccount(editForm.conta || '')).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 block mb-1">Subtipo *</label>
              <select
                value={editForm.subtipo || ''}
                onChange={(e) => setEditForm({...editForm, subtipo: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                disabled={!editForm.categoria || transaction.is_from_reconciliation}
              >
                <option value="">Selecione...</option>
                {editForm.conta && editForm.categoria && 
                 getCategoriesForAccount(editForm.conta)[editForm.categoria]?.subtipos.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 block mb-1">Descrição *</label>
              <input
                type="text"
                value={editForm.descricao || ''}
                onChange={(e) => setEditForm({...editForm, descricao: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                placeholder="Digite a descrição..."
                disabled={transaction.is_from_reconciliation}
              />
            </div>
          </div>

          {/* Indicadores visuais */}
          {canReconcile && (
            <div className="bg-green-900 border border-green-700 rounded p-3 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-green-400">🔗</span>
                <div>
                  <p className="text-green-100 text-sm font-medium">Reconciliação Disponível</p>
                  <p className="text-green-300 text-xs">
                    {availableGroupsCount} grupo(s) de transações futuras disponível(is)
                  </p>
                </div>
              </div>
            </div>
          )}

          {availableGroupsCount === 0 && onReconcile && transaction.realizado === 'p' && (
            <div className="bg-yellow-900 border border-yellow-700 rounded p-3 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400">⚠️</span>
                <div>
                  <p className="text-yellow-100 text-sm">Nenhum grupo disponível para reconciliação</p>
                  <p className="text-yellow-300 text-xs">
                    Importe uma fatura de cartão primeiro
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Botões */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            
            {/* Botão de reconciliação - sempre visível se função disponível */}
            {onReconcile && (
              <button
                onClick={handleReconcile}
                className={`py-2 px-3 rounded transition-colors flex items-center gap-1 ${
                  canReconcile 
                    ? 'bg-green-600 hover:bg-green-500 text-white' 
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
                disabled={!canReconcile}
                title={canReconcile ? 'Reconciliar com transações futuras' : 'Nenhum grupo disponível ou transação já reconciliada'}
              >
                <span>🔗</span>
                <span className="hidden sm:inline">Reconciliar</span>
              </button>
            )}
            
            {/* Botão de divisão - apenas para transações não categorizadas */}
            {canSplit && (
              <button
                onClick={() => {
                  onSplit(transaction);
                  onClose();
                }}
                className="py-2 px-3 bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors flex items-center gap-1"
                title="Dividir em múltiplas transações"
              >
                <span>✂️</span>
                <span className="hidden sm:inline">Dividir</span>
              </button>
            )}
            
            <button
              onClick={handleSave}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              disabled={!editForm.conta || !editForm.categoria || !editForm.subtipo || !editForm.descricao}
            >
              Salvar Alterações
            </button>
          </div>

          {/* Informações adicionais */}
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="text-xs text-gray-400 space-y-1">
              {transaction.is_from_reconciliation && (
                <p>💡 Esta transação foi criada por reconciliação e tem edição limitada</p>
              )}
              {canReconcile && (
                <p>💡 Use "Reconciliar" para conectar com transações futuras de cartão</p>
              )}
              {canSplit && (
                <p>💡 Use "Dividir" para separar em múltiplas categorias</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}