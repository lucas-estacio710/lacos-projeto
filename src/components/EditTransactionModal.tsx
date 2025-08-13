// components/EditTransactionModal.tsx - VERSÃO LIMPA

import React, { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  onReconcile?: (transaction: Transaction) => void;
  canReconcile?: boolean;
}

export function EditTransactionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onSave, 
  onSplit,
  onReconcile,
  canReconcile = false
}: EditTransactionModalProps) {
  const [editForm, setEditForm] = useState({
    conta: '',
    categoria: '',
    subtipo: '',
    descricao: ''
  });

  useEffect(() => {
    if (transaction) {
      setEditForm({
        conta: transaction.conta || '',
        categoria: transaction.categoria || '',
        subtipo: transaction.subtipo || '',
        descricao: transaction.descricao || transaction.descricao_origem || ''
      });
    }
  }, [transaction]);

  const getCategoriesForAccount = (account: string) => {
    switch(account) {
      case 'PJ': return categoriesPJ;
      case 'PF': return categoriesPF;
      case 'CONC.': return categoriesCONC;
      default: return {};
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const handleSaveClick = () => {
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

  if (!isOpen || !transaction) return null;

  const isFromReconciliation = transaction.is_from_reconciliation;
  const isReconciled = isFromReconciliation || transaction.linked_future_group;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4">
            ✏️ Editar Transação
          </h3>
          
          {/* Informações da transação */}
          <div className="space-y-3 mb-6">
            <div>
              <label className="text-sm text-gray-400">Data</label>
              <p className="text-gray-200">{formatDate(transaction.data)}</p>
            </div>
            
            <div>
              <label className="text-sm text-gray-400">Descrição Original</label>
              <p className="text-gray-200 break-words">{transaction.descricao_origem}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Valor</label>
                <p className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Banco</label>
                <p className="text-gray-200">{transaction.cc}</p>
              </div>
            </div>

            {/* Status de reconciliação */}
            {isReconciled && (
              <div className="bg-blue-900 border border-blue-700 rounded p-3">
                <p className="text-blue-100 text-sm font-medium flex items-center gap-2">
                  <span>🔗</span>
                  {isFromReconciliation 
                    ? 'Transação criada por reconciliação'
                    : 'Transação reconciliada com fatura'
                  }
                </p>
              </div>
            )}
          </div>
          
          {/* Formulário de edição */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Conta *</label>
              <select
                value={editForm.conta}
                onChange={(e) => setEditForm({
                  ...editForm, 
                  conta: e.target.value, 
                  categoria: '', 
                  subtipo: ''
                })}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
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
                value={editForm.categoria}
                onChange={(e) => setEditForm({
                  ...editForm, 
                  categoria: e.target.value, 
                  subtipo: ''
                })}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                disabled={!editForm.conta}
              >
                <option value="">Selecione...</option>
                {editForm.conta && Object.keys(getCategoriesForAccount(editForm.conta)).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 block mb-1">Subtipo *</label>
              <select
                value={editForm.subtipo}
                onChange={(e) => setEditForm({...editForm, subtipo: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                disabled={!editForm.categoria}
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
                value={editForm.descricao}
                onChange={(e) => setEditForm({...editForm, descricao: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                placeholder="Digite a descrição..."
              />
            </div>
          </div>
          
          {/* Botões de ação */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            
            {onSplit && !isReconciled && (
              <button
                onClick={() => {
                  onSplit(transaction);
                  onClose();
                }}
                className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
              >
                ✂️ Dividir
              </button>
            )}
            
            {onReconcile && canReconcile && !isReconciled && (
              <button
                onClick={() => {
                  onReconcile(transaction);
                  onClose();
                }}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              >
                🔗 Reconciliar
              </button>
            )}
            
            <button
              onClick={handleSaveClick}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              disabled={!editForm.conta || !editForm.categoria || !editForm.subtipo || !editForm.descricao}
            >
              💾 Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== COMPONENTE PARA EDITAR CARD TRANSACTIONS =====

import { CardTransaction } from '@/hooks/useCardTransactions';

interface EditCardTransactionModalProps {
  transaction: CardTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: CardTransaction) => void;
}

export function EditCardTransactionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onSave 
}: EditCardTransactionModalProps) {
  const [editForm, setEditForm] = useState<{
    conta: string;
    categoria: string;
    subtipo: string;
    descricao_classificada: string;
  }>({
    conta: '',
    categoria: '',
    subtipo: '',
    descricao_classificada: ''
  });

  useEffect(() => {
    if (transaction) {
      // Determinar conta baseada na categoria existente
      let conta = 'PF'; // Default
      if (transaction.categoria) {
        if (Object.keys(categoriesPJ).includes(transaction.categoria)) conta = 'PJ';
        else if (Object.keys(categoriesPF).includes(transaction.categoria)) conta = 'PF';
        else if (Object.keys(categoriesCONC).includes(transaction.categoria)) conta = 'CONC.';
      }
      
      setEditForm({
        conta: conta,
        categoria: transaction.categoria || '',
        subtipo: transaction.subtipo || '',
        descricao_classificada: transaction.descricao_classificada || transaction.descricao_origem || ''
      });
    }
  }, [transaction]);

  const getCategoriesForAccount = (account: string) => {
    switch(account) {
      case 'PJ': return categoriesPJ;
      case 'PF': return categoriesPF;
      case 'CONC.': return categoriesCONC;
      default: return {};
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const handleSaveClick = () => {
    if (transaction && editForm.categoria && editForm.subtipo && editForm.descricao_classificada) {
      const updatedTransaction: CardTransaction = {
        ...transaction,
        categoria: editForm.categoria,
        subtipo: editForm.subtipo,
        descricao_classificada: editForm.descricao_classificada,
        status: 'classified' // Marcar como classificada
      };
      onSave(updatedTransaction);
      onClose();
    }
  };

  if (!isOpen || !transaction) return null;

  const isReconciled = transaction.status === 'reconciled';
  const canEdit = !isReconciled;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <span>💳</span>
            {canEdit ? 'Classificar' : 'Visualizar'} Transação do Cartão
          </h3>
          
          {/* Informações da transação */}
          <div className="space-y-3 mb-6">
            {/* Fatura e Status */}
            <div className="bg-purple-900 border border-purple-700 rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">
                    Fatura: {transaction.fatura_id}
                  </p>
                  <p className="text-purple-300 text-xs">
                    {transaction.origem} • {transaction.cc}
                  </p>
                </div>
                <div>
                  {transaction.status === 'pending' && (
                    <span className="px-2 py-1 bg-yellow-700 text-yellow-100 rounded text-xs">
                      ⏳ Pendente
                    </span>
                  )}
                  {transaction.status === 'classified' && (
                    <span className="px-2 py-1 bg-green-700 text-green-100 rounded text-xs">
                      ✅ Classificada
                    </span>
                  )}
                  {transaction.status === 'reconciled' && (
                    <span className="px-2 py-1 bg-blue-700 text-blue-100 rounded text-xs">
                      🔗 Reconciliada
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Dados principais */}
            <div>
              <label className="text-sm text-gray-400">Descrição Original</label>
              <p className="text-gray-200 font-medium break-words">
                {transaction.descricao_origem}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Data</label>
                <p className="text-gray-200">{formatDate(transaction.data_transacao)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Valor</label>
                <p className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                </p>
              </div>
            </div>

            {/* Classificação atual (se houver) */}
            {transaction.categoria && (
              <div className="bg-gray-700 rounded p-2">
                <p className="text-xs text-gray-400 mb-1">Classificação Atual:</p>
                <p className="text-sm text-gray-200">
                  {transaction.categoria} → {transaction.subtipo}
                </p>
                {transaction.descricao_classificada && (
                  <p className="text-xs text-gray-300 mt-1">
                    "{transaction.descricao_classificada}"
                  </p>
                )}
              </div>
            )}

            {/* Aviso se reconciliada */}
            {isReconciled && (
              <div className="bg-blue-900 border border-blue-700 rounded p-3">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🔗</span>
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Transação Reconciliada</p>
                    <p className="text-blue-300 text-xs">
                      Esta transação já foi paga e não pode ser editada
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Formulário de classificação */}
          {canEdit && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Conta *</label>
                <select
                  value={editForm.conta}
                  onChange={(e) => setEditForm({
                    ...editForm, 
                    conta: e.target.value, 
                    categoria: '', 
                    subtipo: ''
                  })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
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
                  value={editForm.categoria}
                  onChange={(e) => setEditForm({
                    ...editForm, 
                    categoria: e.target.value, 
                    subtipo: ''
                  })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                  disabled={!editForm.conta}
                >
                  <option value="">Selecione...</option>
                  {editForm.conta && Object.keys(getCategoriesForAccount(editForm.conta)).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 block mb-1">Subtipo *</label>
                <select
                  value={editForm.subtipo}
                  onChange={(e) => setEditForm({...editForm, subtipo: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                  disabled={!editForm.categoria}
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
                  value={editForm.descricao_classificada}
                  onChange={(e) => setEditForm({...editForm, descricao_classificada: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                  placeholder="Digite a descrição..."
                />
              </div>
            </div>
          )}
          
          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              {canEdit ? 'Cancelar' : 'Fechar'}
            </button>
            
            {canEdit && (
              <button
                onClick={handleSaveClick}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors font-medium"
                disabled={!editForm.categoria || !editForm.subtipo || !editForm.descricao_classificada}
              >
                💾 Salvar Classificação
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}