import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { formatCurrency, formatMonth, formatDate } from '@/lib/utils';
import { useConfig } from '@/contexts/ConfigContext';
import { useHierarchy } from '@/hooks/useHierarchy';

interface CartoesTabProps {
  cardTransactions: CardTransaction[];
  onEditCardTransaction: (transaction: CardTransaction) => void;
}

type StatusFilter = 'aberto' | 'fechado' | 'todos';

export function CartoesTab({ 
  cardTransactions, 
  onEditCardTransaction
}: CartoesTabProps) {
  const { contas, categorias, subtipos, carregarTudo } = useHierarchy();
  
  // Load hierarchy data
  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // ✅ Helper functions para acessar dados da hierarquia - IGUAL AO OVERVIEWTAB
  const getCardTransactionAccount = (transaction: CardTransaction): string => {
    // PRIMEIRO: tenta hierarchy
    if (transaction.hierarchy?.conta_codigo) {
      return transaction.hierarchy.conta_codigo;
    }
    
    // SEGUNDO: tenta buscar via subtipo_id manualmente
    if (transaction.subtipo_id) {
      const subtipo = subtipos.find(s => s.id === transaction.subtipo_id);
      if (subtipo) {
        const categoria = categorias.find(c => c.id === subtipo.categoria_id);
        if (categoria) {
          const conta = contas.find(c => c.id === categoria.conta_id);
          if (conta) {
            return conta.codigo;
          }
        }
      }
    }
    
    // TERCEIRO: FORÇA mostrar como OUTRAS
    return 'OUTRAS';
  };

  const getCardTransactionCategory = (transaction: CardTransaction): string => {
    // PRIMEIRO: tenta hierarchy
    if (transaction.hierarchy?.categoria_nome) {
      return transaction.hierarchy.categoria_nome;
    }
    
    // SEGUNDO: busca manual via subtipo_id
    if (transaction.subtipo_id) {
      const subtipo = subtipos.find(s => s.id === transaction.subtipo_id);
      if (subtipo) {
        const categoria = categorias.find(c => c.id === subtipo.categoria_id);
        if (categoria) {
          return categoria.nome;
        }
      }
    }
    
    // TERCEIRO: usa campo legacy ou fallback
    return transaction.categoria || 'SEM CATEGORIA';
  };

  const getCardTransactionSubtype = (transaction: CardTransaction): string => {
    // PRIMEIRO: tenta hierarchy
    if (transaction.hierarchy?.subtipo_nome) {
      return transaction.hierarchy.subtipo_nome;
    }
    
    // SEGUNDO: busca manual via subtipo_id
    if (transaction.subtipo_id) {
      const subtipo = subtipos.find(s => s.id === transaction.subtipo_id);
      if (subtipo) {
        return subtipo.nome;
      }
    }
    
    // TERCEIRO: usa campo legacy ou fallback
    return transaction.subtipo || 'SEM SUBTIPO';
  };
  
  // ✅ Helper to get category icon from hierarchy
  const getCategoryIcon = useMemo(() => {
    return (contaCodigo: string, categoriaNome: string) => {
      const conta = contas.find(c => c.codigo === contaCodigo);
      const categoria = categorias.find(c => 
        c.conta_id === conta?.id && c.nome === categoriaNome
      );
      return categoria?.icone || '📁';
    };
  }, [contas, categorias]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('aberto'); // ⭐ PADRÃO: ABA ABERTO
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

  // ⭐ DEBUG: Ver status das transações
  console.log('📊 Status das transações carregadas:', 
    cardTransactions.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );
  console.log('🔍 Filtro atual:', statusFilter);

  // Filtrar transações
  const filteredTransactions = cardTransactions.filter(t => {
    // ⭐ FILTRO DE STATUS (fluxo: pending → classified → reconciled)
    let matchesStatus = true;
    if (statusFilter === 'aberto') {
      matchesStatus = t.status === 'classified'; // Somente Classified (aguardando reconciliação)
    } else if (statusFilter === 'fechado') {
      matchesStatus = t.status === 'reconciled'; // Somente Reconciled (finalizados)
    }
    // Para 'todos', não filtra por status (pending + classified + reconciled)
    
    const matchesCartao = selectedCartao === 'todos' || t.origem === selectedCartao;
    
    // Extrair mês da fatura_id para comparação
    const faturaMonth = t.fatura_id.split('_')[1] || '';
    const matchesMes = selectedMes === 'todos' || faturaMonth === selectedMes;
    
    const matchesSearch = !searchTerm || 
      t.descricao_origem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.descricao_classificada?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subtipo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesCartao && matchesMes && matchesSearch;
  });

  // Agrupar por categoria (classificadas E reconciliadas)
  const transacoesClassificadas = filteredTransactions.filter(t => t.status === 'classified' || t.status === 'reconciled');
  
  // DEBUG LOGS - FORÇA MOSTRAR TUDO
  console.log('🔍 CartoesTab - Total cardTransactions:', cardTransactions.length);
  console.log('🔍 CartoesTab - filteredTransactions:', filteredTransactions.length);
  console.log('🔍 CartoesTab - transacoesClassificadas:', transacoesClassificadas.length);
  console.log('🔍 CartoesTab - Status breakdown:', 
    cardTransactions.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );
  console.log('🔍 CartoesTab - Sample classified:', transacoesClassificadas.slice(0, 2));
  console.log('🔍 CartoesTab - Current filter:', statusFilter);
  console.log('🔍 CartoesTab - Contas encontradas:', [...new Set(transacoesClassificadas.map(t => getCardTransactionAccount(t)))]);
  console.log('🔍 CartoesTab - Sample transaction full:', transacoesClassificadas[0]);
  console.log('🔍 CartoesTab - Transactions with hierarchy:', transacoesClassificadas.filter(t => t.hierarchy).length);
  console.log('🔍 CartoesTab - Sample account resolution:', transacoesClassificadas.slice(0, 3).map(t => ({
    id: t.id.slice(-8),
    subtipo_id: t.subtipo_id?.slice(-8),
    account: getCardTransactionAccount(t),
    category: getCardTransactionCategory(t),
    subtype: getCardTransactionSubtype(t)
  })));

  // ✅ CÁLCULOS DINÂMICOS: baseados nos filtros aplicados
  const totalGeral = Math.abs(filteredTransactions.reduce((sum, t) => sum + t.valor, 0));
  const totalClassificado = Math.abs(transacoesClassificadas.reduce((sum, t) => sum + t.valor, 0));
  const totalNaoClassificado = Math.abs(filteredTransactions
    .filter(t => t.status !== 'classified')
    .reduce((sum, t) => sum + t.valor, 0));

  // ⭐ TOTAL DINÂMICO: Usar o totalGeral que já considera todos os filtros
  const totalDinamico = totalGeral;

  // ⭐ TÍTULO DINÂMICO: Baseado nos filtros selecionados
  const getTituloDinamico = () => {
    let partes = ["💳 Total"];
    
    // Adicionar cartão se não for "todos"
    if (selectedCartao !== 'todos') {
      partes.push(selectedCartao);
    }
    
    // Adicionar mês se não for "todos"
    if (selectedMes !== 'todos') {
      partes.push(formatMonth(selectedMes));
    }
    
    // Se ambos forem "todos", usar "Cartões"
    if (selectedCartao === 'todos' && selectedMes === 'todos') {
      return "💳 Total Cartões";
    }
    
    return partes.join(" ");
  };

  return (
    <div className="space-y-4">

      {/* ⭐ TOGGLES DE STATUS - ACIMA DOS FILTROS */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          <button
            onClick={() => setStatusFilter('aberto')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'aberto'
                ? 'bg-yellow-600 text-white shadow-lg animate-pulse'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span className="hidden sm:inline">🟡 Aberto</span>
            <span className="sm:hidden">🟡 Aberto</span>
          </button>
          
          <button
            onClick={() => setStatusFilter('fechado')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'fechado'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span className="hidden sm:inline">✅ Fechado</span>
            <span className="sm:hidden">✅ Fech.</span>
          </button>
          
          <button
            onClick={() => setStatusFilter('todos')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'todos'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span className="hidden sm:inline">🔍 Todos</span>
            <span className="sm:hidden">🔍 Todos</span>
          </button>
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

      {/* Total Dinâmico */}
      {totalDinamico > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-lg">
          {/* Linha 1: Título e Valor */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200">
              {getTituloDinamico()}
            </h2>
            <p className="text-xl font-bold text-white">
              R$ {formatCurrency(totalDinamico)}
            </p>
          </div>
          
          {/* Linha 2: Despesas */}
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-red-200">Despesas</span>
            <span className="text-red-200 font-medium">
              R$ {formatCurrency(Math.abs(filteredTransactions.filter(t => t.valor < 0).reduce((sum, t) => sum + t.valor, 0)))}
            </span>
          </div>
          
          {/* Linha 3: Estornos */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-200">Estornos</span>
            <span className="text-green-200 font-medium">
              R$ {formatCurrency(filteredTransactions.filter(t => t.valor > 0).reduce((sum, t) => sum + t.valor, 0))}
            </span>
          </div>
          
          {/* Contador de transações (pequeno, discreto) */}
          <p className="text-xs text-blue-200 mt-2 text-center opacity-75">
            {filteredTransactions.length} transações
          </p>
        </div>
      )}

      {/* USANDO HELPER FUNCTIONS - Sistema hierárquico por conta ORDENADO */}
      {[...new Set(transacoesClassificadas.map(t => getCardTransactionAccount(t)))]
        .sort((a, b) => {
          // Ordenação usando ordem_exibicao das contas
          const getContaOrdem = (codConta: string) => {
            const conta = contas.find(c => c.codigo === codConta);
            if (conta) {
              return conta.ordem_exibicao;
            }
            return codConta === 'OUTRAS' ? 1000 : 999;
          };
          return getContaOrdem(a) - getContaOrdem(b);
        })
        .map(conta => {
        // Filtrar transações desta conta específica
        const transacoesConta = transacoesClassificadas.filter(t => getCardTransactionAccount(t) === conta);

        if (transacoesConta.length === 0) return null;

        // ✅ CORREÇÃO: Calcular total da conta respeitando sinais
        const totalConta = Math.abs(transacoesConta.reduce((sum, t) => sum + t.valor, 0));
        
        // ⭐ CORREÇÃO: Total geral deve ser baseado nas transações filtradas, não classificadas
        const totalGeralFiltrado = Math.abs(filteredTransactions.reduce((sum, t) => sum + t.valor, 0));
        
        // Usar dados REAIS da hierarquia ou fallback
        const contaObj = contas.find(c => c.codigo === conta);
        const label = contaObj
          ? { title: `Cartões ${contaObj.nome}`, icon: contaObj.icone || '💳', color: 'blue' }
          : { title: `Cartões ${conta}`, icon: '💳', color: 'gray' };

        // Agrupar hierarquicamente por categoria > subtipo USANDO HELPER FUNCTIONS
        const groupedHierarchyConta = transacoesConta.reduce((acc, transaction) => {
          const categoria = getCardTransactionCategory(transaction);
          const subtipo = getCardTransactionSubtype(transaction);
          
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
              label.color === 'blue' ? 'from-blue-600 to-blue-700' :
              label.color === 'green' ? 'from-green-600 to-green-700' :
              label.color === 'purple' ? 'from-purple-600 to-purple-700' :
              'from-gray-600 to-gray-700'
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
                    {totalGeralFiltrado > 0 ? ((totalConta / totalGeralFiltrado) * 100).toFixed(1) : 0}% do total
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
                
                // ✅ Buscar ícone da categoria usando sistema dinâmico
                let categoryIcon = getCategoryIcon(conta, categoria) || '📊';
                let categoryColor = 'red';
                
                // Fallback para sistema antigo se necessário
                

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
                          <p className={`font-bold text-sm ${categoriaTransactions.reduce((sum, t) => sum + t.valor, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {categoriaTransactions.reduce((sum, t) => sum + t.valor, 0) >= 0 ? '+' : ''}R$ {formatCurrency(totalCategoria)}
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
                                      <p className={`font-semibold text-sm ${transactions.reduce((sum, t) => sum + t.valor, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {transactions.reduce((sum, t) => sum + t.valor, 0) >= 0 ? '+' : ''}R$ {formatCurrency(totalSubtipo)}
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
                                  <div className="bg-gradient-to-r from-slate-800 to-blue-900">
                                    {transactions.map((transaction, idx) => (
                                      <div 
                                        key={`${transaction.id}-${idx}`} 
                                        className="px-6 py-2 border-b border-blue-800 last:border-b-0 hover:bg-blue-800"
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