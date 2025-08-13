// components/OverviewTab.tsx - VERSÃO LIMPA SEM NÃO CLASSIFICADOS

import React, { useState } from 'react';
import { Calendar, Search } from 'lucide-react';
import { Transaction } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';
import { CategorySection } from './CategorySection';
import { SummaryBox } from './SummaryBox';

interface OverviewTabProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
}

export function OverviewTab({ 
  transactions, 
  onEditTransaction
}: OverviewTabProps) {
  const [selectedMonth, setSelectedMonth] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const formatMonth = (mes: string) => {
    if (!mes || mes === 'todos') return 'Todos os meses';
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

  const availableMonths = [...new Set(transactions.map(t => t.mes))].filter(m => m).sort().reverse();

  const filteredByMonth = selectedMonth === 'todos' ? transactions : transactions.filter(t => t.mes === selectedMonth);

  const getFilteredTransactions = () => {
    let filtered = filteredByMonth;
    
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subtipo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Importante: filtrar apenas transações CLASSIFICADAS (realizado = 's')
    return filtered.filter(t => t.realizado === 's').sort((a, b) => {
      if (a.mes !== b.mes) return b.mes.localeCompare(a.mes);
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return Math.abs(b.valor) - Math.abs(a.valor);
    });
  };

  const classifiedTransactions = getFilteredTransactions();
  const pfTransactions = classifiedTransactions.filter(t => t.conta === 'PF');
  const pjTransactions = classifiedTransactions.filter(t => t.conta === 'PJ');
  const concTransactions = classifiedTransactions.filter(t => t.conta === 'CONC.');

  return (
    <div className="space-y-4">
      {/* Header da Visão Geral */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-2">📊 Visão Geral Financeira</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="opacity-90">Transações</p>
            <p className="text-xl font-bold">{classifiedTransactions.length}</p>
          </div>
          <div>
            <p className="opacity-90">Período</p>
            <p className="text-lg font-bold">{formatMonth(selectedMonth)}</p>
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
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-blue-500"
          >
            <option value="todos">Todos os meses</option>
            {availableMonths.map(mes => (
              <option key={mes} value={mes}>{formatMonth(mes)}</option>
            ))}
          </select>
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
      </div>

      {/* Conteúdo Principal */}
      {classifiedTransactions.length === 0 ? (
        <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-100 mb-2">
            Nenhuma Transação Classificada
          </h3>
          <p className="text-gray-400">
            {selectedMonth !== 'todos' 
              ? `Não há transações classificadas para ${formatMonth(selectedMonth)}`
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
            <h4 className="font-bold text-lg mb-3">💎 Resumo Total</h4>
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