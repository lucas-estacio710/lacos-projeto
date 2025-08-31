// components/SplitCardTransactionModal.tsx - NOVO COMPONENTE PARA DIVIDIR CARTÕES

import React, { useState, useEffect } from 'react';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { useConfig } from '@/contexts/ConfigContext';
import { useHierarchy } from '@/hooks/useHierarchy';

interface SplitCardPart {
  categoria: string;
  subtipo: string;
  descricao_classificada: string;
  valor: number;
}

interface SplitCardTransactionModalProps {
  transaction: CardTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSplit: (parts: SplitCardPart[]) => void;
}

export function SplitCardTransactionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onSplit 
}: SplitCardTransactionModalProps) {
  const { contas, categorias, subtipos } = useHierarchy();
  const [numberOfParts, setNumberOfParts] = useState(2);
  const [parts, setParts] = useState<SplitCardPart[]>([]);
  const [error, setError] = useState<string>('');

  // Inicializar partes quando o modal abrir
  useEffect(() => {
    if (transaction && isOpen) {
      const initialParts: SplitCardPart[] = Array.from({ length: numberOfParts }, () => ({
        categoria: '',
        subtipo: '',
        descricao_classificada: '',
        valor: 0
      }));
      setParts(initialParts);
      setError('');
    }
  }, [transaction, isOpen, numberOfParts]);

  // Função para determinar a conta automaticamente
  const getAccountForTransaction = (transaction: CardTransaction): string => {
    // Lógica similar ao que já existe no sistema
    if (transaction.descricao_origem?.toLowerCase().includes('posto') || 
        transaction.descricao_origem?.toLowerCase().includes('combustivel')) {
      return 'PJ';
    }
    return 'PF'; // Default
  };


  const formatCurrency = (value: number) => {
    return Math.abs(value).toLocaleString('pt-BR', {
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

  const handleNumberOfPartsChange = (newNumber: number) => {
    setNumberOfParts(newNumber);
    setError('');
  };

  const handlePartChange = (index: number, field: keyof SplitCardPart, value: string | number) => {
    const newParts = [...parts];
    
    if (field === 'valor') {
      newParts[index][field] = Number(value);
      
      // Calcular valor restante automaticamente para a última parte não preenchida
      const filledValues = newParts.slice(0, -1).reduce((sum, part) => sum + part.valor, 0);
      const remaining = Math.abs(transaction?.valor || 0) - Math.abs(filledValues);
      
      // Se não é a última parte e ainda há valor restante
      if (index < parts.length - 1) {
        const lastIndex = parts.length - 1;
        newParts[lastIndex].valor = transaction?.valor && transaction.valor < 0 ? -remaining : remaining;
      }
    } else if (field === 'categoria') {
      newParts[index][field] = value as string;
      newParts[index].subtipo = ''; // Reset subtipo when categoria changes
    } else {
      newParts[index][field] = value as string;
    }
    
    setParts(newParts);
    
    // Validar soma dos valores
    const total = newParts.reduce((sum, part) => sum + part.valor, 0);
    const originalValue = transaction?.valor || 0;
    
    if (Math.abs(Math.abs(total) - Math.abs(originalValue)) > 0.01) {
      setError(`Soma dos valores (${formatCurrency(total)}) deve ser igual ao valor original (${formatCurrency(Math.abs(originalValue))})`);
    } else {
      setError('');
    }
  };

  const handleSplit = () => {
    if (!transaction) return;

    // Validações
    const total = parts.reduce((sum, part) => sum + part.valor, 0);
    const originalValue = transaction.valor;

    if (Math.abs(Math.abs(total) - Math.abs(originalValue)) > 0.01) {
      setError('A soma dos valores deve ser igual ao valor original');
      return;
    }

    const hasEmptyFields = parts.some(part => 
      !part.categoria || !part.subtipo || !part.descricao_classificada
    );

    if (hasEmptyFields) {
      setError('Todos os campos devem ser preenchidos');
      return;
    }

    onSplit(parts);
    onClose();
  };

  if (!isOpen || !transaction) return null;

  const account = getAccountForTransaction(transaction);
  const contaObj = contas.find(c => c.codigo === account);
  const categoriasParaConta = contaObj ? categorias.filter(cat => cat.conta_id === contaObj.id) : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center">
            <span className="mr-2">✂️</span>
            Dividir Transação de Cartão
          </h3>
          
          {/* Informações da transação original */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div>
                <label className="text-sm text-gray-400">Fatura</label>
                <p className="text-gray-200">{transaction.fatura_id}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Data</label>
                <p className="text-gray-200">{formatDate(transaction.data_transacao)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Descrição Original</label>
                <p className="text-gray-200 break-words text-sm">{transaction.descricao_origem}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Valor Total</label>
                <p className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(transaction.valor)}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Conta (Auto)</label>
                <p className="text-blue-400">{account}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Cartão</label>
                <p className="text-gray-200">{transaction.origem}</p>
              </div>
            </div>
          </div>

          {/* Seletor de número de partes */}
          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-2">Dividir em quantas partes?</label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => handleNumberOfPartsChange(num)}
                  className={`flex-1 py-2 px-3 rounded transition-colors ${
                    numberOfParts === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Partes da divisão */}
          <div className="space-y-4 mb-6">
            {parts.map((part, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Parte {index + 1}
                </h4>
                
                <div className="space-y-3">
                  {/* Categoria */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Categoria *</label>
                    <select
                      value={part.categoria}
                      onChange={(e) => handlePartChange(index, 'categoria', e.target.value)}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {categoriasParaConta.map(cat => (
                        <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subtipo */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Subtipo *</label>
                    <select
                      value={part.subtipo}
                      onChange={(e) => handlePartChange(index, 'subtipo', e.target.value)}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                      disabled={!part.categoria}
                    >
                      <option value="">Selecione...</option>
                      {part.categoria && (() => {
                        const categoriaObj = categorias.find(c => c.nome === part.categoria);
                        if (!categoriaObj) return null;
                        const subtiposParaCategoria = subtipos.filter(sub => sub.categoria_id === categoriaObj.id);
                        return subtiposParaCategoria.map(sub => (
                          <option key={sub.id} value={sub.nome}>{sub.nome}</option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descrição *</label>
                    <input
                      type="text"
                      value={part.descricao_classificada}
                      onChange={(e) => handlePartChange(index, 'descricao_classificada', e.target.value)}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                      placeholder="Ex: Compra Supermercado"
                    />
                  </div>

                  {/* Valor */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Valor * {index === parts.length - 1 && '(calculado automaticamente)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={Math.abs(part.valor)}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        const adjustedValue = transaction.valor < 0 ? -value : value;
                        handlePartChange(index, 'valor', adjustedValue);
                      }}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                      placeholder="0.00"
                      disabled={index === parts.length - 1}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Resumo */}
          <div className="bg-gray-700 rounded-lg p-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total das partes:</span>
              <span className={`font-bold ${
                parts.reduce((sum, part) => sum + part.valor, 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                R$ {formatCurrency(parts.reduce((sum, part) => sum + part.valor, 0))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Valor original:</span>
              <span className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                R$ {formatCurrency(transaction.valor)}
              </span>
            </div>
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
              onClick={handleSplit}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              disabled={!!error || parts.some(part => !part.categoria || !part.subtipo || !part.descricao_classificada)}
            >
              Dividir Transação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}