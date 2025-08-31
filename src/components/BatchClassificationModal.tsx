// components/BatchClassificationModal.tsx - ATUALIZADO COM BOTÃO CLASSIFICAÇÃO COMPLEXA

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { useConfig } from '@/contexts/ConfigContext';
import { useHierarchy } from '@/hooks/useHierarchy';
import { 
  BatchClassificationItem, 
  prepareBatchClassification, 
  validateBatchClassification,
  HistoricItem
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
    subtipo_id: string;
    descricao: string;
  }>) => Promise<void>;
  onMoveToComplexClassification?: (transactionIds: string[]) => Promise<void>; // ✅ NOVA PROP
}

export function BatchClassificationModal({
  isOpen,
  onClose,
  unclassifiedTransactions,
  historicTransactions,
  historicCardTransactions = [],
  onApplyBatch,
  onMoveToComplexClassification // ✅ NOVA PROP
}: BatchClassificationModalProps) {
  const { contas, categorias, subtipos, carregarTudo } = useHierarchy();
  
  // Load hierarchy data when modal opens
  useEffect(() => {
    if (isOpen) {
      carregarTudo();
    }
  }, [isOpen, carregarTudo]);
  
  const [batchItems, setBatchItems] = useState<BatchClassificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [showHistoric, setShowHistoric] = useState<Record<string, boolean>>({});
  const [selectedForComplex, setSelectedForComplex] = useState<Set<string>>(new Set()); // ✅ NOVO ESTADO
  
  // ✅ Dynamic hierarchy options
  const availableContas = useMemo(() => {
    return contas.filter(c => c.ativo).map(c => ({
      codigo: c.codigo,
      nome: c.nome,
      icone: c.icone
    }));
  }, [contas]);
  
  const getCategoriesForConta = useCallback((contaCodigo: string) => {
    const selectedConta = contas.find(c => c.codigo === contaCodigo);
    if (!selectedConta) return [];
    
    return categorias
      .filter(c => c.conta_id === selectedConta.id && c.ativo)
      .map(c => ({
        nome: c.nome,
        icone: c.icone
      }));
  }, [contas, categorias]);
  
  const getSubtiposForCategoria = useCallback((contaCodigo: string, categoriaNome: string) => {
    const selectedConta = contas.find(c => c.codigo === contaCodigo);
    const selectedCategoria = categorias.find(c => 
      c.conta_id === selectedConta?.id && c.nome === categoriaNome
    );
    
    if (!selectedCategoria) return [];
    
    return subtipos
      .filter(s => s.categoria_id === selectedCategoria.id && s.ativo)
      .map(s => s.nome);
  }, [contas, categorias, subtipos]);
  
  const findSubtipoId = useCallback((contaCodigo: string, categoriaNome: string, subtipoNome: string) => {
    const selectedConta = contas.find(c => c.codigo === contaCodigo);
    const selectedCategoria = categorias.find(c => 
      c.conta_id === selectedConta?.id && c.nome === categoriaNome
    );
    const selectedSubtipo = subtipos.find(s => 
      s.categoria_id === selectedCategoria?.id && s.nome === subtipoNome
    );
    
    return selectedSubtipo?.id;
  }, [contas, categorias, subtipos]);

  // Preparar dados quando modal abre
  useEffect(() => {
    if (isOpen && unclassifiedTransactions.length > 0) {
      console.log('📄 Preparando classificação em lote...');
      const prepared = prepareBatchClassification(
        unclassifiedTransactions, 
        historicTransactions,
        historicCardTransactions
      );
      setBatchItems(prepared);
      setCurrentIndex(0);
      setErrors([]);
      setShowHistoric({});
      setSelectedForComplex(new Set()); // ✅ RESETAR SELEÇÃO
    }
  }, [isOpen, unclassifiedTransactions, historicTransactions, historicCardTransactions]);

  // Detectar tipo de transação
  const isCardTransaction = (item: Transaction | CardTransaction): item is CardTransaction => {
    return 'fatura_id' in item;
  };

  // ✅ NOVA FUNÇÃO: Toggle seleção para classificação complexa
  const toggleComplexSelection = (transactionId: string) => {
    const newSelected = new Set(selectedForComplex);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedForComplex(newSelected);
  };

  // ✅ NOVA FUNÇÃO: Selecionar todas para complexa
  const selectAllForComplex = () => {
    if (selectedForComplex.size === batchItems.length) {
      setSelectedForComplex(new Set());
    } else {
      setSelectedForComplex(new Set(batchItems.map(item => item.id)));
    }
  };

  // ✅ NOVA FUNÇÃO: Enviar selecionadas para classificação complexa
  const handleMoveToComplex = async () => {
    if (!onMoveToComplexClassification || selectedForComplex.size === 0) {
      alert('⚠️ Selecione pelo menos uma transação para mover');
      return;
    }

    const confirmMove = window.confirm(
      `🧩 Mover ${selectedForComplex.size} transação${selectedForComplex.size !== 1 ? 'ões' : ''} para Classificação Complexa?\n\n` +
      `Estas transações ficarão disponíveis na aba "🧩 Classificação Complexa" para processamento avançado.`
    );

    if (!confirmMove) return;

    setLoading(true);
    try {
      await onMoveToComplexClassification(Array.from(selectedForComplex));
      
      alert(`✅ ${selectedForComplex.size} transação${selectedForComplex.size !== 1 ? 'ões' : ''} movida${selectedForComplex.size !== 1 ? 's' : ''} para Classificação Complexa!`);
      
      onClose();
    } catch (error) {
      console.error('❌ Erro ao mover para classificação complexa:', error);
      alert('❌ Erro ao mover transações');
    } finally {
      setLoading(false);
    }
  };

  // Limpar classificação
  const clearCurrentClassification = () => {
    setBatchItems(prev => prev.map((item, index) => 
      index === currentIndex 
        ? {
            ...item,
            selectedSubtipoId: '',
            selectedDescricao: item.transaction.descricao_origem || 'Sem descrição',
            // Campos legados temporários
            selectedConta: '',
            selectedCategoria: '',
            selectedSubtipo: ''
          }
        : item
    ));
    
    setErrors([]);
    console.log('🗑️ Classificação limpa para transação', currentIndex + 1);
  };

  // Obter descrições históricas para subtipo específico
  const getHistoricDescriptions = (subtipo_id: string): string[] => {
    const historicDescriptions = historicTransactions
      .filter(t => 
        t.subtipo_id === subtipo_id &&
        t.descricao && 
        t.descricao !== t.descricao_origem &&
        t.realizado === 's'
      )
      .map(t => t.descricao)
      .filter((desc, index, arr) => arr.indexOf(desc) === index)
      .slice(0, 5);

    return historicDescriptions;
  };

  // Atualizar item específico
  const updateItem = (index: number, field: keyof BatchClassificationItem, value: any) => {
    setBatchItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      if (field === 'selectedSubtipoId') {
        // Reset description when classification changes
        updated[index].selectedDescricao = '';
      }
      
      return updated;
    });
  };

  // Aplicar item do histórico
  const applyHistoricItem = (index: number, historicItem: HistoricItem) => {
    setBatchItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        selectedSubtipoId: historicItem.subtipo_id,
        selectedDescricao: historicItem.descricao,
        // Campos legados para compatibilidade temporária
        selectedConta: 'PF', // TODO: Derivar do subtipo_id
        selectedCategoria: 'Temp', // TODO: Derivar do subtipo_id  
        selectedSubtipo: 'Temp' // TODO: Derivar do subtipo_id
      };
      return updated;
    });
    
    // Fechar lista após seleção
    setShowHistoric(prev => ({
      ...prev,
      [currentIndex]: false
    }));
  };

  // Toggle lista do histórico
  const toggleHistoric = (index: number) => {
    setShowHistoric(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Aplicar classificação para todos
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
      selectedSubtipo: current.selectedSubtipo,
      selectedDescricao: current.selectedDescricao
    })));
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

  // Validação
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
      const hasAllRequiredFields = item.selectedConta && item.selectedCategoria && item.selectedSubtipo && item.selectedDescricao;
      
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

    const classified = validation.valid.filter(item => item.selectedConta && item.selectedCategoria && item.selectedSubtipo && item.selectedDescricao);
    const unclassified = validation.valid.filter(item => !item.selectedConta || !item.selectedCategoria || !item.selectedSubtipo || !item.selectedDescricao);
    
    if (classified.length === 0 && unclassified.length > 0) {
      const confirm = window.confirm(
        `⚠️ Todas as ${unclassified.length} transações ficarão não classificadas. Tem certeza?`
      );
      if (!confirm) return;
    }

    const classifications = classified.map(item => ({
      id: item.id,
      subtipo_id: findSubtipoId(item.selectedConta!, item.selectedCategoria!, item.selectedSubtipo!)!,
      descricao: item.selectedDescricao!
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
    classified: batchItems.filter(item => item.selectedConta && item.selectedCategoria && item.selectedSubtipo && item.selectedDescricao).length,
    unclassified: batchItems.filter(item => !item.selectedConta || !item.selectedCategoria || !item.selectedSubtipo || !item.selectedDescricao).length,
    withSimilar: batchItems.filter(item => item.historicSimilar && item.historicSimilar.length > 0).length,
    selectedForComplex: selectedForComplex.size // ✅ NOVO
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

          {/* Navegação - logo abaixo do título */}
          {batchItems.length > 1 && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className="py-2.5 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
              >
                ← Anterior
              </button>
              
              <button
                onClick={goToNext}
                disabled={currentIndex === batchItems.length - 1}
                className="py-2.5 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Próxima →
              </button>
            </div>
          )}

          {/* ✅ NOVA SEÇÃO: Seleção para Classificação Complexa */}
          {onMoveToComplexClassification && (
            <div className="mb-4 bg-orange-900/30 border border-orange-700 rounded-lg p-3">
              {/* Linha 1: Título compacto */}
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-orange-100 flex items-center gap-1 text-sm">
                  <span>🧩</span>
                  <span className="hidden sm:inline">Classificação</span>
                  <span className="sm:hidden">Complex</span>
                  {selectedForComplex.size > 0 && (
                    <span className="bg-orange-700 text-orange-200 px-1.5 py-0.5 rounded-full text-xs ml-1">
                      {selectedForComplex.size}
                    </span>
                  )}
                </h4>
                <button
                  onClick={handleMoveToComplex}
                  disabled={loading || selectedForComplex.size === 0}
                  className="px-2 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded text-xs transition-colors"
                >
                  {loading ? '⏳' : '🧩'} Mover
                </button>
              </div>
              
              {/* Linha 2: Botão de seleção (só quando há itens) */}
              {batchItems.length > 0 && (
                <button
                  onClick={selectAllForComplex}
                  className="w-full px-2 py-1 bg-orange-600/50 hover:bg-orange-600/70 text-orange-100 rounded text-xs transition-colors"
                >
                  {selectedForComplex.size === batchItems.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              )}
            </div>
          )}

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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-blue-100">
                    📋 Transação {currentIndex + 1}/{batchItems.length}
                    {isCardTransaction(currentItem.transaction) && (
                      <span className="ml-2 text-xs bg-purple-700 text-purple-200 px-2 py-1 rounded">
                        {currentItem.transaction.fatura_id}
                      </span>
                    )}
                  </h4>
                  
                  {/* ✅ NOVO: Checkbox para classificação complexa na transação atual */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-orange-300 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedForComplex.has(currentItem.id)}
                        onChange={() => toggleComplexSelection(currentItem.id)}
                        className="w-4 h-4 rounded border-orange-500 bg-orange-900 text-orange-600"
                      />
                      🧩 Complexa
                    </label>
                  </div>
                </div>
                
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
                    <label className="text-blue-300">Descrição Original:</label>
                    <p className="text-blue-100 break-words font-medium">
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

              {/* Lista de Histórico Similar */}
              {currentItem.historicSimilar && currentItem.historicSimilar.length > 0 && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4 border border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-100 flex items-center gap-2">
                      <span>📚</span>
                      Histórico Similar ({currentItem.historicSimilar.length})
                      {currentItem.historicSimilar[0] && (
                        <span className="text-xs bg-green-700 text-green-200 px-2 py-1 rounded">
                          Melhor: {Math.round(currentItem.historicSimilar[0].similarity * 100)}%
                        </span>
                      )}
                    </h4>
                    <button
                      onClick={() => toggleHistoric(currentIndex)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      {showHistoric[currentIndex] ? '▼ Ocultar' : '▶ Mostrar'} Lista
                    </button>
                  </div>
                  
                  {showHistoric[currentIndex] && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {currentItem.historicSimilar.map((item, idx) => (
                        <div
                          key={`${item.id}-${idx}`}
                          className="border border-gray-600 rounded-lg p-3 hover:bg-gray-600 cursor-pointer transition-colors"
                          onClick={() => applyHistoricItem(currentIndex, item)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.similarity > 0.8 ? 'bg-green-700 text-green-200' :
                                item.similarity > 0.6 ? 'bg-yellow-700 text-yellow-200' :
                                'bg-gray-700 text-gray-300'
                              }`}>
                                {Math.round(item.similarity * 100)}%
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                item.type === 'transaction' ? 'bg-blue-600 text-blue-100' : 'bg-purple-600 text-purple-100'
                              }`}>
                                {item.type === 'transaction' ? '🏦 Bancária' : '💳 Cartão'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-medium ${item.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                R$ {formatCurrency(Math.abs(item.valor))}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-sm">
                            <p className="text-gray-200 font-medium mb-1">"{item.descricao_origem}"</p>
                            <div className="text-xs text-gray-400 grid grid-cols-2 gap-2">
                              <div>
                                <span>📋 Classificação:</span>
                                <span className="text-blue-300 ml-1">Classificado</span>
                              </div>
                              <div>
                                <span>📝 Descrição:</span>
                                <span className="text-green-300 ml-1">"{item.descricao}"</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(item.data)} • {item.origem}
                            </div>
                          </div>
                          
                          <div className="mt-2 text-center">
                            <span className="text-xs text-blue-400">👆 Clique para aplicar esta classificação</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                      {currentItem.selectedConta} → {currentItem.selectedCategoria} → {currentItem.selectedSubtipo}
                      {currentItem.selectedDescricao && ` → "${currentItem.selectedDescricao}"`}
                    </span>
                  </div>
                </div>
              )}

              {/* Formulário de Classificação */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <button
                    onClick={clearCurrentClassification}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors flex items-center gap-2"
                  >
                    🗑️ Limpar
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Conta</label>
                    <select
                      value={currentItem.selectedConta || ''}
                      onChange={(e) => updateItem(currentIndex, 'selectedConta', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {availableContas.map((conta) => (
                        <option key={conta.codigo} value={conta.codigo}>
                          {conta.icone} {conta.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Categoria</label>
                    <select
                      value={currentItem.selectedCategoria || ''}
                      onChange={(e) => updateItem(currentIndex, 'selectedCategoria', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                      disabled={!currentItem.selectedConta}
                    >
                      <option value="">Selecione...</option>
                      {currentItem.selectedConta && getCategoriesForConta(currentItem.selectedConta).map(categoria => (
                        <option key={categoria.nome} value={categoria.nome}>
                          {categoria.icone} {categoria.nome}
                        </option>
                      ))}
                    </select>
                  </div>

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
                       getSubtiposForCategoria(currentItem.selectedConta, currentItem.selectedCategoria).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Descrição *</label>
                  
                  {currentItem.selectedConta && currentItem.selectedCategoria && currentItem.selectedSubtipo && (
                    <div className="mb-2 bg-blue-900/20 border border-blue-700 rounded-lg p-2">
                      <p className="text-xs text-blue-300 mb-2">🔍 Sugestões:</p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => updateItem(currentIndex, 'selectedDescricao', currentItem.transaction.descricao_origem)}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs transition-colors"
                        >
                          📋 Original
                        </button>
                        
                        {currentItem.selectedConta && currentItem.selectedCategoria && currentItem.selectedSubtipo && 
                         getHistoricDescriptions(
                          findSubtipoId(currentItem.selectedConta, currentItem.selectedCategoria, currentItem.selectedSubtipo) || ''
                        ).slice(0, 3).map(desc => (
                          <button
                            key={desc}
                            type="button"
                            onClick={() => updateItem(currentIndex, 'selectedDescricao', desc)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors"
                          >
                            💡 {desc.length > 12 ? desc.substring(0, 12) + '...' : desc}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
                  onClick={() => {
                    const confirmApply = window.confirm(
                      `⚠️ Tem certeza que deseja aplicar esta classificação para TODAS as ${batchItems.length} transações?\n\n` +
                      `Esta ação irá sobrescrever todas as classificações existentes neste lote.`
                    );
                    if (confirmApply) {
                      applyToSelected();
                    }
                  }}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                  disabled={!currentItem.selectedConta || !currentItem.selectedCategoria || !currentItem.selectedSubtipo || !currentItem.selectedDescricao}
                >
                  🎯 Aplicar a Todas
                </button>
              </div>

            </>
          )}

          {/* Resumo */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-gray-100 mb-2">📊 Resumo</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <p className="text-green-400 text-lg font-bold">{classificationSummary.classified}</p>
                <p className="text-gray-300">Classificadas</p>
              </div>
              <div className="text-center">
                <p className="text-yellow-400 text-lg font-bold">{classificationSummary.unclassified}</p>
                <p className="text-gray-300">Não Classificadas</p>
              </div>
              <div className="text-center">
                <p className="text-blue-400 text-lg font-bold">{classificationSummary.withSimilar}</p>
                <p className="text-gray-300">Com Histórico</p>
              </div>
              {/* ✅ NOVA COLUNA */}
              <div className="text-center">
                <p className="text-orange-400 text-lg font-bold">{classificationSummary.selectedForComplex}</p>
                <p className="text-gray-300">Para Complexa</p>
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
        </div>
      </div>
    </div>
  );
}