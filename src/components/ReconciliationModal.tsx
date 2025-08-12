import React, { useState, useEffect } from 'react';
import { Transaction, ReconciliationGroup } from '@/types';
import { formatCurrency, formatMonth } from '@/lib/utils';
import { validateReconciliation, formatGroupInfo } from '@/lib/reconciliationService';

interface ReconciliationModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedGroup: ReconciliationGroup) => void;
  availableGroups: ReconciliationGroup[];
}

export function ReconciliationModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onConfirm, 
  availableGroups 
}: ReconciliationModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    warnings: string[];
    errors: string[];
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Reset quando modal abre/fecha
  useEffect(() => {
    if (isOpen) {
      setSelectedGroupId('');
      setValidationResult(null);
      setShowPreview(false);
    }
  }, [isOpen]);

  // Validar quando grupo é selecionado
  useEffect(() => {
    if (selectedGroupId && transaction) {
      const selectedGroup = availableGroups.find(g => g.groupId === selectedGroupId);
      if (selectedGroup) {
        const result = validateReconciliation(transaction, selectedGroup.futures);
        setValidationResult(result);
      }
    } else {
      setValidationResult(null);
    }
  }, [selectedGroupId, transaction, availableGroups]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const handleConfirm = () => {
    const selectedGroup = availableGroups.find(g => g.groupId === selectedGroupId);
    if (selectedGroup && validationResult?.valid) {
      onConfirm(selectedGroup);
      onClose();
    }
  };

  const selectedGroup = availableGroups.find(g => g.groupId === selectedGroupId);

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center">
            <span className="mr-2">🔗</span>
            Reconciliar Pagamento
          </h3>
          
          {/* Informações da transação */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-4 mb-6 border border-blue-700">
            <h4 className="font-medium text-blue-100 mb-3">💳 Pagamento a Reconciliar</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-blue-300">Data</label>
                <p className="text-blue-100">{formatDate(transaction.data)}</p>
              </div>
              <div>
                <label className="text-sm text-blue-300">Valor</label>
                <p className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-blue-300">Descrição</label>
                <p className="text-blue-100 break-words text-sm">{transaction.descricao_origem}</p>
              </div>
              <div>
                <label className="text-sm text-blue-300">Origem</label>
                <p className="text-blue-100">{transaction.origem}</p>
              </div>
              <div>
                <label className="text-sm text-blue-300">CC</label>
                <p className="text-blue-100">{transaction.cc}</p>
              </div>
            </div>
          </div>

          {/* Seleção de grupo */}
          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-2">
              Escolha o grupo de transações futuras para reconciliar *
            </label>
            
            {availableGroups.length === 0 ? (
              <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-center">
                <span className="text-2xl mb-2 block">⚠️</span>
                <p className="text-yellow-100">Nenhum grupo disponível para reconciliação</p>
                <p className="text-yellow-300 text-sm mt-1">
                  Importe uma fatura de cartão ou verifique se já não foram reconciliadas
                </p>
              </div>
            ) : (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-blue-500"
              >
                <option value="">Selecione um grupo...</option>
                {availableGroups.map(group => (
                  <option key={group.groupId} value={group.groupId}>
                    {formatGroupInfo(group)} - {formatMonth(group.month)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Preview do grupo selecionado */}
          {selectedGroup && (
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-100">📋 Preview do Grupo Selecionado</h4>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  {showPreview ? 'Ocultar detalhes' : 'Ver detalhes'}
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="text-xs text-gray-400">Transações</label>
                  <p className="text-gray-200 font-medium">{selectedGroup.count}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Valor Total</label>
                  <p className="text-red-400 font-medium">
                    R$ {formatCurrency(selectedGroup.totalValue)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Mês</label>
                  <p className="text-gray-200">{formatMonth(selectedGroup.month)}</p>
                </div>
              </div>
              
              <div className="mb-3">
                <label className="text-xs text-gray-400">Estabelecimentos</label>
                <p className="text-gray-200 text-sm">
                  {selectedGroup.estabelecimentos.slice(0, 3).join(', ')}
                  {selectedGroup.estabelecimentos.length > 3 && ` +${selectedGroup.estabelecimentos.length - 3} outros`}
                </p>
              </div>

              {/* Detalhes expandidos */}
              {showPreview && (
                <div className="border-t border-gray-600 pt-3 mt-3">
                  <label className="text-xs text-gray-400 block mb-2">Transações do Grupo:</label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {selectedGroup.futures.map((future, idx) => (
                      <div key={`${future.id}-${idx}`} className="flex justify-between items-center text-sm bg-gray-800 p-2 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-200 truncate">{future.estabelecimento}</p>
                          <p className="text-gray-400 text-xs">{formatDate(future.data_vencimento)}</p>
                        </div>
                        <span className="text-red-400 font-medium ml-2">
                          R$ {formatCurrency(Math.abs(future.valor))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validação */}
          {validationResult && (
            <div className="mb-6">
              {validationResult.errors.length > 0 && (
                <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-3">
                  <p className="text-red-100 font-medium mb-2">❌ Erros encontrados:</p>
                  <ul className="text-red-200 text-sm space-y-1">
                    {validationResult.errors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.warnings.length > 0 && (
                <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                  <p className="text-yellow-100 font-medium mb-2">⚠️ Avisos:</p>
                  <ul className="text-yellow-200 text-sm space-y-1">
                    {validationResult.warnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Informações sobre reconciliação */}
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 mb-6">
            <h4 className="text-blue-100 font-medium mb-2">ℹ️ Sobre a Reconciliação</h4>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• As transações futuras serão convertidas em transações reais</li>
              <li>• O pagamento será marcado como reconciliado</li>
              <li>• As futures reconciliadas serão removidas da lista</li>
              <li>• Esta ação pode ser desfeita se necessário</li>
            </ul>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors font-medium"
              disabled={!selectedGroupId || !validationResult?.valid || availableGroups.length === 0}
            >
              🔗 Reconciliar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}