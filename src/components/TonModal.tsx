// components/TonModal.tsx - MODAL MANUAL TON COM 3 ABAS
// Aba 1: Maquininha (D-3 até mais recente)
// Aba 2: Link (D-16 até mais recente) 
// Aba 3: Ambos (D-16 até mais recente)

import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, RefreshCw } from 'lucide-react';
import { Transaction } from '@/types';
import { SUBTIPO_IDS } from '@/lib/constants';

// Interface para entrada da planilha financeira TON
interface EntradaFinanceira {
  id: string;
  csv_id: string;
  id_contrato: string;
  data_hora: string;
  tipo: string; // "Plano" ou "Catálogo" - usado para classificação automática
  metodo: string;
  cc: string;
  valor_final: number;
  id_transacao: string;
  parcelamento: string; // "Maquininha" ou "Link"
  uploaded_at: string;
  utilizada?: boolean; // ✅ NOVO: Marca se a entrada já foi utilizada em classificação
  utilizada_em?: string; // ✅ NOVO: Data/hora quando foi utilizada
}

// Tipo das abas do modal
type TabType = 'maquininha' | 'link' | 'ambos';

// Interface para matching manual
interface ManualMatch {
  bankTransaction: Transaction;
  selectedEntries: EntradaFinanceira[];
}

interface TonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // ✅ NOVO: Callback para quando operação é bem-sucedida
  complexTransactions?: Transaction[]; // Transactions com categoria COMPLEXA
  planilhaEntries?: EntradaFinanceira[]; // Entradas da planilha financeira TON
  onMarkEntriesAsUsed?: (entryIds: string[]) => Promise<void>; // Para marcar entradas como utilizadas
  onApplyReconciliation?: (reconciliationData: {
    // IDs das transações originais que serão RECONCILIADAS (realizado = 'r')
    originalTransactionIds: string[];
    
    // IDs das entradas da planilha usadas na reconciliação
    selectedEntryIds: string[];
    
    // NOVOS lançamentos que serão CRIADOS (realizado = 's')
    newTransactions: Array<{
      id: string;
      valor: number;
      subtipo_id: string; // ✅ Nova hierarquia
      descricao: string;
      data: string;
      origem: string;
      cc: string;
      mes: string;
      descricao_origem: string;
      realizado: 's';
      linked_future_group?: string;
      is_from_reconciliation: boolean;
      reconciliation_metadata: string;
    }>;
    
    // Nota explicativa da reconciliação
    reconciliationNote: string;
    
    // Metadados da operação N→M
    reconciliationMetadata: {
      type: 'ton_manual_n_to_m';
      source_count: number;
      destination_count: number;
      date: string;
      contracts: string[];
      total_original_value: number;
      total_new_value: number;
      difference: number;
      tab_type: 'maquininha' | 'link' | 'ambos';
      match_count: number;
    };
  }) => Promise<void>;
}

