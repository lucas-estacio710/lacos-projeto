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
import { useHierarchy } from '@/hooks/useHierarchy';

// Componentes
import BankUpload from '@/components/BankUpload';
import { NavigationTabs } from '@/components/NavigationTabs';
import { InboxTab } from '@/components/InboxTab';
import { OverviewTab } from '@/components/OverviewTab';
import { AnalyticsTab } from '@/components/AnalyticsTab';
import { ContasTab } from '@/components/ContasTab';
import { PlanilhaTab } from '@/components/PlanilhaTab';
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
  
  const { visaoPlana } = useHierarchy();
  
  const { 
    cardTransactions,
    addCardTransactions,
    updateCardTransaction,
    updateMultipleCardTransactions,
    deleteCardTransaction,
    applySimpleDiffChanges,
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
    const originalTransactionId = updatedTransaction.id;
    
    // 1. Atualizar a transação
    await updateTransaction(updatedTransaction);
    
    // 2. Se a transação foi classificada, aguardar reclassificação automática
    if (updatedTransaction.realizado === 's') {
      console.log('🔄 Transação classificada, aguardando reclassificação automática...');
      
      // Aguardar até que a transação seja reclassificada ou timeout
      let tentativas = 0;
      const maxTentativas = 30; // 30 segundos máximo
      
      while (tentativas < maxTentativas) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
        
        // Verificar se a transação ainda existe na lista atual
        const transacaoAtual = transactions.find(t => t.id === originalTransactionId);
        
        if (!transacaoAtual) {
          console.log('✅ Transação foi reclassificada e removida da lista atual');
          break;
        }
        
        // Se mudou de categoria, consideramos como reclassificada
        if (transacaoAtual.categoria !== updatedTransaction.categoria) {
          console.log('✅ Transação foi reclassificada para nova categoria');
          break;
        }
        
        tentativas++;
        console.log(`⏳ Aguardando reclassificação... ${tentativas}/${maxTentativas}`);
      }
      
      if (tentativas >= maxTentativas) {
        console.log('⚠️ Timeout na reclassificação, mas continuando...');
      }
      
      // Forçar refresh dos dados após reclassificação
      console.log('🔄 Recarregando dados após reclassificação...');
      await refreshTransactions();
    }
    
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
    subtipo_id: string;
    descricao_classificada: string;
    valor: number;
  }>) => {
    if (!splitingCardTransaction) return;
    
    try {
      // ✅ Converter subtipo_id para categoria/subtipo legacy para splitCardTransaction
      const convertedParts = parts.map(part => {
        const hierarchyItem = visaoPlana?.find(v => v.subtipo_id === part.subtipo_id);
        return {
          categoria: hierarchyItem?.categoria_nome || 'Sem categoria',
          subtipo: hierarchyItem?.subtipo_nome || 'Sem subtipo', 
          descricao_classificada: part.descricao_classificada,
          valor: part.valor
        };
      });
      
      const result = await splitCardTransaction(splitingCardTransaction, convertedParts);
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
      
      // Forçar refresh após classificação em lote
      await refreshTransactions();
      
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
      
      // Forçar refresh após classificação em lote
      await refreshTransactions();
      
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
        <div className="bg-gradient-to-br from-gray-900 via-purple-950 to-black border border-purple-900/50 text-white py-1 px-4 rounded-xl mb-1 shadow-2xl relative overflow-hidden min-h-[100px]">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-gray-900/10 blur-xl opacity-30 animate-pulse"></div>
          
          {/* 🌩️ 5 RAIOS OTIMIZADOS 🌩️ */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            
            {/* RAIO 1 - Esquerda Superior */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-white/20 opacity-0" style={{animation: 'lightning-flash 20s ease-in-out infinite', animationDelay: '1s'}}></div>
              <svg className="absolute inset-0 w-full h-full opacity-0" style={{animation: 'lightning-strike 20s ease-in-out infinite', animationDelay: '1s'}}>
                <path d="M25,5 L32,12 L28,18 L35,25 L30,32 L38,38 L33,45 L45,52" 
                  stroke="#ffffff" strokeWidth="3" fill="none" 
                  filter="drop-shadow(0 0 12px #00ffff)" strokeLinecap="round"/>
                <path d="M30,32 L22,38 L25,45" 
                  stroke="#00ffff" strokeWidth="2" fill="none" 
                  filter="drop-shadow(0 0 8px #00ffff)" strokeLinecap="round"/>
              </svg>
            </div>
            
            {/* RAIO 2 - Centro com Ramificações */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-white/25 opacity-0" style={{animation: 'lightning-flash 20s ease-in-out infinite', animationDelay: '5s'}}></div>
              <svg className="absolute inset-0 w-full h-full opacity-0" style={{animation: 'lightning-strike 20s ease-in-out infinite', animationDelay: '5s'}}>
                <path d="M160,5 L155,25 L165,45 L160,65 L170,85" 
                  stroke="#ffffff" strokeWidth="4" fill="none" 
                  filter="drop-shadow(0 0 18px #00ffff)" strokeLinecap="round"/>
                <path d="M165,45 L175,50 L170,60" 
                  stroke="#00ffff" strokeWidth="2.5" fill="none" 
                  filter="drop-shadow(0 0 10px #00ffff)" strokeLinecap="round"/>
              </svg>
            </div>

            {/* RAIO 3 - Grande Central */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-white/35 opacity-0" style={{animation: 'lightning-flash 20s ease-in-out infinite', animationDelay: '9s'}}></div>
              <svg className="absolute inset-0 w-full h-full opacity-0" style={{animation: 'lightning-strike 20s ease-in-out infinite', animationDelay: '9s'}}>
                <path d="M120,8 L125,15 L118,22 L130,28 L122,35 L140,42 L135,48 L145,55 L138,62 L155,68" 
                  stroke="#ffffff" strokeWidth="5" fill="none" 
                  filter="drop-shadow(0 0 25px #00ffff) drop-shadow(0 0 45px #00ffff)" strokeLinecap="round"/>
                <path d="M122,35 L115,40 L118,47" 
                  stroke="#00ffff" strokeWidth="3" fill="none" 
                  filter="drop-shadow(0 0 15px #00ffff)" strokeLinecap="round"/>
                <path d="M140,42 L148,46 L145,52" 
                  stroke="#00ddff" strokeWidth="2.5" fill="none" 
                  filter="drop-shadow(0 0 10px #00ffff)" strokeLinecap="round"/>
              </svg>
            </div>
            
            {/* RAIO 4 - Direita Potente */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-white/22 opacity-0" style={{animation: 'lightning-flash 20s ease-in-out infinite', animationDelay: '13s'}}></div>
              <svg className="absolute inset-0 w-full h-full opacity-0" style={{animation: 'lightning-strike 20s ease-in-out infinite', animationDelay: '13s'}}>
                <path d="M285,15 L275,35 L290,55 L280,75 L295,95" 
                  stroke="#ffffff" strokeWidth="4" fill="none" 
                  filter="drop-shadow(0 0 18px #00ffff)" strokeLinecap="round"/>
                <path d="M290,55 L300,60" 
                  stroke="#00ffff" strokeWidth="3" fill="none" 
                  filter="drop-shadow(0 0 12px #00ffff)" strokeLinecap="round"/>
              </svg>
            </div>

            {/* RAIO 5 - Diagonal Final */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-white/30 opacity-0" style={{animation: 'lightning-flash 20s ease-in-out infinite', animationDelay: '17s'}}></div>
              <svg className="absolute inset-0 w-full h-full opacity-0" style={{animation: 'lightning-strike 20s ease-in-out infinite', animationDelay: '17s'}}>
                <path d="M40,10 L65,30 L60,50 L85,70 L80,90 L105,110" 
                  stroke="#ffffff" strokeWidth="4.5" fill="none" 
                  filter="drop-shadow(0 0 20px #00ffff)" strokeLinecap="round"/>
                <path d="M60,50 L50,60 L55,75" 
                  stroke="#00ffff" strokeWidth="3" fill="none" 
                  filter="drop-shadow(0 0 12px #00ffff)" strokeLinecap="round"/>
              </svg>
            </div>

          </div>
          
          <style jsx>{`
            @keyframes lightning-strike {
              0% { opacity: 0; }
              0.5% { opacity: 1; }
              1% { opacity: 0.8; }
              1.5% { opacity: 0.6; }
              2% { opacity: 0.4; }
              2.5% { opacity: 0.2; }
              3% { opacity: 0; }
              100% { opacity: 0; }
            }
            
            @keyframes lightning-branch {
              0% { opacity: 0; }
              0.3% { opacity: 0; }
              0.8% { opacity: 1; }
              1.3% { opacity: 0.7; }
              1.8% { opacity: 0.5; }
              2.3% { opacity: 0.3; }
              2.8% { opacity: 0; }
              100% { opacity: 0; }
            }
            
            @keyframes lightning-tip {
              0% { opacity: 0; }
              0.6% { opacity: 0; }
              1.1% { opacity: 1; }
              1.6% { opacity: 0.6; }
              2.1% { opacity: 0.4; }
              2.6% { opacity: 0.2; }
              3.1% { opacity: 0; }
              100% { opacity: 0; }
            }
            
            @keyframes lightning-flash {
              0% { opacity: 1; }
              0.2% { opacity: 0.9; }
              0.4% { opacity: 0.7; }
              0.7% { opacity: 0.4; }
              1.1% { opacity: 0.2; }
              1.4% { opacity: 0; }
              100% { opacity: 0; }
            }
          `}</style>
          
          
          <div className="relative">
            {/* Main title - spanning full width */}
            <div className="flex items-center justify-center mb-2 pt-4">
              <h1 className="text-3xl md:text-4xl font-black mx-4 relative group font-[family-name:var(--font-michroma)]">
                <span className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent tracking-wider font-bold">
                  LAÇOS 3.0
                </span>
                <div className="absolute -inset-2 bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 rounded-lg blur opacity-20 group-hover:opacity-60 transition duration-1000"></div>
              </h1>
            </div>
            
            {/* Subtitle - full width bar */}
            <div className="bg-gradient-to-r from-gray-900/90 via-purple-900/40 to-gray-900/90 border border-cyan-500/20 rounded-full py-2 px-6 backdrop-blur-sm mb-2">
              <div className="flex items-center justify-center gap-3">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                <span className="text-sm font-mono font-bold text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text tracking-wide">
                  ULTIMATE FINANCIAL AI SYSTEM
                </span>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping delay-150"></div>
              </div>
            </div>
            
            {/* Online Status + Version */}
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-mono text-green-400 tracking-wide">
                  ONLINE
                </span>
              </div>
              <span className="text-gray-600">|</span>
              <span className="text-xs font-mono text-gray-500">
                v3.9.0
              </span>
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
                onUpdateTransaction={async (transaction) => { await updateTransaction(transaction); }}
                onUpdateCardTransaction={async (cardTransaction) => { await updateCardTransaction(cardTransaction); }}
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
                onUpdateTransaction={async (transaction) => { await updateTransaction(transaction); }}
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

            {activeTab === 'planilha' && (
              <PlanilhaTab transactions={transactions} />
            )}

          </>
        )}

        {/* ===== MODAIS ===== */}
        
        <BankUpload
          isOpen={showBankUpload}
          onClose={() => setShowBankUpload(false)}
          onTransactionsImported={handleTransactionsImported}
          onCardTransactionsImported={handleCardTransactionsImported}
          existingTransactions={transactions} // ✅ NOVA PROP: Para calcular prévia do saldo
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
          />
        )}
      </div>
    </div>
    </ConfigProvider>
  );
}