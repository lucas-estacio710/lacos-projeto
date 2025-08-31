// InterPagConciliationModal.tsx - COM TOTALIZADORES E SIMULAÇÃO

import React, { useState, useEffect } from 'react';
import { X, Calculator, Zap, Eye, Plus, Minus } from 'lucide-react';
import { Transaction, InterPagEntry, InterPagPercentual, InterPagSheetData, createInterPagSplitTransactions } from '@/types';
import { formatDateToLocal, formatDateForDisplay } from '@/lib/dateUtils';

// Helper para formatação
const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface DayData {
  date: string;
  displayDate: string;
  transactions: Transaction[];
  agendaEntries: InterPagEntry[];
}

interface SelectedMatch {
  transactionId: string;
  agendaId: string;
  percentualData: InterPagPercentual;
}

interface SimulationPreview {
  usedTransactions: Transaction[];
  unusedTransactions: Transaction[];
  usedAgenda: InterPagEntry[];
  unusedAgenda: InterPagEntry[];
  newTransactions: Array<{
    descricao: string;
    valor: number;
    categoria: string;
    subtipo: string;
    tipo: 'Catálogo' | 'Planos';
  }>;
}

interface InterPagConciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  complexTransactions: Transaction[];
  interPagData: InterPagSheetData | null;
  onApplyClassification: (classifications: Array<{
    id: string;
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  }>) => Promise<void>;
  onReconcileTransactions?: (reconciliationData: {
    originalTransactionIds: string[];
    newTransactions: Array<{
      conta: string;
      categoria: string;
      subtipo: string;
      descricao: string;
      valor: number;
      data: string;
      origem: string;
      cc: string;
      mes: string;
      descricao_origem: string;
      realizado: 's';
    }>;
    reconciliationNote: string;
  }) => Promise<void>;
  onDataRefresh?: () => Promise<void>;
}