export const TonModal: React.FC<TonModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  complexTransactions = [],
  planilhaEntries = [],
  onMarkEntriesAsUsed,
  onApplyReconciliation
}) => {
  // Estados do modal
  const [currentTab, setCurrentTab] = useState<TabType>('maquininha');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [manualMatches, setManualMatches] = useState<ManualMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionsBlocked, setSelectionsBlocked] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null); // ✅ NOVO: Transação ativa para filtro

  // ✅ FILTRAR apenas transações TON não classificadas do banco (ordenadas do mais antigo para o mais novo)
  const tonBankTransactions = useMemo(() => {
    return complexTransactions
      .filter(t => 
        t.cc === 'Stone' && // No banco é "Stone"
        (t.subtipo_id === SUBTIPO_IDS.COMPLEXA || !t.subtipo_id) &&
        t.realizado === 'p'
      )
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()); // Ordenação crescente por data
  }, [complexTransactions]);

  // ✅ FILTRAR apenas entradas TON da planilha (na planilha é "Ton")
  const tonSheetEntries = useMemo(() => {
    return planilhaEntries.filter(entry => entry.cc === 'Ton');
  }, [planilhaEntries]);

  // ✅ FUNÇÃO para calcular diferença de dias (não usada no manual, mas mantida para compatibilidade)
  // const calculateDaysDiff = (date1: string, date2: string): number => {
  //   const d1 = new Date(date1);
  //   const d2 = new Date(date2);
  //   return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  // };

  // ✅ FILTRAR ENTRADAS DA PLANILHA BASEADO NA ABA ATUAL E TRANSAÇÃO ATIVA
  const filteredTonSheetEntries = useMemo(() => {
    let filtered = tonSheetEntries;

    // Filtrar por tipo de parcelamento conforme a aba
    if (currentTab === 'maquininha') {
      filtered = filtered.filter(entry => entry.parcelamento === 'Maquininha');
    } else if (currentTab === 'link') {
      filtered = filtered.filter(entry => entry.parcelamento === 'Link');
    }
    // Para 'ambos', não aplica filtro de parcelamento

    // ✅ NOVO: Filtro dinâmico baseado na transação ativa
    if (activeTransaction) {
      const transactionDate = activeTransaction.data; // YYYY-MM-DD
      const filterDays = currentTab === 'maquininha' ? 3 : 16; // D-3 para maquininha, D-16 para link e ambos
      
      // Data de início: D-X antes da transação
      const startDate = new Date(transactionDate);
      startDate.setDate(startDate.getDate() - filterDays);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Data de fim: própria data da transação (D+0)
      const endDateStr = transactionDate;
      
      filtered = filtered.filter(entry => {
        const entryDate = entry.data_hora.split('T')[0];
        return entryDate >= startDateStr && entryDate <= endDateStr;
      });
      
      console.log(`🔍 TON - Filtro dinâmico aplicado:`, {
        transactionDate,
        tab: currentTab,
        filterDays,
        startDate: startDateStr,
        endDate: endDateStr,
        totalFiltered: filtered.length
      });
      
    } else {
      // Filtro padrão quando nenhuma transação está ativa
      if (tonBankTransactions.length > 0) {
        const oldestBankDate = tonBankTransactions[0].data; // Já ordenado crescente
        const filterDays = currentTab === 'maquininha' ? 3 : 16;
        
        const cutoffDate = new Date(oldestBankDate);
        cutoffDate.setDate(cutoffDate.getDate() - filterDays);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        
        filtered = filtered.filter(entry => {
          const entryDate = entry.data_hora.split('T')[0];
          return entryDate >= cutoffDateStr;
        });
      }
    }

    return filtered.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
  }, [tonSheetEntries, currentTab, tonBankTransactions, activeTransaction]);

  // ✅ LÓGICA DE MATCHING MANUAL POR CLIQUE
  const handleTransactionClick = (transaction: Transaction) => {
    if (selectionsBlocked) return; // Bloquear se houver matches criados
    
    // ✅ NOVO: Set active transaction for dynamic filtering
    setActiveTransaction(prev => prev?.id === transaction.id ? null : transaction);
    
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transaction.id)) {
        newSet.delete(transaction.id);
      } else {
        newSet.add(transaction.id);
      }
      return newSet;
    });
  };

  const handleEntryClick = (entry: EntradaFinanceira) => {
    if (selectionsBlocked) return; // Bloquear se houver matches criados
    
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entry.id)) {
        newSet.delete(entry.id);
      } else {
        newSet.add(entry.id);
      }
      return newSet;
    });
  };

  // ✅ CRIAR MATCH MANUAL
  const createManualMatch = () => {
    if (selectedTransactions.size === 0 || selectedEntries.size === 0) return;

    const selectedTransactionsList = tonBankTransactions.filter(t => selectedTransactions.has(t.id));
    const selectedEntriesList = filteredTonSheetEntries.filter(e => selectedEntries.has(e.id));

    // Para cada transação selecionada, criar um match com as entradas selecionadas
    const newMatches = selectedTransactionsList.map(transaction => ({
      bankTransaction: transaction,
      selectedEntries: selectedEntriesList
    }));

    setManualMatches(prev => [...prev, ...newMatches]);
    setSelectedTransactions(new Set());
    setSelectedEntries(new Set());
    setSelectionsBlocked(true); // Bloquear novas seleções após criar match
  };

  // Reset completo quando modal abrir/fechar
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 TON MODAL - Abrindo modal, carregando dados...');
      console.log('  Transações complexas:', complexTransactions?.length || 0);
      console.log('  Entradas planilha:', planilhaEntries?.length || 0);
      
      // Reset inicial - apenas limpar seleções, manter tab
      setSelectedTransactions(new Set());
      setSelectedEntries(new Set());
      setManualMatches([]);
      setSelectionsBlocked(false);
      setActiveTransaction(null);
      setLoading(false);
      setRefreshing(false);
    } else {
      // Reset completo quando fechar
      console.log('🔄 TON MODAL - Fechando modal, resetando estado...');
      resetModalState();
    }
  }, [isOpen]);

  const formatCurrency = (value: number) => {
    return `R$ ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  // ✅ CALCULAR SOMATÓRIAS DAS SELEÇÕES
  const selectedTransactionsTotal = useMemo(() => {
    return tonBankTransactions
      .filter(t => selectedTransactions.has(t.id))
      .reduce((sum, t) => sum + Math.abs(t.valor), 0);
  }, [tonBankTransactions, selectedTransactions]);

  const selectedEntriesTotal = useMemo(() => {
    return filteredTonSheetEntries
      .filter(e => selectedEntries.has(e.id))
      .reduce((sum, e) => sum + e.valor_final, 0);
  }, [filteredTonSheetEntries, selectedEntries]);

  // ✅ GERAR TRANSAÇÕES CLASSIFICADAS baseado nos matches manuais
  const generateClassifiedTransactions = (match: ManualMatch): Partial<Transaction>[] => {
    const { bankTransaction, selectedEntries } = match;
    
    if (!bankTransaction || !selectedEntries || selectedEntries.length === 0) {
      console.warn('❌ TON - Dados inválidos para gerar transações:', { bankTransaction, selectedEntries });
      return [];
    }

    // Agrupar entradas por tipo (Plano/Catálogo) e ID Contrato
    const groupedEntries = selectedEntries.reduce((acc, entry) => {
      if (!entry || !entry.tipo || !entry.id_contrato || !entry.valor_final) {
        console.warn('❌ TON - Entrada inválida ignorada:', entry);
        return acc;
      }

      const key = `${entry.tipo}_${entry.id_contrato}`;
      if (!acc[key]) {
        acc[key] = {
          tipo: entry.tipo,
          id_contrato: entry.id_contrato,
          entries: [],
          totalValue: 0
        };
      }
      acc[key].entries.push(entry);
      acc[key].totalValue += Number(entry.valor_final) || 0;
      return acc;
    }, {} as Record<string, { tipo: string; id_contrato: string; entries: EntradaFinanceira[]; totalValue: number }>);

    const transactions: Partial<Transaction>[] = [];
    
    // Criar transação para cada grupo (tipo + contrato)
    Object.values(groupedEntries).forEach((group, index) => {
      const isPlano = group.tipo.toLowerCase().includes('plano');
      const isCatalogo = group.tipo.toLowerCase().includes('catálogo');
      const isIndividual = group.id_contrato.toLowerCase().includes('ind') || group.id_contrato.toLowerCase().includes('individual');
      
      let subtipo_id = '';
      if (isPlano && isIndividual) subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_PLANO_INDIVIDUAL;
      else if (isPlano && !isIndividual) subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_PLANO_COLETIVA;
      else if (isCatalogo && isIndividual) subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_CATALOGO_INDIVIDUAL;
      else if (isCatalogo && !isIndividual) subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_CATALOGO_COLETIVA;
      else subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_PLANO_COLETIVA; // Default

      // Garantir que todos os campos obrigatórios estão presentes
      const newTransaction: Partial<Transaction> = {
        id: `${bankTransaction.id}_${index}`,
        mes: bankTransaction.mes || new Date().toISOString().slice(0, 7), // YYYY-MM
        data: bankTransaction.data,
        origem: bankTransaction.origem || 'Importação Manual',
        cc: bankTransaction.cc,
        subtipo_id: subtipo_id,
        descricao: `Receita Nova ${group.tipo} - TON ${group.id_contrato}`,
        descricao_origem: `${bankTransaction.descricao_origem || 'TON'} [${group.tipo.toUpperCase()}]`,
        valor: Number(group.totalValue) || 0,
        realizado: 's' as const,
        is_from_reconciliation: true,
        linked_future_group: `TON_${bankTransaction.id}`,
        reconciliation_metadata: JSON.stringify({
          original_transaction_id: bankTransaction.id,
          ton_entries: group.entries.map(e => e.id),
          match_type: 'ton_manual',
          contract_type: group.id_contrato,
          product_type: group.tipo,
          match_date: new Date().toISOString()
        })
      };

      transactions.push(newTransaction);
    });

    return transactions;
  };

  // ✅ SALVAR CLASSIFICAÇÕES MANUAIS
  const handleSaveApproved = async () => {
    if (manualMatches.length === 0 || !onApplyReconciliation) return;
    
    setLoading(true);
    
    try {
      const classifiedTransactions: Partial<Transaction>[] = [];
      
      console.log('🔄 TON - Processando matches:', manualMatches.length);
      
      manualMatches.forEach((match, index) => {
        console.log(`🔄 TON - Processando match ${index + 1}:`, {
          bankTransaction: match.bankTransaction.id,
          entries: match.selectedEntries.length
        });
        
        const transactions = generateClassifiedTransactions(match);
        console.log(`🔄 TON - Transações geradas para match ${index + 1}:`, transactions.length);
        
        classifiedTransactions.push(...transactions);
      });

      console.log('🔄 TON - Total de transações para salvar:', classifiedTransactions.length);

      // Calcular totais e metadados
      const originalTransactionIds = manualMatches.map(match => match.bankTransaction.id);
      const selectedEntryIds = manualMatches.flatMap(match => 
        match.selectedEntries.map(entry => entry.id)
      );
      const totalOriginalValue = manualMatches.reduce((sum, match) => 
        sum + Math.abs(match.bankTransaction.valor), 0
      );
      const totalNewValue = classifiedTransactions.reduce((sum, tx) => 
        sum + (Number(tx.valor) || 0), 0
      );
      const contracts = [...new Set(manualMatches.flatMap(match => 
        match.selectedEntries.map(entry => entry.id_contrato)
      ))];

      // Estruturar dados de reconciliação
      const reconciliationData = {
        originalTransactionIds,
        selectedEntryIds,
        newTransactions: classifiedTransactions.map(tx => ({
          id: tx.id!,
          valor: tx.valor!,
          subtipo_id: tx.subtipo_id!,
          descricao: tx.descricao!,
          data: tx.data!,
          origem: tx.origem!,
          cc: tx.cc!,
          mes: tx.mes!,
          descricao_origem: tx.descricao_origem!,
          realizado: 's' as const,
          linked_future_group: tx.linked_future_group,
          is_from_reconciliation: tx.is_from_reconciliation!,
          reconciliation_metadata: tx.reconciliation_metadata!
        })),
        reconciliationNote: `Reconciliação TON manual - ${manualMatches.length} match(es) processado(s) via aba ${currentTab}`,
        reconciliationMetadata: {
          type: 'ton_manual_n_to_m' as const,
          source_count: originalTransactionIds.length,
          destination_count: classifiedTransactions.length,
          date: new Date().toISOString(),
          contracts,
          total_original_value: totalOriginalValue,
          total_new_value: totalNewValue,
          difference: totalNewValue - totalOriginalValue,
          tab_type: currentTab,
          match_count: manualMatches.length
        }
      };

      // Aplicar reconciliação
      await onApplyReconciliation(reconciliationData);

      // Marcar entradas como utilizadas
      if (onMarkEntriesAsUsed && selectedEntryIds.length > 0) {
        console.log('🔄 TON - Marcando entradas como utilizadas:', selectedEntryIds);
        await onMarkEntriesAsUsed(selectedEntryIds);
      }

      // Exibir mensagem de sucesso
      alert(
        `✅ Reconciliação TON concluída!\n\n` +
        `📄 PROCESSAMENTO:\n` +
        `   • ${manualMatches.length} match${manualMatches.length !== 1 ? 'es' : ''} processado${manualMatches.length !== 1 ? 's' : ''}\n` +
        `   • ${originalTransactionIds.length} transaç${originalTransactionIds.length !== 1 ? 'ões' : 'ão'} reconciliada${originalTransactionIds.length !== 1 ? 's' : ''} (realizado='r')\n` +
        `   • ${classifiedTransactions.length} nova${classifiedTransactions.length !== 1 ? 's' : ''} transaç${classifiedTransactions.length !== 1 ? 'ões' : 'ão'} criada${classifiedTransactions.length !== 1 ? 's' : ''} (realizado='s')\n\n` +
        `💰 VALORES:\n` +
        `   • Original: R$ ${totalOriginalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `   • Novo: R$ ${totalNewValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `   • Diferença: R$ ${Math.abs(totalNewValue - totalOriginalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
        `🏷️ Contratos: ${contracts.join(', ')}\n` +
        `📂 Aba: ${currentTab.toUpperCase()}`
      );

      // Reset seleções
      resetModalState();

      // Callback de sucesso
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      console.error('Erro ao aplicar reconciliação TON:', error);
      alert('Erro ao aplicar reconciliação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ REMOVER MATCH MANUAL
  const removeManualMatch = (index: number) => {
    setManualMatches(prev => prev.filter((_, i) => i !== index));
    // Se não há mais matches, desbloquear seleções
    if (manualMatches.length === 1) {
      setSelectionsBlocked(false);
    }
  };

  // ✅ DESFAZER TODOS OS MATCHES E PERMITIR NOVAS SELEÇÕES
  const clearAllMatches = () => {
    setManualMatches([]);
    setSelectedTransactions(new Set());
    setSelectedEntries(new Set());
    setSelectionsBlocked(false);
    setActiveTransaction(null);
    
    console.log('🔄 TON MODAL - Todos os matches removidos');
  };

  // ✅ RESET COMPLETO DO ESTADO DO MODAL
  const resetModalState = () => {
    setSelectedTransactions(new Set());
    setSelectedEntries(new Set());
    setManualMatches([]);
    setSelectionsBlocked(false);
    setActiveTransaction(null);
    setCurrentTab('maquininha');
    setLoading(false);
    setRefreshing(false);
    
    console.log('🔄 TON MODAL - Estado resetado completamente');
  };

  // ✅ REFRESH DOS DADOS
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setSelectedTransactions(new Set());
      setSelectedEntries(new Set());
      setManualMatches([]);
      setSelectionsBlocked(false);
      setActiveTransaction(null);
      
      // Callback de sucesso para recarregar dados
      if (onSuccess) {
        onSuccess();
      }
      
      console.log('🔄 TON MODAL - Dados atualizados via refresh');
    } catch (error) {
      console.error('❌ Erro ao fazer refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-7xl sm:max-w-6xl lg:max-w-7xl w-full h-[98vh] sm:h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-700">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-100">🏦 Classificação TON</h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 hidden sm:block">
              Matching por clique: Maquininha (D-3) | Link (D-16) | Ambos (D-16)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`text-gray-400 hover:text-gray-200 transition-colors p-2 rounded-lg hover:bg-gray-700 ${refreshing ? 'cursor-not-allowed' : ''}`}
              title="Refresh dados"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 border-b border-gray-700">
          {[
            { key: 'maquininha', label: 'Maquininha', desc: 'D-3', descLong: 'D-3 até mais recente' },
            { key: 'link', label: 'Link', desc: 'D-16', descLong: 'D-16 até mais recente' },
            { key: 'ambos', label: 'Ambos', desc: 'D-16', descLong: 'D-16 até mais recente' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setCurrentTab(tab.key as TabType)}
              className={`px-2 sm:px-4 py-2 sm:py-3 border-b-2 transition-colors text-center ${
                currentTab === tab.key
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              <div className="text-xs sm:text-sm font-medium">{tab.label}</div>
              <div className="text-xs text-gray-500 hidden sm:block">{tab.descLong}</div>
              <div className="text-xs text-gray-500 sm:hidden">{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {/* Resumo */}
          <div className="mb-4 sm:mb-6 bg-gray-700 p-3 sm:p-4 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Banco:</span>
                <span className="text-white sm:ml-2 font-bold">{tonBankTransactions.length}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Planilha:</span>
                <span className="text-white sm:ml-2 font-bold">{filteredTonSheetEntries.length}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Matches:</span>
                <span className="text-white sm:ml-2 font-bold">{manualMatches.length}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Aba:</span>
                <span className="text-blue-400 sm:ml-2 font-bold capitalize">{currentTab}</span>
              </div>
            </div>
          </div>

          {/* Área principal - responsiva */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 h-96 sm:h-[50vh] lg:h-[55vh]">
            {/* Coluna esquerda: Transações do banco */}
            <div className={`bg-gray-700 rounded-lg p-3 sm:p-4 ${selectionsBlocked ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium text-sm sm:text-base">Transações TON</h3>
                <span className="text-gray-400 text-xs sm:text-sm hidden sm:block">mais antigo → mais novo</span>
              </div>
              {/* Somatória das seleções */}
              <div className="mb-3 p-2 bg-gray-600 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">
                    Selecionadas: {selectedTransactions.size}
                  </span>
                  <span className="text-blue-400 font-bold text-sm">
                    {formatCurrency(selectedTransactionsTotal)}
                  </span>
                </div>
                {selectionsBlocked && (
                  <div className="text-yellow-400 text-xs mt-1">
                    🔒 Seleções bloqueadas - remova matches para editar
                  </div>
                )}
              </div>
              <div className="space-y-1 sm:space-y-2 max-h-64 sm:max-h-80 lg:max-h-96 overflow-y-auto">
                {tonBankTransactions.map(transaction => (
                  <div
                    key={transaction.id}
                    onClick={() => handleTransactionClick(transaction)}
                    className={`p-2 sm:p-3 rounded transition-colors ${
                      selectionsBlocked 
                        ? 'cursor-not-allowed bg-gray-600' 
                        : 'cursor-pointer hover:bg-gray-500'
                    } ${
                      selectedTransactions.has(transaction.id)
                        ? 'bg-blue-600 border border-blue-400'
                        : activeTransaction?.id === transaction.id
                        ? 'bg-purple-600 border border-purple-400'
                        : 'bg-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-xs sm:text-sm truncate">
                          {transaction.descricao_origem}
                        </div>
                        <div className="text-gray-300 text-xs mt-1">
                          {transaction.data}
                        </div>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <div className="text-white font-bold text-xs sm:text-sm">
                          {formatCurrency(transaction.valor)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {tonBankTransactions.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    Nenhuma transação TON não classificada encontrada
                  </div>
                )}
              </div>
            </div>

            {/* Coluna direita: Entradas da planilha */}
            <div className={`bg-gray-700 rounded-lg p-3 sm:p-4 ${selectionsBlocked ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium text-sm sm:text-base">
                  Planilha TON
                  {currentTab !== 'ambos' && (
                    <span className="text-blue-400 ml-1 sm:ml-2 text-xs sm:text-sm">({currentTab})</span>
                  )}
                </h3>
                <span className="text-gray-400 text-xs sm:text-sm hidden sm:block">
                  D-{currentTab === 'maquininha' ? '3' : '16'} até mais recente
                </span>
              </div>
              {/* Somatória das seleções */}
              <div className="mb-3 p-2 bg-gray-600 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">
                    Selecionadas: {selectedEntries.size}
                  </span>
                  <span className="text-green-400 font-bold text-sm">
                    {formatCurrency(selectedEntriesTotal)}
                  </span>
                </div>
                {selectedTransactions.size > 0 && selectedEntries.size > 0 && (
                  <div className="text-gray-400 text-xs mt-1">
                    Diferença: {formatCurrency(Math.abs(selectedTransactionsTotal - selectedEntriesTotal))}
                    {selectedTransactionsTotal !== selectedEntriesTotal && (
                      <span className="text-yellow-400 ml-1">⚠️</span>
                    )}
                  </div>
                )}
                {activeTransaction && (
                  <div className="text-purple-400 text-xs mt-1">
                    🔍 Filtro ativo: {activeTransaction.data} (D-{currentTab === 'maquininha' ? '3' : '16'} até D+0)
                  </div>
                )}
              </div>
              <div className="space-y-1 sm:space-y-2 max-h-64 sm:max-h-80 lg:max-h-96 overflow-y-auto">
                {filteredTonSheetEntries.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => handleEntryClick(entry)}
                    className={`p-2 sm:p-3 rounded transition-colors ${
                      selectionsBlocked 
                        ? 'cursor-not-allowed bg-gray-600' 
                        : 'cursor-pointer hover:bg-gray-500'
                    } ${
                      selectedEntries.has(entry.id)
                        ? 'bg-green-600 border border-green-400'
                        : 'bg-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-xs sm:text-sm truncate">
                          {entry.tipo} - {entry.id_contrato}
                        </div>
                        <div className="text-gray-300 text-xs mt-1">
                          {entry.data_hora.split('T')[0]} • {entry.parcelamento}
                        </div>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <div className="text-white font-bold text-xs sm:text-sm">
                          {formatCurrency(entry.valor_final)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredTonSheetEntries.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    Nenhuma entrada encontrada para esta aba
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* Lista de Matches Manuais */}
          {manualMatches.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Matches Criados ({manualMatches.length})</h3>
                <button
                  onClick={clearAllMatches}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  🗑️ Desfazer Todos
                </button>
              </div>
              <div className="space-y-4">
                {manualMatches.map((match, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-white font-medium">
                          {match.bankTransaction.descricao_origem}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {match.bankTransaction.data} • {formatCurrency(match.bankTransaction.valor)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeManualMatch(index)}
                        className="text-red-400 hover:text-red-300 transition-colors px-3 py-1 rounded text-sm"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="bg-gray-600 rounded p-3">
                      <h4 className="text-white font-medium mb-2">Entradas correspondentes ({match.selectedEntries.length}):</h4>
                      <div className="space-y-2">
                        {match.selectedEntries.map((entry, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <div className="flex items-center">
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                entry.parcelamento === 'Maquininha' ? 'bg-green-400' : 'bg-blue-400'
                              }`}></span>
                              <span className="text-gray-300">
                                {entry.tipo} - {entry.id_contrato} • {entry.parcelamento}
                              </span>
                            </div>
                            <div className="text-gray-400">
                              {formatCurrency(entry.valor_final)} • {entry.data_hora.split('T')[0]}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Preview das transações que serão criadas */}
                      <div className="mt-3 pt-3 border-t border-gray-500">
                        <h5 className="text-gray-300 text-sm mb-2">Preview das transações que serão criadas:</h5>
                        {(() => {
                          const previewTransactions = generateClassifiedTransactions(match);
                          return previewTransactions.map((tx, i) => (
                            <div key={i} className="text-xs text-gray-400 flex justify-between">
                              <span>{tx.descricao}</span>
                              <span>{formatCurrency(tx.valor!)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-400 hidden sm:block">
              {manualMatches.length > 0 && `${manualMatches.length} match${manualMatches.length !== 1 ? 'es' : ''} criado${manualMatches.length !== 1 ? 's' : ''}`}
            </div>
            <div className="flex gap-2 flex-1 sm:flex-initial justify-end">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-gray-400 hover:text-gray-200 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={createManualMatch}
                disabled={selectedTransactions.size === 0 || selectedEntries.size === 0 || selectionsBlocked}
                className={`px-3 py-1.5 rounded font-medium transition-colors text-sm ${
                  selectedTransactions.size > 0 && selectedEntries.size > 0 && !selectionsBlocked
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {selectionsBlocked ? '🔒' : `Match (${selectedTransactions.size + selectedEntries.size})`}
              </button>
              <button
                onClick={handleSaveApproved}
                disabled={manualMatches.length === 0 || loading}
                className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 text-sm ${
                  manualMatches.length > 0 && !loading
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Salvar
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Salvar ({manualMatches.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};