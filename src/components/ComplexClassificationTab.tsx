// components/ComplexClassificationTab.tsx - VERSÃO LIMPA COM HIERARCHY MANAGER

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Target, 
  TrendingUp, 
  Cpu, 
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit,
  X
} from 'lucide-react';
import { Transaction } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { UploadPlanilhasSection } from './UploadPlanilhasSection';
import { usePlanilhaStats } from '@/hooks/usePlanilhaStats';
import { useEntradasFinanceiras } from '@/hooks/useEntradasFinanceiras';
import { useAgendaInter } from '@/hooks/useAgendaInter';
import { PixInterModal } from './PixInterModal';
import { InterPagModal } from './InterPagModal';
import { TonModal } from './TonModal';
import { CremacoesModal } from './CremacoesModal';
import { ManualEntryModal } from './ManualEntryModal';
import { supabase } from '@/lib/supabase';
import { useConfig } from '@/contexts/ConfigContext';
import { useHierarchy } from '@/hooks/useHierarchy';
import { prepareClassificationOptions, getTransactionHierarchy } from '@/lib/hierarchyHelpers';
import { HierarchyManager } from './HierarchyManager';

interface ComplexClassificationTabProps {
  transactions: Transaction[];
  cardTransactions: CardTransaction[];
  historicTransactions: Transaction[];
  historicCardTransactions: CardTransaction[];
  addTransactions: (transactions: Transaction[]) => Promise<any>;
  onTransactionUpdate: (id: string, updates: Partial<Transaction>) => void;
  onCardTransactionUpdate: (id: string, updates: Partial<CardTransaction>) => void;
  onTransactionReload: () => void;
  onCardTransactionReload: () => void;
}

