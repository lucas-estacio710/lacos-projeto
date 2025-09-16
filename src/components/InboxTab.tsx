// components/InboxTab.tsx - VERSÃO COMPLETA COM FILTROS DE RECONCILIAÇÃO

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { Transaction, countsInBalance } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { EnhancedUnclassifiedSection } from '@/components/EnhancedUnclassifiedSection';
import { BatchClassificationModal } from '@/components/BatchClassificationModal';
import { useMobileGestureProtection } from '@/hooks/useMobileGestureProtection';
import { useHierarchy } from '@/hooks/useHierarchy';
import { getQuickActionCategories } from '@/lib/smartClassification';

interface InboxTabProps {
  unclassifiedTransactions: Transaction[];
  unclassifiedCards: CardTransaction[];
  historicTransactions: Transaction[];
  historicCardTransactions: CardTransaction[];
  onEditTransaction: (transaction: Transaction) => void;
  onEditCardTransaction: (transaction: CardTransaction) => void;
  onReconcileTransaction: (transaction: Transaction) => void;
  onApplyQuickClassification: (transactionId: string, classification: any) => Promise<void>;
  onApplyBatchClassification: (classifications: Array<{
    id: string;
    subtipo_id: string;
    descricao: string;
  }>) => Promise<void>;
  onMoveToComplexClassification: (transactionId: string) => Promise<void>;
  canReconcile: boolean;
  onUpdateTransaction?: (transaction: Transaction) => Promise<void>;
  onUpdateCardTransaction?: (cardTransaction: CardTransaction) => Promise<void>;
}

