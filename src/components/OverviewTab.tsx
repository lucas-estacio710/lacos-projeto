// components/OverviewTab.tsx - VERSÃO ATUALIZADA COM CLASSIFICAÇÃO INTELIGENTE

import React, { useState } from 'react';
import { Calendar, Search } from 'lucide-react';
import { Transaction, FutureTransaction } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';
import { CategorySection } from './CategorySection';
import { SummaryBox } from './SummaryBox';
import { EnhancedUnclassifiedSection } from './EnhancedUnclassifiedSection';

interface OverviewTabProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
  onReconcileTransaction?: (transaction: Transaction) => void;
  availableGroupsCount?: number;
  onApplyQuickClassification?: (transactionId: string, classification: any) => Promise<void>;
  onApplyBatchClassification?: (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => Promise<void>;
}

// Função wrapper para compatibilidade com EnhancedUnclassifiedSection
const handleEditTransactionWrapper = (
  transaction: Transaction | FutureTransaction, 
  onEditTransaction: (transaction: Transaction) => void
) => {
  // Como estamos no contexto de transactions, sabemos que é Transaction
  onEditTransaction(transaction as Transaction);
};

export function OverviewTab({ 
  transactions, 
  onEditTransaction, 
  onReconcileTransaction,
  availableGroupsCount = 0,
  onApplyQuickClassification,
  onApplyBatchClassification
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    return dateStr;
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
    
    return filtered.sort((a, b) => {
      if (a.mes !== b.mes) return b.mes.localeCompare(a.mes);
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return Math.abs(b.valor) - Math.abs(a.valor);
    });
  };

  const classifiedTransactions = filteredByMonth.filter(t => t.realizado !== 'p');
  const pfTransactions = classifiedTransactions.filter(t => t.conta === 'PF');
  const pjTransactions = classifiedTransactions.filter(t => t.conta === 'PJ');
  const concTransactions = classifiedTransactions.filter(t => t.conta === 'CONC.');

  return (
    <>
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-4 border border-gray-700">
        <div className="flex items-center gap-3">
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
      </div>

      <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-4 border border-gray-700">
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

      <div className="space-y-4">
        {/* Seção de não classificados - NOVA VERSÃO INTELIGENTE */}
        <EnhancedUnclassifiedSection
          transactions={getFilteredTransactions()}
          historicTransactions={transactions.filter(t => t.realizado === 's')}
          onEditTransaction={(transaction) => handleEditTransactionWrapper(transaction, onEditTransaction)}
          onReconcileTransaction={onReconcileTransaction}
          onApplyQuickClassification={onApplyQuickClassification}
          onApplyBatchClassification={onApplyBatchClassification}
          availableGroupsCount={availableGroupsCount}
          type="transactions"
        />
        
        <div className="bg-gray-700 p-2 rounded-lg">
          <h3 className="font-semibold text-center text-gray-100">🏢 Transações PJ</h3>
        </div>
        {Object.entries(categoriesPJ).map(([categoryName, categoryData]) => {
          const categoryTransactions = getFilteredTransactions().filter(t => 
            t.conta === 'PJ' && t.categoria === categoryName && t.realizado !== 'p'
          );
          return (
            <CategorySection
              key={categoryName}
              categoryName={categoryName}
              categoryData={categoryData}
              transactions={categoryTransactions}
              tabKey="todos-pj"
              onEditTransaction={onEditTransaction}
            />
          );
        })}
        <SummaryBox title="Resumo PJ" transactions={pjTransactions} />

        <div className="bg-gray-700 p-2 rounded-lg mt-6">
          <h3 className="font-semibold text-center text-gray-100">👤 Transações PF</h3>
        </div>
        {Object.entries(categoriesPF).map(([categoryName, categoryData]) => {
          const categoryTransactions = getFilteredTransactions().filter(t => 
            t.conta === 'PF' && t.categoria === categoryName && t.realizado !== 'p'
          );
          return (
            <CategorySection
              key={categoryName}
              categoryName={categoryName}
              categoryData={categoryData}
              transactions={categoryTransactions}
              tabKey="todos-pf"
              onEditTransaction={onEditTransaction}
            />
          );
        })}
        <SummaryBox title="Resumo PF" transactions={pfTransactions} />

        {concTransactions.length > 0 && (
          <>
            <div className="bg-gray-700 p-2 rounded-lg mt-6">
              <h3 className="font-semibold text-center text-gray-100">🔄 Transações CONC</h3>
            </div>
            {Object.entries(categoriesCONC).map(([categoryName, categoryData]) => {
              const categoryTransactions = getFilteredTransactions().filter(t => 
                t.conta === 'CONC.' && t.categoria === categoryName && t.realizado !== 'p'
              );
              return (
                <CategorySection
                  key={categoryName}
                  categoryName={categoryName}
                  categoryData={categoryData}
                  transactions={categoryTransactions}
                  tabKey="todos-conc"
                  onEditTransaction={onEditTransaction}
                />
              );
            })}
            <SummaryBox title="Resumo CONC" transactions={concTransactions} />
          </>
        )}

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
            <div className="flex justify-between items-center">
              <span>Saldo CONC:</span>
              <span className="font-bold">
                R$ {formatCurrency(concTransactions.reduce((sum, t) => sum + t.valor, 0))}
              </span>
            </div>
            <div className="border-t border-white/30 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg">Resultado Final:</span>
                <span className="font-bold text-xl">
                  R$ {formatCurrency(filteredByMonth.reduce((sum, t) => sum + t.valor, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Indicador de reconciliação no final */}
        {onReconcileTransaction && availableGroupsCount > 0 && (
          <div className="bg-green-900 border border-green-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-2xl">🔗</span>
              <div>
                <h4 className="text-green-100 font-medium">Sistema de Reconciliação Ativo</h4>
                <p className="text-green-300 text-sm">
                  {availableGroupsCount} grupo(s) de transações futuras disponível(is) para reconciliação
                </p>
                <p className="text-green-400 text-xs mt-1">
                  💡 Use o botão "🔗 Reconciliar" nas transações não classificadas para conectar com faturas de cartão
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de sistema de classificação inteligente */}
        {(onApplyQuickClassification || onApplyBatchClassification) && (
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-blue-400 text-2xl">🤖</span>
              <div>
                <h4 className="text-blue-100 font-medium">Classificação Inteligente Ativa</h4>
                <p className="text-blue-300 text-sm">
                  Sistema com sugestões baseadas no histórico e classificação em lote
                </p>
                <p className="text-blue-400 text-xs mt-1">
                  💡 Use botões rápidos (🛒🍽️🚗), sugestões IA (🤖) ou classificação em lote (⚡) para acelerar
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}