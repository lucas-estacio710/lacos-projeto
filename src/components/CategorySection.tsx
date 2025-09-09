import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction, CategoryData } from '@/types';

interface CategorySectionProps {
  categoryName: string;
  categoryData: CategoryData;
  transactions: Transaction[];
  tabKey: string;
  onEditTransaction: (transaction: Transaction) => void;
}

export function CategorySection({ 
  categoryName, 
  categoryData, 
  transactions, 
  tabKey, 
  onEditTransaction 
}: CategorySectionProps) {
  const [expandedCategory, setExpandedCategory] = useState<Record<string, boolean>>({});
  const [expandedSubcategory, setExpandedSubcategory] = useState<Record<string, boolean>>({});

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

  const renderSubcategorySection = (subcategory: string, subTransactions: Transaction[], showEmpty = false) => {
    const isExpanded = expandedSubcategory[`${tabKey}-${categoryName}-${subcategory}`];
    const subcategoryTotal = subTransactions.reduce((sum, t) => sum + t.valor, 0);
    
    const sortedTransactions = [...subTransactions].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    
    if (subTransactions.length === 0 && !showEmpty) return null;
    
    return (
      <div key={subcategory} className={`mx-2 my-1 rounded ${subTransactions.length === 0 ? 'bg-gray-800 opacity-60' : 'bg-gray-700'}`}>
        <button
          onClick={() => setExpandedSubcategory(prev => ({
            ...prev,
            [`${tabKey}-${categoryName}-${subcategory}`]: !isExpanded
          }))}
          className="w-full p-3 flex items-center justify-between hover:bg-gray-600 transition-colors rounded"
        >
          <div className="flex items-center gap-2">
            <span className={`text-sm ${subTransactions.length === 0 ? 'text-gray-500' : 'text-gray-300'}`}>
              {subcategory}
            </span>
            <span className="text-xs text-gray-500">
              ({subTransactions.length})
              {subTransactions.length === 0 && ' - Vazio'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm ${
              subTransactions.length === 0 
                ? 'text-gray-500' 
                : subcategoryTotal >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              R$ {formatCurrency(Math.abs(subcategoryTotal))}
            </span>
            {subTransactions.length > 0 && (
              isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>
        
        {isExpanded && subTransactions.length > 0 && (
          <div className="border-t border-gray-600">
            <div className="max-h-48 overflow-y-auto">
              {sortedTransactions.map((transaction, idx) => (
                <div key={`${transaction.id}-${idx}`} className="px-4 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-600">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm text-gray-200 font-medium">{transaction.descricao}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(transaction.data)} - {transaction.descricao_origem}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {transaction.valor >= 0 ? '+' : ''} R$ {formatCurrency(Math.abs(transaction.valor))}
                      </span>
                      <button
                        onClick={() => onEditTransaction(transaction)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const isExpanded = expandedCategory[`${tabKey}-${categoryName}`];
  const categoryTotal = transactions.reduce((sum, t) => sum + t.valor, 0);
  // Determine color based on actual values, not hardcoded colors
  const isPositive = categoryTotal >= 0;
  
  const subcategoryGroups: Record<string, Transaction[]> = {};
  
  // Inicializar todos os subtipos com arrays vazios
  categoryData.subtipos.forEach(subtipo => {
    subcategoryGroups[subtipo] = [];
  });
  
  // Agrupar transações existentes
  transactions.forEach(transaction => {
    const subtipo = transaction.subtipo || 'Outros';
    if (!subcategoryGroups[subtipo]) {
      subcategoryGroups[subtipo] = [];
    }
    subcategoryGroups[subtipo].push(transaction);
  });

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
      <button
        onClick={() => setExpandedCategory(prev => ({
          ...prev,
          [`${tabKey}-${categoryName}`]: !isExpanded
        }))}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{categoryData.icon}</span>
          <div className="text-left">
            <p className="font-semibold text-gray-100">{categoryName}</p>
            <p className="text-xs text-gray-400">
              {transactions.length > 0 
                ? `${transactions.length} lançamentos` 
                : 'Nenhum lançamento'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {transactions.length > 0 ? (
            <span className={`font-bold ${
              isPositive ? 'text-green-400' : 'text-red-400'
            }`}>
  {isPositive ? '+' : '-'} R$ {formatCurrency(Math.abs(categoryTotal))}
</span>
          ) : (
            <span className="text-gray-500 text-sm">R$ 0,00</span>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-gray-700">
          {categoryData.subtipos.map(subtipo => {
            const subtipoTransactions = subcategoryGroups[subtipo] || [];
            return renderSubcategorySection(subtipo, subtipoTransactions, true);
          })}
        </div>
      )}
    </div>
  );
}