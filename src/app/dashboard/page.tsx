'use client';

import React, { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { Transaction } from '@/types';
import { CardTransaction, ImportResult } from '@/hooks/useCardTransactions';

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
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { EditCardTransactionModal } from '@/components/EditTransactionModal'; // Corrigido o import
import { SplitTransactionModal } from '@/components/SplitTransactionModal';
import { ReconciliationModal } from '@/components/ReconciliationModal';
import { SimpleBillDiffModal, BillChanges } from '@/components/SimpleBillDiffModal';

export default function DashboardPage() {
  // ===== HOOKS =====
  const { 
    transactions, 
    addTransactions, 
    updateTransaction, 
    splitTransaction,
    executeReconciliation 
  } = useTransactions();
  
  const { 
    cardTransactions,
    addCardTransactions,
    updateCardTransaction,
    updateMultipleCardTransactions,
    deleteCardTransaction, // ← ADICIONAR ESTA LINHA
    replaceFatura,
    markAsReconciled,
    compareTransactions,
    getTransactionsForReconciliation
  } = useCardTransactions();
  
  // ===== ESTADOS =====
  const [activeTab, setActiveTab] = useState('inbox');
  const [showBankUpload, setShowBankUpload] = useState(false);
  
  // Estados para modais de edição
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingCardTransaction, setEditingCardTransaction] = useState<CardTransaction | null>(null);
  const [splitingTransaction, setSplitingTransaction] = useState<Transaction | null>(null);
  
  // Estados para reconciliação
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliationTransaction, setReconciliationTransaction] = useState<Transaction | null>(null);
  
  // Estados para matching de faturas
