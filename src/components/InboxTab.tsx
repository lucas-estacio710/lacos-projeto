// components/InboxTab.tsx - VERSÃO COMPLETA COM FILTROS DE RECONCILIAÇÃO

import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction, countsInBalance } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { EnhancedUnclassifiedSection } from '@/components/EnhancedUnclassifiedSection';
import { BatchClassificationModal } from '@/components/BatchClassificationModal';

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
  canReconcile
}: InboxTabProps) {
  const [viewMode, setViewMode] = useState<'all' | 'transactions' | 'cards'>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('todos');
  const [showTips, setShowTips] = useState(false);

  // Função adaptadora para o EnhancedUnclassifiedSection
  const handleBatchClassification = async (transactions: {
    selectedIds: string[];
    conta: string;
    categoria: string;
    subtipo: string;
  }) => {
    // Converter do formato do EnhancedUnclassifiedSection para o formato esperado pelo InboxTab
    const classifications = transactions.selectedIds.map(id => ({
      id,
      subtipo_id: transactions.subtipo, // Assumindo que subtipo é o subtipo_id
      descricao: '' // Adicionar descrição se necessário
    }));
    
    await onApplyBatchClassification(classifications);
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