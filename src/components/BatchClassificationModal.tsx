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
  const { contas, categorias, subtipos, carregarTudo, visaoPlana } = useHierarchy();
  
  // Load hierarchy data when modal opens (only if not loaded)
  useEffect(() => {
    if (isOpen && (contas.length === 0 || categorias.length === 0 || subtipos.length === 0)) {
      carregarTudo();
    }
  }, [isOpen, contas.length, categorias.length, subtipos.length, carregarTudo]);
  
  const [batchItems, setBatchItems] = useState<BatchClassificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [showHistoric, setShowHistoric] = useState<Record<string, boolean>>({});
  const [selectedForComplex, setSelectedForComplex] = useState<Set<string>>(new Set()); // ✅ NOVO ESTADO
  const [preparingBatch, setPreparingBatch] = useState(false); // ✅ NOVO: Estado de preparação
  const [searchSubtipo, setSearchSubtipo] = useState(''); // Busca rápida de subtipo
  
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

  // Busca rápida: todos os subtipos ativos com caminho completo
  const allSearchSubtipos = useMemo(() => {
    return subtipos
      .filter(s => s.ativo)
      .map(s => {
        const categoria = categorias.find(c => c.id === s.categoria_id);
        const conta = categoria ? contas.find(c => c.id === categoria.conta_id) : null;
        return {
          id: s.id,
          nome: s.nome,
          categoria_nome: categoria?.nome || '',
          conta_codigo: conta?.codigo || '',
          conta_nome: conta?.nome || '',
          caminho_completo: `${conta?.codigo || ''} > ${categoria?.nome || ''} > ${s.nome}`
        };
      });
  }, [contas, categorias, subtipos]);

  // Filtrar subtipos baseado na busca
  const filteredSearchSubtipos = useMemo(() => {
    if (!searchSubtipo.trim()) return [];
    const search = searchSubtipo.toLowerCase().trim();
    return allSearchSubtipos
      .filter(s =>
        s.nome.toLowerCase().includes(search) ||
        s.categoria_nome.toLowerCase().includes(search) ||
        s.conta_nome.toLowerCase().includes(search)
      )
      .slice(0, 8);
  }, [allSearchSubtipos, searchSubtipo]);

  // Aplicar subtipo selecionado da busca rápida no item atual
  const handleSearchSubtipoSelect = (subtipo: typeof allSearchSubtipos[0]) => {
    setBatchItems(prev => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        selectedConta: subtipo.conta_codigo,
        selectedCategoria: subtipo.categoria_nome,
        selectedSubtipo: subtipo.nome,
        selectedSubtipoId: subtipo.id,
        selectedDescricao: updated[currentIndex].selectedDescricao || updated[currentIndex].transaction.descricao_origem || ''
      };
      return updated;
    });
    setSearchSubtipo('');
  };

  // Preparar dados quando modal abre
  useEffect(() => {
    if (isOpen && unclassifiedTransactions.length > 0) {
      const prepareBatch = async () => {
        setPreparingBatch(true);
        try {
          // ✅ Simular delay para mostrar loading em lotes grandes
          if (unclassifiedTransactions.length > 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const prepared = prepareBatchClassification(
            unclassifiedTransactions, 
            historicTransactions,
            historicCardTransactions
          );
          setBatchItems(prepared);
          setCurrentIndex(0);
          setErrors([]);
          setShowHistoric({});
          setSelectedForComplex(new Set());
        } finally {
          setPreparingBatch(false);
        }
      };
      
      prepareBatch();
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
    // ✅ Log removido para melhor performance
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
      
      // Buscar informações da hierarquia baseadas no subtipo_id
      const subtipoInfo = visaoPlana?.find(v => v.subtipo_id === historicItem.subtipo_id);
      
      
      updated[index] = {
        ...updated[index],
        selectedSubtipoId: historicItem.subtipo_id,
        selectedDescricao: historicItem.descricao,
        // Derivar campos da hierarquia - usar códigos para compatibilidade com dropdowns
        selectedConta: subtipoInfo?.conta_codigo || 'PF',
        selectedCategoria: subtipoInfo?.categoria_nome || 'Sem categoria',  
        selectedSubtipo: subtipoInfo?.subtipo_nome || 'Sem subtipo'
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
      setSearchSubtipo('');
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSearchSubtipo('');
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

  // ✅ TELA DE LOADING durante preparação
  if (preparingBatch) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-100 mb-2">⚡ Preparando Classificação em Lote</h3>
          <p className="text-sm text-gray-400 mb-1">
            Analisando {unclassifiedTransactions.length} transações...
          </p>
          <p className="text-xs text-gray-500">
            {unclassifiedTransactions.length > 20 
              ? "Processando lote grande - isso pode demorar alguns segundos" 
              : "Buscando transações similares no histórico"
            }
          </p>
          <div className="mt-4 bg-gray-700 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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

          {/* Navegação + Progress Bar */}
          {batchItems.length > 1 && (
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-3 mb-3">
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
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-lg hover:shadow-blue-500/25 hover:scale-105 active:scale-95 relative overflow-hidden"
                >
                  <span className="relative z-10">Próxima →</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              </div>
              {/* Progress Bar numa linha compacta */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{currentIndex + 1}/{batchItems.length}</span>
                <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
              </div>
            </div>
          )}

          {/* ✅ NOVA SEÇÃO: Seleção para Classificação Complexa */}
          {onMoveToComplexClassification && (
            <div className="mb-3 bg-orange-900/20 border border-orange-600/50 rounded-md p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-orange-100 text-xs">🧩 Complexa</span>
                  {selectedForComplex.size > 0 && (
                    <span className="bg-orange-700 text-orange-200 px-1.5 py-0.5 rounded-full text-xs">
                      {selectedForComplex.size}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {batchItems.length > 0 && (
                    <button
                      onClick={selectAllForComplex}
                      className="px-2 py-1 bg-orange-600/50 hover:bg-orange-600/70 text-orange-100 rounded text-xs transition-colors"
                    >
                      {selectedForComplex.size === batchItems.length ? 'Desmarcar' : 'Selecionar'}
                    </button>
                  )}
                  <button
                    onClick={handleMoveToComplex}
                    disabled={loading || selectedForComplex.size === 0}
                    className="px-2 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded text-xs transition-colors"
                  >
                    {loading ? '⏳' : 'Mover'}
                  </button>
                </div>
              </div>
            </div>
          )}


          {currentItem && (
            <>
              {/* Transação Atual */}
              <div className="bg-blue-900/30 border border-blue-600/50 rounded-md p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-blue-100 text-sm font-medium">📋</span>
                    <span className="text-blue-300">{currentItem.transaction.origem}</span>
                    <span className="text-blue-300">•</span>
                    <span className="text-blue-300">{currentItem.transaction.cc}</span>
                    {isCardTransaction(currentItem.transaction) && (
                      <span className="bg-purple-700 text-purple-200 px-2 py-1 rounded">
                        {currentItem.transaction.fatura_id}
                      </span>
                    )}
                  </div>
                  
                  {/* ✅ NOVO: Checkbox para classificação complexa na transação atual */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-orange-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedForComplex.has(currentItem.id)}
                        onChange={() => toggleComplexSelection(currentItem.id)}
                        className="w-4 h-4 rounded border-orange-500 bg-orange-900 text-orange-600"
                      />
                      <span className="text-sm">🧩</span>
                    </label>
                  </div>
                </div>
                
                <div className="text-xs space-y-1">
                  {/* Data | Descrição | Valor */}
                  <div className="flex items-start gap-3">
                    <span className="text-blue-100 whitespace-nowrap">
                      {formatDate(
                        isCardTransaction(currentItem.transaction)
                          ? currentItem.transaction.data_transacao
                          : currentItem.transaction.data
                      )}
                    </span>
                    <p className="text-blue-100 font-medium break-words line-clamp-2 flex-1 leading-tight">
                      {currentItem.transaction.descricao_origem}
                    </p>
                    <span className={`font-bold whitespace-nowrap ${currentItem.transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {currentItem.transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(currentItem.transaction.valor))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de Histórico Similar */}
              {currentItem.historicSimilar && currentItem.historicSimilar.length > 0 && (
                <div className="rounded-lg p-4 mb-4 border border-yellow-500/40" style={{ background: 'linear-gradient(135deg, #44370a 0%, #2a2518 30%, #1a1a2e 70%, #c0c0c0 150%)' }}>
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors p-2 -m-2 rounded"
                    onClick={() => toggleHistoric(currentIndex)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-200 text-sm">✨ Histórico Similar</span>
                      <span className="text-yellow-300/70 text-xs">({currentItem.historicSimilar.length})</span>
                    </div>
                    <div className="text-yellow-300/80 text-xs">
                      {showHistoric[currentIndex] ? '▼' : '▶'}
                    </div>
                  </div>
                  
                  {showHistoric[currentIndex] && (
                    <div className="space-y-2 max-h-72 overflow-y-auto mt-3">
                      {currentItem.historicSimilar.map((item, idx) => (
                        <div
                          key={`${item.id}-${idx}`}
                          className={`border rounded-lg px-3 py-2.5 cursor-pointer transition-colors active:opacity-80 ${
                            item.similarity > 0.8 ? 'bg-green-900/40 border-green-600/50 hover:bg-green-900/60' :
                            item.similarity > 0.6 ? 'bg-yellow-900/30 border-yellow-600/50 hover:bg-yellow-900/50' :
                            item.similarity > 0.4 ? 'bg-orange-900/25 border-orange-600/50 hover:bg-orange-900/45' :
                            'bg-red-900/20 border-red-600/50 hover:bg-red-900/40'
                          }`}
                          onClick={() => applyHistoricItem(currentIndex, item)}
                        >
                          {/* Linha 1: Descrição original + Valor */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-gray-200 text-sm font-medium line-clamp-1 flex-1 leading-tight">
                              {item.descricao_origem}
                            </p>
                            <span className={`font-bold text-sm whitespace-nowrap ${item.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {item.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(item.valor))}
                            </span>
                          </div>

                          {/* Linha 2: Descrição classificada + Hierarquia */}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-yellow-400 text-xs line-clamp-1 flex-1 leading-tight">
                              → {item.descricao}
                            </p>
                            {(() => {
                              const hierarchyInfo = visaoPlana?.find(v => v.subtipo_id === item.subtipo_id);
                              return hierarchyInfo ? (
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {hierarchyInfo.conta_nome} › <span className="text-yellow-400 font-medium">{hierarchyInfo.subtipo_nome}</span>
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Status da classificação atual */}
              {!currentItem.selectedCategoria ? (
                <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-md p-2 mb-2">
                  <div className="text-yellow-200 text-xs">
                    ⚠️ Lançamento será salvo como <strong>não classificado</strong>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-900/20 border border-blue-600/50 rounded-md p-2 mb-2">
                  <div className="text-blue-200 text-xs truncate">
                    📋 {currentItem.selectedConta} → {currentItem.selectedCategoria} → {currentItem.selectedSubtipo}
                    {currentItem.selectedDescricao && ` → "${currentItem.selectedDescricao}"`}
                  </div>
                </div>
              )}

              {/* Formulário de Classificação */}
              <div className="space-y-4 mb-6">

                {/* Busca rápida de subtipo */}
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    📋 Classificação
                  </h4>
                  <div className="flex-1 max-w-xs relative">
                    <input
                      type="text"
                      value={searchSubtipo}
                      onChange={(e) => setSearchSubtipo(e.target.value)}
                      placeholder="Buscar subtipo..."
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    {filteredSearchSubtipos.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                        {filteredSearchSubtipos.map((subtipo) => (
                          <button
                            key={subtipo.id}
                            onClick={() => handleSearchSubtipoSelect(subtipo)}
                            className="w-full text-left p-3 hover:bg-gray-600 transition-colors border-b border-gray-600 last:border-b-0"
                          >
                            <div className="text-sm text-gray-100 font-medium">
                              {subtipo.nome}
                            </div>
                            <div className="text-xs text-gray-400">
                              {subtipo.caminho_completo}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
              <div className="flex justify-between gap-2 mb-6">
                <button
                  onClick={clearCurrentClassification}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
                >
                  🗑️ Limpar
                </button>
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
                `✅ ${classificationSummary.classified} • ⏳ ${classificationSummary.unclassified}`
              }
            </button>
          </div>

          {/* Dicas */}
        </div>
      </div>
    </div>
  );
}