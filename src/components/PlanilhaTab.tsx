import React, { useState, useMemo } from 'react';
import { Transaction } from '@/types';
import { useHierarchy } from '@/hooks/useHierarchy';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightExpand } from 'lucide-react';

interface PlanilhaTabProps {
  transactions: Transaction[];
}

export function PlanilhaTab({ transactions }: PlanilhaTabProps) {
  const { contas, categorias, subtipos, visaoPlana } = useHierarchy();
  const [selectedConta, setSelectedConta] = useState<string>('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');
  const [viewMode, setViewMode] = useState<'filtered' | 'dre'>('dre'); // Começar com DRE
  const [monthPage, setMonthPage] = useState<number>(() => {
    // Iniciar na última página (mais recente)
    const total = Math.ceil(12 / 4); // 12 meses, 4 por página
    return total - 1;
  });
  
  // Estados para expansão de contas e categorias
  const [expandedContas, setExpandedContas] = useState<Set<string>>(new Set());
  const [expandedCategorias, setExpandedCategorias] = useState<Set<string>>(new Set());
  
  // Funções para controlar expansão
  const toggleConta = (contaCodigo: string) => {
    const newExpanded = new Set(expandedContas);
    if (newExpanded.has(contaCodigo)) {
      newExpanded.delete(contaCodigo);
      // Também colapsar todas as categorias dessa conta
      const contaCategoriasToCollapse = categorias
        .filter(cat => contas.find(c => c.id === cat.conta_id)?.codigo === contaCodigo)
        .map(cat => `${contaCodigo}-${cat.nome}`);
      const newExpandedCategorias = new Set(expandedCategorias);
      contaCategoriasToCollapse.forEach(key => newExpandedCategorias.delete(key));
      setExpandedCategorias(newExpandedCategorias);
    } else {
      newExpanded.add(contaCodigo);
    }
    setExpandedContas(newExpanded);
  };
  
  const toggleCategoria = (contaCodigo: string, categoriaNome: string) => {
    const key = `${contaCodigo}-${categoriaNome}`;
    const newExpanded = new Set(expandedCategorias);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCategorias(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return Math.round(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Gerar últimos 12 meses
  const getLast12Months = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const shortYear = year.toString().slice(-2);
      
      months.push({
        key: `${year}-${month}`,
        display: `${shortYear}${month}`,
        year,
        month: parseInt(month)
      });
    }
    
    return months;
  };

  const last12Months = getLast12Months();
  
  // Paginação dos meses (4 por vez)
  const MONTHS_PER_PAGE = 4;
  const totalPages = Math.ceil(last12Months.length / MONTHS_PER_PAGE);
  const currentMonths = last12Months.slice(
    monthPage * MONTHS_PER_PAGE,
    (monthPage + 1) * MONTHS_PER_PAGE
  );
  
  const canGoBack = monthPage > 0;
  const canGoForward = monthPage < totalPages - 1;

  // Filtrar categorias disponíveis baseadas na conta selecionada
  const availableCategorias = useMemo(() => {
    if (!selectedConta) return [];
    
    const conta = contas.find(c => c.codigo === selectedConta);
    if (!conta) return [];
    
    return categorias.filter(cat => cat.conta_id === conta.id);
  }, [selectedConta, contas, categorias]);

  // Filtrar subtipos disponíveis baseados na categoria selecionada
  const availableSubtipos = useMemo(() => {
    if (!selectedCategoria) return [];
    
    const categoria = availableCategorias.find(cat => cat.nome === selectedCategoria);
    if (!categoria) return [];
    
    return subtipos.filter(sub => sub.categoria_id === categoria.id);
  }, [selectedCategoria, availableCategorias, subtipos]);

  // Calcular dados da planilha
  const planilhaData = useMemo(() => {
    if (!selectedConta || !selectedCategoria) return [];

    // Obter transações filtradas por conta e categoria
    const filteredTransactions = transactions.filter(t => {
      if (!t.subtipo_id) return false;
      
      const visao = visaoPlana.find(v => v.subtipo_id === t.subtipo_id);
      return visao && 
             visao.conta_codigo === selectedConta && 
             visao.categoria_nome === selectedCategoria;
    });

    // Agrupar por subtipo e calcular valores mensais
    const subtipesData = availableSubtipos.map(subtipo => {
      const subtipoTransactions = filteredTransactions.filter(t => t.subtipo_id === subtipo.id);
      
      const monthlyValues = currentMonths.map(month => {
        const monthTransactions = subtipoTransactions.filter(t => {
          const transactionDate = new Date(t.data);
          return transactionDate.getFullYear() === month.year && 
                 (transactionDate.getMonth() + 1) === month.month;
        });
        
        return monthTransactions.reduce((sum, t) => sum + t.valor, 0);
      });
      
      const total = monthlyValues.reduce((sum, val) => sum + val, 0);
      
      return {
        subtipo: subtipo.nome,
        monthlyValues,
        total
      };
    });

    return subtipesData; // Mostrar todos os subtipos (mesmo zerados)
  }, [selectedConta, selectedCategoria, transactions, visaoPlana, availableSubtipos, last12Months]);

  // ===== NOVA LÓGICA: DRE Completa =====
  const dreData = useMemo(() => {
    if (viewMode !== 'dre') return null;

    // Estrutura hierárquica para expansão/colapso
    interface ContaData {
      conta: {
        codigo: string;
        nome: string;
        monthlyValues: number[];
        total: number;
        ordem: number;
      };
      categorias: Array<{
        categoria: {
          nome: string;
          monthlyValues: number[];
          total: number;
          ordem: number;
        };
        subtipos: Array<{
          nome: string;
          monthlyValues: number[];
          total: number;
          ordem: number;
        }>;
      }>;
    }

    const contasData: ContaData[] = [];

    contas.forEach(conta => {
      const contaCategorias = categorias.filter(cat => cat.conta_id === conta.id);
      
      const categoriasData = contaCategorias.map(categoria => {
        const categoriaSubtipos = subtipos.filter(sub => sub.categoria_id === categoria.id);
        
        const subtiposData = categoriaSubtipos.map(subtipo => {
          const subtipoTransactions = transactions.filter(t => {
            if (!t.subtipo_id) return false;
            const visao = visaoPlana.find(v => v.subtipo_id === t.subtipo_id);
            return visao && visao.subtipo_nome === subtipo.nome;
          });

          const subtipoMonthlyValues = currentMonths.map(month => {
            return subtipoTransactions
              .filter(t => {
                const transactionDate = new Date(t.data);
                return transactionDate.getFullYear() === month.year && 
                       (transactionDate.getMonth() + 1) === month.month;
              })
              .reduce((sum, t) => sum + t.valor, 0);
          });

          return {
            nome: subtipo.nome,
            monthlyValues: subtipoMonthlyValues,
            total: subtipoMonthlyValues.reduce((sum, val) => sum + val, 0),
            ordem: subtipo.ordem_exibicao || 999
          };
        }).sort((a, b) => a.ordem - b.ordem);

        const categoriaMonthlyValues = currentMonths.map((_, monthIndex) => 
          subtiposData.reduce((sum, sub) => sum + sub.monthlyValues[monthIndex], 0)
        );

        return {
          categoria: {
            nome: categoria.nome,
            monthlyValues: categoriaMonthlyValues,
            total: categoriaMonthlyValues.reduce((sum, val) => sum + val, 0),
            ordem: categoria.ordem_exibicao || 999
          },
          subtipos: subtiposData
        };
      }).sort((a, b) => a.categoria.ordem - b.categoria.ordem);

      const contaMonthlyValues = currentMonths.map((_, monthIndex) => 
        categoriasData.reduce((sum, cat) => sum + cat.categoria.monthlyValues[monthIndex], 0)
      );

      contasData.push({
        conta: {
          codigo: conta.codigo,
          nome: conta.nome,
          monthlyValues: contaMonthlyValues,
          total: contaMonthlyValues.reduce((sum, val) => sum + val, 0),
          ordem: conta.ordem_exibicao || 999
        },
        categorias: categoriasData
      });
    });

    return contasData.sort((a, b) => a.conta.ordem - b.conta.ordem);
  }, [viewMode, transactions, visaoPlana, contas, categorias, subtipos, last12Months]);

  // Calcular totais mensais
  const monthlyTotals = useMemo(() => {
    if (viewMode === 'dre' && dreData) {
      return currentMonths.map((_, monthIndex) => 
        dreData.reduce((sum, contaData) => sum + contaData.conta.monthlyValues[monthIndex], 0)
      );
    }
    return currentMonths.map((_, monthIndex) => 
      planilhaData.reduce((sum, row) => sum + row.monthlyValues[monthIndex], 0)
    );
  }, [viewMode, dreData, planilhaData, currentMonths]);

  const grandTotal = monthlyTotals.reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6 p-4">
      {/* Título e Toggle */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">📊 Planilha de Análise</h2>
        <p className="text-gray-400 text-sm mb-4">Dados consolidados dos últimos 12 meses</p>
        
        {/* Toggle entre modos */}
        <div className="flex justify-center mb-4">
          <div className="bg-gray-800 rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('dre')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'dre'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              📈 Visão DRE Completa
            </button>
            <button
              onClick={() => setViewMode('filtered')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'filtered'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              🎯 Seleção Filtrada
            </button>
          </div>
        </div>
      </div>

      {/* Seleção em Cascata - Apenas no modo filtrado */}
      {viewMode === 'filtered' && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-100 mb-3">🎯 Seleção de Categorias</h3>
        
          {/* Seleção de Conta */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              1. Selecione a Conta:
            </label>
            <select
              value={selectedConta}
              onChange={(e) => {
                setSelectedConta(e.target.value);
                setSelectedCategoria(''); // Reset categoria
              }}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
            >
              <option value="">-- Selecione uma conta --</option>
              {contas.map(conta => (
                <option key={conta.id} value={conta.codigo}>
                  {conta.nome} ({conta.codigo})
                </option>
              ))}
            </select>
          </div>

          {/* Seleção de Categoria */}
          {selectedConta && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                2. Selecione a Categoria:
              </label>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              >
                <option value="">-- Selecione uma categoria --</option>
                {availableCategorias.map(categoria => (
                  <option key={categoria.id} value={categoria.nome}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Planilha DRE Completa */}
      {viewMode === 'dre' && dreData && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-100">
              📈 DRE - Demonstracao Completa por Hierarquia
            </h3>
            
            {/* Controles de navegação */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthPage(Math.max(0, monthPage - 1))}
                disabled={!canGoBack}
                className={`p-2 rounded-lg transition-all ${
                  canGoBack 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-gray-300 text-sm px-2">
                {currentMonths[0]?.display} - {currentMonths[currentMonths.length - 1]?.display}
              </span>
              
              <button
                onClick={() => setMonthPage(Math.min(totalPages - 1, monthPage + 1))}
                disabled={!canGoForward}
                className={`p-2 rounded-lg transition-all ${
                  canGoForward 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-700">
                  <th className="text-left p-1 text-gray-100 font-semibold min-w-[100px] max-w-[100px]">
                    <div className="truncate text-xs">Hierarquia</div>
                  </th>
                  {currentMonths.map(month => (
                    <th key={month.key} className="text-right p-1 text-gray-100 font-semibold min-w-[45px]">
                      <div className="truncate text-xs">{month.display}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dreData.map((contaData, contaIndex) => (
                  <React.Fragment key={contaData.conta.codigo}>
                    {/* Linha da Conta */}
                    <tr className="bg-blue-900/30 hover:bg-blue-800/40 transition-colors">
                      <td className="p-1.5 text-white font-bold text-xs min-w-[100px] max-w-[100px] border-r border-gray-600">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleConta(contaData.conta.codigo)}
                            className="hover:bg-blue-700 rounded p-0.5"
                          >
                            {expandedContas.has(contaData.conta.codigo) ? 
                              <ChevronDown className="w-3 h-3" /> : 
                              <ChevronRightExpand className="w-3 h-3" />
                            }
                          </button>
                          <span className="truncate" title={`${contaData.conta.codigo} - ${contaData.conta.nome}`}>
                            {contaData.conta.codigo} - {contaData.conta.nome}
                          </span>
                        </div>
                      </td>
                      {contaData.conta.monthlyValues.map((value, monthIndex) => (
                        <td key={monthIndex} className="text-right p-1">
                          <span className={`${value === 0 ? 'text-gray-500' : value > 0 ? 'text-green-400' : 'text-red-400'} font-mono text-xs`}>
                            {value === 0 ? '-' : `${value > 0 ? '+' : ''}${formatCurrency(Math.abs(value))}`}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Categorias da Conta (se expandida) */}
                    {expandedContas.has(contaData.conta.codigo) && contaData.categorias.map((categoriaData, catIndex) => (
                      <React.Fragment key={`${contaData.conta.codigo}-${categoriaData.categoria.nome}`}>
                        {/* Linha da Categoria */}
                        <tr className="bg-green-900/20 hover:bg-green-800/30 transition-colors">
                          <td className="p-1 text-green-100 font-semibold text-xs min-w-[100px] max-w-[100px] border-r border-gray-600 pl-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleCategoria(contaData.conta.codigo, categoriaData.categoria.nome)}
                                className="hover:bg-green-700 rounded p-0.5"
                              >
                                {expandedCategorias.has(`${contaData.conta.codigo}-${categoriaData.categoria.nome}`) ? 
                                  <ChevronDown className="w-3 h-3" /> : 
                                  <ChevronRightExpand className="w-3 h-3" />
                                }
                              </button>
                              <span className="truncate" title={categoriaData.categoria.nome}>
                                {categoriaData.categoria.nome}
                              </span>
                            </div>
                          </td>
                          {categoriaData.categoria.monthlyValues.map((value, monthIndex) => (
                            <td key={monthIndex} className="text-right p-1">
                              <span className={`${value === 0 ? 'text-gray-500' : value > 0 ? 'text-green-400' : 'text-red-400'} font-mono text-xs`}>
                                {value === 0 ? '-' : `${value > 0 ? '+' : ''}${formatCurrency(Math.abs(value))}`}
                              </span>
                            </td>
                          ))}
                        </tr>

                        {/* Subtipos da Categoria (se expandida) */}
                        {expandedCategorias.has(`${contaData.conta.codigo}-${categoriaData.categoria.nome}`) && 
                         categoriaData.subtipos.map((subtipoData, subIndex) => (
                          <tr key={`${contaData.conta.codigo}-${categoriaData.categoria.nome}-${subtipoData.nome}`} 
                              className="bg-gray-800 hover:bg-gray-700 transition-colors">
                            <td className="p-1 text-gray-200 text-xs min-w-[100px] max-w-[100px] border-r border-gray-600 pl-4">
                              <span className="truncate" title={subtipoData.nome}>
                                {subtipoData.nome.length > 8 ? subtipoData.nome.substring(0, 7) + '...' : subtipoData.nome}
                              </span>
                            </td>
                            {subtipoData.monthlyValues.map((value, monthIndex) => (
                              <td key={monthIndex} className="text-right p-1">
                                <span className={`${value === 0 ? 'text-gray-500' : value > 0 ? 'text-green-400' : 'text-red-400'} font-mono text-xs`}>
                                  {value === 0 ? '-' : `${value > 0 ? '+' : ''}${formatCurrency(Math.abs(value))}`}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Planilha Filtrada */}
      {viewMode === 'filtered' && selectedConta && selectedCategoria && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            📋 {selectedConta} → {selectedCategoria}
          </h3>
          
          {planilhaData.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto max-h-80 touch-pan-x scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              <div className="min-w-max">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-700 sticky top-0 z-10">
                      <th className="text-left p-1.5 text-gray-100 font-semibold sticky left-0 bg-gray-700 z-20 min-w-[120px] max-w-[120px]">
                        <div className="truncate" title="Subtipo">Sub</div>
                      </th>
                      {currentMonths.map(month => (
                        <th key={month.key} className="text-right p-1.5 text-gray-100 font-semibold min-w-[70px]">
                          <div className="truncate">{month.display}</div>
                        </th>
                      ))}
                      <th className="text-center p-1.5 text-gray-100 font-semibold bg-gray-600 min-w-[80px]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {planilhaData.map((row, index) => (
                      <tr key={row.subtipo} className={`${index % 2 === 0 ? 'bg-gray-750' : 'bg-gray-800'} hover:bg-gray-600 transition-colors`}>
                        <td className="p-1.5 text-gray-100 font-medium sticky left-0 bg-inherit z-10 border-r border-gray-600 min-w-[120px] max-w-[120px]">
                          <div className="truncate text-xs" title={row.subtipo}>
                            {row.subtipo.length > 15 ? row.subtipo.substring(0, 12) + '...' : row.subtipo}
                          </div>
                        </td>
                        {row.monthlyValues.map((value, monthIndex) => (
                          <td key={monthIndex} className="text-right p-1.5">
                            <span className={`${value === 0 ? 'text-gray-500' : value > 0 ? 'text-green-400' : 'text-red-400'} font-mono text-xs`}>
                              {value === 0 ? '-' : `${value > 0 ? '+' : ''}${formatCurrency(Math.abs(value))}`}
                            </span>
                          </td>
                        ))}
                        <td className="text-center p-1.5 bg-gray-700 font-bold">
                          <span className={`${row.total > 0 ? 'text-green-400' : 'text-red-400'} font-mono text-xs`}>
                            {row.total > 0 ? '+' : ''}{formatCurrency(Math.abs(row.total))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-600 font-bold sticky bottom-0">
                      <td className="p-1.5 text-gray-100 sticky left-0 bg-gray-600 z-10 min-w-[120px] max-w-[120px]">
                        <div className="truncate text-xs font-bold">TOTAL</div>
                      </td>
                      {monthlyTotals.map((total, monthIndex) => (
                        <td key={monthIndex} className="text-right p-1.5">
                          <span className={`${total === 0 ? 'text-gray-300' : total > 0 ? 'text-green-300' : 'text-red-300'} font-mono font-bold text-xs`}>
                            {total === 0 ? '-' : `${total > 0 ? '+' : ''}${formatCurrency(Math.abs(total))}`}
                          </span>
                        </td>
                      ))}
                      <td className="text-center p-1.5 bg-gray-500">
                        <span className={`${grandTotal > 0 ? 'text-green-200' : 'text-red-200'} font-mono font-bold text-sm`}>
                          {grandTotal > 0 ? '+' : ''}{formatCurrency(Math.abs(grandTotal))}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <p className="text-lg">📄 Nenhum dado encontrado</p>
              <p className="text-sm mt-2">Não há transações para os critérios selecionados nos últimos 12 meses.</p>
            </div>
          )}
        </div>
      )}

      {/* Instruções */}
      {viewMode === 'filtered' && !selectedConta && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h4 className="text-blue-300 font-semibold mb-2">ℹ️ Como usar:</h4>
          <ul className="text-blue-200 text-sm space-y-1">
            <li>1. Selecione uma conta (Ex: PF, CONC, etc.)</li>
            <li>2. Escolha uma categoria dentro da conta selecionada</li>
            <li>3. Visualize os dados consolidados dos últimos 12 meses</li>
            <li>4. Arraste horizontalmente para navegar pela planilha</li>
          </ul>
        </div>
      )}
      
      {/* Instruções DRE */}
      {viewMode === 'dre' && (!dreData || dreData.length === 0) && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <h4 className="text-green-300 font-semibold mb-2">📈 DRE - Demonstração do Resultado</h4>
          <ul className="text-green-200 text-sm space-y-1">
            <li>• Visão completa de todas as contas com movimentação</li>
            <li>• Hierarquia organizada: Contas → Categorias → Subtipos</li>
            <li>• Dados dos últimos 12 meses automaticamente</li>
            <li>• Arraste horizontalmente para navegar pelos meses</li>
          </ul>
        </div>
      )}
    </div>
  );
}