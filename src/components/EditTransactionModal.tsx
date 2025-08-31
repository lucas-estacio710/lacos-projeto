// components/EditTransactionModal.tsx - VERSÃO COMPLETA COM SPLIT PARA CARTÕES

import React, { useState, useEffect, useMemo } from 'react';
import { Transaction } from '@/types';
import { useConfig } from '@/contexts/ConfigContext';
import { useHierarchy } from '@/hooks/useHierarchy';
import { SUBTIPO_IDS, isClassificacaoComplexa } from '@/lib/constants';

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
  const { getAllAccountTypes } = useConfig();
  const { contas, categorias, subtipos, carregarTudo } = useHierarchy();
  
  // Load hierarchy data when modal opens
  useEffect(() => {
    if (isOpen) {
      carregarTudo();
    }
  }, [isOpen, carregarTudo]);

  // Helper para determinar a conta baseada na categoria
  const getAccountFromCategory = (categoria: string): string => {
    if (!categoria) return 'PF';
    
    // Usar hierarquia dinâmica para determinar conta
    const categoriaObj = categorias.find(c => c.nome === categoria);
    if (categoriaObj) {
      const conta = contas.find(c => c.id === categoriaObj.conta_id);
      return conta?.codigo || 'PF';
    }
    return 'PF'; // Default
  };
  
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

  // ✅ Dynamic hierarchy options
  const availableContas = useMemo(() => {
    // Identificar qual conta contém o subtipo COMPLEXA
    const subtipoComplexa = subtipos.find(s => isClassificacaoComplexa(s.id));
    let contaComplexaId: string | null = null;
    
    if (subtipoComplexa) {
      const categoriaComplexa = categorias.find(c => c.id === subtipoComplexa.categoria_id);
      if (categoriaComplexa) {
        contaComplexaId = categoriaComplexa.conta_id;
      }
    }
    
    return contas
      .filter(c => c.ativo && c.id !== contaComplexaId) // Excluir conta que contém COMPLEXA
      .map(c => ({
        codigo: c.codigo,
        nome: c.nome,
        icone: c.icone
      }));
  }, [contas, categorias, subtipos]);
  
  const availableCategorias = useMemo(() => {
    const selectedConta = contas.find(c => c.codigo === editForm.conta);
    if (!selectedConta) return [];
    
    return categorias
      .filter(c => c.conta_id === selectedConta.id && c.ativo)
      .map(c => ({
        nome: c.nome,
        icone: c.icone
      }));
  }, [contas, categorias, editForm.conta]);
  
  const availableSubtipos = useMemo(() => {
    const selectedConta = contas.find(c => c.codigo === editForm.conta);
    const selectedCategoria = categorias.find(c => 
      c.conta_id === selectedConta?.id && c.nome === editForm.categoria
    );
    
    if (!selectedCategoria) return [];
    
    return subtipos
      .filter(s => s.categoria_id === selectedCategoria.id && s.ativo && !isClassificacaoComplexa(s.id))
      .map(s => s.nome);
  }, [contas, categorias, subtipos, editForm.conta, editForm.categoria]);

  const handleSaveClick = () => {
    if (transaction && editForm.conta && editForm.categoria && editForm.subtipo && editForm.descricao) {
      // ✅ Find subtipo_id for new hierarchy system
      const selectedConta = contas.find(c => c.codigo === editForm.conta);
      const selectedCategoria = categorias.find(c => 
        c.conta_id === selectedConta?.id && c.nome === editForm.categoria
      );
      const selectedSubtipo = subtipos.find(s => 
        s.categoria_id === selectedCategoria?.id && s.nome === editForm.subtipo
      );
      
      const updatedTransaction: Transaction = {
        ...transaction,
        conta: editForm.conta,
        categoria: editForm.categoria,
        subtipo: editForm.subtipo,
        subtipo_id: selectedSubtipo?.id, // ✅ Add subtipo_id for new hierarchy
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      {/* Mobile: slide up, Desktop: center */}
      <div className="bg-gray-800 w-full sm:max-w-lg sm:rounded-lg shadow-xl max-h-[95vh] overflow-hidden sm:mx-4 rounded-t-xl sm:rounded-b-xl">
        
        {/* Header compacto */}
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-700">
          <h3 className="text-lg font-medium text-gray-100 flex items-center gap-2">
            ✏️ Editar
          </h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
          <div className="p-4">
            
            {/* Card de informações da transação - mais compacto */}
            <div className="bg-gray-900 rounded-lg p-3 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Data</span>
                <span className="text-sm text-gray-200 font-medium">{formatDate(transaction.data)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Valor</span>
                <span className={`text-sm font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Banco</span>
                <span className="text-sm text-gray-200">{transaction.cc}</span>
              </div>
              
              <div className="pt-1 border-t border-gray-700">
                <span className="text-xs text-gray-400 block mb-1">Descrição Original</span>
                <p className="text-sm text-gray-200 leading-tight line-clamp-2">{transaction.descricao_origem}</p>
              </div>

              {/* Status de reconciliação */}
              {isReconciled && (
                <div className="bg-blue-900/50 border border-blue-700/50 rounded p-2 mt-2">
                  <p className="text-blue-200 text-xs flex items-center gap-1">
                    🔗 {isFromReconciliation ? 'Criada por reconciliação' : 'Reconciliada'}
                  </p>
                </div>
              )}
            </div>
          
            {/* Formulário de classificação - design moderno */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                📋 Classificação
              </h4>
              
              {/* Conta */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">CONTA *</label>
                <select
                  value={editForm.conta}
                  onChange={(e) => setEditForm({
                    ...editForm, 
                    conta: e.target.value, 
                    categoria: '', 
                    subtipo: ''
                  })}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="">Selecione a conta...</option>
                  {availableContas.map((conta) => (
                    <option key={conta.codigo} value={conta.codigo}>
                      {conta.icone} {conta.nome}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Categoria */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">CATEGORIA *</label>
                <select
                  value={editForm.categoria}
                  onChange={(e) => setEditForm({
                    ...editForm, 
                    categoria: e.target.value, 
                    subtipo: ''
                  })}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                  disabled={!editForm.conta}
                >
                  <option value="">
                    {!editForm.conta ? 'Primeiro selecione uma conta' : 'Selecione a categoria...'}
                  </option>
                  {availableCategorias.map((categoria) => (
                    <option key={categoria.nome} value={categoria.nome}>
                      {categoria.icone} {categoria.nome}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Subtipo */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">SUBTIPO *</label>
                <select
                  value={editForm.subtipo}
                  onChange={(e) => setEditForm({...editForm, subtipo: e.target.value})}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                  disabled={!editForm.categoria}
                >
                  <option value="">
                    {!editForm.categoria ? 'Primeiro selecione uma categoria' : 'Selecione o subtipo...'}
                  </option>
                  {availableSubtipos.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              
              {/* Descrição */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">DESCRIÇÃO *</label>
                <textarea
                  value={editForm.descricao}
                  onChange={(e) => setEditForm({...editForm, descricao: e.target.value})}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                  placeholder="Digite a descrição da transação..."
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>
          
        {/* Footer com botões - sticky no bottom */}
        <div className="bg-gray-900 border-t border-gray-700 p-4">
          {/* Linha 1: Ações secundárias */}
          {(onSplit && !isReconciled) || (onReconcile && canReconcile && !isReconciled) ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {onSplit && !isReconciled && (
                <button
                  onClick={() => {
                    onSplit(transaction);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  ✂️ <span className="hidden sm:inline">Dividir</span>
                </button>
              )}
              
              {onReconcile && canReconcile && !isReconciled && (
                <button
                  onClick={() => {
                    onReconcile(transaction);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  🔗 <span className="hidden sm:inline">Reconciliar</span>
                </button>
              )}
            </div>
          ) : null}
          
          {/* Linha 2: Ações principais */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            
            <button
              onClick={handleSaveClick}
              className="py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
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

// ===== COMPONENTE PARA EDITAR CARD TRANSACTIONS - ATUALIZADO COM SPLIT =====

import { CardTransaction } from '@/hooks/useCardTransactions';

interface EditCardTransactionModalProps {
  transaction: CardTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: CardTransaction) => void;
  onSplit?: (transaction: CardTransaction) => void; // ✅ NOVA PROP
}

export function EditCardTransactionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onSave,
  onSplit // ✅ NOVA PROP
}: EditCardTransactionModalProps) {
  const { contas, categorias, subtipos, carregarTudo } = useHierarchy();
  
  // Load hierarchy data when modal opens
  useEffect(() => {
    if (isOpen) {
      carregarTudo();
    }
  }, [isOpen, carregarTudo]);
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
      const conta = getAccountFromCategory(transaction.categoria || '');
      
      setEditForm({
        conta: conta,
        categoria: transaction.categoria || '',
        subtipo: transaction.subtipo || '',
        descricao_classificada: transaction.descricao_classificada || transaction.descricao_origem || ''
      });
    }
  }, [transaction]);


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

  // ✅ Dynamic hierarchy options for card transactions
  const availableContas = useMemo(() => {
    // Identificar qual conta contém o subtipo COMPLEXA
    const subtipoComplexa = subtipos.find(s => isClassificacaoComplexa(s.id));
    let contaComplexaId: string | null = null;
    
    if (subtipoComplexa) {
      const categoriaComplexa = categorias.find(c => c.id === subtipoComplexa.categoria_id);
      if (categoriaComplexa) {
        contaComplexaId = categoriaComplexa.conta_id;
      }
    }
    
    return contas
      .filter(c => c.ativo && c.id !== contaComplexaId) // Excluir conta que contém COMPLEXA
      .map(c => ({
        codigo: c.codigo,
        nome: c.nome,
        icone: c.icone
      }));
  }, [contas, categorias, subtipos]);
  
  const availableCategorias = useMemo(() => {
    const selectedConta = contas.find(c => c.codigo === editForm.conta);
    if (!selectedConta) return [];
    
    return categorias
      .filter(c => c.conta_id === selectedConta.id && c.ativo)
      .map(c => ({
        nome: c.nome,
        icone: c.icone
      }));
  }, [contas, categorias, editForm.conta]);
  
  const availableSubtipos = useMemo(() => {
    const selectedConta = contas.find(c => c.codigo === editForm.conta);
    const selectedCategoria = categorias.find(c => 
      c.conta_id === selectedConta?.id && c.nome === editForm.categoria
    );
    
    if (!selectedCategoria) return [];
    
    return subtipos
      .filter(s => s.categoria_id === selectedCategoria.id && s.ativo && !isClassificacaoComplexa(s.id))
      .map(s => s.nome);
  }, [contas, categorias, subtipos, editForm.conta, editForm.categoria]);

  const handleSaveClick = () => {
    if (transaction && editForm.categoria && editForm.subtipo && editForm.descricao_classificada) {
      // ✅ Find subtipo_id for new hierarchy system
      const selectedConta = contas.find(c => c.codigo === editForm.conta);
      const selectedCategoria = categorias.find(c => 
        c.conta_id === selectedConta?.id && c.nome === editForm.categoria
      );
      const selectedSubtipo = subtipos.find(s => 
        s.categoria_id === selectedCategoria?.id && s.nome === editForm.subtipo
      );
      
      const updatedTransaction: CardTransaction = {
        ...transaction,
        categoria: editForm.categoria,
        subtipo: editForm.subtipo,
        subtipo_id: selectedSubtipo?.id, // ✅ Add subtipo_id for new hierarchy
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
  const canSplit = canEdit && onSplit; // ✅ NOVA VARIÁVEL

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
                  {availableContas.map((conta) => (
                    <option key={conta.codigo} value={conta.codigo}>
                      {conta.icone} {conta.nome} ({conta.codigo})
                    </option>
                  ))}
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
                  {availableCategorias.map((categoria) => (
                    <option key={categoria.nome} value={categoria.nome}>
                      {categoria.icone} {categoria.nome}
                    </option>
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
                  {availableSubtipos.map(sub => (
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
            
            {/* ✅ NOVO BOTÃO: Dividir para cartões */}
            {canSplit && (
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