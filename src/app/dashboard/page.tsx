'use client';

import React, { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { Transaction, FutureTransaction, ReconciliationGroup, FaturaAnalysis } from '@/types';
import BankUpload from '@/components/BankUpload';
import { useTransactions } from '@/hooks/useTransactions';
import { useFutureTransactions } from '@/hooks/useFutureTransactions';
import { OverviewTab } from '@/components/OverviewTab';
import { AnalyticsTab } from '@/components/AnalyticsTab';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { EditFutureTransactionModal } from '@/components/EditFutureTransactionModal';
import { ContasTab } from '@/components/ContasTab';
import { CartoesTab } from '@/components/CartoesTab';
import { ReconciliationModal } from '@/components/ReconciliationModal';
import { FaturaAnalysisModal } from '@/components/FaturaAnalysisModal';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

// === COMPONENTE SPLIT MODAL INLINE (MANTIDO INTOCADO) ===
interface SplitPart {
  categoria: string;
  subtipo: string;
  descricao: string;
  valor: number;
}

interface SplitTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSplit: (parts: SplitPart[]) => void;
}

function SplitTransactionModal({ transaction, isOpen, onClose, onSplit }: SplitTransactionModalProps) {
  const [numberOfParts, setNumberOfParts] = useState(2);
  const [parts, setParts] = useState<SplitPart[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (transaction && isOpen) {
      const initialParts: SplitPart[] = Array.from({ length: numberOfParts }, () => ({
        categoria: '',
        subtipo: '',
        descricao: '',
        valor: 0
      }));
      setParts(initialParts);
      setError('');
    }
  }, [transaction, isOpen, numberOfParts]);

  const getAccountForTransaction = (transaction: Transaction): string => {
    if (transaction.descricao_origem?.toLowerCase().includes('pix') || 
        transaction.descricao_origem?.toLowerCase().includes('transferencia')) {
      return 'PJ';
    }
    return 'PF';
  };

  const getCategoriesForAccount = (account: string) => {
    switch(account) {
      case 'PJ': return categoriesPJ;
      case 'PF': return categoriesPF;
      case 'CONC.': return categoriesCONC;
      default: return {};
    }
  };

  const formatCurrency = (value: number) => {
    return Math.abs(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleNumberOfPartsChange = (newNumber: number) => {
    setNumberOfParts(newNumber);
    setError('');
  };

  const handlePartChange = (index: number, field: keyof SplitPart, value: string | number) => {
    const newParts = [...parts];
    
    if (field === 'valor') {
      newParts[index][field] = Number(value);
      
      if (index < parts.length - 1) {
        const filledValues = newParts.slice(0, -1).reduce((sum, part) => sum + Math.abs(part.valor), 0);
        const remaining = Math.abs(transaction?.valor || 0) - filledValues;
        const lastIndex = parts.length - 1;
        newParts[lastIndex].valor = transaction?.valor && transaction.valor < 0 ? -remaining : remaining;
      }
    } else if (field === 'categoria') {
      newParts[index][field] = value as string;
      newParts[index].subtipo = '';
    } else {
      newParts[index][field] = value as string;
    }
    
    setParts(newParts);
    
    const total = newParts.reduce((sum, part) => sum + Math.abs(part.valor), 0);
    const originalValue = Math.abs(transaction?.valor || 0);
    
    if (Math.abs(total - originalValue) > 0.01) {
      setError(`Soma dos valores (${formatCurrency(total)}) deve ser igual ao valor original (${formatCurrency(originalValue)})`);
    } else {
      setError('');
    }
  };

  const handleSplit = () => {
    if (!transaction) return;

    const total = parts.reduce((sum, part) => sum + Math.abs(part.valor), 0);
    const originalValue = Math.abs(transaction.valor);

    if (Math.abs(total - originalValue) > 0.01) {
      setError('A soma dos valores deve ser igual ao valor original');
      return;
    }

    const hasEmptyFields = parts.some(part => 
      !part.categoria || !part.subtipo || !part.descricao
    );

    if (hasEmptyFields) {
      setError('Todos os campos devem ser preenchidos');
      return;
    }

    const adjustedParts = parts.map(part => ({
      ...part,
      valor: transaction.valor < 0 ? -Math.abs(part.valor) : Math.abs(part.valor)
    }));

    onSplit(adjustedParts);
  };

  if (!isOpen || !transaction) return null;

  const account = getAccountForTransaction(transaction);
  const categories = getCategoriesForAccount(account);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center">
            <span className="mr-2">✂️</span>
            Dividir Transação
          </h3>
          
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div>
                <label className="text-sm text-gray-400">Data</label>
                <p className="text-gray-200">{transaction.data}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Descrição Original</label>
                <p className="text-gray-200 break-words text-sm">{transaction.descricao_origem}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Valor Total</label>
                <p className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(transaction.valor)}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Conta (Auto)</label>
                <p className="text-blue-400">{account}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-2">Dividir em quantas partes?</label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => handleNumberOfPartsChange(num)}
                  className={`flex-1 py-2 px-3 rounded transition-colors ${
                    numberOfParts === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {parts.map((part, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Parte {index + 1}
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Categoria *</label>
                    <select
                      value={part.categoria}
                      onChange={(e) => handlePartChange(index, 'categoria', e.target.value)}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {Object.keys(categories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Subtipo *</label>
                    <select
                      value={part.subtipo}
                      onChange={(e) => handlePartChange(index, 'subtipo', e.target.value)}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                      disabled={!part.categoria}
                    >
                      <option value="">Selecione...</option>
                      {part.categoria && categories[part.categoria]?.subtipos.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descrição *</label>
                    <input
                      type="text"
                      value={part.descricao}
                      onChange={(e) => handlePartChange(index, 'descricao', e.target.value)}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                      placeholder="Ex: Compra Acessórios"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Valor * {index === parts.length - 1 && '(calculado automaticamente)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={Math.abs(part.valor) || ''}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        handlePartChange(index, 'valor', value);
                      }}
                      className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                      placeholder="0.00"
                      disabled={index === parts.length - 1}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-gray-700 rounded-lg p-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total das partes:</span>
              <span className="font-bold text-blue-400">
                R$ {formatCurrency(parts.reduce((sum, part) => sum + Math.abs(part.valor), 0))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Valor original:</span>
              <span className={`font-bold ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                R$ {formatCurrency(transaction.valor)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSplit}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              disabled={!!error || parts.some(part => !part.categoria || !part.subtipo || !part.descricao)}
            >
              Dividir Transação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// === FIM DO COMPONENTE INLINE ===

export default function DashboardPage() {
  const { transactions, addTransactions, updateTransaction, splitTransaction, markAsReconciled } = useTransactions();
  const { 
    futureTransactions, 
    addFutureTransactions, 
    updateFutureTransaction, 
    updateRelatedParcelas,
    getAllReconciliationGroups,
    reconcileWithPayment,
    compareFaturaFechada,
    applyFaturaCorrections
  } = useFutureTransactions();
  
  const [activeTab, setActiveTab] = useState('todos');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [splitingTransaction, setSplitingTransaction] = useState<Transaction | null>(null);
  const [editingFutureTransaction, setEditingFutureTransaction] = useState<FutureTransaction | null>(null);
  const [showBankUpload, setShowBankUpload] = useState(false);

  // ===== NOVOS ESTADOS PARA RECONCILIAÇÃO =====
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliationTransaction, setReconciliationTransaction] = useState<Transaction | null>(null);
  const [showFaturaAnalysis, setShowFaturaAnalysis] = useState(false);
  const [faturaAnalysisData, setFaturaAnalysisData] = useState<FaturaAnalysis | null>(null);
  const [availableGroups, setAvailableGroups] = useState<ReconciliationGroup[]>([]);

  // Atualizar grupos disponíveis quando futureTransactions mudam
  useEffect(() => { 
    const groups = getAllReconciliationGroups();
    setAvailableGroups(groups);
    console.log('📊 Grupos de reconciliação atualizados:', groups.length);
  }, [futureTransactions]); // ✅ Remove getAllReconciliationGroups da dependência

  // ===== HANDLERS EXISTENTES (MANTIDOS) =====
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleSplitTransaction = (transaction: Transaction) => {
    setSplitingTransaction(transaction);
  };

  const handleEditFutureTransaction = (transaction: FutureTransaction) => {
    setEditingFutureTransaction(transaction);
  };

  const handleSaveTransaction = (updatedTransaction: Transaction) => {
    updateTransaction(updatedTransaction);
    setEditingTransaction(null);
  };

  const handleConfirmSplit = async (parts: Array<{
    categoria: string;
    subtipo: string;
    descricao: string;
    valor: number;
  }>) => {
    if (!splitingTransaction) return;

    try {
      console.log('🔄 Iniciando divisão da transação:', splitingTransaction.id);
      
      const result = await splitTransaction(splitingTransaction, parts);
      
      if (result.success) {
        alert(`✅ Transação dividida com sucesso em ${result.partsCreated} partes!`);
        setSplitingTransaction(null);
      }
      
    } catch (error) {
      console.error('❌ Erro ao dividir transação:', error);
      alert(`❌ Erro ao dividir transação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleSaveFutureTransaction = async (updatedTransaction: FutureTransaction, updateParcelas: boolean) => {
    try {
      console.log('🔄 Salvando transação futura:', updatedTransaction.id);
      
      await updateFutureTransaction(updatedTransaction);
      
      if (updateParcelas && updatedTransaction.parcela_total > 1 && !updatedTransaction.original_transaction_id) {
        await updateRelatedParcelas(
          updatedTransaction.id, 
          updatedTransaction.categoria, 
          updatedTransaction.subtipo,
          updatedTransaction.conta || 'PF'
        );
      }
      
      setEditingFutureTransaction(null);
      
    } catch (error) {
      console.error('❌ Erro ao salvar transação futura:', error);
      alert(`❌ Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // ===== NOVOS HANDLERS PARA RECONCILIAÇÃO =====
  const handleReconciliation = (transaction: Transaction) => {
    console.log('🔗 Iniciando processo de reconciliação para:', transaction.id);
    setReconciliationTransaction(transaction);
    setShowReconciliation(true);
  };

  const handleConfirmReconciliation = async (selectedGroup: ReconciliationGroup) => {
    if (!reconciliationTransaction) return;

    try {
      console.log('🔗 Confirmando reconciliação...');
      console.log('💳 Transação:', reconciliationTransaction.id);
      console.log('📋 Grupo:', selectedGroup.groupId);

      // ETAPA 1: Reconciliar no sistema de futures
      const reconcileResult = await reconcileWithPayment(reconciliationTransaction, selectedGroup.futures);
      
      if (!reconcileResult.success) {
        throw new Error(`Erro na reconciliação: ${reconcileResult.errors.join(', ')}`);
      }

      // ETAPA 2: Marcar transação como reconciliada
      await markAsReconciled(reconciliationTransaction, selectedGroup.groupId);

      // ETAPA 3: Fechar modal e mostrar sucesso
      setShowReconciliation(false);
      setReconciliationTransaction(null);

      alert(`✅ Reconciliação concluída com sucesso!\n\n` +
            `💳 Pagamento: ${reconciliationTransaction.descricao_origem}\n` +
            `📋 Grupo: ${selectedGroup.description}\n` +
            `🔄 ${reconcileResult.convertedCount} transações futuras reconciliadas`);

    } catch (error) {
      console.error('❌ Erro na reconciliação:', error);
      alert(`❌ Erro na reconciliação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleFaturaAnalysis = (analysisData: FaturaAnalysis) => {
    console.log('📊 Mostrando análise da fatura:', analysisData);
    setFaturaAnalysisData(analysisData);
    setShowFaturaAnalysis(true);
  };

  const handleApplyCorrections = async (corrections: FaturaAnalysis) => {
    try {
      console.log('🔧 Aplicando correções da fatura...');
      
      const result = await applyFaturaCorrections(corrections);
      
      if (result.success) {
        alert(`✅ Correções aplicadas com sucesso!\n\n` +
              `📊 ${result.updatedCount} atualizadas\n` +
              `➕ ${result.createdCount} criadas\n` +
              `❌ ${result.deletedCount} removidas`);
        
        setShowFaturaAnalysis(false);
        setFaturaAnalysisData(null);
      } else {
        throw new Error(`Falhas: ${result.errors.join(', ')}`);
      }

    } catch (error) {
      console.error('❌ Erro ao aplicar correções:', error);
      alert(`❌ Erro ao aplicar correções: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // ===== NOVOS HANDLERS PARA CLASSIFICAÇÃO INTELIGENTE =====

  // Handler para classificação rápida (transactions)
  const handleQuickClassification = async (transactionId: string, classification: any) => {
    try {
      console.log('⚡ Aplicando classificação rápida:', transactionId, classification);
      
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) {
        console.error('❌ Transação não encontrada:', transactionId);
        return;
      }

      const updatedTransaction: Transaction = {
        ...transaction,
        conta: classification.conta,
        categoria: classification.categoria,
        subtipo: classification.subtipo,
        descricao: classification.descricao,
        realizado: 's' // Marcar como realizado automaticamente
      };

      await updateTransaction(updatedTransaction);
      alert('✅ Classificação aplicada com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro na classificação rápida:', error);
      alert('❌ Erro ao aplicar classificação');
    }
  };

  // Handler para classificação em lote (transactions)
  const handleBatchClassification = async (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => {
    try {
      console.log('📊 Aplicando classificação em lote:', classifications.length, 'transações');
      
      const promises = classifications.map(async (classification) => {
        const transaction = transactions.find(t => t.id === classification.id);
        if (!transaction) {
          console.warn('⚠️ Transação não encontrada:', classification.id);
          return null;
        }

        const updatedTransaction: Transaction = {
          ...transaction,
          conta: classification.conta,
          categoria: classification.categoria,
          subtipo: classification.subtipo,
          descricao: classification.descricao,
          realizado: 's' // Marcar como realizado automaticamente
        };

        return updateTransaction(updatedTransaction);
      });

      // Executar todas as atualizações
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r !== null).length;
      
      alert(`✅ ${successCount}/${classifications.length} transações classificadas com sucesso!`);
      
    } catch (error) {
      console.error('❌ Erro na classificação em lote:', error);
      alert('❌ Erro ao aplicar classificações em lote');
    }
  };

  // Handler para classificação rápida (future transactions)
  const handleQuickClassificationFutures = async (transactionId: string, classification: any) => {
    try {
      console.log('⚡ Aplicando classificação rápida em future:', transactionId, classification);
      
      const futureTransaction = futureTransactions.find(t => t.id === transactionId);
      if (!futureTransaction) {
        console.error('❌ Future transaction não encontrada:', transactionId);
        return;
      }

      const updatedTransaction: FutureTransaction = {
        ...futureTransaction,
        categoria: classification.categoria,
        subtipo: classification.subtipo,
        descricao: classification.descricao,
        status: 'confirmed' // Marcar como confirmada
      };

      await updateFutureTransaction(updatedTransaction);
      alert('✅ Classificação aplicada com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro na classificação rápida future:', error);
      alert('❌ Erro ao aplicar classificação');
    }
  };

  // Handler para classificação em lote (future transactions)
  const handleBatchClassificationFutures = async (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => {
    try {
      console.log('📊 Aplicando classificação em lote futures:', classifications.length, 'transações');
      
      const promises = classifications.map(async (classification) => {
        const futureTransaction = futureTransactions.find(t => t.id === classification.id);
        if (!futureTransaction) {
          console.warn('⚠️ Future transaction não encontrada:', classification.id);
          return null;
        }

        const updatedTransaction: FutureTransaction = {
          ...futureTransaction,
          categoria: classification.categoria,
          subtipo: classification.subtipo,
          descricao: classification.descricao,
          status: 'confirmed' // Marcar como confirmada
        };

        return updateFutureTransaction(updatedTransaction);
      });

      // Executar todas as atualizações
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r !== null).length;
      
      alert(`✅ ${successCount}/${classifications.length} future transactions classificadas com sucesso!`);
      
    } catch (error) {
      console.error('❌ Erro na classificação em lote futures:', error);
      alert('❌ Erro ao aplicar classificações em lote');
    }
  };

  // ===== HANDLERS DE IMPORTAÇÃO (ATUALIZADOS) =====
  const handleTransactionsImported = async (importedTransactions: Transaction[]) => {
    try {
      const result = await addTransactions(importedTransactions);
      return result;
    } catch (error) {
      console.error('Erro ao importar transações:', error);
      throw error;
    }
  };

  const handleFutureTransactionsImported = async (importedFutureTransactions: FutureTransaction[], referenceMes: string) => {
    try {
      // Verificar se é fatura fechada vs projetada
      const shouldAnalyze = importedFutureTransactions.some(f => f.status === 'confirmed');
      
      if (shouldAnalyze) {
        // É uma fatura fechada - comparar com projeções existentes
        const existingProjections = futureTransactions.filter(f => 
          f.mes_vencimento === referenceMes && f.status === 'projected'
        );
        
        if (existingProjections.length > 0) {
          // Simular transactions da fatura fechada para comparação
          const realTransactions: Transaction[] = importedFutureTransactions.map(f => ({
            id: f.id,
            mes: f.mes_vencimento,
            data: f.data_vencimento,
            descricao_origem: f.descricao_origem,
            subtipo: f.subtipo,
            categoria: f.categoria,
            descricao: f.descricao,
            valor: f.valor,
            origem: f.origem,
            cc: f.cc,
            realizado: 's',
            conta: ''
          }));
          
          const analysis = compareFaturaFechada(existingProjections, realTransactions);
          
          // Se há diferenças, mostrar modal de análise
          if (analysis.changed.length > 0 || analysis.removed.length > 0 || analysis.added.length > 0) {
            handleFaturaAnalysis(analysis);
            return { success: true, stats: { total: 0, added: 0, duplicates: 0 } };
          }
        }
      }

      // Importação normal
      const result = await addFutureTransactions(importedFutureTransactions);
      return result;
    } catch (error) {
      console.error('Erro ao importar transações futuras:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg mb-4 shadow-lg relative">
          <h1 className="text-xl font-bold text-center" style={{ fontFamily: 'monospace, Courier New' }}>
            LAÇOS 2.0 - AI Version
          </h1>
          <button
            onClick={() => setShowBankUpload(true)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            title="Importar dados bancários/cartões"
          >
            <span className="text-2xl leading-none mb-1">+</span>
          </button>
        </div>

        {/* Área de importação inicial */}
        {transactions.length === 0 && futureTransactions.length === 0 && (
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 mb-4">
            <h3 className="font-semibold mb-3 text-gray-100">📊 Importar Dados</h3>
            <button
              onClick={() => setShowBankUpload(true)}
              className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors"
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-400">Importar Extrato/Fatura</p>
            </button>
          </div>
        )}

        {/* Navegação e conteúdo principal */}
        {(transactions.length > 0 || futureTransactions.length > 0) && (
          <>
            {/* Tabs de navegação */}
            <div className="space-y-2">
              <div className="flex mb-2 bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-700">
                <button
                  onClick={() => setActiveTab('todos')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'todos' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📊 Visão Geral
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'analytics' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📈 Análise
                </button>
                <button
                  onClick={() => setActiveTab('contas')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'contas' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  🏦 Contas
                </button>
              </div>
              
              <div className="flex mb-4 bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-700">
                <button
                  onClick={() => setActiveTab('cartoes')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'cartoes' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  💳 Cartões
                </button>
                <button
                  onClick={() => setActiveTab('receitas')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'receitas' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📅 Receitas
                </button>
                <button
                  onClick={() => setActiveTab('investimentos')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'investimentos' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📊 Invest.
                </button>
              </div>
            </div>

            {/* Conteúdo das abas */}
            {activeTab === 'todos' && (
              <OverviewTab 
                transactions={transactions} 
                onEditTransaction={handleEditTransaction}
                onReconcileTransaction={handleReconciliation}
                availableGroupsCount={availableGroups.length}
                onApplyQuickClassification={handleQuickClassification}
                onApplyBatchClassification={handleBatchClassification}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab transactions={transactions} />
            )}

            {activeTab === 'contas' && (
              <ContasTab transactions={transactions} />
            )}

            {activeTab === 'cartoes' && (
              <CartoesTab 
                futureTransactions={futureTransactions}
                onEditFutureTransaction={handleEditFutureTransaction}
                onApplyQuickClassification={handleQuickClassificationFutures}
                onApplyBatchClassification={handleBatchClassificationFutures}
              />
            )}

            {['receitas', 'investimentos'].includes(activeTab) && (
              <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-xl font-semibold text-gray-100 mb-2">Em Construção</h3>
                <p className="text-gray-400">Esta funcionalidade estará disponível em breve!</p>
              </div>
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
          </>
        )}

        {/* Modal de upload bancário */}
        <BankUpload
          isOpen={showBankUpload}
          onClose={() => setShowBankUpload(false)}
          onTransactionsImported={handleTransactionsImported}
          onFutureTransactionsImported={handleFutureTransactionsImported}
        />

        {/* Modal de edição de transações normais - ATUALIZADO COM RECONCILIAÇÃO */}
        <EditTransactionModal
          transaction={editingTransaction}
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleSaveTransaction}
          onSplit={handleSplitTransaction}
          onReconcile={handleReconciliation}
          availableGroupsCount={availableGroups.length}
        />

        {/* Modal de divisão de transações (MANTIDO INTOCADO) */}
        <SplitTransactionModal
          transaction={splitingTransaction}
          isOpen={!!splitingTransaction}
          onClose={() => setSplitingTransaction(null)}
          onSplit={handleConfirmSplit}
        />

        {/* Modal de edição de transações futuras */}
        <EditFutureTransactionModal
          transaction={editingFutureTransaction}
          isOpen={!!editingFutureTransaction}
          onClose={() => setEditingFutureTransaction(null)}
          onSave={handleSaveFutureTransaction}
        />

        {/* ===== NOVOS MODAIS PARA RECONCILIAÇÃO ===== */}
        
        {/* Modal de Reconciliação */}
        <ReconciliationModal
          transaction={reconciliationTransaction}
          isOpen={showReconciliation}
          onClose={() => {
            setShowReconciliation(false);
            setReconciliationTransaction(null);
          }}
          onConfirm={handleConfirmReconciliation}
          availableGroups={availableGroups}
        />

        {/* Modal de Análise de Fatura */}
        <FaturaAnalysisModal
          isOpen={showFaturaAnalysis}
          analysisData={faturaAnalysisData}
          onClose={() => {
            setShowFaturaAnalysis(false);
            setFaturaAnalysisData(null);
          }}
          onApplyCorrections={handleApplyCorrections}
        />

        {/* Indicador de grupos disponíveis (debug/info) */}
        {availableGroups.length > 0 && (
          <div className="fixed bottom-4 right-4 bg-green-900 border border-green-700 rounded-lg p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-green-400">🔗</span>
              <div>
                <p className="text-green-100 text-sm font-medium">Reconciliação Disponível</p>
                <p className="text-green-300 text-xs">
                  {availableGroups.length} grupo(s) de transações futuras
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}