export const ComplexClassificationTab: React.FC<ComplexClassificationTabProps> = ({
  transactions,
  cardTransactions,
  historicTransactions,
  historicCardTransactions,
  addTransactions,
  onTransactionUpdate,
  onCardTransactionUpdate,
  onTransactionReload,
  onCardTransactionReload
}) => {
  // ID do subtipo COMPLEXA
  const COMPLEX_SUBTIPO_ID = 'e92f4f0f-4e94-4007-8945-a1fb47782051';

  // Contadores para as mini aplicações
  const pixInterCount = useMemo(() => {
    return transactions.filter(t => 
      t.subtipo_id === COMPLEX_SUBTIPO_ID &&
      t.realizado === 'p' &&
      t.origem === 'Inter' &&
      !t.descricao_origem?.toLowerCase().includes('inter pag') &&
      !t.descricao_origem?.toLowerCase().includes('interpag') &&
      t.valor >= 0 // Apenas valores positivos (receitas)
    ).length;
  }, [transactions]);

  const interPagCount = useMemo(() => {
    return transactions.filter(t => 
      t.subtipo_id === COMPLEX_SUBTIPO_ID &&
      t.realizado === 'p' &&
      t.origem === 'Inter' &&
      (t.descricao_origem?.toLowerCase().includes('inter pag') ||
       t.descricao_origem?.toLowerCase().includes('interpag'))
    ).length;
  }, [transactions]);

  const tonCount = useMemo(() => {
    return transactions.filter(t => 
      t.subtipo_id === COMPLEX_SUBTIPO_ID &&
      t.realizado === 'p' &&
      t.cc === 'Stone'
    ).length;
  }, [transactions]);

  const cremacoesCount = useMemo(() => {
    return transactions.filter(t => 
      t.subtipo_id === COMPLEX_SUBTIPO_ID &&
      t.realizado === 'p' &&
      t.valor < 0 // Valores negativos (saídas/gastos)
    ).length;
  }, [transactions]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPixInterModal, setShowPixInterModal] = useState(false);
  const [showInterPagModal, setShowInterPagModal] = useState(false);
  const [showTonModal, setShowTonModal] = useState(false);
  const [showCremacoesModal, setShowCremacoesModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);

  const statsHook = usePlanilhaStats();
  const entradasHook = useEntradasFinanceiras();
  const agendaHook = useAgendaInter();
  const config = useConfig();

  // Contadores básicos
  const totalTransactions = useMemo(() => 
    transactions.length + cardTransactions.length, 
    [transactions.length, cardTransactions.length]
  );

  const classifiedCount = useMemo(() =>
    transactions.filter(t => t.realizado === 's').length + 
    cardTransactions.filter(c => c.status === 'classified').length,
    [transactions, cardTransactions]
  );

  const unclassifiedCount = totalTransactions - classifiedCount;
  const classificationPercentage = totalTransactions > 0 ? (classifiedCount / totalTransactions) * 100 : 0;

  // Handlers para modais específicos
  const handlePixInterClick = useCallback(() => {
    setShowPixInterModal(true);
  }, []);

  const handleInterPagClick = useCallback(() => {
    setShowInterPagModal(true);
  }, []);

  const handleTonClick = useCallback(() => {
    setShowTonModal(true);
  }, []);

  const handleCremacoesClick = useCallback(() => {
    setShowCremacoesModal(true);
  }, []);

  const handleManualEntryClick = useCallback(() => {
    setShowManualEntryModal(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowPixInterModal(false);
    setShowInterPagModal(false);
    setShowTonModal(false);
    setShowCremacoesModal(false);
    setShowManualEntryModal(false);
  }, []);

  // Handlers específicos para cada tipo de modal
  const handleUploadPlanilhasSuccess = useCallback(() => {
    // UploadPlanilhas → stats + entradas financeiras
    if (statsHook.refreshStats) {
      statsHook.refreshStats();
    }
    if (entradasHook.refreshEntradas) {
      entradasHook.refreshEntradas();
    }
  }, [statsHook, entradasHook]);

  const handlePixInterSuccess = useCallback(() => {
    // PixInterModal → transações + entradas
    onTransactionReload();
    onCardTransactionReload();
    if (entradasHook.refreshEntradas) {
      entradasHook.refreshEntradas();
    }
  }, [onTransactionReload, onCardTransactionReload, entradasHook]);

  const handleInterPagSuccess = useCallback(() => {
    // InterPagModal → transações + agenda + percentuais 
    onTransactionReload();
    onCardTransactionReload();
    if (statsHook.refreshStats) {
      statsHook.refreshStats();
    }
    if (agendaHook.refreshData) {
      agendaHook.refreshData();
    }
  }, [onTransactionReload, onCardTransactionReload, statsHook, agendaHook]);

  const handleTonSuccess = useCallback(() => {
    // TonModal → transações + entradas
    onTransactionReload();
    onCardTransactionReload();
    if (entradasHook.refreshEntradas) {
      entradasHook.refreshEntradas();
    }
  }, [onTransactionReload, onCardTransactionReload, entradasHook]);

  const handleCremacoesSuccess = useCallback(() => {
    // CremacoesModal → transações
    onTransactionReload();
    onCardTransactionReload();
  }, [onTransactionReload, onCardTransactionReload]);

  const handleManualEntrySuccess = useCallback(() => {
    // ManualEntryModal → transações
    onTransactionReload();
    onCardTransactionReload();
  }, [onTransactionReload, onCardTransactionReload]);

  const [activeSubTab, setActiveSubTab] = useState<'apps' | 'uploads'>('apps');

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Aplicações e Planilhas */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveSubTab('apps')}
            className={`flex-1 px-4 py-2 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
              activeSubTab === 'apps' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            📝 Aplicações
          </button>
          <button
            onClick={() => setActiveSubTab('uploads')}
            className={`flex-1 px-4 py-2 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
              activeSubTab === 'uploads' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            📤 Planilhas
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeSubTab === 'apps' && (
            <div className="space-y-3">
              <button
                onClick={handlePixInterClick}
                className="w-full p-3 bg-purple-900/30 hover:bg-purple-800/50 border border-purple-600 rounded-lg text-left group transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 group-hover:text-purple-200">
                    <span className="text-lg">🏦</span>
                    <div className="font-medium text-base">PIX Inter</div>
                  </div>
                  {pixInterCount > 0 && (
                    <span className="bg-purple-700 text-purple-200 px-2 py-1 rounded-full text-xs font-semibold">
                      {pixInterCount}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={handleInterPagClick}
                className="w-full p-3 bg-orange-900/30 hover:bg-orange-800/50 border border-orange-600 rounded-lg text-left group transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-300 group-hover:text-orange-200">
                    <span className="text-lg">💳</span>
                    <div className="font-medium text-base">InterPag</div>
                  </div>
                  {interPagCount > 0 && (
                    <span className="bg-orange-700 text-orange-200 px-2 py-1 rounded-full text-xs font-semibold">
                      {interPagCount}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={handleTonClick}
                className="w-full p-3 bg-green-900/30 hover:bg-green-800/50 border border-green-600 rounded-lg text-left group transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-300 group-hover:text-green-200">
                    <span className="text-lg">⚡</span>
                    <div className="font-medium text-base">Ton</div>
                  </div>
                  {tonCount > 0 && (
                    <span className="bg-green-700 text-green-200 px-2 py-1 rounded-full text-xs font-semibold">
                      {tonCount}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={handleCremacoesClick}
                className="w-full p-3 bg-yellow-900/30 hover:bg-yellow-800/50 border border-yellow-600 rounded-lg text-left group transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-300 group-hover:text-yellow-200">
                    <span className="text-lg">💛</span>
                    <div className="font-medium text-base">Cremações</div>
                  </div>
                  {cremacoesCount > 0 && (
                    <span className="bg-yellow-700 text-yellow-200 px-2 py-1 rounded-full text-xs font-semibold">
                      {cremacoesCount}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={handleManualEntryClick}
                className="w-full p-3 bg-gray-900/30 hover:bg-gray-800/50 border border-gray-600 rounded-lg text-left group transition-all"
              >
                <div className="flex items-center gap-2 text-gray-300 group-hover:text-gray-200">
                  <span className="text-lg">✏️</span>
                  <div className="font-medium text-base">Lançamento Manual</div>
                </div>
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full p-3 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-600 rounded-lg text-left group transition-all"
              >
                <div className="flex items-center gap-2 text-blue-300 group-hover:text-blue-200">
                  <span className="text-lg">🏗️</span>
                  <div className="font-medium text-base">Estrutura</div>
                </div>
              </button>
            </div>
          )}

          {activeSubTab === 'uploads' && (
            <UploadPlanilhasSection onStatsUpdate={handleUploadPlanilhasSuccess} />
          )}
        </div>
      </div>

      {/* Modal Pop-up para Reorganizar (mantido para compatibilidade) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-blue-600 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Gerenciar Hierarquia</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <HierarchyManager 
                isOpen={true}
                onClose={() => setIsModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modais das Mini-Aplicações */}
      <PixInterModal 
        isOpen={showPixInterModal} 
        onClose={handleModalClose}
        onSuccess={handlePixInterSuccess}
        complexTransactions={transactions}
        planilhaEntries={entradasHook.entradas || []}
        onMarkEntriesAsUsed={entradasHook.markEntriesAsUsed}
        onApplyReconciliation={async (reconciliationData) => {
          // Aplicar reconciliação das transações PIX Inter
          const { originalTransactionIds, newTransactions } = reconciliationData;
          
          // 1. Marcar transações originais como reconciliadas
          for (const id of originalTransactionIds) {
            onTransactionUpdate(id, { realizado: 'r' });
          }
          
          // 2. Criar novos lançamentos no Supabase (com user_id)
          if (newTransactions.length > 0) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');
            
            // Adicionar user_id às transações
            const transactionsWithUser = newTransactions.map(t => ({
              ...t,
              user_id: user.id
            }));
            
            const { error } = await supabase
              .from('transactions')
              .insert(transactionsWithUser);
            
            if (error) {
              console.error('Erro ao criar novos lançamentos:', error);
              throw error;
            }
          }
          
          // 3. Recarregar dados
          onTransactionReload();
        }}
      />
      
      <InterPagModal 
        isOpen={showInterPagModal} 
        onClose={handleModalClose}
        onSuccess={handleInterPagSuccess}
        complexTransactions={transactions}
        agendaEntries={agendaHook.agendaEntries}
        percentuaisEntries={agendaHook.percentuaisEntries}
        onApplyReconciliation={async (reconciliationData) => {
          // Aplicar reconciliação das transações InterPag
          const { originalTransactionIds, newTransactions } = reconciliationData;
          
          // 1. Marcar transações originais como reconciliadas
          for (const id of originalTransactionIds) {
            onTransactionUpdate(id, { realizado: 'r' });
          }
          
          // 2. Criar novos lançamentos no Supabase (precisa usar nova hierarquia)
          if (newTransactions.length > 0) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');
            
            // Adicionar user_id às transações (InterPag ainda usa sistema antigo)
            const transactionsWithUser = newTransactions.map(t => ({
              ...t,
              user_id: user.id
            }));
            
            const { error } = await supabase
              .from('transactions')
              .insert(transactionsWithUser);
            
            if (error) {
              console.error('Erro ao criar novos lançamentos InterPag:', error);
              throw error;
            }
          }
          
          // 3. Recarregar dados
          onTransactionReload();
        }}
      />
      
      <TonModal 
        isOpen={showTonModal} 
        onClose={handleModalClose}
        onSuccess={handleTonSuccess}
        complexTransactions={transactions}
        planilhaEntries={entradasHook.entradas || []}
        onApplyReconciliation={async (reconciliationData) => {
          // Aplicar reconciliação das transações TON
          const { originalTransactionIds, newTransactions } = reconciliationData;
          
          // 1. Marcar transações originais como reconciliadas
          for (const id of originalTransactionIds) {
            onTransactionUpdate(id, { realizado: 'r' });
          }
          
          // 2. Criar novos lançamentos no Supabase (com user_id)
          if (newTransactions.length > 0) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');
            
            // Adicionar user_id às transações
            const transactionsWithUser = newTransactions.map(t => ({
              ...t,
              user_id: user.id
            }));
            
            const { error } = await supabase
              .from('transactions')
              .insert(transactionsWithUser);
            
            if (error) throw error;
          }
        }}
        onMarkEntriesAsUsed={entradasHook.markEntriesAsUsed}
      />
      
      <CremacoesModal 
        isOpen={showCremacoesModal} 
        onClose={handleModalClose}
        onSuccess={handleCremacoesSuccess}
        complexTransactions={transactions}
        onApplyReconciliation={async (reconciliationData) => {
          const { originalTransactionIds, newTransactions, reconciliationNote, reconciliationMetadata } = reconciliationData;
          
          // Obter user para RLS
          const { data: { user } } = await supabase.auth.getUser();
          
          // Criar novas transações usando addTransactions
          await addTransactions(newTransactions.map((t: any) => ({
            ...t,
            user_id: user?.id // Adicionar user_id para RLS
          })));
          
          // Marcar transações originais como reconciliadas
          for (const id of originalTransactionIds) {
            onTransactionUpdate(id, { 
              realizado: 'r' // Marcar como reconciliada
            });
          }
          
          console.log(`✅ Reconciliação Cremação: ${reconciliationNote}`, reconciliationMetadata);
          
          // Recarregar dados
          onTransactionReload();
        }}
        onMarkTransactionsAsReconciled={async (transactionIds) => {
          // Callback adicional para marcação específica se necessário
          for (const id of transactionIds) {
            onTransactionUpdate(id, { 
              realizado: 'r'
            });
          }
          
          console.log(`✅ Transações marcadas como reconciliadas:`, transactionIds);
        }}
      />
      
      <ManualEntryModal 
        isOpen={showManualEntryModal} 
        onClose={handleModalClose}
        onSuccess={handleManualEntrySuccess}
      />
    </div>
  );
};

export default ComplexClassificationTab;