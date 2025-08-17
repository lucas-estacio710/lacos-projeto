// components/OverviewTab.tsx - VERSÃO COM PERÍODOS AGRUPADOS

import React, { useState } from 'react';
import { Calendar, Search, TrendingUp, BarChart3 } from 'lucide-react';
import { Transaction, countsInBalance } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';
import { CategorySection } from './CategorySection';
import { SummaryBox } from './SummaryBox';

interface OverviewTabProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
}

// Tipo para agrupamento de períodos
type PeriodType = 'month' | 'quarter' | 'semester' | 'year';

interface PeriodItem {
  id: string;
  label: string;
  type: PeriodType;
  startMonth: string;
  endMonth: string;
  transactions: Transaction[];
  isAggregate: boolean;
}

export function OverviewTab({ 
  transactions, 
  onEditTransaction
}: OverviewTabProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAggregates, setShowAggregates] = useState(true);

  const formatMonth = (mes: string) => {
    if (!mes || mes === 'todos') return 'Todos os períodos';
    const year = '20' + mes.substring(0, 2);
    const month = mes.substring(2, 4);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return monthNames[parseInt(month) - 1] + ' ' + year;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // ===== FUNÇÃO PARA CRIAR PERÍODOS AGRUPADOS =====
  const createPeriodItems = (): PeriodItem[] => {
    const balanceTransactions = transactions.filter(t => countsInBalance(t.realizado));
    const monthsSet = new Set(balanceTransactions.map(t => t.mes).filter(Boolean));
    const months = Array.from(monthsSet).sort();
    
    if (months.length === 0) return [];

    const items: PeriodItem[] = [];
    
    // Agrupar por ano
    const yearGroups: Record<string, string[]> = {};
    months.forEach(month => {
      const year = '20' + month.substring(0, 2);
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(month);
    });

    // Processar cada ano
    Object.entries(yearGroups)
      .sort(([a], [b]) => b.localeCompare(a)) // Anos mais recentes primeiro
      .forEach(([year, yearMonths]) => {
        const sortedYearMonths = yearMonths.sort().reverse(); // Meses mais recentes primeiro
        
        // ===== ADICIONAR MESES INDIVIDUAIS =====
        sortedYearMonths.forEach(month => {
          const monthTransactions = balanceTransactions.filter(t => t.mes === month);
          
          items.push({
            id: month,
            label: formatMonth(month),
            type: 'month',
            startMonth: month,
            endMonth: month,
            transactions: monthTransactions,
            isAggregate: false
          });
        });

        // ===== ADICIONAR TRIMESTRES (se houver pelo menos 3 meses) =====
        if (sortedYearMonths.length >= 3) {
          const quarters = [
            { q: 4, months: ['10', '11', '12'], label: '4º Tri' },
            { q: 3, months: ['07', '08', '09'], label: '3º Tri' },
            { q: 2, months: ['04', '05', '06'], label: '2º Tri' },
            { q: 1, months: ['01', '02', '03'], label: '1º Tri' }
          ];

          quarters.forEach(({ q, months: qMonths, label }) => {
            const quarterMonths = sortedYearMonths.filter(month => {
              const monthNum = month.substring(2, 4);
              return qMonths.includes(monthNum);
            });

            if (quarterMonths.length >= 2) { // Pelo menos 2 meses do trimestre
              const quarterTransactions = balanceTransactions.filter(t => 
                quarterMonths.includes(t.mes)
              );

              items.push({
                id: `${year}-Q${q}`,
                label: `${label}/${year.slice(-2)}`,
                type: 'quarter',
                startMonth: quarterMonths[quarterMonths.length - 1], // Primeiro mês do trimestre
                endMonth: quarterMonths[0], // Último mês do trimestre
                transactions: quarterTransactions,
                isAggregate: true
              });
            }
          });
        }

        // ===== ADICIONAR SEMESTRES (se houver pelo menos 6 meses) =====
        if (sortedYearMonths.length >= 6) {
          const semesters = [
            { s: 2, months: ['07', '08', '09', '10', '11', '12'], label: '2º Sem' },
            { s: 1, months: ['01', '02', '03', '04', '05', '06'], label: '1º Sem' }
          ];

          semesters.forEach(({ s, months: sMonths, label }) => {
            const semesterMonths = sortedYearMonths.filter(month => {
              const monthNum = month.substring(2, 4);
              return sMonths.includes(monthNum);
            });

            if (semesterMonths.length >= 4) { // Pelo menos 4 meses do semestre
              const semesterTransactions = balanceTransactions.filter(t => 
                semesterMonths.includes(t.mes)
              );

              items.push({
                id: `${year}-S${s}`,
                label: `${label}/${year.slice(-2)}`,
                type: 'semester',
                startMonth: semesterMonths[semesterMonths.length - 1],
                endMonth: semesterMonths[0],
                transactions: semesterTransactions,
                isAggregate: true
              });
            }
          });
        }

        // ===== ADICIONAR ANO COMPLETO (se houver pelo menos 8 meses) =====
        if (sortedYearMonths.length >= 8) {
          const yearTransactions = balanceTransactions.filter(t => 
            sortedYearMonths.includes(t.mes)
          );

          items.push({
            id: `${year}-YEAR`,
            label: `Ano ${year}`,
            type: 'year',
            startMonth: sortedYearMonths[sortedYearMonths.length - 1],
            endMonth: sortedYearMonths[0],
            transactions: yearTransactions,
            isAggregate: true
          });
        }
      });

    return items;
  };

  // ===== OBTER PERÍODOS DISPONÍVEIS =====
  const availablePeriods = createPeriodItems();

  // ===== FILTRAR PERÍODOS BASEADO NA CONFIGURAÇÃO =====
  const getFilteredPeriods = () => {
    if (!showAggregates) {
      return availablePeriods.filter(p => !p.isAggregate);
    }
    return availablePeriods;
  };

  const filteredPeriods = getFilteredPeriods();

  // ===== OBTER TRANSAÇÕES DO PERÍODO SELECIONADO =====
  const getSelectedPeriodTransactions = () => {
    if (selectedPeriod === 'todos') {
      return transactions.filter(t => countsInBalance(t.realizado));
    }

    const selectedPeriodItem = availablePeriods.find(p => p.id === selectedPeriod);
    return selectedPeriodItem ? selectedPeriodItem.transactions : [];
  };

  const filteredByPeriod = getSelectedPeriodTransactions();

  // ===== APLICAR FILTRO DE BUSCA =====
  const getFilteredTransactions = () => {
    let filtered = filteredByPeriod;
    
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subtipo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => {
      if (a.mes !== b.mes) return b.mes.localeCompare(a.mes);
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return Math.abs(b.valor) - Math.abs(a.valor);
    });
  };

  const classifiedTransactions = getFilteredTransactions();
  
  // ===== SEPARAR POR CONTA =====
  const pfTransactions = classifiedTransactions.filter(t => t.conta === 'PF');
  const pjTransactions = classifiedTransactions.filter(t => t.conta === 'PJ');
  const concTransactions = classifiedTransactions.filter(t => t.conta === 'CONC.');

  // ===== OBTER INFORMAÇÕES DO PERÍODO SELECIONADO =====
  const getSelectedPeriodInfo = () => {
    if (selectedPeriod === 'todos') {
      return { label: 'Todos os períodos', type: 'all' as const };
    }
    
    const periodItem = availablePeriods.find(p => p.id === selectedPeriod);
    return periodItem ? { 
      label: periodItem.label, 
      type: periodItem.type,
      isAggregate: periodItem.isAggregate 
    } : { label: 'Período desconhecido', type: 'month' as const };
  };

  const selectedPeriodInfo = getSelectedPeriodInfo();

  return (
    <div className="space-y-4">
      {/* Header da Visão Geral */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          📊 Visão Geral Financeira
        </h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="opacity-90">Transações</p>
            <p className="text-xl font-bold">{classifiedTransactions.length}</p>
          </div>
          <div>
            <p className="opacity-90">Período</p>
            <p className="text-lg font-bold flex items-center gap-1">
              {selectedPeriodInfo.isAggregate && <TrendingUp className="w-4 h-4" />}
              {selectedPeriodInfo.label}
            </p>
          </div>
          <div>
            <p className="opacity-90">Saldo</p>
            <p className={`text-xl font-bold ${
              classifiedTransactions.reduce((sum, t) => sum + t.valor, 0) >= 0 
                ? 'text-green-300' 
                : 'text-red-300'
            }`}>
              R$ {formatCurrency(classifiedTransactions.reduce((sum, t) => sum + t.valor, 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-blue-500"
          >
            <option value="todos">Todos os períodos</option>
            {filteredPeriods.map(period => (
              <option key={period.id} value={period.id}>
                {period.isAggregate ? '📈 ' : '📅 '}{period.label}
                {period.isAggregate && ` (${period.transactions.length} transações)`}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle para mostrar/ocultar agregados */}
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showAggregates}
              onChange={(e) => setShowAggregates(e.target.checked)}
              className="rounded border-gray-500 bg-gray-600"
            />
            <TrendingUp className="w-4 h-4" />
            Mostrar períodos agrupados (trimestres, semestres, anos)
          </label>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descrição ou subtipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Informações do período selecionado */}
        {selectedPeriodInfo.isAggregate && (
          <div className="mt-3 bg-blue-900/30 border border-blue-700 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <p className="text-blue-100 text-sm font-medium">
                Período Agrupado: {selectedPeriodInfo.label}
              </p>
            </div>
            <p className="text-blue-200 text-xs mt-1">
              💡 Este período consolida múltiplos meses para análise de tendências.
            </p>
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500">
          💡 Esta visão mostra apenas transações que impactam o saldo atual. 
          Pagamentos reconciliados são excluídos para evitar duplicação.
        </div>
      </div>

      {/* Resto do conteúdo permanece igual... */}
      {classifiedTransactions.length === 0 ? (
        <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
          <div className="text-6xl mb-4">🔭</div>
          <h3 className="text-xl font-semibold text-gray-100 mb-2">
            Nenhuma Transação no Saldo
          </h3>
          <p className="text-gray-400">
            {selectedPeriod !== 'todos' 
              ? `Não há transações que contam no saldo para ${selectedPeriodInfo.label}`
              : 'Classifique suas transações na Caixa de Entrada para vê-las aqui'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Seção PJ */}
          {pjTransactions.length > 0 && (
            <>
              <div className="bg-gray-700 p-2 rounded-lg">
                <h3 className="font-semibold text-center text-gray-100">🏢 Transações PJ</h3>
              </div>
              {Object.entries(categoriesPJ).map(([categoryName, categoryData]) => {
                const categoryTransactions = pjTransactions.filter(t => 
                  t.categoria === categoryName
                );
                return (
                  <CategorySection
                    key={categoryName}
                    categoryName={categoryName}
                    categoryData={categoryData}
                    transactions={categoryTransactions}
                    tabKey="overview-pj"
                    onEditTransaction={onEditTransaction}
                  />
                );
              })}
              <SummaryBox title="Resumo PJ" transactions={pjTransactions} />
            </>
          )}

          {/* Seção PF */}
          {pfTransactions.length > 0 && (
            <>
              <div className="bg-gray-700 p-2 rounded-lg mt-6">
                <h3 className="font-semibold text-center text-gray-100">👤 Transações PF</h3>
              </div>
              {Object.entries(categoriesPF).map(([categoryName, categoryData]) => {
                const categoryTransactions = pfTransactions.filter(t => 
                  t.categoria === categoryName
                );
                return (
                  <CategorySection
                    key={categoryName}
                    categoryName={categoryName}
                    categoryData={categoryData}
                    transactions={categoryTransactions}
                    tabKey="overview-pf"
                    onEditTransaction={onEditTransaction}
                  />
                );
              })}
              <SummaryBox title="Resumo PF" transactions={pfTransactions} />
            </>
          )}

          {/* Seção CONC */}
          {concTransactions.length > 0 && (
            <>
              <div className="bg-gray-700 p-2 rounded-lg mt-6">
                <h3 className="font-semibold text-center text-gray-100">🔄 Transações CONC</h3>
              </div>
              {Object.entries(categoriesCONC).map(([categoryName, categoryData]) => {
                const categoryTransactions = concTransactions.filter(t => 
                  t.categoria === categoryName
                );
                return (
                  <CategorySection
                    key={categoryName}
                    categoryName={categoryName}
                    categoryData={categoryData}
                    transactions={categoryTransactions}
                    tabKey="overview-conc"
                    onEditTransaction={onEditTransaction}
                  />
                );
              })}
              <SummaryBox title="Resumo CONC" transactions={concTransactions} />
            </>
          )}

          {/* Resumo Total */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg mt-6 shadow-lg">
            <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
              💎 Resumo Total - {selectedPeriodInfo.label}
              {selectedPeriodInfo.isAggregate && <TrendingUp className="w-5 h-5" />}
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Saldo PJ:</span>
                <span className="font-bold">
                  R$ {formatCurrency(pjTransactions.reduce((sum, t) => sum + t.valor, 0))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Saldo PF:</span>
                <span className="font-bold">
                  R$ {formatCurrency(pfTransactions.reduce((sum, t) => sum + t.valor, 0))}
                </span>
              </div>
              {concTransactions.length > 0 && (
                <div className="flex justify-between items-center">
                  <span>Saldo CONC:</span>
                  <span className="font-bold">
                    R$ {formatCurrency(concTransactions.reduce((sum, t) => sum + t.valor, 0))}
                  </span>
                </div>
              )}
              <div className="border-t border-white/30 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Resultado Final:</span>
                  <span className="font-bold text-xl">
                    R$ {formatCurrency(classifiedTransactions.reduce((sum, t) => sum + t.valor, 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Estatísticas Adicionais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h5 className="font-medium text-gray-100 mb-2 flex items-center gap-2">
                <span className="text-green-400">📈</span>
                Receitas
              </h5>
              <p className="text-2xl font-bold text-green-400">
                R$ {formatCurrency(classifiedTransactions.filter(t => t.valor > 0).reduce((sum, t) => sum + t.valor, 0))}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {classifiedTransactions.filter(t => t.valor > 0).length} transações
              </p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h5 className="font-medium text-gray-100 mb-2 flex items-center gap-2">
                <span className="text-red-400">📉</span>
                Despesas
              </h5>
              <p className="text-2xl font-bold text-red-400">
                R$ {formatCurrency(Math.abs(classifiedTransactions.filter(t => t.valor < 0).reduce((sum, t) => sum + t.valor, 0)))}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {classifiedTransactions.filter(t => t.valor < 0).length} transações
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}