// components/UltimosLancamentosModal.tsx - Modal de Últimos Lançamentos

import React, { useState, useMemo } from 'react';
import { X, RefreshCw, Undo2, Trash2, Check } from 'lucide-react';
import { useUltimosLancamentos, UltimoLancamento } from '@/hooks/useUltimosLancamentos';
import { formatCurrency } from '@/lib/utils';

interface UltimosLancamentosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterType = 'todos' | 'bancos' | 'cartoes';
type ConfirmAction = { id: string; tipo: string; action: 'revert' | 'delete' } | null;

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHour < 24) return `há ${diffHour}h`;
  if (diffDay < 7) return `há ${diffDay}d`;
  return date.toLocaleDateString('pt-BR');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getStatusBadge(item: UltimoLancamento) {
  if (item.tipo === 'transaction') {
    switch (item.status) {
      case 's':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/50 text-green-300 border border-green-700">Realizado</span>;
      case 'p':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700">Pendente</span>;
      case 'r':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-300 border border-blue-700">Reconciliado</span>;
    }
  } else {
    switch (item.status) {
      case 'classified':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/50 text-green-300 border border-green-700">Classificado</span>;
      case 'pending':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700">Pendente</span>;
      case 'reconciled':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-300 border border-blue-700">Reconciliado</span>;
    }
  }
  return null;
}

function isPending(item: UltimoLancamento): boolean {
  if (item.tipo === 'transaction') return item.status === 'p';
  return item.status === 'pending';
}

export function UltimosLancamentosModal({ isOpen, onClose }: UltimosLancamentosModalProps) {
  const { items, loading, error, refresh, revertToPending, deleteItem } = useUltimosLancamentos();
  const [filter, setFilter] = useState<FilterType>('todos');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const filteredItems = useMemo(() => {
    if (filter === 'bancos') return items.filter(i => i.tipo === 'transaction');
    if (filter === 'cartoes') return items.filter(i => i.tipo === 'card');
    return items;
  }, [items, filter]);

  const counts = useMemo(() => ({
    todos: items.length,
    bancos: items.filter(i => i.tipo === 'transaction').length,
    cartoes: items.filter(i => i.tipo === 'card').length,
  }), [items]);

  const handleConfirm = async (item: UltimoLancamento) => {
    if (!confirmAction) return;
    try {
      setProcessingId(item.id);
      if (confirmAction.action === 'revert') {
        await revertToPending(item);
      } else {
        await deleteItem(item);
      }
    } catch {
      // erro já logado no hook
    } finally {
      setProcessingId(null);
      setConfirmAction(null);
    }
  };

  const isConfirming = (item: UltimoLancamento, action: 'revert' | 'delete') =>
    confirmAction?.id === item.id && confirmAction?.tipo === item.tipo && confirmAction?.action === action;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg border border-cyan-600 max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕐</span>
            <h2 className="text-xl font-bold text-white">Últimos Lançamentos</h2>
            <span className="text-xs text-gray-400">
              ({filteredItems.length} itens)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filter selector */}
        <div className="flex gap-1 px-4 pt-3 pb-1">
          <button
            onClick={() => setFilter('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'todos'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Todos ({counts.todos})
          </button>
          <button
            onClick={() => setFilter('bancos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'bancos'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            🏦 Bancos ({counts.bancos})
          </button>
          <button
            onClick={() => setFilter('cartoes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'cartoes'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            💳 Cartões ({counts.cartoes})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-600 rounded-lg text-red-300 text-sm mb-3">
              {error}
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum lançamento encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map(item => {
                const showingConfirm = confirmAction?.id === item.id && confirmAction?.tipo === item.tipo;

                return (
                  <div
                    key={`${item.tipo}-${item.id}`}
                    className={`p-3 bg-gray-800 rounded-lg border transition-colors ${
                      showingConfirm
                        ? confirmAction?.action === 'delete'
                          ? 'border-red-500'
                          : 'border-yellow-500'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {/* Confirmation bar */}
                    {showingConfirm && (
                      <div className={`flex items-center justify-between mb-2 pb-2 border-b ${
                        confirmAction?.action === 'delete' ? 'border-red-800' : 'border-yellow-800'
                      }`}>
                        <span className={`text-xs font-medium ${
                          confirmAction?.action === 'delete' ? 'text-red-300' : 'text-yellow-300'
                        }`}>
                          {confirmAction?.action === 'delete' ? 'Excluir este lançamento?' : 'Voltar para pendente?'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleConfirm(item)}
                            disabled={processingId === item.id}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                              confirmAction?.action === 'delete'
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                            }`}
                          >
                            {processingId === item.id ? '...' : 'Sim'}
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                          >
                            Não
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Row 1: Tipo + Descrição + Valor + Ações */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-base flex-shrink-0" title={item.tipo === 'transaction' ? 'Extrato' : 'Cartão'}>
                          {item.tipo === 'transaction' ? '🏦' : '💳'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-white truncate block" title={item.descricao_origem}>
                            {item.descricao && item.descricao !== item.descricao_origem ? item.descricao : item.descricao_origem}
                          </span>
                          {item.descricao && item.descricao !== item.descricao_origem && (
                            <span className="text-[10px] text-gray-500 truncate block" title={item.descricao_origem}>
                              {item.descricao_origem}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-sm font-mono font-semibold ${
                          item.valor >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(item.valor)}
                        </span>
                        {!isPending(item) && (
                          <button
                            onClick={() => setConfirmAction({ id: item.id, tipo: item.tipo, action: 'revert' })}
                            className="p-1 rounded text-yellow-400 hover:bg-yellow-900/40 hover:text-yellow-300 transition-colors"
                            title="Voltar para Pendente"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmAction({ id: item.id, tipo: item.tipo, action: 'delete' })}
                          className="p-1 rounded text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Data + Hierarquia + Status + Timestamp */}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {formatDate(item.data)}
                        </span>
                        {item.conta_nome && (
                          <span className="text-xs text-cyan-400 truncate" title={`${item.conta_nome} → ${item.categoria_nome} → ${item.subtipo_nome}`}>
                            {item.conta_nome} → {item.categoria_nome} → {item.subtipo_nome}
                          </span>
                        )}
                        {!item.conta_nome && item.subtipo_id && (
                          <span className="text-xs text-gray-500 italic">classificado</span>
                        )}
                        {!item.subtipo_id && (
                          <span className="text-xs text-gray-600 italic">sem classificação</span>
                        )}
                        {getStatusBadge(item)}
                      </div>
                      <span className="text-[10px] text-gray-500 flex-shrink-0" title={new Date(item.updated_at).toLocaleString('pt-BR')}>
                        {formatRelativeTime(item.updated_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
