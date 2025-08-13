// components/BatchClassificationModal.tsx - MODAL DE CLASSIFICAÇÃO EM LOTE ATUALIZADO COM BOTÃO LIMPAR

import React, { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { categoriesPJ, categoriesPF, categoriesCONC, getCategoriesForAccount } from '@/lib/categories';
import { 
  BatchClassificationItem, 
  prepareBatchClassification, 
  validateBatchClassification,
  SmartSuggestion
} from '@/lib/smartClassification';
import { formatCurrency, formatDate } from '@/lib/utils';

interface BatchClassificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  unclassifiedTransactions: (Transaction | CardTransaction)[];
  historicTransactions: Transaction[];
  historicCardTransactions?: CardTransaction[];
  onApplyBatch: (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => Promise<void>;
}

export function BatchClassificationModal({
  isOpen,
  onClose,
  unclassifiedTransactions,
  historicTransactions,
  historicCardTransactions = [],
  onApplyBatch
}: BatchClassificationModalProps) {
  const [batchItems, setBatchItems] = useState<BatchClassificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedAll, setSelectedAll] = useState(false);

  // Preparar dados quando modal abre
  useEffect(() => {
    if (isOpen && unclassifiedTransactions.length > 0) {
      console.log('📄 Preparando classificação em lote...');
      const prepared = prepareBatchClassification(
        unclassifiedTransactions, 
        historicTransactions
      );
      setBatchItems(prepared);
      setCurrentIndex(0);
      setErrors([]);
      setSelectedAll(false);
    }
  }, [isOpen, unclassifiedTransactions, historicTransactions, historicCardTransactions]);

  // Detectar tipo de transação
  const isCardTransaction = (item: Transaction | CardTransaction): item is CardTransaction => {
    return 'fatura_id' in item;
  };

  // ===== FUNÇÃO PARA LIMPAR CLASSIFICAÇÃO =====
  const clearCurrentClassification = () => {
    setBatchItems(prev => prev.map((item, index) => 
      index === currentIndex 
        ? {
            ...item,
            selectedConta: '',
            selectedCategoria: '',
            selectedSubtipo: '',
            // Mantém selectedDescricao
          }
        : item
    ));
    
    // Limpa erros e mostra feedback
    setErrors([]);
    console.log('🗑️ Classificação limpa para transação', currentIndex + 1);
  };

  // Atualizar item específico
  const updateItem = (index: number, field: keyof BatchClassificationItem, value: any) => {
    setBatchItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Reset categoria/subtipo se conta mudou
      if (field === 'selectedConta') {
        updated[index].selectedCategoria = '';
        updated[index].selectedSubtipo = '';
      }
      
      // Reset subtipo se categoria mudou
      if (field === 'selectedCategoria') {
        updated[index].selectedSubtipo = '';
      }
      
      return updated;
    });
  };

  // Aplicar sugestão
  const applySuggestion = (index: number, suggestion: SmartSuggestion) => {
    setBatchItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        selectedConta: suggestion.conta,
        selectedCategoria: suggestion.categoria,
        selectedSubtipo: suggestion.subtipo
      };
      return updated;
    });
  };

  // Aplicar classificação para todos os selecionados
  const applyToSelected = () => {
    const current = batchItems[currentIndex];
    if (!current.selectedConta || !current.selectedCategoria || !current.selectedSubtipo) {
      alert('⚠️ Preencha todos os campos da transação atual primeiro');
      return;
    }

    setBatchItems(prev => prev.map(item => ({
      ...item,
      selectedConta: current.selectedConta,
      selectedCategoria: current.selectedCategoria,
      selectedSubtipo: current.selectedSubtipo
    })));

    setSelectedAll(true);
  };

  // Navegação
  const goToNext = () => {
    if (currentIndex < batchItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // ===== VALIDAÇÃO ATUALIZADA PARA ACEITAR VAZIO =====
  const validateBatchClassificationUpdated = (items: BatchClassificationItem[]): {
    valid: BatchClassificationItem[];
    invalid: BatchClassificationItem[];
    errors: string[];
  } => {
    const valid: BatchClassificationItem[] = [];
    const invalid: BatchClassificationItem[] = [];
    const errors: string[] = [];

    items.forEach((item, index) => {
      const hasAnyField = item.selectedConta || item.selectedCategoria || item.selectedSubtipo;
      const hasAllRequiredFields = item.selectedConta && item.selectedCategoria && item.selectedSubtipo;
      
      // Aceita completamente vazio OU completamente preenchido
      if (!hasAnyField || hasAllRequiredFields) {
        valid.push(item);
      } else {
        invalid.push(item);
        errors.push(`Transação ${index + 1}: Preencha todos os campos ou deixe todos vazios`);
      }
    });

    return { valid, invalid, errors };
  };

  // Submeter classificações
  const handleSubmit = async () => {
    const validation = validateBatchClassificationUpdated(batchItems);
    
    if (validation.invalid.length > 0) {
      setErrors(validation.errors);
      alert(`❌ ${validation.invalid.length} transações com problemas. Verifique os campos.`);
      return;
    }

    // Separar classificadas vs não classificadas
    const classified = validation.valid.filter(item => item.selectedConta && item.selectedCategoria && item.selectedSubtipo);
    const unclassified = validation.valid.filter(item => !item.selectedConta || !item.selectedCategoria || !item.selectedSubtipo);
    
    // Confirmar se nenhuma será classificada
    if (classified.length === 0 && unclassified.length > 0) {
      const confirm = window.confirm(
        `⚠️ Todas as ${unclassified.length} transações ficarão não classificadas. Tem certeza?`
      );
      if (!confirm) return;
    }

    const classifications = classified.map(item => ({
      id: item.id,
      conta: item.selectedConta!,
      categoria: item.selectedCategoria!,
      subtipo: item.selectedSubtipo!,
      descricao: item.selectedDescricao || item.transaction.descricao_origem || 'Sem descrição'
    }));

    setLoading(true);
    try {
      if (classifications.length > 0) {
        await onApplyBatch(classifications);
      }
      
      alert(`✅ ${classifications.length} transações classificadas! ${unclassified.length} deixadas não classificadas.`);
      onClose();
    } catch (error) {
      console.error('❌ Erro na classificação em lote:', error);
      alert('❌ Erro ao aplicar classificações');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentItem = batchItems[currentIndex];
  const progress = batchItems.length > 0 ? ((currentIndex + 1) / batchItems.length) * 100 : 0;

  // Calcular resumo
  const classificationSummary = {
    classified: batchItems.filter(item => item.selectedConta && item.selectedCategoria && item.selectedSubtipo).length,
    unclassified: batchItems.filter(item => !item.selectedConta || !item.selectedCategoria || !item.selectedSubtipo).length,
    withSuggestion: batchItems.filter(item => item.suggestedClassification).length
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              <span>⚡</span>
              Classificação em Lote
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Progresso: {currentIndex + 1} de {batchItems.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {currentItem && (
            <>
              {/* Transação Atual */}
              <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-4 mb-6 border border-blue-700">
                <h4 className="font-medium text-blue-100 mb-3">
                  📋 Transação {currentIndex + 1}/{batchItems.length}
                  {isCardTransaction(currentItem.transaction) && (
                    <span className="ml-2 text-xs bg-purple-700 text-purple-200 px-2 py-1 rounded">
                      {currentItem.transaction.fatura_id}
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-blue-300">Data:</label>
                    <p className="text-blue-100">
                      {formatDate(
                        isCardTransaction(currentItem.transaction) 
                          ? currentItem.transaction.data_transacao 
                          : currentItem.transaction.data
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-blue-300">Valor:</label>
                    <p className={`font-bold ${currentItem.transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {currentItem.transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(currentItem.transaction.valor))}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-blue-300">Descrição:</label>
                    <p className="text-blue-100 break-words">
                      {currentItem.transaction.descricao_origem}
                    </p>
                  </div>
                  <div>
                    <label className="text-blue-300">Origem:</label>
                    <p className="text-blue-100">{currentItem.transaction.origem}</p>
                  </div>
                  <div>
                    <label className="text-blue-300">Banco/Cartão:</label>
                    <p className="text-blue-100">{currentItem.transaction.cc}</p>
                  </div>
                </div>
              </div>

              {/* Sugestões Inteligentes */}
              {currentItem.suggestedClassification && (
                <div className="bg-green-900 border border-green-700 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-green-100 mb-3 flex items-center gap-2">
                    <span>🤖</span>
                    Sugestão Inteligente
                    <span className="text-xs bg-green-700 text-green-100 px-2 py-1 rounded">
                      {Math.round(currentItem.suggestedClassification.confidence * 100)}% confiança
                    </span>
                  </h4>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-green-200">
                      <p>{currentItem.suggestedClassification.conta} → {currentItem.suggestedClassification.categoria} → {currentItem.suggestedClassification.subtipo}</p>
                      <p className="text-green-300 text-xs mt-1">{currentItem.suggestedClassification.reason}</p>
                    </div>
                    <button
                      onClick={() => applySuggestion(currentIndex, currentItem.suggestedClassification!)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}

              {/* Status da classificação atual */}
              {!currentItem.selectedCategoria ? (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-2 mb-3">
                  <div className="flex items-center gap-2 text-yellow-200 text-sm">
                    ⚠️ <span>Lançamento será salvo como <strong>não classificado</strong></span>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-2 mb-3">
                  <div className="flex items-center gap-2 text-blue-200 text-sm">
                    📋 <span>
                      Categoria: <strong>{currentItem.selectedCategoria}</strong> → <strong>{currentItem.selectedSubtipo}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Formulário de Classificação */}
              <div className="space-y-4 mb-6">
                {/* Header do formulário com botão limpar */}
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-100">📝 Classificação</h4>
                  
                  {/* BOTÃO LIMPAR CLASSIFICAÇÃO */}
                  <button
                    onClick={clearCurrentClassification}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors flex items-center gap-2"
                    title="Remove a classificação sugerida, deixando como não classificado"
                  >
                    🗑️ Limpar
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Conta */}
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Conta</label>
                    <select
                      value={currentItem.selectedConta || ''}
                      onChange={(e) => updateItem(currentIndex, 'selectedConta', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                    >
                      <option value="">Selecione...</option>
                      <option value="PF">PF</option>
                      <option value="PJ">PJ</option>
                      <option value="CONC.">CONC.</option>
                    </select>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Categoria</label>
                    <select
                      value={currentItem.selectedCategoria || ''}
                      onChange={(e) => updateItem(currentIndex, 'selectedCategoria', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                      disabled={!currentItem.selectedConta}
                    >
                      <option value="">Selecione...</option>
                      {currentItem.selectedConta && Object.keys(getCategoriesForAccount(currentItem.selectedConta)).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subtipo */}
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Subtipo</label>
                    <select
                      value={currentItem.selectedSubtipo || ''}
                      onChange={(e) => updateItem(currentIndex, 'selectedSubtipo', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                      disabled={!currentItem.selectedCategoria}
                    >
                      <option value="">Selecione...</option>
                      {currentItem.selectedConta && currentItem.selectedCategoria && 
                       getCategoriesForAccount(currentItem.selectedConta)[currentItem.selectedCategoria]?.subtipos.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Descrição</label>
                  <input
                    type="text"
                    value={currentItem.selectedDescricao || ''}
                    onChange={(e) => updateItem(currentIndex, 'selectedDescricao', e.target.value)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                    placeholder="Digite a descrição..."
                  />
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={applyToSelected}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
                  disabled={!currentItem.selectedConta || !currentItem.selectedCategoria || !currentItem.selectedSubtipo}
                >
                  🎯 Aplicar a Todas
                </button>
                <button
                  onClick={() => setCurrentIndex(Math.floor(Math.random() * batchItems.length))}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
                >
                  🎲 Aleatória
                </button>
              </div>

              {/* Navegação */}
              <div className="flex justify-between items-center mb-6">
                <button
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
                >
                  ← Anterior
                </button>
                
                <div className="text-center">
                  <p className="text-gray-300 text-sm">
                    Use ← → para navegar
                  </p>
                </div>
                
                <button
                  onClick={goToNext}
                  disabled={currentIndex === batchItems.length - 1}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
                >
                  Próxima →
                </button>
              </div>
            </>
          )}

          {/* Resumo */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-gray-100 mb-2">📊 Resumo</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-green-400 text-lg font-bold">{classificationSummary.classified}</p>
                <p className="text-gray-300">Classificadas</p>
              </div>
              <div className="text-center">
                <p className="text-yellow-400 text-lg font-bold">{classificationSummary.unclassified}</p>
                <p className="text-gray-300">Não Classificadas</p>
              </div>
              <div className="text-center">
                <p className="text-blue-400 text-lg font-bold">{classificationSummary.withSuggestion}</p>
                <p className="text-gray-300">Com Sugestão</p>
              </div>
            </div>
          </div>

          {/* Erros */}
          {errors.length > 0 && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-4">
              <h4 className="font-medium text-red-100 mb-2">❌ Erros encontrados:</h4>
              <ul className="text-red-200 text-sm space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Botões Finais */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded transition-colors font-medium"
            >
              {loading ? '⏳ Aplicando...' : 
                `✅ Classificar ${classificationSummary.classified} • ⚪ ${classificationSummary.unclassified} Não Classificadas`
              }
            </button>
          </div>

          {/* Dicas */}
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="text-xs text-gray-400 space-y-1">
              <p>💡 Use as sugestões inteligentes quando disponíveis para acelerar o processo</p>
              <p>💡 "Aplicar a Todas" replica a classificação atual para todas as transações restantes</p>
              <p>💡 🗑️ "Limpar" remove a classificação deixando como não classificado</p>
              <p>💡 As sugestões são baseadas no seu histórico de transações similares</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}