import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { formatCurrency, formatMonth, formatDate } from '@/lib/utils';
import { getCategoriesForAccount } from '@/lib/categories';

interface CartoesTabProps {
  cardTransactions: CardTransaction[];
  onEditCardTransaction: (transaction: CardTransaction) => void;
}

export function CartoesTab({ 
  cardTransactions, 
  onEditCardTransaction
}: CartoesTabProps) {
  const [selectedCartao, setSelectedCartao] = useState('todos');
  const [selectedMes, setSelectedMes] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedSubtypes, setExpandedSubtypes] = useState<Record<string, boolean>>({});

  const toggleCategory = (categoria: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  };

  const toggleSubtype = (key: string) => {
    setExpandedSubtypes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Obter cartões únicos
  const availableCartoes = [...new Set(cardTransactions.map(t => t.origem))]
    .sort();

  // Obter meses únicos das transações
  const availableMonths = [...new Set(cardTransactions.map(t => {
    // Extrair mês da fatura_id (formato: NUBANK_2508)
    const parts = t.fatura_id.split('_');
    return parts[1] || '';
  }))].filter(m => m).sort().reverse();

  // Filtrar transações
  const filteredTransactions = cardTransactions.filter(t => {
    const matchesCartao = selectedCartao === 'todos' || t.origem === selectedCartao;
    
    // Extrair mês da fatura_id para comparação
    const faturaMonth = t.fatura_id.split('_')[1] || '';
    const matchesMes = selectedMes === 'todos' || faturaMonth === selectedMes;
    
    const matchesSearch = !searchTerm || 
      t.descricao_origem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.descricao_classificada?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subtipo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCartao && matchesMes && matchesSearch;
  });

  // Agrupar por categoria (apenas as classificadas)
  const transacoesClassificadas = filteredTransactions.filter(t => t.status === 'classified');

  // ✅ CÁLCULOS CORRIGIDOS: Somar com sinais e depois aplicar Math.abs
  const totalGeral = Math.abs(filteredTransactions.reduce((sum, t) => sum + t.valor, 0));
  const totalClassificado = Math.abs(transacoesClassificadas.reduce((sum, t) => sum + t.valor, 0));
  const totalNaoClassificado = Math.abs(filteredTransactions
    .filter(t => t.status !== 'classified')
    .reduce((sum, t) => sum + t.valor, 0));

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-2">💳 Cartões de Crédito</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="opacity-90">Total das Faturas</p>
            <p className="text-xl font-bold">R$ {formatCurrency(totalGeral)}</p>
          </div>
          <div>
            <p className="opacity-90">Transações</p>
            <p className="text-xl font-bold">{filteredTransactions.length}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 space-y-3">
        {/* Seleção de Cartão */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Cartão:</label>
          <select
            value={selectedCartao}
            onChange={(e) => setSelectedCartao(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
          >
            <option value="todos">Todos os cartões</option>
            {availableCartoes.map(cartao => (
              <option key={cartao} value={cartao}>{cartao}</option>
            ))}
          </select>
        </div>

        {/* Seleção de Mês */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Mês:</label>
          <select
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
          >
            <option value="todos">Todos os meses</option>
            {availableMonths.map(mes => (
              <option key={mes} value={mes}>{formatMonth(mes)}</option>
            ))}
          </select>
        </div>

        {/* Busca */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Buscar:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Descrição, categoria..."
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
          />
        </div>
      </div>

      {/* Resumo de totais */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-green-800 p-3 rounded-lg text-center border border-green-700">
          <p className="text-green-100 text-xs">Classificado</p>
          <p className="text-green-100 font-bold">R$ {formatCurrency(totalClassificado)}</p>
          <p className="text-green-300 text-xs">{transacoesClassificadas.length} itens</p>
        </div>
        <div className="bg-purple-800 p-3 rounded-lg text-center border border-purple-700">
          <p className="text-purple-100 text-xs">Total Geral</p>
          <p className="text-purple-100 font-bold">R$ {formatCurrency(totalGeral)}</p>
          <p className="text-purple-300 text-xs">{filteredTransactions.length} itens</p>
        </div>
      </div>

      {/* Sistema hierárquico por conta */}
      {(['PJ', 'PF', 'CONC.'] as const).map(conta => {
        const transacoesConta = transacoesClassificadas.filter(t => {
          if (!t.categoria) return false;
          const categories = getCategoriesForAccount(conta);
          return Object.keys(categories).includes(t.categoria);
        });

        if (transacoesConta.length === 0) return null;

        // ✅ CORREÇÃO: Calcular total da conta respeitando sinais
        const totalConta = Math.abs(transacoesConta.reduce((sum, t) => sum + t.valor, 0));
        
        const contaLabels: Record<string, { title: string; icon: string; color: string }> = {
          'PJ': { title: 'Gastos PJ', icon: '🏢', color: 'blue' },
          'PF': { title: 'Gastos PF', icon: '👤', color: 'green' },
          'CONC.': { title: 'Gastos CONC.', icon: '🔄', color: 'purple' }
        };

        const label = contaLabels[conta] || contaLabels['PF'];

        // Agrupar hierarquicamente por categoria > subtipo
        const groupedHierarchyConta = transacoesConta.reduce((acc, transaction) => {
          const categoria = transaction.categoria || 'Sem categoria';
          const subtipo = transaction.subtipo || 'Sem subtipo';
          
          if (!acc[categoria]) {
            acc[categoria] = {};
          }
          if (!acc[categoria][subtipo]) {
            acc[categoria][subtipo] = [];
          }
          acc[categoria][subtipo].push(transaction);
          return acc;
        }, {} as Record<string, Record<string, CardTransaction[]>>);

        return (
          <div key={conta} className="space-y-3">
            {/* Header da Conta */}
            <div className={`bg-gradient-to-r ${
              conta === 'PJ' ? 'from-blue-600 to-blue-700' :
              conta === 'PF' ? 'from-green-600 to-green-700' :
              'from-purple-600 to-purple-700'
            } text-white p-4 rounded-lg shadow-lg`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{label.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold">{label.title}</h2>
                    <p className="text-sm opacity-90">{transacoesConta.length} transações</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">R$ {formatCurrency(totalConta)}</p>
                  <p className="text-sm opacity-90">
                    {totalClassificado > 0 ? ((totalConta / totalClassificado) * 100).toFixed(1) : 0}% do total
                  </p>
                </div>
              </div>
            </div>

            {/* Categorias da Conta */}
            {Object.entries(groupedHierarchyConta)
              .sort(([,a], [,b]) => {
                // ✅ CORREÇÃO: Ordenar por valor total respeitando sinais
                const totalA = Math.abs(Object.values(a).flat().reduce((sum, t) => sum + t.valor, 0));
                const totalB = Math.abs(Object.values(b).flat().reduce((sum, t) => sum + t.valor, 0));
                return totalB - totalA;
              })
              .map(([categoria, subtipos]) => {
                const categoriaTransactions = Object.values(subtipos).flat();
                // ✅ CORREÇÃO: Calcular total da categoria respeitando sinais
                const totalCategoria = Math.abs(categoriaTransactions.reduce((sum, t) => sum + t.valor, 0));
                const countCategoria = categoriaTransactions.length;
                
                // Buscar ícone da categoria
                let categoryIcon = '📊';
                let categoryColor = 'red';
                
                const categories = getCategoriesForAccount(conta);
                if (categories[categoria]) {
                  categoryIcon = categories[categoria].icon;
                  categoryColor = categories[categoria].color;
                }

                const isExpanded = expandedCategories[`${conta}-${categoria}`];

                return (
                  <div key={`${conta}-${categoria}`} className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                    {/* Header da Categoria */}
                    <button
                      onClick={() => toggleCategory(`${conta}-${categoria}`)}
                      className="w-full p-3 flex items-center justify-between hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{categoryIcon}</span>
                        <div className="text-left">
                          <h3 className="font-medium text-gray-100 text-sm">{categoria}</h3>
                          <p className="text-xs text-gray-400">{countCategoria} transações</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`font-bold text-sm ${categoryColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {formatCurrency(totalCategoria)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {totalConta > 0 ? ((totalCategoria / totalConta) * 100).toFixed(1) : 0}% da conta
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {/* Subtipos expandidos */}
                    {isExpanded && (
                      <div className="border-t border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750">
                        {Object.entries(subtipos)
                          .sort(([,a], [,b]) => {
                            // ✅ CORREÇÃO: Ordenar subtipos por valor respeitando sinais
                            const totalA = Math.abs(a.reduce((sum, t) => sum + t.valor, 0));
                            const totalB = Math.abs(b.reduce((sum, t) => sum + t.valor, 0));
                            return totalB - totalA;
                          })
                          .map(([subtipo, transactions]) => {
                            // ✅ CORREÇÃO: Calcular total do subtipo respeitando sinais
                            const totalSubtipo = Math.abs(transactions.reduce((sum, t) => sum + t.valor, 0));
                            const countSubtipo = transactions.length;
                            const subtypeKey = `${conta}-${categoria}-${subtipo}`;
                            const isSubtypeExpanded = expandedSubtypes[subtypeKey];

                            return (
                              <div key={subtypeKey} className="border-b border-gray-700 last:border-b-0">
                                {/* Header do Subtipo */}
                                <button
                                  onClick={() => toggleSubtype(subtypeKey)}
                                  className="w-full px-5 py-2 flex items-center justify-between hover:bg-gray-700 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 flex items-center justify-center">
                                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                                    </div>
                                    <div className="text-left">
                                      <p className="font-medium text-gray-200 text-sm">{subtipo}</p>
                                      <p className="text-xs text-gray-400">{countSubtipo} transações</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <p className="font-semibold text-red-400 text-sm">
                                        R$ {formatCurrency(totalSubtipo)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {totalCategoria > 0 ? ((totalSubtipo / totalCategoria) * 100).toFixed(1) : 0}%
                                      </p>
                                    </div>
                                    {isSubtypeExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                                  </div>
                                </button>

                                {/* Transações */}
                                {isSubtypeExpanded && (
                                  <div className="bg-gradient-to-r from-gray-750 to-gray-700">
                                    {transactions.map((transaction, idx) => (
                                      <div 
                                        key={`${transaction.id}-${idx}`} 
                                        className="px-6 py-2 border-b border-gray-600 last:border-b-0 hover:bg-gray-700"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <p className="text-sm text-gray-100 font-medium truncate">
                                                {transaction.descricao_classificada || transaction.descricao_origem}
                                              </p>
                                              {transaction.status === 'reconciled' && (
                                                <span className="text-xs bg-blue-700 text-blue-200 px-1.5 py-0.5 rounded">
                                                  🔗 Reconciliada
                                                </span>
                                              )}
                                            </div>
                                            
                                            <div className="text-xs text-gray-400 mt-0.5">
                                              {formatDate(transaction.data_transacao)} • {transaction.descricao_origem}
                                            </div>
                                          </div>
                                          
                                          <div className="text-right flex-shrink-0 ml-2">
                                            <span className={`font-medium text-sm ${
                                              transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                              {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                                            </span>
                                            {transaction.status !== 'reconciled' && (
                                              <button
                                                onClick={() => onEditCardTransaction(transaction)}
                                                className="block mt-0.5 px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs transition-colors"
                                              >
                                                Editar
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}

      {/* Total Geral */}
      {totalClassificado > 0 && (
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-95"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent)] opacity-50"></div>
          
          <div className="relative p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg">
              <span className="text-3xl filter drop-shadow-lg">💳</span>
            </div>
            
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
              Total Geral Cartões
            </h2>
            
            <div className="relative">
              <p className="text-4xl font-bold text-white mb-1 filter drop-shadow-lg">
                R$ {formatCurrency(totalClassificado)}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-700">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Transações</p>
                <p className="text-lg font-semibold text-blue-300">{transacoesClassificadas.length}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Categorias</p>
                <p className="text-lg font-semibold text-purple-300">
                  {[...new Set(transacoesClassificadas.map(t => t.categoria))].filter(Boolean).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensagem quando não há transações */}
      {filteredTransactions.length === 0 && (
        <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
          <div className="text-6xl mb-4">💳</div>
          <h3 className="text-xl font-semibold text-gray-100 mb-2">Nenhuma Transação</h3>
          <p className="text-gray-400">
            {searchTerm 
              ? `Nenhuma transação encontrada para "${searchTerm}"`
              : 'Não há transações de cartão classificadas'
            }
          </p>
        </div>
      )}
    </div>
  );
}