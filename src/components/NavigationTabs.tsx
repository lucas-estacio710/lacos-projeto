// components/NavigationTabs.tsx - COM CLASSIFICAÇÃO COMPLEXA ADICIONADA

import React from 'react';
import { Upload } from 'lucide-react';

interface NavigationTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unclassifiedCount: number;
  unclassifiedCardsCount: number;
  hasReconciliationPending: boolean;
  complexCount?: number; // ⭐ NOVO: Contador de transações complexas
  transactions?: any[]; // ⭐ NOVO: Para calcular complexCount automaticamente
  onShowUpload?: () => void; // ⭐ NOVO: Callback para mostrar upload
}

export function NavigationTabs({ 
  activeTab, 
  setActiveTab, 
  unclassifiedCount, 
  unclassifiedCardsCount,
  hasReconciliationPending,
  complexCount,
  transactions = [],
  onShowUpload
}: NavigationTabsProps) {
  const totalPending = unclassifiedCount + unclassifiedCardsCount;
  
  // ⭐ CALCULAR TRANSAÇÕES COMPLEXAS SE NÃO FOR PASSADO
  const COMPLEX_SUBTIPO_ID = 'e92f4f0f-4e94-4007-8945-a1fb47782051';
  const calculatedComplexCount = complexCount !== undefined 
    ? complexCount 
    : transactions.filter(t => 
        t.subtipo_id === COMPLEX_SUBTIPO_ID || 
        (t.realizado === 'p' && !t.subtipo_id)
      ).length;
  
  const tabs = [
    {
      id: 'overview',
      label: '📊 Geral',
      badge: null,
      highlight: false,
      bgStyle: 'bg-blue-900/30 border border-blue-600',
      activeStyle: 'bg-gradient-to-r from-blue-600 to-blue-800',
      textColor: 'text-blue-100'
    },
    {
      id: 'inbox',
      label: '📬 Inbox',
      badge: totalPending,
      badgeColor: totalPending > 10 ? 'bg-red-500' : totalPending > 0 ? 'bg-yellow-500' : null,
      highlight: totalPending > 0,
      bgStyle: 'bg-yellow-900/30 border border-yellow-600',
      activeStyle: 'bg-gradient-to-r from-yellow-600 to-yellow-800',
      textColor: 'text-yellow-100'
    },
    {
      id: 'complex',
      label: '🧩 Complexa',
      badge: calculatedComplexCount,
      badgeColor: calculatedComplexCount > 0 ? 'bg-purple-500' : null,
      highlight: calculatedComplexCount > 0,
      bgStyle: 'bg-purple-900/30 border border-purple-600',
      activeStyle: 'bg-gradient-to-r from-purple-600 to-purple-800',
      textColor: 'text-purple-100'
    },
    {
      id: 'cards',
      label: '💳 Cartões',
      badge: hasReconciliationPending ? '🔗' : null,
      badgeColor: 'bg-green-500',
      highlight: false,
      bgStyle: 'bg-green-900/30 border border-green-600',
      activeStyle: 'bg-gradient-to-r from-green-600 to-green-800',
      textColor: 'text-green-100'
    },
    {
      id: 'analytics',
      label: '📈 Análise',
      badge: null,
      highlight: false,
      bgStyle: 'bg-orange-900/30 border border-orange-600',
      activeStyle: 'bg-gradient-to-r from-orange-600 to-orange-800',
      textColor: 'text-orange-100'
    },
    {
      id: 'accounts',
      label: '🏦 Contas',
      badge: null,
      highlight: false,
      bgStyle: 'bg-teal-900/30 border border-teal-600',
      activeStyle: 'bg-gradient-to-r from-teal-600 to-teal-800',
      textColor: 'text-teal-100'
    }
  ];

  const uploadButton = {
    id: 'upload',
    label: '📤 Upload',
    isButton: true,
    bgStyle: 'bg-gray-900/50 border border-gray-600',
    hoverStyle: 'hover:bg-gray-700 hover:border-gray-500',
    textColor: 'text-gray-100'
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-700 mb-4">
      <div className="flex flex-wrap gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex-1 min-w-[70px] py-2 px-2 rounded-lg font-medium transition-all text-xs sm:text-sm
              ${activeTab === tab.id 
                ? `${tab.activeStyle} text-white shadow-lg`
                : tab.highlight
                  ? `${tab.bgStyle} ${tab.textColor} hover:opacity-80 animate-pulse`
                  : `${tab.bgStyle} ${tab.textColor} hover:opacity-80`
              }
            `}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="hidden sm:flex flex-col items-center">
                <span className="text-lg">{tab.label.split(' ')[0]}</span>
                <span className="text-xs">{tab.label.split(' ').slice(1).join(' ')}</span>
              </div>
              <span className="sm:hidden text-2xl">{tab.label.split(' ')[0]}</span>
              {tab.badge !== null && (
                <span className={`
                  mt-1 px-1.5 py-0.5 rounded-full text-xs font-bold
                  ${tab.badgeColor || 'bg-gray-600'} text-white min-w-[20px] text-center
                  ${tab.highlight ? 'animate-bounce' : ''}
                `}>
                  {tab.badge}
                </span>
              )}
            </div>
          </button>
        ))}
        
        {/* Botão de Upload */}
        {onShowUpload && (
          <button
            onClick={onShowUpload}
            className={`
              relative flex-1 min-w-[70px] py-2 px-2 rounded-lg font-medium transition-all text-xs sm:text-sm
              ${uploadButton.bgStyle} ${uploadButton.textColor} ${uploadButton.hoverStyle}
            `}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="hidden sm:flex flex-col items-center">
                <Upload className="w-5 h-5" />
                <span className="text-xs">Upload</span>
              </div>
              <Upload className="sm:hidden w-6 h-6" />
            </div>
          </button>
        )}
      </div>
      
      {/* ⭐ NOVO: Indicador especial quando há transações complexas */}
      {calculatedComplexCount > 0 && activeTab !== 'complex' && (
        <div className="mt-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-900/30 border border-purple-600 rounded-full text-purple-300 text-xs animate-pulse">
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-ping"></span>
            {calculatedComplexCount} transação{calculatedComplexCount > 1 ? 'ões' : ''} aguardando classificação complexa
          </div>
        </div>
      )}
    </div>
  );
}