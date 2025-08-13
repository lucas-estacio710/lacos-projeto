// components/NavigationTabs.tsx
import React from 'react';

interface NavigationTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unclassifiedCount: number;
  unclassifiedCardsCount: number;
  hasReconciliationPending: boolean;
}

export function NavigationTabs({ 
  activeTab, 
  setActiveTab, 
  unclassifiedCount, 
  unclassifiedCardsCount,
  hasReconciliationPending 
}: NavigationTabsProps) {
  const totalPending = unclassifiedCount + unclassifiedCardsCount;
  
  const tabs = [
    {
      id: 'inbox',
      label: '📬 Caixa de Entrada',
      badge: totalPending,
      badgeColor: totalPending > 10 ? 'bg-red-500' : totalPending > 0 ? 'bg-yellow-500' : null,
      highlight: totalPending > 0
    },
    {
      id: 'overview',
      label: '📊 Visão Geral',
      badge: null,
      highlight: false
    },
    {
      id: 'cards',
      label: '💳 Cartões',
      badge: hasReconciliationPending ? '🔗' : null,
      badgeColor: 'bg-green-500',
      highlight: false
    },
    {
      id: 'analytics',
      label: '📈 Análise',
      badge: null,
      highlight: false
    },
    {
      id: 'accounts',
      label: '🏦 Contas',
      badge: null,
      highlight: false
    }
  ];

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-700 mb-4">
      <div className="flex flex-wrap gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex-1 min-w-[80px] py-2 px-2 rounded-lg font-medium transition-all
              ${activeTab === tab.id 
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg text-xs sm:text-sm' 
                : tab.highlight
                  ? 'text-yellow-300 hover:bg-gray-700 animate-pulse text-xs sm:text-sm'
                  : 'text-gray-300 hover:bg-gray-700 text-xs sm:text-sm'
              }
            `}
          >
            <span className="relative flex items-center justify-center">
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              {tab.badge !== null && (
                <span className={`
                  absolute -top-3 -right-3 px-1.5 py-0.5 rounded-full text-xs font-bold
                  ${tab.badgeColor || 'bg-gray-600'} text-white min-w-[20px] text-center
                  ${tab.highlight ? 'animate-bounce' : ''}
                `}>
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}