export function InterPagConciliationModal({
  isOpen,
  onClose,
  complexTransactions,
  interPagData,
  onApplyClassification,
  onReconcileTransactions,
  onDataRefresh
}: InterPagConciliationModalProps) {
  const [dayData, setDayData] = useState<DayData[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<SelectedMatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);

  // ✅ FUNÇÃO PARA CRIAR MATCH MÚLTIPLO (1 transação → N agendas)
  const createMultipleMatches = (transactionId: string, agendaIds: string[]) => {
    const newMatches: SelectedMatch[] = [];
    
    agendaIds.forEach(agendaId => {
      const percentualData = interPagData?.percentuais.find(p => p.idTransacao === agendaId);
      if (percentualData) {
        newMatches.push({
          transactionId,
          agendaId,
          percentualData
        });
      }
    });
    
    setSelectedMatches(prev => [...prev, ...newMatches]);
    setSelectedTransaction(null);
    setSelectedAgendas([]);
  };

  // ✅ FUNÇÃO PARA TOGGLE AGENDA
  const toggleAgenda = (agendaId: string) => {
    setSelectedAgendas(prev => {
      if (prev.includes(agendaId)) {
        return prev.filter(id => id !== agendaId);
      } else {
        return [...prev, agendaId];
      }
    });
  };

  // Organizar dados por dia
  useEffect(() => {
    if (!isOpen || !interPagData) {
      setDayData([]);
      return;
    }

    console.log('📊 Organizando dados Inter Pag por dia...');

    // ✅ FILTRO EXATO COMO SOLICITADO
    const interPagTransactions = complexTransactions.filter(t => {
      return (
        t.origem === 'Inter' &&
        t.descricao_origem?.includes('INTER PAG') &&
        t.subtipo_id === 'e92f4f0f-4e94-4007-8945-a1fb47782051'
      );
    });

    console.log(`📊 ${interPagTransactions.length} transações Inter Pag encontradas`);
    console.log(`📋 ${interPagData.agendaEntries.length} entradas na agenda`);

    // Criar mapa de todas as datas únicas
    const allDates = new Set<string>();

    // Adicionar datas das transações
    interPagTransactions.forEach(t => {
      const dateStr = formatDateToLocal(t.data);
      if (dateStr && dateStr !== 'Data inválida') {
        allDates.add(dateStr);
      }
    });

    // Adicionar datas da agenda (usando Data Pagamento)
    interPagData.agendaEntries.forEach(entry => {
      const dateStr = formatDateToLocal(entry.dataPagamento);
      if (dateStr && dateStr !== 'Data inválida') {
        allDates.add(dateStr);
      }
    });

    // Criar estrutura de dados por dia
    const sortedDates = Array.from(allDates).sort();
    const dayDataArray: DayData[] = sortedDates.map(date => {
      // Transações do dia
      const dayTransactions = interPagTransactions.filter(t => 
        formatDateToLocal(t.data) === date
      );

      // Entradas da agenda do dia (usando Data Pagamento)
      const dayAgendaEntries = interPagData.agendaEntries.filter(entry => 
        formatDateToLocal(entry.dataPagamento) === date
      );

      return {
        date,
        displayDate: formatDateForDisplay(date),
        transactions: dayTransactions,
        agendaEntries: dayAgendaEntries
      };
    });

    // Filtrar apenas dias que têm pelo menos transações OU agenda
    const filteredDayData = dayDataArray.filter(day => 
      day.transactions.length > 0 || day.agendaEntries.length > 0
    );

    setDayData(filteredDayData);
    setCurrentDayIndex(0);
    setSelectedMatches([]);

    console.log(`✅ ${filteredDayData.length} dias organizados`);
  }, [isOpen, complexTransactions, interPagData]);

  // Navegação entre dias
  const goToPreviousDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  const goToNextDay = () => {
    if (currentDayIndex < dayData.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    }
  };

  // Obter dados do dia atual
  const getCurrentDay = (): DayData | null => {
    return dayData[currentDayIndex] || null;
  };

  // ✅ NOVA FUNÇÃO: Toggle match mais simples
  const toggleMatch = (transactionId: string, agendaId: string) => {
    const matchIndex = selectedMatches.findIndex(
      m => m.transactionId === transactionId && m.agendaId === agendaId
    );

    if (matchIndex >= 0) {
      // Remover match existente
      setSelectedMatches(prev => prev.filter((_, i) => i !== matchIndex));
    } else {
      // Adicionar novo match
      const percentualData = interPagData?.percentuais.find(p => p.idTransacao === agendaId);
      if (percentualData) {
        setSelectedMatches(prev => [...prev, {
          transactionId,
          agendaId,
          percentualData
        }]);
      }
    }
  };

  // Verificar se um par está selecionado
  const isSelected = (transactionId: string, agendaId: string): boolean => {
    return selectedMatches.some(
      m => m.transactionId === transactionId && m.agendaId === agendaId
    );
  };

  // ✅ CALCULAR TOTALIZADORES
  const calculateTotals = () => {
    const currentDay = getCurrentDay();
    if (!currentDay) return { transactionsTotal: 0, agendaTotal: 0, selectedTransactionsTotal: 0, selectedAgendaTotal: 0, difference: 0 };

    const transactionsTotal = currentDay.transactions.reduce((sum, t) => sum + Math.abs(t.valor), 0);
    const agendaTotal = currentDay.agendaEntries.reduce((sum, e) => sum + e.valorLiquido, 0);

    const selectedTransactionIds = selectedMatches.map(m => m.transactionId);
    const selectedAgendaIds = selectedMatches.map(m => m.agendaId);

    const selectedTransactionsTotal = currentDay.transactions
      .filter(t => selectedTransactionIds.includes(t.id))
      .reduce((sum, t) => sum + Math.abs(t.valor), 0);

    const selectedAgendaTotal = currentDay.agendaEntries
      .filter(e => selectedAgendaIds.includes(e.idTransacao))
      .reduce((sum, e) => sum + e.valorLiquido, 0);

    const difference = selectedTransactionsTotal - selectedAgendaTotal;

    return {
      transactionsTotal,
      agendaTotal,
      selectedTransactionsTotal,
      selectedAgendaTotal,
      difference
    };
  };

  // ✅ GERAR SIMULAÇÃO
  const generateSimulation = (): SimulationPreview => {
    const currentDay = getCurrentDay();
    if (!currentDay) return {
      usedTransactions: [],
      unusedTransactions: [],
      usedAgenda: [],
      unusedAgenda: [],
      newTransactions: []
    };

    const selectedTransactionIds = selectedMatches.map(m => m.transactionId);
    const selectedAgendaIds = selectedMatches.map(m => m.agendaId);

    const usedTransactions = currentDay.transactions.filter(t => selectedTransactionIds.includes(t.id));
    const unusedTransactions = currentDay.transactions.filter(t => !selectedTransactionIds.includes(t.id));
    const usedAgenda = currentDay.agendaEntries.filter(e => selectedAgendaIds.includes(e.idTransacao));
    const unusedAgenda = currentDay.agendaEntries.filter(e => !selectedAgendaIds.includes(e.idTransacao));

    // Gerar transações que serão criadas
    const newTransactions: Array<{
      descricao: string;
      valor: number;
      categoria: string;
      subtipo: string;
      tipo: 'Catálogo' | 'Planos';
    }> = [];

    selectedMatches.forEach(match => {
      const agendaEntry = usedAgenda.find(e => e.idTransacao === match.agendaId);
      if (agendaEntry) {
        const catalogoValue = Math.round((agendaEntry.valorLiquido * match.percentualData.percentualCatalogo / 100) * 100) / 100;
        const planosValue = Math.round((agendaEntry.valorLiquido * match.percentualData.percentualPlanos / 100) * 100) / 100;

        if (catalogoValue > 0) {
          newTransactions.push({
            descricao: `Inter Pag Catálogo - ${match.percentualData.idContrato}`,
            valor: catalogoValue,
            categoria: 'Receita Antiga',
            subtipo: match.percentualData.idContrato.includes('IND') ? 'REC. A. P. IND.' : 'REC. A. P. COL.',
            tipo: 'Catálogo'
          });
        }

        if (planosValue > 0) {
          newTransactions.push({
            descricao: `Inter Pag Planos - ${match.percentualData.idContrato}`,
            valor: planosValue,
            categoria: 'Receita Antiga',
            subtipo: match.percentualData.idContrato.includes('IND') ? 'REC. A. P. IND.' : 'REC. A. P. COL.',
            tipo: 'Planos'
          });
        }
      }
    });

    return {
      usedTransactions,
      unusedTransactions,
      usedAgenda,
      unusedAgenda,
      newTransactions
    };
  };

  // Executar reconciliação
  const handleReconciliation = async () => {
    if (selectedMatches.length === 0) {
      alert('⚠️ Selecione pelo menos um match para reconciliar');
      return;
    }

    const totals = calculateTotals();
    if (Math.abs(totals.difference) > 0.01) {
      const confirm = window.confirm(
        `⚠️ Há diferença de R$ ${formatCurrency(Math.abs(totals.difference))} entre transações e agenda.\n\n` +
        `Transações selecionadas: R$ ${formatCurrency(totals.selectedTransactionsTotal)}\n` +
        `Agenda selecionada: R$ ${formatCurrency(totals.selectedAgendaTotal)}\n\n` +
        `Deseja continuar mesmo assim?`
      );
      if (!confirm) return;
    }

    const simulation = generateSimulation();
    const contracts = selectedMatches.map(match => match.percentualData.idContrato).join(', ');

    const confirmText = 
      `🔗 Reconciliar ${selectedMatches.length} match(es) Inter Pag?\n\n` +
      `💰 Valor: R$ ${formatCurrency(totals.selectedAgendaTotal)}\n` +
      `📋 Contratos: ${contracts}\n` +
      `🆕 Novas transações: ${simulation.newTransactions.length}\n\n` +
      `Isso irá quebrar cada transação conforme percentuais`;

    if (!window.confirm(confirmText)) return;

    setIsProcessing(true);

    try {
      let allNewTransactions: Array<{
        conta: string;
        categoria: string;
        subtipo: string;
        descricao: string;
        valor: number;
        data: string;
        origem: string;
        cc: string;
        mes: string;
        descricao_origem: string;
        realizado: 's';
      }> = [];

      if (onReconcileTransactions) {
        // Para cada match selecionado, criar as transações quebradas
        for (const match of selectedMatches) {
          const transaction = complexTransactions.find(t => t.id === match.transactionId);
          const agendaEntry = interPagData?.agendaEntries.find(e => e.idTransacao === match.agendaId);

          if (transaction && agendaEntry) {
            const splitResult = createInterPagSplitTransactions(
              transaction,
              agendaEntry,
              match.percentualData
            );

            // Adicionar transação do catálogo
            if (splitResult.catalogoTransaction.valor && splitResult.catalogoTransaction.valor > 0) {
              allNewTransactions.push({
                conta: splitResult.catalogoTransaction.conta!,
                categoria: splitResult.catalogoTransaction.categoria!,
                subtipo: splitResult.catalogoTransaction.subtipo!,
                descricao: splitResult.catalogoTransaction.descricao!,
                valor: splitResult.catalogoTransaction.valor,
                data: splitResult.catalogoTransaction.data!,
                origem: splitResult.catalogoTransaction.origem!,
                cc: splitResult.catalogoTransaction.cc!,
                mes: splitResult.catalogoTransaction.mes!,
                descricao_origem: splitResult.catalogoTransaction.descricao_origem!,
                realizado: 's'
              });
            }

            // Adicionar transação dos planos
            if (splitResult.planosTransaction.valor && splitResult.planosTransaction.valor > 0) {
              allNewTransactions.push({
                conta: splitResult.planosTransaction.conta!,
                categoria: splitResult.planosTransaction.categoria!,
                subtipo: splitResult.planosTransaction.subtipo!,
                descricao: splitResult.planosTransaction.descricao!,
                valor: splitResult.planosTransaction.valor,
                data: splitResult.planosTransaction.data!,
                origem: splitResult.planosTransaction.origem!,
                cc: splitResult.planosTransaction.cc!,
                mes: splitResult.planosTransaction.mes!,
                descricao_origem: splitResult.planosTransaction.descricao_origem!,
                realizado: 's'
              });
            }
          }
        }

        const reconciliationData = {
          originalTransactionIds: selectedMatches.map(m => m.transactionId),
          newTransactions: allNewTransactions,
          reconciliationNote: `Inter Pag reconciliado: ${contracts} - ${selectedMatches.length} matches processados`
        };

        await onReconcileTransactions(reconciliationData);
      } else {
        // Fallback: classificação simples
        const classifications = selectedMatches.map(match => {
          const isIndividual = match.percentualData.idContrato.includes('IND');
          
          return {
            id: match.transactionId,
            conta: 'PJ',
            categoria: 'Receita Antiga',
            subtipo: isIndividual ? 'REC. A. P. IND.' : 'REC. A. P. COL.',
            descricao: `Inter Pag - Contrato ${match.percentualData.idContrato} - ${match.percentualData.percentualCatalogo}% Cat / ${match.percentualData.percentualPlanos}% Planos`
          };
        });

        await onApplyClassification(classifications);
      }

      const totalCreated = onReconcileTransactions ? allNewTransactions.length : selectedMatches.length;

      alert(`✅ Reconciliação Inter Pag concluída!\n\n📊 ${totalCreated} ${onReconcileTransactions ? 'novas transações criadas' : 'transações classificadas'}`);

      // Recarregar dados
      if (onDataRefresh) {
        await onDataRefresh();
      }

    } catch (error) {
      console.error('❌ Erro na reconciliação Inter Pag:', error);
      alert('❌ Erro ao executar reconciliação Inter Pag');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const currentDay = getCurrentDay();
  const totals = calculateTotals();
  const simulation = generateSimulation();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-100">
              🟠 Inter Pag - Matching com Simulação
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSimulation(!showSimulation)}
                className={`px-3 py-1 rounded transition-colors ${
                  showSimulation 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Simulação
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Navegação entre dias */}
          {dayData.length > 0 && (
            <div className="bg-orange-900/30 border border-orange-600 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-100 font-medium">
                  📅 {currentDay?.displayDate} ({currentDayIndex + 1}/{dayData.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousDay}
                    disabled={currentDayIndex === 0}
                    className="px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 text-white rounded transition-colors"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={goToNextDay}
                    disabled={currentDayIndex === dayData.length - 1}
                    className="px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 text-white rounded transition-colors"
                  >
                    Próximo →
                  </button>
                </div>
              </div>
              
              {/* ✅ TOTALIZADORES */}
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="bg-blue-700 p-2 rounded text-center">
                  <div className="text-blue-200 text-xs">Transações Total</div>
                  <div className="text-white font-bold">R$ {formatCurrency(totals.transactionsTotal)}</div>
                </div>
                <div className="bg-green-700 p-2 rounded text-center">
                  <div className="text-green-200 text-xs">Agenda Total</div>
                  <div className="text-white font-bold">R$ {formatCurrency(totals.agendaTotal)}</div>
                </div>
                <div className="bg-purple-700 p-2 rounded text-center">
                  <div className="text-purple-200 text-xs">Selecionado</div>
                  <div className="text-white font-bold">R$ {formatCurrency(totals.selectedTransactionsTotal)}</div>
                </div>
                <div className={`p-2 rounded text-center ${
                  Math.abs(totals.difference) < 0.01 
                    ? 'bg-green-700' 
                    : 'bg-red-700'
                }`}>
                  <div className="text-gray-200 text-xs">Diferença</div>
                  <div className="text-white font-bold">R$ {formatCurrency(Math.abs(totals.difference))}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-hidden">
          {dayData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🟠</div>
                <h3 className="text-xl font-semibold text-gray-100 mb-2">
                  Nenhum dado Inter Pag para reconciliar
                </h3>
                <p className="text-gray-400">
                  Verifique se há transações Inter Pag e dados da planilha carregados
                </p>
              </div>
            </div>
          ) : currentDay ? (
            <div className="h-full flex">
              
              {/* ✅ GRID PRINCIPAL */}
              <div className={`${showSimulation ? 'w-2/3' : 'w-full'} transition-all duration-300`}>
                <div className="h-full p-4">
                  {/* Grid lado a lado */}
                  <div className="grid grid-cols-2 gap-6 h-full">
                    
                    {/* LADO ESQUERDO: Transações */}
                    <div className="border border-gray-600 rounded-lg p-4 overflow-hidden flex flex-col">
                      <h4 className="font-medium text-gray-100 mb-3 flex items-center justify-between">
                        <span>📊 Transações ({currentDay.transactions.length})</span>
                        <span className="text-sm text-blue-300">R$ {formatCurrency(totals.transactionsTotal)}</span>
                      </h4>
                      
                      <div className="flex-1 overflow-y-auto space-y-2">
                        {currentDay.transactions.length === 0 ? (
                          <div className="text-gray-400 text-center py-8">
                            Nenhuma transação Inter Pag neste dia
                          </div>
                        ) : (
                          currentDay.transactions.map(transaction => {
                            const isUsed = selectedMatches.some(m => m.transactionId === transaction.id);
                            const isPending = selectedTransaction === transaction.id;
                            
                            return (
                              <button
                                key={transaction.id}
                                onClick={() => {
                                  if (isUsed) {
                                    // Remove todos os matches desta transação
                                    setSelectedMatches(prev => prev.filter(m => m.transactionId !== transaction.id));
                                  } else if (selectedAgendas.length > 0) {
                                    // Se há agendas selecionadas, criar matches múltiplos
                                    createMultipleMatches(transaction.id, selectedAgendas);
                                  } else {
                                    // Selecionar esta transação
                                    setSelectedTransaction(transaction.id);
                                    setSelectedAgendas([]);
                                  }
                                }}
                                className={`w-full text-left border rounded p-3 transition-colors ${
                                  isUsed 
                                    ? 'border-green-500 bg-green-900/20' 
                                    : isPending
                                    ? 'border-yellow-500 bg-yellow-900/20'
                                    : 'border-gray-700 bg-gray-800 hover:bg-blue-900/20 hover:border-blue-500'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-medium text-gray-100 text-sm">
                                    {transaction.descricao_origem?.substring(0, 30)}...
                                  </div>
                                  <div className={`font-bold ${isUsed ? 'text-green-400' : 'text-blue-400'}`}>
                                    R$ {formatCurrency(Math.abs(transaction.valor))}
                                  </div>
                                </div>
                                
                                <div className="text-xs text-gray-400 space-y-0.5">
                                  <div>ID: {transaction.id}</div>
                                  <div>CC: {transaction.cc}</div>
                                  {isUsed && <div className="text-green-300">✅ Selecionada</div>}
                                  {isPending && <div className="text-yellow-300">👆 Selecione agenda(s)</div>}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* LADO DIREITO: Agenda Inter */}
                    <div className="border border-gray-600 rounded-lg p-4 overflow-hidden flex flex-col">
                      <h4 className="font-medium text-gray-100 mb-3 flex items-center justify-between">
                        <span>📋 Agenda ({currentDay.agendaEntries.length})</span>
                        <span className="text-sm text-green-300">R$ {formatCurrency(totals.agendaTotal)}</span>
                      </h4>
                      
                      <div className="flex-1 overflow-y-auto space-y-2">
                        {currentDay.agendaEntries.length === 0 ? (
                          <div className="text-gray-400 text-center py-8">
                            Nenhuma entrada da agenda neste dia
                          </div>
                        ) : (
                          currentDay.agendaEntries.map(entry => {
                            const percentualData = interPagData?.percentuais.find(p => p.idTransacao === entry.idTransacao);
                            const isUsed = selectedMatches.some(m => m.agendaId === entry.idTransacao);
                            const isPending = selectedAgendas.includes(entry.idTransacao);
                            
                            return (
                              <button
                                key={entry.idTransacao}
                                onClick={() => {
                                  if (isUsed) {
                                    // Remove match desta agenda
                                    setSelectedMatches(prev => prev.filter(m => m.agendaId !== entry.idTransacao));
                                  } else if (selectedTransaction) {
                                    // Se há transação selecionada, adicionar esta agenda à seleção múltipla
                                    toggleAgenda(entry.idTransacao);
                                  } else {
                                    // Apenas toggle desta agenda
                                    toggleAgenda(entry.idTransacao);
                                  }
                                }}
                                className={`w-full text-left border rounded p-3 transition-colors ${
                                  isUsed 
                                    ? 'border-green-500 bg-green-900/20' 
                                    : isPending
                                    ? 'border-yellow-500 bg-yellow-900/20'
                                    : 'border-gray-700 bg-gray-800 hover:bg-green-900/20 hover:border-green-500'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-medium text-gray-100 text-sm">
                                    ID: {entry.idTransacao}
                                  </div>
                                  <div className={`font-bold ${isUsed ? 'text-green-400' : 'text-green-400'}`}>
                                    R$ {formatCurrency(entry.valorLiquido)}
                                  </div>
                                </div>
                                
                                <div className="text-xs text-gray-400 space-y-0.5">
                                  <div>Bandeira: {entry.bandeira}</div>
                                  <div>Status: {entry.status}</div>
                                  {percentualData && (
                                    <div className="mt-2 pt-2 border-t border-gray-600">
                                      <div className="text-blue-300">
                                        {percentualData.idContrato}
                                      </div>
                                      <div className="text-blue-300">
                                        {percentualData.percentualCatalogo}% Cat / {percentualData.percentualPlanos}% Planos
                                      </div>
                                    </div>
                                  )}
                                  {isUsed && <div className="text-green-300">✅ Selecionada</div>}
                                  {isPending && <div className="text-yellow-300">📋 Aguardando transação</div>}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ✅ ÁREA DE MATCHING SIMPLIFICADA */}
                  {currentDay.transactions.length > 0 && currentDay.agendaEntries.length > 0 && (
                    <div className="mt-4 border-t border-gray-600 pt-4">
                      <h4 className="font-medium text-gray-100 mb-3">
                        🔗 Matching rápido
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Transações clicáveis */}
                        <div>
                          <h5 className="text-sm text-gray-300 mb-2">Clique na transação:</h5>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {currentDay.transactions.map(transaction => (
                              <button
                                key={transaction.id}
                                className="w-full text-left text-xs bg-blue-700 hover:bg-blue-600 p-2 rounded transition-colors"
                                onClick={() => {
                                  const availableAgenda = currentDay.agendaEntries.filter(e => 
                                    !selectedMatches.some(m => m.agendaId === e.idTransacao)
                                  );
                                  
                                  if (availableAgenda.length === 0) {
                                    alert('Todas as agendas já foram selecionadas');
                                    return;
                                  }
                                  
                                  // Auto-match com primeira agenda disponível
                                  toggleMatch(transaction.id, availableAgenda[0].idTransacao);
                                }}
                              >
                                R$ {formatCurrency(Math.abs(transaction.valor))}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Matches atuais */}
                        <div>
                          <h5 className="text-sm text-gray-300 mb-2">Matches ({selectedMatches.length}):</h5>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {selectedMatches.length === 0 ? (
                              <div className="text-gray-500 text-xs">Nenhum match</div>
                            ) : (
                              selectedMatches.map((match, index) => {
                                const transaction = currentDay.transactions.find(t => t.id === match.transactionId);
                                const agendaEntry = currentDay.agendaEntries.find(e => e.idTransacao === match.agendaId);
                                
                                return (
                                  <div
                                    key={index}
                                    className="bg-green-700 p-2 rounded text-xs text-white flex items-center justify-between"
                                  >
                                    <div>
                                      🔗 R$ {formatCurrency(Math.abs(transaction?.valor || 0))} ↔ {agendaEntry?.idTransacao}
                                    </div>
                                    <button
                                      onClick={() => toggleMatch(match.transactionId, match.agendaId)}
                                      className="text-red-300 hover:text-red-100"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ PAINEL DE SIMULAÇÃO */}
              {showSimulation && (
                <div className="w-1/3 border-l border-gray-600 bg-gray-850 p-4 overflow-y-auto">
                  <h4 className="font-medium text-gray-100 mb-4 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Simulação da Reconciliação
                  </h4>

                  {/* Transações que serão inutilizadas */}
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-red-300 mb-2">
                      🗑️ Transações que serão marcadas como reconciliadas ({simulation.usedTransactions.length}):
                    </h5>
                    <div className="space-y-1">
                      {simulation.usedTransactions.map(t => (
                        <div key={t.id} className="text-xs bg-red-900/20 p-2 rounded">
                          R$ {formatCurrency(Math.abs(t.valor))} - {t.id}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Novas transações que serão criadas */}
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-green-300 mb-2">
                      ➕ Novas transações que serão criadas ({simulation.newTransactions.length}):
                    </h5>
                    <div className="space-y-1">
                      {simulation.newTransactions.map((nt, index) => (
                        <div key={index} className={`text-xs p-2 rounded ${
                          nt.tipo === 'Catálogo' ? 'bg-blue-900/20' : 'bg-purple-900/20'
                        }`}>
                          <div className="font-medium">
                            {nt.tipo}: R$ {formatCurrency(nt.valor)}
                          </div>
                          <div className="text-gray-400">
                            {nt.categoria} - {nt.subtipo}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumo final */}
                  <div className="bg-gray-700 p-3 rounded">
                    <h5 className="text-sm font-medium text-gray-200 mb-2">📊 Resumo:</h5>
                    <div className="text-xs text-gray-300 space-y-1">
                      <div>• {simulation.usedTransactions.length} transações originais → reconciliadas</div>
                      <div>• {simulation.newTransactions.length} novas transações → criadas</div>
                      <div>• Total catálogo: R$ {formatCurrency(
                        simulation.newTransactions
                          .filter(nt => nt.tipo === 'Catálogo')
                          .reduce((sum, nt) => sum + nt.valor, 0)
                      )}</div>
                      <div>• Total planos: R$ {formatCurrency(
                        simulation.newTransactions
                          .filter(nt => nt.tipo === 'Planos')
                          .reduce((sum, nt) => sum + nt.valor, 0)
                      )}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-850">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Fechar
            </button>
            
            <div className="flex-1" />
            
            <div className="text-xs text-gray-400 mr-4">
              Diferença: R$ {formatCurrency(Math.abs(totals.difference))}
              {Math.abs(totals.difference) < 0.01 && ' ✅'}
            </div>
            
            <button
              onClick={handleReconciliation}
              disabled={selectedMatches.length === 0 || isProcessing}
              className={`px-6 py-2 rounded transition-colors font-medium flex items-center gap-2 ${
                selectedMatches.length > 0 && !isProcessing
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                  Processando...
                </>
              ) : selectedMatches.length > 0 ? (
                <>
                  <Zap className="w-4 h-4" />
                  Processar {selectedMatches.length} Match(es)
                </>
              ) : (
                'Selecione Matches para Processar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}