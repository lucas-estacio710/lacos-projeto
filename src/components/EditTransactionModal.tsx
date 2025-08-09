import React, { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void; // Nova prop para divisão
}

export function EditTransactionModal({ transaction, isOpen, onClose, onSave, onSplit }: EditTransactionModalProps) {
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
        realizado: transaction.realizado
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

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4">Editar Transação</h3>
          
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
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Conta *</label>
              <select
                value={editForm.conta || ''}
                onChange={(e) => setEditForm({...editForm, conta: e.target.value, categoria: '', subtipo: ''})}
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
                value={editForm.categoria || ''}
                onChange={(e) => setEditForm({...editForm, categoria: e.target.value, subtipo: ''})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                disabled={!editForm.conta}
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
                value={editForm.descricao || ''}
                onChange={(e) => setEditForm({...editForm, descricao: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                placeholder="Digite a descrição..."
              />
            </div>
          </div>
          
          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            
            {/* Botão de divisão - apenas para transações não categorizadas */}
            {onSplit && (!editForm.categoria || !editForm.subtipo) && (
              <button
                onClick={() => {
                  onSplit(transaction);
                  onClose();
                }}
                className="py-2 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors flex items-center gap-1"
                title="Dividir em múltiplas transações"
              >
                <span>✂️</span>
                <span className="hidden sm:inline">Dividir</span>
              </button>
            )}
            
            <button
              onClick={handleSave}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              disabled={!editForm.conta || !editForm.categoria || !editForm.subtipo || !editForm.descricao}
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 