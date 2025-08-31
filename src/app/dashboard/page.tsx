// page.tsx - ATUALIZADO COM CLASSIFICAÇÃO COMPLEXA

'use client';

import React, { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { Transaction } from '@/types';
import { CardTransaction, ImportResult } from '@/hooks/useCardTransactions';
import { ConfigProvider } from '@/contexts/ConfigContext';

// Hooks
import { useTransactions } from '@/hooks/useTransactions';
import { useCardTransactions } from '@/hooks/useCardTransactions';

// Componentes
import BankUpload from '@/components/BankUpload';
import { NavigationTabs } from '@/components/NavigationTabs';
import { InboxTab } from '@/components/InboxTab';
import { OverviewTab } from '@/components/OverviewTab';
import { AnalyticsTab } from '@/components/AnalyticsTab';
import { ContasTab } from '@/components/ContasTab';
import { CartoesTab } from '@/components/CartoesTab';
import ComplexClassificationTab from '@/components/ComplexClassificationTab'; // ✅ IMPORT CORRIGIDO
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { EditCardTransactionModal } from '@/components/EditTransactionModal';
import { SplitTransactionModal } from '@/components/SplitTransactionModal';
import { SplitCardTransactionModal } from '@/components/SplitCardTransactionModal';
import { ReconciliationModal } from '@/components/ReconciliationModal';
import { SimpleBillDiffModal, BillChanges } from '@/components/SimpleBillDiffModal';

export default function DashboardPage() {
  // ===== HOOKS =====
  const { 
    transactions, 
    addTransactions, 
    updateTransaction, 
    splitTransaction,
    executeReconciliation,
    refreshTransactions
  } = useTransactions();
  
  const { 
    cardTransactions,
    addCardTransactions,
    updateCardTransaction,
    updateMultipleCardTransactions,
    deleteCardTransaction,
    applySimpleDiffChanges,
    replaceFaturaComplete,
    splitCardTransaction,
    markAsReconciled,
    getTransactionsForReconciliation
  } = useCardTransactions();
  
  // ===== ESTADOS =====
  const [activeTab, setActiveTab] = useState(() => {
    // Começar na overview por padrão, mudará para inbox se houver items
    return 'overview';
  });
  const [showBankUpload, setShowBankUpload] = useState(false);
  
  // Estados para modais de edição
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingCardTransaction, setEditingCardTransaction] = useState<CardTransaction | null>(null);
  const [splitingTransaction, setSplitingTransaction] = useState<Transaction | null>(null);
  const [splitingCardTransaction, setSplitingCardTransaction] = useState<CardTransaction | null>(null);
  
  // Estados para reconciliação
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliationTransaction, setReconciliationTransaction] = useState<Transaction | null>(null);
  
  // Estados para SimpleDiff
  const [showSimpleDiff, setShowSimpleDiff] = useState(false);
  const [simpleDiffData, setSimpleDiffData] = useState<{
    faturaId: string;
    existingBill: CardTransaction[];
    newBill: CardTransaction[];
  } | null>(null);

  // ===== FUNÇÕES AUXILIARES =====
  
  // Obter faturas disponíveis para reconciliação
  const getAvailableFaturas = () => {
    const faturas = new Map<string, CardTransaction[]>();
    
    cardTransactions
      .filter(ct => ct.status === 'classified')
      .forEach(ct => {
        if (!faturas.has(ct.fatura_id)) {
          faturas.set(ct.fatura_id, []);
        }
        faturas.get(ct.fatura_id)!.push(ct);
      });
    
    return Array.from(faturas.entries()).map(([faturaId, transactions]) => ({
      faturaId,
      transactions,
      // ✅ CORREÇÃO: Somar valores respeitando sinais (gastos negativos + estornos positivos)
      // e depois aplicar Math.abs para mostrar o valor total da fatura
      totalValue: Math.abs(transactions.reduce((sum, t) => sum + t.valor, 0)),
      month: faturaId.split('_')[1] || '',
      cardCount: transactions.length
    }));
  };

  const canReconcile = () => {
    return getAvailableFaturas().length > 0;
  };

  // ===== ✅ MANTER: FUNÇÕES PARA MOVER PARA CLASSIFICAÇÃO COMPLEXA =====
  
  // Mover para classificação complexa
  const handleMoveToComplexClassification = async (transactionId: string): Promise<void> => {
    try {
      // Verificar se é transaction ou card
      const transaction = transactions.find(t => t.id === transactionId);
      const cardTransaction = cardTransactions.find(c => c.id === transactionId);

      // ID correto do subtipo para classificação complexa
      const COMPLEX_SUBTIPO_ID = 'e92f4f0f-4e94-4007-8945-a1fb47782051';

      if (transaction) {
        // Atualizar transaction usando subtipo_id
        const updatedTransaction: Transaction = {
          ...transaction,
          subtipo_id: COMPLEX_SUBTIPO_ID,
          descricao: transaction.descricao_origem || 'Classificação Complexa',
          realizado: 'p' // Manter como pendente
        };
        
        await updateTransaction(updatedTransaction);
        console.log('✅ Transaction movida para classificação complexa:', transactionId);
        
      } else if (cardTransaction) {
        // Atualizar card transaction usando subtipo_id
        const updatedCardTransaction: CardTransaction = {
          ...cardTransaction,
          subtipo_id: COMPLEX_SUBTIPO_ID,
          descricao_classificada: cardTransaction.descricao_origem || 'Classificação Complexa',
          status: 'pending' // Manter como pendente
        };
        
        await updateCardTransaction(updatedCardTransaction);
        console.log('✅ CardTransaction movida para classificação complexa:', transactionId);
        
      } else {
        throw new Error('Transação não encontrada');
      }
      
    } catch (error) {
      console.error('⛔ Erro ao mover para classificação complexa:', error);
      throw error;
    }
  };

  // ===== CONTADORES PARA BADGES =====
  const COMPLEX_SUBTIPO_ID = 'e92f4f0f-4e94-4007-8945-a1fb47782051';
  
  const unclassifiedCount = transactions.filter(t => t.realizado === 'p' && 
    t.subtipo_id !== COMPLEX_SUBTIPO_ID
  ).length;
  
  const unclassifiedCardsCount = cardTransactions.filter(c => c.status === 'pending' && 
    c.subtipo_id !== COMPLEX_SUBTIPO_ID
  ).length;
  
  // ⭐ NOVO: Contador de transações complexas (sem duplicação)
  const complexCount = transactions.filter(t => 
    t.subtipo_id === COMPLEX_SUBTIPO_ID && t.realizado !== 'r'  // Só COMPLEXA, excluindo reconciliadas
  ).length + cardTransactions.filter(c => 
    c.subtipo_id === COMPLEX_SUBTIPO_ID && c.status !== 'reconciled'  // Só COMPLEXA, excluindo reconciliadas
  ).length;
  
  const hasReconciliationPending = getAvailableFaturas().length > 0;

  // ===== AUTO-NAVEGAÇÃO PARA INBOX =====
  const totalPending = unclassifiedCount + unclassifiedCardsCount;
  
  // Removed auto-navigation logic - let user choose freely

  // ===== HANDLERS DE EDIÇÃO =====
  
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleEditCardTransaction = (transaction: CardTransaction) => {
    setEditingCardTransaction(transaction);
  };

  const handleSaveTransaction = async (updatedTransaction: Transaction) => {
    await updateTransaction(updatedTransaction);
    setEditingTransaction(null);
  };

  const handleSaveCardTransaction = async (updatedTransaction: CardTransaction) => {
    await updateCardTransaction(updatedTransaction);
    setEditingCardTransaction(null);
  };

  const handleSplitTransaction = (transaction: Transaction) => {
    setSplitingTransaction(transaction);
  };

  const handleSplitCardTransaction = (transaction: CardTransaction) => {
    setSplitingCardTransaction(transaction);
  };

  const handleConfirmSplit = async (parts: Array<{
    subtipo_id: string;
    descricao: string;
    valor: number;
  }>) => {
    if (!splitingTransaction) return;
    
    try {
      const result = await splitTransaction(splitingTransaction, parts);
      if (result.success) {
        alert(`✅ Transação dividida em ${result.partsCreated} partes!`);
        setSplitingTransaction(null);
      }
    } catch (error) {
      console.error('⛔ Erro ao dividir transação:', error);
      alert('⛔ Erro ao dividir transação');
    }
  };

  const handleBatchMoveToComplexClassification = async (transactionIds: string[]): Promise<void> => {
    try {
      console.log('🧩 Movendo', transactionIds.length, 'transações para classificação complexa');
      
      let successCount = 0;
      const errors: string[] = [];
      
      // Processar cada transação individualmente
      for (const transactionId of transactionIds) {
        try {
          await handleMoveToComplexClassification(transactionId);
          successCount++;
        } catch (error) {
          console.error(`⛔ Erro ao mover transação ${transactionId}:`, error);
          errors.push(`Transação ${transactionId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }
      
      // Relatório final
      if (successCount > 0) {
        console.log(`✅ ${successCount} transações movidas com sucesso`);
      }
      
      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} erros durante o processo:`, errors);
        throw new Error(`${errors.length} transações falharam ao mover`);
      }
      
    } catch (error) {
      console.error('⛔ Erro no batch de classificação complexa:', error);
      throw error;
    }
  };

  const handleConfirmCardSplit = async (parts: Array<{
    categoria: string;
    subtipo: string;
    descricao_classificada: string;
    valor: number;
  }>) => {
    if (!splitingCardTransaction) return;
    
    try {
      const result = await splitCardTransaction(splitingCardTransaction, parts);
      if (result.success) {
        alert(`✅ Transação de cartão dividida em ${result.partsCreated} partes!`);
        setSplitingCardTransaction(null);
      }
    } catch (error) {
      console.error('⛔ Erro ao dividir transação de cartão:', error);
      alert('⛔ Erro ao dividir transação de cartão');
    }
  };

  // ===== HANDLERS DE IMPORTAÇÃO =====
  
  const handleTransactionsImported = async (importedTransactions: Transaction[]) => {
    try {
      const result = await addTransactions(importedTransactions);
      return result;
    } catch (error) {
      console.error('Erro ao importar transações:', error);
      throw error;
    }
  };

  const handleCardTransactionsImported = async (importedCards: CardTransaction[]): Promise<ImportResult> => {
    try {
      console.log('📄 Processando importação de cartões (NOVO FLUXO)');
      
      const result = await addCardTransactions(importedCards);
      
      if (result.requiresSimpleDiff) {
        console.log('📊 Abrindo SimpleDiff...');
        
        setSimpleDiffData({
          faturaId: result.faturaId,
          existingBill: result.existingBill,
          newBill: result.newBill
        });
        
        setShowSimpleDiff(true);
        console.log('✅ SimpleDiff configurado e aberto');
      }
      
      return result;
      
    } catch (error) {
      console.error('⛔ Erro ao importar cartões:', error);
      throw error;
    }
  };

  const handleSimpleDiffApply = async (changes: BillChanges) => {
    if (!simpleDiffData) return;
    
    try {
      console.log('📄 Aplicando mudanças do SimpleDiff...');
      
      const result = await applySimpleDiffChanges({
        toAdd: changes.toAdd,
        toKeep: changes.toKeep,
        toRemove: changes.toRemove
      });
      
      if (result.success) {
        const { added, kept, removed } = result.stats;
        
        alert(`✅ Fatura atualizada com sucesso!\n\n` +
              `➕ ${added} transações adicionadas\n` +
              `✅ ${kept} transações mantidas\n` +
              `🗑️ ${removed} transações removidas\n\n` +
              `📋 Fatura: ${simpleDiffData.faturaId}`);
      } else {
        throw new Error('Falha ao aplicar mudanças');
      }
      
      setShowSimpleDiff(false);
      setSimpleDiffData(null);
      
    } catch (error) {
      console.error('⛔ Erro ao aplicar SimpleDiff:', error);
      alert('⛔ Erro ao aplicar mudanças');
    }
  };

  const handleSimpleDiffReplaceAll = async () => {
    if (!simpleDiffData) return;
    
    try {
      console.log('📄 Substituindo fatura completa...');
      
      const result = await replaceFaturaComplete(
        simpleDiffData.faturaId,
        simpleDiffData.newBill
      );
      
      if (result.success) {
        alert(`✅ Fatura substituída completamente!\n\n` +
              `📋 ${simpleDiffData.newBill.length} transações importadas\n` +
              `📄 Fatura: ${simpleDiffData.faturaId}`);
      } else {
        throw new Error('Falha na substituição');
      }
      
      setShowSimpleDiff(false);
      setSimpleDiffData(null);
      
    } catch (error) {
      console.error('⛔ Erro na substituição:', error);
      alert('⛔ Erro ao substituir fatura');
    }
  };

  const handleSimpleDiffCancel = () => {
    console.log('⛔ Importação cancelada pelo usuário');
    setShowSimpleDiff(false);
    setSimpleDiffData(null);
    alert('ℹ️ Importação cancelada');
  };

  // ===== HANDLERS DE RECONCILIAÇÃO =====
  
  const handleReconciliation = (transaction: Transaction) => {
    setReconciliationTransaction(transaction);
    setShowReconciliation(true);
  };

  const handleConfirmReconciliation = async (faturaId: string, cardTransactionIds: string[]) => {
    if (!reconciliationTransaction) return;
    
    try {
      const selectedCards = cardTransactions.filter(ct => 
        cardTransactionIds.includes(ct.id)
      );
      
      const result = await executeReconciliation(
        reconciliationTransaction,
        selectedCards,
        faturaId
      );
      
      if (result.success) {
        await markAsReconciled(cardTransactionIds);
        
        alert(`✅ Reconciliação concluída!\n\n` +
              `💳 Pagamento reconciliado\n` +
              `📋 ${result.createdTransactions} transações criadas\n` +
              `🔗 Fatura: ${faturaId}`);
        
        setShowReconciliation(false);
        setReconciliationTransaction(null);
      } else {
        throw new Error(result.errors.join(', '));
      }
    } catch (error) {
      console.error('⛔ Erro na reconciliação:', error);
      alert('⛔ Erro na reconciliação');
    }
  };

  // ===== HANDLERS DE CLASSIFICAÇÃO =====
  
  const handleQuickClassificationTransactions = async (transactionId: string, classification: any) => {
    try {
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) return;

      const updatedTransaction: Transaction = {
        ...transaction,
        subtipo_id: classification.subtipo_id,
        descricao: classification.descricao,
        realizado: 's'
      };

      await updateTransaction(updatedTransaction);
    } catch (error) {
      console.error('⛔ Erro na classificação rápida:', error);
      alert('⛔ Erro ao aplicar classificação');
    }
  };

  const handleQuickClassificationCards = async (cardId: string, classification: any) => {
    try {
      const card = cardTransactions.find(c => c.id === cardId);
      if (!card) return;

      const updatedCard: CardTransaction = {
        ...card,
        subtipo_id: classification.subtipo_id,
        descricao_classificada: classification.descricao,
        status: 'classified'
      };

      await updateCardTransaction(updatedCard);
    } catch (error) {
      console.error('⛔ Erro na classificação rápida:', error);
      alert('⛔ Erro ao aplicar classificação');
    }
  };

  const handleBatchClassificationTransactions = async (classifications: Array<{
    id: string;
    subtipo_id: string;
    descricao: string;
  }>) => {
    try {
      for (const classification of classifications) {
        const transaction = transactions.find(t => t.id === classification.id);
        if (!transaction) continue;

        const updatedTransaction: Transaction = {
          ...transaction,
          subtipo_id: classification.subtipo_id,
          descricao: classification.descricao,
          realizado: 's'
        };

        await updateTransaction(updatedTransaction);
      }
      
      alert(`✅ ${classifications.length} transações classificadas!`);
    } catch (error) {
      console.error('⛔ Erro na classificação em lote:', error);
      alert('⛔ Erro ao aplicar classificações');
    }
  };

  const handleBatchClassificationCards = async (classifications: Array<{
    id: string;
    subtipo_id: string;
    descricao: string;
  }>) => {
    try {
      const updates = classifications.map(c => ({
        id: c.id,
        subtipo_id: c.subtipo_id,
        descricao_classificada: c.descricao
      }));
      
      const count = await updateMultipleCardTransactions(updates);
      alert(`✅ ${count} transações de cartão classificadas!`);
    } catch (error) {
      console.error('⛔ Erro na classificação em lote:', error);
      alert('⛔ Erro ao aplicar classificações');
    }
  };

  const handleBatchClassification = async (classifications: Array<{
    id: string;
    subtipo_id: string;
    descricao: string;
  }>) => {
    const transactionClassifications: typeof classifications = [];
    const cardClassifications: typeof classifications = [];
    
    classifications.forEach(c => {
      if (transactions.find(t => t.id === c.id)) {
        transactionClassifications.push(c);
      } else if (cardTransactions.find(ct => ct.id === c.id)) {
        cardClassifications.push(c);
      }
    });
    
    if (transactionClassifications.length > 0) {
      await handleBatchClassificationTransactions(transactionClassifications);
    }
    if (cardClassifications.length > 0) {
      await handleBatchClassificationCards(cardClassifications);
    }
  };

  return (
    <ConfigProvider>
      <div className="min-h-screen bg-gray-900">
      <div className="max-w-md mx-auto p-4 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-gray-900 via-purple-950 to-black border border-purple-900/50 text-white py-4 px-4 rounded-xl mb-4 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-gray-900/10 blur-xl opacity-30 animate-pulse"></div>
          
          {/* Matrix effect background */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-2 left-4 text-green-400 text-xs font-mono animate-pulse">01001100</div>
            <div className="absolute top-6 right-8 text-blue-400 text-xs font-mono animate-pulse delay-75">AI.v3.0</div>
            <div className="absolute bottom-2 left-8 text-cyan-400 text-xs font-mono animate-pulse delay-150">NEURAL</div>
            <div className="absolute bottom-6 right-4 text-purple-400 text-xs font-mono animate-pulse delay-300">QUANTUM</div>
          </div>
          
          <div className="relative">
            {/* Main title - spanning full width */}
            <div className="flex items-center justify-between mb-3">
              <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-cyan-500 flex-1"></div>
              <h1 className="text-3xl md:text-4xl font-black mx-4 relative group">
                <span className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent tracking-wider">
                  LAÇOS 3.0
                </span>
                <div className="absolute -inset-2 bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 rounded-lg blur opacity-20 group-hover:opacity-60 transition duration-1000"></div>
              </h1>
              <div className="h-px bg-gradient-to-r from-cyan-500 via-cyan-500/50 to-transparent flex-1"></div>
            </div>
            
            {/* Subtitle - full width bar */}
            <div className="bg-gradient-to-r from-gray-900/90 via-purple-900/40 to-gray-900/90 border border-cyan-500/20 rounded-full py-2 px-6 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-3">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                <span className="text-sm font-mono font-bold text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text tracking-wide">
                  ULTIMATE FINANCIAL AI SYSTEM
                </span>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping delay-150"></div>
              </div>
              
              {/* Neural network lines */}
              <div className="flex justify-center mt-2 gap-1">
                <div className="w-8 h-px bg-gradient-to-r from-transparent to-cyan-400 animate-pulse"></div>
                <div className="w-4 h-px bg-gradient-to-r from-cyan-400 to-purple-400 animate-pulse delay-75"></div>
                <div className="w-6 h-px bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse delay-150"></div>
                <div className="w-4 h-px bg-gradient-to-r from-pink-400 to-purple-400 animate-pulse delay-225"></div>
                <div className="w-8 h-px bg-gradient-to-r from-purple-400 to-transparent animate-pulse delay-300"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Área de importação inicial */}
        {transactions.length === 0 && cardTransactions.length === 0 && (
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 mb-4">
            <h3 className="font-semibold mb-3 text-gray-100">📊 Começar</h3>
            <button
              onClick={() => setShowBankUpload(true)}
              className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors"
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-400">Importar Extrato ou Fatura</p>
            </button>
          </div>
        )}

        {/* Navegação e conteúdo principal */}
        {(transactions.length > 0 || cardTransactions.length > 0) && (
          <>
            {/* ⭐ ATUALIZADO: NavigationTabs com complexCount - STICKY */}
            <div className="sticky top-0 z-50 bg-gray-900 pb-2 -mx-4 px-4 pt-2">
              <NavigationTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                unclassifiedCount={unclassifiedCount}
                unclassifiedCardsCount={unclassifiedCardsCount}
                hasReconciliationPending={hasReconciliationPending}
                complexCount={complexCount} // ⭐ NOVO
                transactions={transactions} // ⭐ NOVO
                onShowUpload={() => setShowBankUpload(true)} // ⭐ NOVO
              />
            </div>

            {/* Conteúdo das abas */}
            {/* Aba Inbox - MANTIDA com função de mover para complexa */}
            {activeTab === 'inbox' && (
              <InboxTab
                unclassifiedTransactions={transactions
                  .filter(t => 
                    t.realizado === 'p' && 
                    t.subtipo_id !== COMPLEX_SUBTIPO_ID
                  )
                  .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                }
                unclassifiedCards={cardTransactions
                  .filter(c => 
                    c.status === 'pending' && 
                    c.subtipo_id !== COMPLEX_SUBTIPO_ID
                  )
                  .sort((a, b) => new Date(b.data_transacao).getTime() - new Date(a.data_transacao).getTime())
                }
                historicTransactions={transactions.filter(t => t.realizado === 's')}
                historicCardTransactions={cardTransactions.filter(c => c.status === 'classified')}
                onEditTransaction={handleEditTransaction}
                onEditCardTransaction={handleEditCardTransaction}
                onReconcileTransaction={handleReconciliation}
                onApplyQuickClassification={async (id, classification) => {
                  if (transactions.find(t => t.id === id)) {
                    await handleQuickClassificationTransactions(id, classification);
                  } else {
                    await handleQuickClassificationCards(id, classification);
                  }
                }}
                onApplyBatchClassification={handleBatchClassification}
                onMoveToComplexClassification={handleMoveToComplexClassification}
                canReconcile={canReconcile()}
              />
            )}

{/* ⭐ NOVA ABA: Classificação Complexa */}
{activeTab === 'complex' && (
  <ComplexClassificationTab
    transactions={transactions}
    cardTransactions={cardTransactions}
    historicTransactions={transactions.filter(t => t.realizado === 's')}
    historicCardTransactions={cardTransactions.filter(c => c.status === 'classified')}
    addTransactions={addTransactions}
    onTransactionUpdate={(id: string, updates: Partial<Transaction>) => {
      const fullTransaction = { ...transactions.find(t => t.id === id)!, ...updates };
      return updateTransaction(fullTransaction);
    }}
    onCardTransactionUpdate={(id: string, updates: Partial<CardTransaction>) => {
      const fullCardTransaction = { ...cardTransactions.find(c => c.id === id)!, ...updates };
      return updateCardTransaction(fullCardTransaction);
    }}
    onTransactionReload={refreshTransactions}
    onCardTransactionReload={() => {
      // Recarregar card transactions - implementar se necessário
      console.log('Card transaction reload requested');
    }}
  />
)}

            {activeTab === 'overview' && (
              <OverviewTab 
                transactions={transactions.filter(t => t.realizado === 's')}
                onEditTransaction={handleEditTransaction}
              />
            )}

            {activeTab === 'cards' && (
              <CartoesTab 
                cardTransactions={cardTransactions.filter(c => c.status === 'classified' || c.status === 'reconciled')}
                onEditCardTransaction={handleEditCardTransaction}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab transactions={transactions} />
            )}

            {activeTab === 'accounts' && (
              <ContasTab transactions={transactions} />
            )}

          </>
        )}

        {/* ===== MODAIS ===== */}
        
        <BankUpload
          isOpen={showBankUpload}
          onClose={() => setShowBankUpload(false)}
          onTransactionsImported={handleTransactionsImported}
          onCardTransactionsImported={handleCardTransactionsImported}
        />

        <EditTransactionModal
          transaction={editingTransaction}
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleSaveTransaction}
          onSplit={handleSplitTransaction}
          onReconcile={handleReconciliation}
          canReconcile={canReconcile()}
        />

        <EditCardTransactionModal
          transaction={editingCardTransaction}
          isOpen={!!editingCardTransaction}
          onClose={() => setEditingCardTransaction(null)}
          onSave={handleSaveCardTransaction}
          onSplit={handleSplitCardTransaction}
        />

        <SplitTransactionModal
          transaction={splitingTransaction}
          isOpen={!!splitingTransaction}
          onClose={() => setSplitingTransaction(null)}
          onSplit={handleConfirmSplit}
        />

        <SplitCardTransactionModal
          transaction={splitingCardTransaction}
          isOpen={!!splitingCardTransaction}
          onClose={() => setSplitingCardTransaction(null)}
          onSplit={handleConfirmCardSplit}
        />

        <ReconciliationModal
          isOpen={showReconciliation}
          transaction={reconciliationTransaction}
          availableFaturas={getAvailableFaturas()}
          onClose={() => {
            setShowReconciliation(false);
            setReconciliationTransaction(null);
          }}
          onConfirm={handleConfirmReconciliation}
        />

        {showSimpleDiff && simpleDiffData && (
          <SimpleBillDiffModal
            isOpen={showSimpleDiff}
            faturaId={simpleDiffData.faturaId}
            oldBill={simpleDiffData.existingBill}
            newBill={simpleDiffData.newBill}
            onClose={() => {
              setShowSimpleDiff(false);
              setSimpleDiffData(null);
            }}
            onApply={handleSimpleDiffApply}
            onCancel={handleSimpleDiffCancel}
            onReplaceAll={handleSimpleDiffReplaceAll}
          />
        )}
      </div>
    </div>
    </ConfigProvider>
  );
}