export function InboxTab({
  unclassifiedTransactions,
  unclassifiedCards,
  historicTransactions,
  historicCardTransactions,
  onEditTransaction,
  onEditCardTransaction,
  onReconcileTransaction,
  onApplyQuickClassification,
  onApplyBatchClassification,
  onMoveToComplexClassification,
  canReconcile,
  onUpdateTransaction,
  onUpdateCardTransaction
}: InboxTabProps) {
  const [viewMode, setViewMode] = useState<'all' | 'transactions' | 'cards'>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('todos');
  const [showTips, setShowTips] = useState(false);

  // Estados para MassiveChangeSubtipo - sempre ativo
  const [massiveChangeMode, setMassiveChangeMode] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [massiveChangeSubtipo, setMassiveChangeSubtipo] = useState('');
  const [massiveChangeDescricao, setMassiveChangeDescricao] = useState('');
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [individualDescriptions, setIndividualDescriptions] = useState<Record<string, string>>({});

  // Hook da hierarquia para busca de subtipos
  const { contas, categorias, subtipos: hierarchySubtipos, carregarTudo } = useHierarchy();

  // Carregar hierarquia
  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Proteção contra gestos acidentais no mobile
  const { setHasUnsavedChanges, markAsSafe } = useMobileGestureProtection({
    enabled: true,
    confirmMessage: 'Você tem transações não classificadas. Deseja realmente sair da página? Você pode perder seu progresso.'
  });

  // Função adaptadora para o EnhancedUnclassifiedSection
  const handleBatchClassification = async (transactions: {
    selectedIds: string[];
    conta: string;
    categoria: string;
    subtipo: string;
    customDescriptions?: Record<string, string>;
  }) => {
    try {
      // Converter do formato do EnhancedUnclassifiedSection para o formato esperado pelo InboxTab
      const classifications = transactions.selectedIds.map(id => {
        // Encontrar a transação para pegar descricao_origem como fallback
        const transaction = filteredTransactions.find(t => t.id === id) ||
                           filteredCards.find(c => c.id === id);

        return {
          id,
          subtipo_id: transactions.subtipo, // Assumindo que subtipo é o subtipo_id
          descricao: transactions.customDescriptions?.[id] || transaction?.descricao_origem || '' // Usar descrição customizada ou fallback para descricao_origem
        };
      });

      await onApplyBatchClassification(classifications);

      // Se todas as transações foram classificadas, marcar como seguro
      const remainingUnclassified = (filteredUnclassifiedTransactions.length + filteredUnclassifiedCards.length) - transactions.selectedIds.length;
      if (remainingUnclassified === 0) {
        markAsSafe();
      }
    } catch (error) {
      console.error('Erro na classificação:', error);
    }
  };

  // Funções para MassiveChangeSubtipo
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const clearMassiveSelection = () => {
    setSelectedItems(new Set());
    setMassiveChangeSubtipo('');
    setMassiveChangeDescricao('');
    setIndividualDescriptions({});
  };

  const updateIndividualDescription = (itemId: string, description: string) => {
    setIndividualDescriptions(prev => ({
      ...prev,
      [itemId]: description
    }));
  };

  const applyMassiveChange = async () => {
    if (selectedItems.size === 0 || !massiveChangeSubtipo) {
      alert('Selecione itens e um subtipo antes de aplicar');
      return;
    }

    if (!onUpdateTransaction && !onUpdateCardTransaction) {
      alert('Funções de atualização não disponíveis');
      return;
    }

    if (isApplyingChanges) {
      return; // Evitar cliques duplos
    }

    // Buscar o subtipo_id baseado no nome selecionado
    const selectedSubtipoObj = hierarchySubtipos.find(s => s.nome === massiveChangeSubtipo);
    if (!selectedSubtipoObj) {
      alert('Subtipo selecionado não encontrado na hierarquia');
      return;
    }

    const confirmMessage = `Deseja alterar ${selectedItems.size} itens para:\n` +
                          `Subtipo: ${massiveChangeSubtipo}\n` +
                          `Descrição: ${massiveChangeDescricao || '(manter atual)'}`;

    if (!confirm(confirmMessage)) return;

    setIsApplyingChanges(true);

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Processar cada item selecionado (transação ou cartão)
      for (const itemId of selectedItems) {
        try {
          // Verificar se é transação bancária ou de cartão
          const transaction = filteredUnclassifiedTransactions.find(t => t.id === itemId);
          const cardTransaction = filteredUnclassifiedCards.find(c => c.id === itemId);

          if (!transaction && !cardTransaction) {
            errors.push(`Item ${itemId} não encontrado`);
            errorCount++;
            continue;
          }

          // Determinar descrição seguindo a hierarquia
          const finalDescription =
            individualDescriptions[itemId] ||
            massiveChangeDescricao ||
            (transaction?.descricao || cardTransaction?.descricao_classificada || cardTransaction?.descricao_origem) ||
            'Sem descrição';

          if (transaction && onUpdateTransaction) {
            // Atualizar transação bancária
            const updatedTransaction: Transaction = {
              ...transaction,
              subtipo_id: selectedSubtipoObj.id,
              descricao: finalDescription,
              realizado: 's'
            };

            await onUpdateTransaction(updatedTransaction);
            successCount++;

          } else if (cardTransaction && onUpdateCardTransaction) {
            // Atualizar transação de cartão
            const updatedCardTransaction: CardTransaction = {
              ...cardTransaction,
              subtipo_id: selectedSubtipoObj.id,
              descricao_classificada: finalDescription,
              status: 'classified' as const
            };

            await onUpdateCardTransaction(updatedCardTransaction);
            successCount++;
          }

        } catch (error) {
          console.error(`Erro ao atualizar item ${itemId}:`, error);
          errors.push(`Item ${itemId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          errorCount++;
        }
      }

      // Relatório final
      let resultMessage = `✅ Alteração em massa concluída!\n\n`;
      resultMessage += `✅ ${successCount} itens alterados com sucesso\n`;

      if (errorCount > 0) {
        resultMessage += `⚠️ ${errorCount} itens com erro\n\n`;
        resultMessage += `Erros:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          resultMessage += `\n... e mais ${errors.length - 5} erros`;
        }
      }

      alert(resultMessage);

      // Limpar seleção apenas se houve pelo menos uma alteração bem-sucedida
      if (successCount > 0) {
        clearMassiveSelection();
      }

    } catch (error) {
      console.error('Erro geral na alteração em massa:', error);
      alert('Erro ao processar alteração em massa');
    } finally {
      setIsApplyingChanges(false);
    }
  };

  // Função adaptadora para mover para classificação complexa
  const handleMoveToComplexClassification = (transaction: Transaction | CardTransaction) => {
    return onMoveToComplexClassification(transaction.id);
  };

  // ✅ FILTRAR APENAS TRANSAÇÕES QUE NÃO CONTAM NO SALDO (realizado = 'p')
  const filteredUnclassifiedTransactions = unclassifiedTransactions.filter(t => 
    t.realizado === 'p' // Apenas pendentes na caixa de entrada
  );
  
  // ✅ FILTRAR APENAS CARDS PENDENTES
  const filteredUnclassifiedCards = unclassifiedCards.filter(c => 
    c.status === 'pending'
  );

  const totalPending = filteredUnclassifiedTransactions.length + filteredUnclassifiedCards.length;

  // Monitora se há transações não classificadas para ativar a proteção
  useEffect(() => {
    const hasUnclassified = filteredUnclassifiedTransactions.length > 0 || filteredUnclassifiedCards.length > 0;
    setHasUnsavedChanges(hasUnclassified);
  }, [filteredUnclassifiedTransactions.length, filteredUnclassifiedCards.length, setHasUnsavedChanges]);

  // ===== FUNÇÃO PARA OBTER ORIGENS DISPONÍVEIS =====
  const getAvailableOrigins = () => {
    const allOrigins = [
      ...filteredUnclassifiedTransactions.map(t => t.origem),
      ...filteredUnclassifiedCards.map(c => c.origem)
    ];
    
    return [...new Set(allOrigins)].filter(Boolean).sort();
  };

  // ===== FUNÇÕES ATUALIZADAS: Aplicar filtros =====
  const filterBySearch = <T extends { descricao_origem: string }>(items: T[]): T[] => {
    if (!searchTerm.trim()) return items;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return items.filter(item => 
      item.descricao_origem?.toLowerCase().includes(searchLower)
    );
  };

  const filterByOrigin = <T extends { origem: string }>(items: T[]): T[] => {
    if (selectedOrigin === 'todos') return items;
    return items.filter(item => item.origem === selectedOrigin);
  };

  // ===== FUNÇÕES PRINCIPAIS: Aplicar todos os filtros =====
  const getFilteredTransactions = () => {
    return filterByOrigin(filterBySearch(filteredUnclassifiedTransactions));
  };

  const getFilteredCards = () => {
    return filterByOrigin(filterBySearch(filteredUnclassifiedCards));
  };

  // Estatísticas rápidas (agora considerando todos os filtros)
  const filteredTransactions = getFilteredTransactions();
  const filteredCards = getFilteredCards();
  const filteredTotal = filteredTransactions.length + filteredCards.length;

  // ===== CÁLCULO DO SOMATÓRIO DE VALORES =====
  const calculateTotalValue = () => {
    const transactionsValue = filteredTransactions.reduce((sum, t) => sum + Math.abs(t.valor), 0);
    const cardsValue = filteredCards.reduce((sum, c) => sum + Math.abs(c.valor), 0);
    return transactionsValue + cardsValue;
  };

  const totalValue = calculateTotalValue();

  const stats = {
    transactions: filteredTransactions.length,
    cards: filteredCards.length,
    totalValue: totalValue,
    oldestDays: calculateOldestDays(filteredTransactions[0]?.data)
  };

  // Funções auxiliares
  function calculateOldestDays(date?: string): number {
    if (!date) return 0;
    const today = new Date();
    const transactionDate = new Date(date);
    const diffTime = Math.abs(today.getTime() - transactionDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // ===== FUNÇÃO ATUALIZADA: Limpar filtros =====
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedOrigin('todos');
  };

  const availableOrigins = getAvailableOrigins();

  return (
    <div className="space-y-4">

      {/* Contador de Transações/Valor logo após título */}
      <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-yellow-100">{filteredTotal} transações</div>
        <div className="text-lg text-yellow-200">R$ {formatCurrency(totalValue)}</div>
        <div className="text-sm text-yellow-300">Não classificadas</div>
      </div>

      {/* ===== SEÇÃO DE FILTROS - OCULTA SE NÃO HOUVER TRANSAÇÕES ===== */}
      {totalPending > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          {/* Header com botão de classificação em lote */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-100 flex items-center gap-1">
              📬 <span className="hidden sm:inline">Inbox</span>
              {totalPending > 0 && (
                <span className="bg-blue-600 px-1.5 py-0.5 rounded-full text-xs">
                  {totalPending}
                </span>
              )}
            </h3>
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors flex items-center gap-1"
              disabled={filteredTotal === 0}
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Lote</span>
            </button>
          </div>
          
          {/* Campo de busca */}
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-5 h-5 text-gray-400" />
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Buscar por descrição... (ex: 'Posto', 'Supermercado', 'PIX')"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  title="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filtro por origem */}
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm text-gray-400 min-w-[60px]">Origem:</label>
            <select
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 flex-1"
            >
              <option value="todos">Todas as origens</option>
              {availableOrigins.map(origem => (
                <option key={origem} value={origem}>{origem}</option>
              ))}
            </select>
          </div>

          {/* Indicador de proteção mobile ativo */}
          {totalPending > 0 && (
            <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-2 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-amber-400">🛡️</span>
                  <span className="text-amber-200">
                    Proteção ativa - Gestos acidentais bloqueados
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Você tem transações não classificadas. Deseja realmente voltar? Você pode perder seu progresso.')) {
                      markAsSafe();
                      window.history.back();
                    }
                  }}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition-colors"
                  title="Voltar com confirmação"
                >
                  ← Voltar
                </button>
              </div>
              <div className="text-xs text-amber-300 mt-1">
                💡 Dica: Segure na lateral por 500ms para navegar normalmente
              </div>
            </div>
          )}

          {/* Indicador de resultados da busca */}
          {(searchTerm || selectedOrigin !== 'todos') && (
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 mb-3">
              {/* Linha 1: Filtros ativos */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs">
                  {searchTerm && (
                    <span className="bg-blue-900/50 border border-blue-600 px-2 py-1 rounded text-blue-300">
                      🔍 "{searchTerm}"
                    </span>
                  )}
                  {selectedOrigin !== 'todos' && (
                    <span className="bg-green-900/50 border border-green-600 px-2 py-1 rounded text-green-300">
                      🏦 {selectedOrigin}
                    </span>
                  )}
                </div>
                <button
                  onClick={clearFilters}
                  className="text-gray-400 hover:text-red-400 text-xs transition-colors"
                  title="Limpar filtros"
                >
                  ✕
                </button>
              </div>
              
              {/* Linha 2: Estatísticas */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{filteredTotal} de {totalPending} transações</span>
                <span className="font-semibold text-yellow-400">
                  R$ {formatCurrency(totalValue)}
                </span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Botões de Visualização - OCULTOS SE NÃO HOUVER TRANSAÇÕES */}
      {totalPending > 0 && (
        <>
          {/* Contadores - 3 botões na mesma linha */}
          <div className="grid grid-cols-3 gap-3">
            {/* Botão Todos */}
            <button
              onClick={() => setViewMode('all')}
              className={`rounded-lg p-3 text-center transition-all ${
                viewMode === 'all'
                  ? 'bg-green-600 border-2 border-green-400 shadow-lg'
                  : 'bg-green-900/30 border border-green-600 hover:bg-green-800/40'
              }`}
            >
              <div className="w-6 h-6 text-green-400 mx-auto mb-1">📋</div>
              <div className="text-xl font-bold text-green-100">{filteredTotal}</div>
              <div className="text-xs text-green-300">Todos</div>
            </button>
            
            {/* Botão Bancárias */}
            <button
              onClick={() => setViewMode('transactions')}
              className={`rounded-lg p-3 text-center transition-all ${
                viewMode === 'transactions'
                  ? 'bg-blue-600 border-2 border-blue-400 shadow-lg'
                  : 'bg-blue-900/30 border border-blue-600 hover:bg-blue-800/40'
              }`}
            >
              <div className="w-6 h-6 text-blue-400 mx-auto mb-1">🏦</div>
              <div className="text-xl font-bold text-blue-100">{stats.transactions}</div>
              <div className="text-xs text-blue-300">Bancárias</div>
            </button>
            
            {/* Botão Cartões */}
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded-lg p-3 text-center transition-all ${
                viewMode === 'cards'
                  ? 'bg-purple-600 border-2 border-purple-400 shadow-lg'
                  : 'bg-purple-900/30 border border-purple-600 hover:bg-purple-800/40'
              }`}
            >
              <div className="w-6 h-6 text-purple-400 mx-auto mb-1">💳</div>
              <div className="text-xl font-bold text-purple-100">{stats.cards}</div>
              <div className="text-xs text-purple-300">Cartões</div>
            </button>
          </div>
        </>
      )}

      {/* Painel MassiveChangeSubtipo */}
      {filteredTotal > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {selectedItems.size > 0 && (
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-blue-600 text-white rounded text-sm">
                    {selectedItems.size} selecionados
                  </span>
                  {Object.keys(individualDescriptions).length > 0 && (
                    <span className="px-2 py-1 bg-purple-600 text-white rounded text-sm">
                      {Object.keys(individualDescriptions).length} com descrição própria
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedItems.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={clearMassiveSelection}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
                >
                  Limpar Tudo
                </button>
                {Object.keys(individualDescriptions).length > 0 && (
                  <button
                    onClick={() => setIndividualDescriptions({})}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
                  >
                    Limpar Descrições
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Painel de Classificação - só aparece quando há seleções */}
          {selectedItems.size > 0 && (
            <div className="bg-gray-700 p-4 rounded border border-gray-600 space-y-4">
              <h4 className="text-gray-100 font-medium flex items-center gap-2">
                🔧 Classificar {selectedItems.size} itens
              </h4>

              {/* Busca de Subtipo */}
              <div className="space-y-2">
                <label className="block text-sm text-gray-300">Buscar Subtipo:</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Digite para buscar subtipo..."
                    value={massiveChangeSubtipo}
                    onChange={(e) => setMassiveChangeSubtipo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-600 border border-gray-500 rounded text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Dropdown de sugestões de subtipo */}
                {massiveChangeSubtipo && massiveChangeSubtipo.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-gray-600 border border-gray-500 rounded">
                    {(() => {
                      const filteredSubtipos = hierarchySubtipos.filter(s =>
                        s.nome.toLowerCase().includes(massiveChangeSubtipo.toLowerCase())
                      ).slice(0, 8);

                      if (filteredSubtipos.length === 0) {
                        return (
                          <div className="p-2 text-sm text-gray-400">
                            Nenhum subtipo encontrado
                          </div>
                        );
                      }

                      return filteredSubtipos.map(subtipo => {
                        const categoria = categorias.find(c => c.id === subtipo.categoria_id);
                        const conta = contas.find(c => c.id === categoria?.conta_id);

                        return (
                          <button
                            key={subtipo.id}
                            onClick={() => setMassiveChangeSubtipo(subtipo.nome)}
                            className="w-full text-left p-2 hover:bg-gray-500 transition-colors border-b border-gray-500 last:border-b-0"
                          >
                            <div className="text-sm text-gray-200 font-medium">{subtipo.nome}</div>
                            <div className="text-xs text-gray-400">
                              {conta?.nome} → {categoria?.nome}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Botões de Classificação Rápida (como presets) */}
                {massiveChangeSubtipo.length === 0 && (
                  <div className="space-y-2 mt-3">
                    <span className="text-xs text-gray-400">Classificação rápida (presets):</span>
                    <div className="grid grid-cols-3 gap-1">
                      {getQuickActionCategories(contas, categorias, hierarchySubtipos).map(category => (
                        <button
                          key={category.id}
                          onClick={() => setMassiveChangeSubtipo(category.subtipo_nome)}
                          className={`px-2 py-2 ${category.color} text-white rounded text-xs transition-colors hover:scale-105 flex items-center gap-1 justify-center`}
                          title={`${category.title}: ${category.conta_codigo} > ${category.categoria_nome} > ${category.subtipo_nome}`}
                        >
                          <span>{category.label}</span>
                          <span className="text-[10px]">{category.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mostrar hierarquia do subtipo selecionado */}
              {massiveChangeSubtipo && (
                <div className="bg-gray-600 p-3 rounded border border-gray-500">
                  <h5 className="text-sm font-medium text-gray-200 mb-2">Hierarquia:</h5>
                  {(() => {
                    const hierarchyItem = hierarchySubtipos.find(s => s.nome === massiveChangeSubtipo);
                    if (hierarchyItem) {
                      const categoria = categorias.find(c => c.id === hierarchyItem.categoria_id);
                      const conta = contas.find(c => c.id === categoria?.conta_id);

                      return (
                        <div className="text-sm text-gray-300">
                          <span className="text-blue-400">{conta?.nome || 'Conta'}</span>
                          <span className="mx-2">→</span>
                          <span className="text-green-400">{categoria?.nome || 'Categoria'}</span>
                          <span className="mx-2">→</span>
                          <span className="text-yellow-400 font-medium">{massiveChangeSubtipo}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-sm text-gray-400">
                          Subtipo "{massiveChangeSubtipo}" não encontrado na hierarquia
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Campo de Descrição */}
              <div className="space-y-2">
                <label className="block text-sm text-gray-300">Descrição do lote (opcional):</label>
                <input
                  type="text"
                  placeholder="Aplicada a todas, exceto quem tiver descrição individual"
                  value={massiveChangeDescricao}
                  onChange={(e) => setMassiveChangeDescricao(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
                <div className="text-xs text-gray-400">
                  💡 Hierarquia: Individual → Lote → Original
                </div>
              </div>

              {/* Botão Aplicar */}
              <div className="flex justify-end">
                <button
                  onClick={applyMassiveChange}
                  disabled={!massiveChangeSubtipo || isApplyingChanges}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    massiveChangeSubtipo && !isApplyingChanges
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isApplyingChanges ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Aplicando...
                    </span>
                  ) : (
                    'Aplicar Alterações'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista de Não Classificados */}
      {filteredTotal === 0 ? (
        <div className="bg-gradient-to-br from-green-900 to-green-800 p-12 rounded-lg border border-green-700 text-center">
          <div className="text-6xl mb-4">
            {searchTerm || selectedOrigin !== 'todos' ? '🔍' : '🏖️😎'}
          </div>
          <h3 className="text-2xl font-bold text-green-100 mb-2">
            {searchTerm || selectedOrigin !== 'todos'
              ? 'Nenhum resultado encontrado'
              : (
                <>
                  Parabéns!<br />
                  Tudo Classificado!<br />
                  Aproveite seu dia!
                </>
              )
            }
          </h3>
          <p className="text-green-300">
            {searchTerm || selectedOrigin !== 'todos'
              ? 'Tente termos diferentes ou limpe os filtros para ver todas as transações'
              : ''
            }
          </p>
          {(searchTerm || selectedOrigin !== 'todos') ? (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              🔄 Limpar Filtros
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Transações Bancárias */}
          {(viewMode === 'all' || viewMode === 'transactions') && filteredTransactions.length > 0 && (
            <EnhancedUnclassifiedSection
              unclassified={filteredTransactions}
              historicTransactions={historicTransactions}
              historicCardTransactions={historicCardTransactions}
              onEditTransaction={onEditTransaction}
              onReconcileTransaction={onReconcileTransaction}
              onApplyBatchClassification={handleBatchClassification}
              onMoveToComplexClassification={handleMoveToComplexClassification}
              canReconcile={canReconcile}
              type="transactions"
              title="🏦 Transações Bancárias Não Classificadas"
              massiveChangeMode={massiveChangeMode}
              selectedItems={selectedItems}
              onToggleItemSelection={toggleItemSelection}
              individualDescriptions={individualDescriptions}
              onUpdateIndividualDescription={updateIndividualDescription}
            />
          )}

          {/* Transações de Cartão */}
          {(viewMode === 'all' || viewMode === 'cards') && filteredCards.length > 0 && (
            <EnhancedUnclassifiedSection
              unclassified={filteredCards}
              historicTransactions={historicTransactions}
              historicCardTransactions={historicCardTransactions}
              onEditCardTransaction={onEditCardTransaction}
              onApplyBatchClassification={handleBatchClassification}
              onMoveToComplexClassification={handleMoveToComplexClassification}
              type="card_transactions"
              title="💳 Transações de Cartão Não Classificadas"
              massiveChangeMode={massiveChangeMode}
              selectedItems={selectedItems}
              onToggleItemSelection={toggleItemSelection}
              individualDescriptions={individualDescriptions}
              onUpdateIndividualDescription={updateIndividualDescription}
            />
          )}
        </div>
      )}

      {/* Modal de Classificação em Lote */}
      {showBatchModal && (
        <BatchClassificationModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          unclassifiedTransactions={[
            ...(viewMode === 'cards' ? [] : filteredTransactions),
            ...(viewMode === 'transactions' ? [] : filteredCards)
          ]}
          historicTransactions={historicTransactions}
          historicCardTransactions={historicCardTransactions}
          onApplyBatch={onApplyBatchClassification}
          onMoveToComplexClassification={async (transactionIds: string[]) => {
            // Executar para cada transação individualmente
            for (const id of transactionIds) {
              await onMoveToComplexClassification(id);
            }
          }}
        />
      )}

      {/* Dicas e Atalhos - Expansível */}
      <div className="bg-blue-900 border border-blue-700 rounded-lg">
        <button
          onClick={() => setShowTips(!showTips)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-blue-800/50 transition-colors rounded-lg"
        >
          <h4 className="font-medium text-blue-100">💡 Dicas de Produtividade</h4>
          {showTips ? (
            <ChevronUp className="w-5 h-5 text-blue-300" />
          ) : (
            <ChevronDown className="w-5 h-5 text-blue-300" />
          )}
        </button>
        
        {showTips && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-200">
              <div>🔍 Use <kbd className="px-1 py-0.5 bg-blue-800 rounded">busca</kbd> para filtrar por descrição</div>
              <div>🏦 Use <kbd className="px-1 py-0.5 bg-blue-800 rounded">origem</kbd> para filtrar por banco/cartão</div>
              <div>🚀 Use <kbd className="px-1 py-0.5 bg-blue-800 rounded">⚡</kbd> para classificação em lote</div>
              <div>🧩 Use <kbd className="px-1 py-0.5 bg-blue-800 rounded">🧩</kbd> para classificação complexa</div>
              <div>🤖 Clique em IA para sugestões inteligentes</div>
              <div>🔗 Reconcilie pagamentos com faturas</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}