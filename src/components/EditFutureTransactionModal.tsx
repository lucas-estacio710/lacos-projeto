import React, { useState, useEffect } from 'react';
import { FutureTransaction } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';
import { formatCurrency, formatMonth } from '@/lib/utils';

interface EditFutureTransactionModalProps {
  transaction: FutureTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: FutureTransaction, updateParcelas: boolean) => void;
}

export function EditFutureTransactionModal({ transaction, isOpen, onClose, onSave }: EditFutureTransactionModalProps) {
  const [editForm, setEditForm] = useState<Partial<FutureTransaction>>({});
  const [updateParcelas, setUpdateParcelas] = useState(true);

  useEffect(() => {
    if (transaction) {
      const conta = 'PF'; // Default para PF, pode ser ajustado conforme necessário
      const categoria = transaction.categoria || '';
      
      setEditForm({
        id: transaction.id,
        mes_vencimento: transaction.mes_vencimento,
        data_vencimento: transaction.data_vencimento,
        descricao_origem: transaction.descricao_origem,
        conta: conta,
        categoria: categoria,
        subtipo: transaction.subtipo || '',
        descricao: transaction.descricao || transaction.descricao_origem || '',
        valor: transaction.valor,
        origem: transaction.origem,
        cc: transaction.cc,
        parcela_atual: transaction.parcela_atual,
        parcela_total: transaction.parcela_total,
        estabelecimento: transaction.estabelecimento,
        status: transaction.status
      });

      // Se tem parcelas, marcar por padrão para atualizar
      setUpdateParcelas(transaction.parcela_total > 1);
    }
  }, [transaction]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    
    // Se já está no formato brasileiro
    if (dateStr.includes('/')) return dateStr;
    
    // Se está no formato ISO (YYYY-MM-DD)
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    
    return dateStr;
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
      const updatedTransaction: FutureTransaction = {
        ...transaction,
        categoria: editForm.categoria,
        subtipo: editForm.subtipo,
        descricao: editForm.descricao,
        status: 'confirmed'
      };
      
      onSave(updatedTransaction, updateParcelas);
      onClose();
    }
  };

  if (!isOpen || !transaction) return null;

  const showParcelasOption = transaction.parcela_total > 1;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4">💳 Classificar Transação do Cartão</h3>
          
          <div className="space-y-3 mb-6">
            <div>
              <label className="text-sm text-gray-400">Estabelecimento</label>
              <p className="text-gray-200 font-medium">{editForm.estabelecimento || 'N/A'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Vencimento</label>
                <p className="text-gray-200">{formatDate(editForm.data_vencimento || '')}</p>
                <p className="text-xs text-gray-400">{formatMonth(editForm.mes_vencimento || '')}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Valor</label>
                <p className={`font-bold ${(editForm.valor || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(editForm.valor || 0) >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(editForm.valor || 0))}
                </p>
              </div>
            </div>

            {showParcelasOption && (
              <div className="bg-yellow-900 p-3 rounded-lg border border-yellow-700">
                <p className="text-yellow-100 text-sm mb-2">
                  📅 <strong>Parcela {transaction.parcela_atual}/{transaction.parcela_total}</strong>
                </p>
                <p className="text-yellow-300 text-xs">
                  Esta transação possui {transaction.parcela_total - 1} parcelas futuras que serão criadas automaticamente.
                </p>
              </div>
            )}
            
            <div>
              <label className="text-sm text-gray-400">Descrição Original</label>
              <p className="text-gray-200 break-words text-sm">{editForm.descricao_origem || 'N/A'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Origem</label>
                <p className="text-gray-200 text-sm">{editForm.origem || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">CC</label>
                <p className="text-gray-200 text-sm">{editForm.cc || 'N/A'}</p>
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

            {showParcelasOption && (
              <div className="bg-blue-900 p-3 rounded-lg border border-blue-700">
                <label className="flex items-center gap-2 text-blue-100">
                  <input
                    type="checkbox"
                    checked={updateParcelas}
                    onChange={(e) => setUpdateParcelas(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">
                    Aplicar classificação às {transaction.parcela_total - 1} parcelas futuras
                  </span>
                </label>
                <p className="text-blue-300 text-xs mt-1">
                  Se marcado, todas as parcelas futuras receberão a mesma classificação
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              disabled={!editForm.conta || !editForm.categoria || !editForm.subtipo || !editForm.descricao}
            >
              Classificar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}