const [showCardMatching, setShowCardMatching] = useState(false);
const [cardMatchingData, setCardMatchingData] = useState<{
  faturaId: string;
  oldBill: CardTransaction[];
  newBill: CardTransaction[];
} | null>(null);

  // ===== FUNÇÕES AUXILIARES (MOVIDAS PARA CIMA) =====
  
  // Obter faturas disponíveis para reconciliação
  const getAvailableFaturas = () => {
    // Agrupar card_transactions classificadas por fatura
    const faturas = new Map<string, CardTransaction[]>();
    
    cardTransactions
      .filter(ct => ct.status === 'classified')
      .forEach(ct => {
        if (!faturas.has(ct.fatura_id)) {
          faturas.set(ct.fatura_id, []);
        }
        faturas.get(ct.fatura_id)!.push(ct);
      });
    
    // Converter para formato esperado pelo ReconciliationModal
    return Array.from(faturas.entries()).map(([faturaId, transactions]) => ({
      faturaId,
      transactions,
      totalValue: transactions.reduce((sum, t) => sum + Math.abs(t.valor), 0),
      month: faturaId.split('_')[1] || '',
      cardCount: transactions.length
    }));
  };

  // Verificar se pode reconciliar
  const canReconcile = () => {
    return getAvailableFaturas().length > 0;
  };

  // ===== CONTADORES PARA BADGES (APÓS AS FUNÇÕES) =====
  const unclassifiedCount = transactions.filter(t => t.realizado === 'p').length;
  const unclassifiedCardsCount = cardTransactions.filter(c => c.status === 'pending').length;
  const hasReconciliationPending = getAvailableFaturas().length > 0;

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

  const handleConfirmSplit = async (parts: Array<{
    categoria: string;
    subtipo: string;
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
      console.error('❌ Erro ao dividir transação:', error);
      alert('❌ Erro ao dividir transação');
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
    const result = await addCardTransactions(importedCards, true);
    
    // Se detectou duplicatas, mostrar modal de comparação
    if (result.matches && result.matches.length > 0) {
      // Extrair fatura antiga dos matches
      const oldBill: CardTransaction[] = [];
      
      result.matches.forEach(match => {
        if (match.transacaoExistente && !oldBill.find(t => t.id === match.transacaoExistente!.id)) {
          oldBill.push(match.transacaoExistente);
        }
      });
      
      setCardMatchingData({
        faturaId: importedCards[0].fatura_id,
        oldBill: oldBill,
        newBill: importedCards // Usar a fatura completa nova
      });
      setShowCardMatching(true);
    } else if (result.success) {
      // Importação normal concluída
      let message = `✅ Fatura Nubank importada!\n\n`;
      message += `📊 ${importedCards.length} transações processadas\n`;
      
      if (result?.stats) {
        message += `➕ ${result.stats.added} adicionadas\n`;
        if (result.stats.duplicates > 0) {
          message += `🔄 ${result.stats.duplicates} duplicatas ignoradas\n`;
        }
      }
      
      message += `\n🆔 Fatura: ${importedCards[0].fatura_id}`;
      
      alert(message);
    }
    
    return result;
  } catch (error) {
    console.error('Erro ao importar cartões:', error);
    throw error;
  }
};


  const handleMergeCard = async (selectedIds: string[]) => {
    if (!cardMatchingData) return;
    
    try {
      // Implementar lógica de merge (manter selecionadas + adicionar novas)
      alert(`✅ Fatura mesclada! ${selectedIds.length} transações mantidas.`);
      setShowCardMatching(false);
      setCardMatchingData(null);
    } catch (error) {
      console.error('Erro ao mesclar fatura:', error);
      alert('❌ Erro ao mesclar fatura');
    }
  };

  const handleCancelCard = () => {
    setShowCardMatching(false);
    setCardMatchingData(null);
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
      // Buscar as card transactions selecionadas
      const selectedCards = cardTransactions.filter(ct => 
        cardTransactionIds.includes(ct.id)
      );
      
      // Executar reconciliação completa
      const result = await executeReconciliation(
        reconciliationTransaction,
        selectedCards,
        faturaId
      );
      
      if (result.success) {
        // Marcar cards como reconciliadas
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
      console.error('❌ Erro na reconciliação:', error);
      alert('❌ Erro na reconciliação');
    }
  };

  // ===== HANDLERS DE CLASSIFICAÇÃO =====
  
  // Handler para classificação rápida (transactions)
  const handleQuickClassificationTransactions = async (transactionId: string, classification: any) => {
    try {
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) return;

      const updatedTransaction: Transaction = {
        ...transaction,
        conta: classification.conta,
        categoria: classification.categoria,
        subtipo: classification.subtipo,
        descricao: classification.descricao,
        realizado: 's'
      };

      await updateTransaction(updatedTransaction);
    } catch (error) {
      console.error('❌ Erro na classificação rápida:', error);
      alert('❌ Erro ao aplicar classificação');
    }
  };

  // Handler para classificação rápida (cards)
  const handleQuickClassificationCards = async (cardId: string, classification: any) => {
    try {
      const card = cardTransactions.find(c => c.id === cardId);
      if (!card) return;

      const updatedCard: CardTransaction = {
        ...card,
        categoria: classification.categoria,
        subtipo: classification.subtipo,
        descricao_classificada: classification.descricao,
        status: 'classified'
      };

      await updateCardTransaction(updatedCard);
    } catch (error) {
      console.error('❌ Erro na classificação rápida:', error);
      alert('❌ Erro ao aplicar classificação');
    }
  };

  // Handler para classificação em lote (transactions)
  const handleBatchClassificationTransactions = async (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => {
    try {
      for (const classification of classifications) {
        const transaction = transactions.find(t => t.id === classification.id);
        if (!transaction) continue;

        const updatedTransaction: Transaction = {
          ...transaction,
          conta: classification.conta,
          categoria: classification.categoria,
          subtipo: classification.subtipo,
          descricao: classification.descricao,
          realizado: 's'
        };

        await updateTransaction(updatedTransaction);
      }
      
      alert(`✅ ${classifications.length} transações classificadas!`);
    } catch (error) {
      console.error('❌ Erro na classificação em lote:', error);
      alert('❌ Erro ao aplicar classificações');
    }
  };

  // Handler para classificação em lote (cards)
  const handleBatchClassificationCards = async (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => {
    try {
      const updates = classifications.map(c => ({
        id: c.id,
        categoria: c.categoria,
        subtipo: c.subtipo,
        descricao_classificada: c.descricao
      }));
      
      const count = await updateMultipleCardTransactions(updates);
      alert(`✅ ${count} transações de cartão classificadas!`);
    } catch (error) {
      console.error('❌ Erro na classificação em lote:', error);
      alert('❌ Erro ao aplicar classificações');
    }
  };

  // Handler unificado para classificação em lote
  const handleBatchClassification = async (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => {
    // Separar por tipo
    const transactionClassifications: typeof classifications = [];
    const cardClassifications: typeof classifications = [];
    
    classifications.forEach(c => {
      if (transactions.find(t => t.id === c.id)) {
        transactionClassifications.push(c);
      } else if (cardTransactions.find(ct => ct.id === c.id)) {
        cardClassifications.push(c);
      }
    });
    
    // Aplicar classificações
    if (transactionClassifications.length > 0) {
      await handleBatchClassificationTransactions(transactionClassifications);
    }
    if (cardClassifications.length > 0) {
      await handleBatchClassificationCards(cardClassifications);
    }
  };

const handleBillDiffApply = async (changes: BillChanges) => {
  if (!cardMatchingData) return;
  
  try {
    // 1. Remover transações marcadas para exclusão
    if (changes.toRemove.length > 0) {
      for (const id of changes.toRemove) {
        // Usar função do hook
        const existingCard = cardTransactions.find(t => t.id === id);
        if (existingCard) {
          await deleteCardTransaction(id);
        }
      }
    }
    
    // 2. Adicionar novas transações
    if (changes.toAdd.length > 0) {
      await addCardTransactions(changes.toAdd, false);
    }
    
    alert(`✅ Fatura atualizada!\n` +
          `➕ ${changes.toAdd.length} adicionadas\n` +
          `✅ ${changes.toKeep.length} mantidas\n` +
          `🗑️ ${changes.toRemove.length} removidas`);
    
    setShowCardMatching(false);
    setCardMatchingData(null);
  } catch (error) {
    console.error('Erro ao aplicar mudanças:', error);
    alert('❌ Erro ao aplicar mudanças');
  }
};

const handleBillDiffCancel = () => {
  setShowCardMatching(false);
  setCardMatchingData(null);
  alert('ℹ️ Importação cancelada');
};

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg mb-4 shadow-lg relative">
          <h1 className="text-xl font-bold text-center" style={{ fontFamily: 'monospace, Courier New' }}>
            LAÇOS 2.0 - Simplificado
          </h1>
          <button
            onClick={() => setShowBankUpload(true)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            title="Importar dados"
          >
            <span className="text-2xl leading-none mb-1">+</span>
          </button>
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
            {/* Nova Navegação com Badges */}
            <NavigationTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              unclassifiedCount={unclassifiedCount}
              unclassifiedCardsCount={unclassifiedCardsCount}
              hasReconciliationPending={hasReconciliationPending}
            />

            {/* Conteúdo das abas */}
            {activeTab === 'inbox' && (
              <InboxTab
                unclassifiedTransactions={transactions.filter(t => t.realizado === 'p')}
                unclassifiedCards={cardTransactions.filter(c => c.status === 'pending')}
                historicTransactions={transactions.filter(t => t.realizado === 's')}
                historicCardTransactions={cardTransactions.filter(c => c.status === 'classified')}
                onEditTransaction={handleEditTransaction}
                onEditCardTransaction={handleEditCardTransaction}
                onReconcileTransaction={handleReconciliation}
                onApplyQuickClassification={async (id, classification) => {
                  // Determinar se é transaction ou card
                  if (transactions.find(t => t.id === id)) {
                    await handleQuickClassificationTransactions(id, classification);
                  } else {
                    await handleQuickClassificationCards(id, classification);
                  }
                }}
                onApplyBatchClassification={handleBatchClassification}
                canReconcile={canReconcile()}
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
                cardTransactions={cardTransactions.filter(c => c.status === 'classified')}
                onEditCardTransaction={handleEditCardTransaction}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab transactions={transactions} />
            )}

            {activeTab === 'accounts' && (
              <ContasTab transactions={transactions} />
            )}

            {/* Botão para importar novo arquivo */}
            <div className="mt-4">
              <button
                onClick={() => setShowBankUpload(true)}
                className="w-full p-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
              >
                🔄 Importar Novo Arquivo
              </button>
            </div>

            {/* Indicador de reconciliação disponível */}
            {canReconcile() && activeTab !== 'inbox' && (
              <div className="mt-4 bg-green-900 border border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">🔗</span>
                  <div>
                    <p className="text-green-100 text-sm font-medium">
                      Reconciliação Disponível
                    </p>
                    <p className="text-green-300 text-xs">
                      {getAvailableFaturas().length} fatura(s) prontas para reconciliar
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== MODAIS ===== */}
        
        {/* Modal de upload bancário */}
        <BankUpload
          isOpen={showBankUpload}
          onClose={() => setShowBankUpload(false)}
          onTransactionsImported={handleTransactionsImported}
          onCardTransactionsImported={handleCardTransactionsImported}
        />

        {/* Modal de edição de transações */}
        <EditTransactionModal
          transaction={editingTransaction}
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleSaveTransaction}
          onSplit={handleSplitTransaction}
          onReconcile={handleReconciliation}
          canReconcile={canReconcile()}
        />

        {/* Modal de edição de cartões */}
        <EditCardTransactionModal
          transaction={editingCardTransaction}
          isOpen={!!editingCardTransaction}
          onClose={() => setEditingCardTransaction(null)}
          onSave={handleSaveCardTransaction}
        />

        {/* Modal de divisão */}
        <SplitTransactionModal
          transaction={splitingTransaction}
          isOpen={!!splitingTransaction}
          onClose={() => setSplitingTransaction(null)}
          onSplit={handleConfirmSplit}
        />

        {/* Modal de reconciliação */}
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

        {/* Modal de matching de cartões */}
        {showCardMatching && cardMatchingData && (
          <SimpleBillDiffModal
            isOpen={showCardMatching}
            faturaId={cardMatchingData.faturaId}
            oldBill={cardMatchingData.oldBill}
            newBill={cardMatchingData.newBill}
            onClose={() => {
              setShowCardMatching(false);
              setCardMatchingData(null);
            }}
            onApply={handleBillDiffApply}
            onCancel={handleBillDiffCancel}
          />
        )}
      </div>
    </div>
  );
}