// components/InboxTab.tsx - COM CAMPO DE BUSCA POR DESCRIÇÃO
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Transaction } from '@/types';
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
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => Promise<void>;
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
  canReconcile
}: InboxTabProps) {
  const [viewMode, setViewMode] = useState<'all' | 'transactions' | 'cards'>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'origin'>('date');
  
  // ===== NOVO: Estado para busca =====
  const [searchTerm, setSearchTerm] = useState('');

  const totalPending = unclassifiedTransactions.length + unclassifiedCards.length;

  // ===== NOVA FUNÇÃO: Filtrar por busca =====
  const filterBySearch = <T extends { descricao_origem: string }>(items: T[]): T[] => {
    if (!searchTerm.trim()) return items;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return items.filter(item => 
      item.descricao_origem?.toLowerCase().includes(searchLower)
    );
  };

  // ===== FUNÇÕES ATUALIZADAS: Aplicar filtro de busca =====
  const getFilteredTransactions = () => {
    return filterBySearch(unclassifiedTransactions);
  };

  const getFilteredCards = () => {
    return filterBySearch(unclassifiedCards);
  };

  // Estatísticas rápidas (agora considerando filtro)
  const filteredTransactions = getFilteredTransactions();
  const filteredCards = getFilteredCards();
  const filteredTotal = filteredTransactions.length + filteredCards.length;

  const stats = {
    transactions: filteredTransactions.length,
    cards: filteredCards.length,
    totalValue: [
      ...filteredTransactions,
      ...filteredCards
    ].reduce((sum, t) => sum + Math.abs(t.valor), 0),
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

  function sortTransactions<T extends { valor: number; origem: string }>(
    items: T[],
    sortBy: 'date' | 'value' | 'origin'
  ): T[] {
    const sorted = [...items];
    
    switch (sortBy) {
      case 'date':
        return sorted.sort((a: any, b: any) => {
          const dateA = a.data || a.data_transacao || '';
          const dateB = b.data || b.data_transacao || '';
          return dateB.localeCompare(dateA);
        });
      case 'value':
        return sorted.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
      case 'origin':
        return sorted.sort((a, b) => a.origem.localeCompare(b.origem));
      default:
        return sorted;
    }
  }

  function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // ===== FUNÇÃO ATUALIZADA: Limpar busca =====
  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      {/* Header com Estatísticas */}
      <div className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              📬 Caixa de Entrada
              {totalPending > 0 && (
                <span className="bg-white/20 px-2 py-1 rounded-full text-sm">
                  {totalPending} pendentes
                </span>
              )}
            </h2>
            <p className="text-sm opacity-90 mt-1">
              Classifique suas transações para organizar suas finanças
            </p>
          </div>
          
          {/* Ações Rápidas */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
              disabled={filteredTotal === 0}
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Classificar em Lote</span>
            </button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs opacity-75">Transações</p>
            <p className="text-2xl font-bold">{stats.transactions}</p>
            {searchTerm && (
              <p className="text-xs opacity-75">de {unclassifiedTransactions.length}</p>
            )}
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs opacity-75">Cartões</p>
            <p className="text-2xl font-bold">{stats.cards}</p>
            {searchTerm && (
              <p className="text-xs opacity-75">de {unclassifiedCards.length}</p>
            )}
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs opacity-75">Valor Total</p>
            <p className="text-lg font-bold">R$ {formatCurrency(stats.totalValue)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs opacity-75">Mais Antiga</p>
            <p className="text-lg font-bold">{stats.oldestDays} dias</p>
          </div>
        </div>
      </div>

      {/* ===== NOVA SEÇÃO: Campo de Busca ===== */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
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
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                title="Limpar busca"
              >
                ❌
              </button>
            )}
          </div>
        </div>

        {/* Indicador de resultados da busca */}
        {searchTerm && (
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-300">
              🔍 Buscando por: <span className="font-medium text-blue-400">"{searchTerm}"</span>
            </div>
            <div className="text-gray-400">
              {filteredTotal} de {totalPending} transações
            </div>
          </div>
        )}

        {/* Dica de uso */}
        {!searchTerm && (
          <div className="text-xs text-gray-500 mt-2">
            💡 Dica: Digite palavras-chave como "Posto", "Supermercado", "PIX" para filtrar transações similares e classificar em lote
          </div>
        )}
      </div>

      {/* Filtros e Visualização */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex flex-wrap gap-3">
          {/* Seletor de Visualização */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Todas ({filteredTotal})
            </button>
            <button
              onClick={() => setViewMode('transactions')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'transactions' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Bancárias ({stats.transactions})
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'cards' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Cartões ({stats.cards})
            </button>
          </div>

          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100"
          >
            <option value="date">📅 Mais Recentes</option>
            <option value="value">💰 Maior Valor</option>
            <option value="origin">🏦 Por Origem</option>
          </select>
        </div>
      </div>

      {/* Lista de Não Classificados */}
      {filteredTotal === 0 ? (
        <div className="bg-gradient-to-br from-green-900 to-green-800 p-12 rounded-lg border border-green-700 text-center">
          <div className="text-6xl mb-4">
            {searchTerm ? '🔍' : '🎉'}
          </div>
          <h3 className="text-2xl font-bold text-green-100 mb-2">
            {searchTerm 
              ? `Nenhum resultado para "${searchTerm}"`
              : 'Parabéns! Tudo Classificado!'
            }
          </h3>
          <p className="text-green-300">
            {searchTerm 
              ? 'Tente termos diferentes ou limpe a busca para ver todas as transações'
              : 'Você não tem nenhuma transação pendente de classificação.'
            }
          </p>
          {searchTerm ? (
            <button
              onClick={clearSearch}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              🔄 Limpar Busca
            </button>
          ) : (
            <p className="text-green-400 text-sm mt-4">
              💡 Dica: Importe novos extratos ou faturas para continuar organizando suas finanças.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Transações Bancárias */}
          {(viewMode === 'all' || viewMode === 'transactions') && filteredTransactions.length > 0 && (
            <EnhancedUnclassifiedSection
              transactions={sortTransactions(filteredTransactions, sortBy)}
              historicTransactions={historicTransactions}
              historicCardTransactions={historicCardTransactions}
              onEditTransaction={onEditTransaction}
              onReconcileTransaction={onReconcileTransaction}
              onApplyQuickClassification={onApplyQuickClassification}
              onApplyBatchClassification={onApplyBatchClassification}
              canReconcile={canReconcile}
              type="transactions"
              title="🏦 Transações Bancárias Não Classificadas"
            />
          )}

          {/* Transações de Cartão */}
          {(viewMode === 'all' || viewMode === 'cards') && filteredCards.length > 0 && (
            <EnhancedUnclassifiedSection
              cardTransactions={sortTransactions(filteredCards, sortBy)}
              historicTransactions={historicTransactions}
              historicCardTransactions={historicCardTransactions}
              onEditCardTransaction={onEditCardTransaction}
              onApplyQuickClassification={onApplyQuickClassification}
              onApplyBatchClassification={onApplyBatchClassification}
              type="cards"
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
        />
      )}

      {/* Dicas e Atalhos - Atualizada com dica de busca */}
      <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
        <h4 className="font-medium text-blue-100 mb-2">💡 Dicas de Produtividade</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-200">
          <div>🔍 Use <kbd className="px-1 py-0.5 bg-blue-800 rounded">busca</kbd> para filtrar por descrição</div>
          <div>🚀 Use <kbd className="px-1 py-0.5 bg-blue-800 rounded">⚡</kbd> para classificação em lote</div>
          <div>🤖 Clique em IA para sugestões inteligentes</div>
          <div>🏷️ Botões rápidos para categorias comuns</div>
          <div>🔗 Reconcilie pagamentos com faturas</div>
          <div>💡 Busque "PIX", "Posto", etc. e classifique tudo junto</div>
        </div>
      </div>
    </div>
  );
}