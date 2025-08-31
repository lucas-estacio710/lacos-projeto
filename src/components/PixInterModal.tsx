// components/PixInterModal.tsx - MODAL 100% MANUAL PARA PIX INTER

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, ArrowLeft, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { Transaction } from '@/types';
import { formatDateToLocal, formatDateForDisplay } from '@/lib/dateUtils';
import { SUBTIPO_IDS } from '@/lib/constants';

// Interface para entrada da planilha financeira
interface EntradaFinanceira {
  id: string;
  csv_id: string;
  id_contrato: string;
  data_hora: string;
  tipo: string;
  metodo: string;
  cc: string;
  valor_final: number;
  id_transacao: string;
  uploaded_at: string;
  utilizada?: boolean; // ✅ NOVO: Marca se a entrada já foi utilizada em classificação
}

interface DayGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  pixTransactions: Transaction[];
  planilhaEntries: EntradaFinanceira[];
  totalTransactionValue: number;
  totalEntriesValue: number;
}

interface PixInterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // ✅ NOVO: Callback para quando operação é bem-sucedida
  complexTransactions?: Transaction[]; // Transactions com categoria COMPLEXA
  planilhaEntries?: EntradaFinanceira[]; // Entradas da planilha financeira
  onMarkEntriesAsUsed?: (entryIds: string[]) => Promise<void>; // ✅ NOVO: Para marcar entradas como utilizadas
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
      type: 'pix_inter_n_to_m';
      source_count: number;
      destination_count: number;
      date: string;
      contracts: string[];
      total_original_value: number;
      total_new_value: number;
      difference: number;
    };
  }) => Promise<void>;
}

export function PixInterModal({
  isOpen,
  onClose,
  onSuccess,
  complexTransactions = [],
  planilhaEntries = [],
  onMarkEntriesAsUsed,
  onApplyReconciliation
}: PixInterModalProps) {
  // Estados principais
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);

  // Organizar dados por dia quando modal abre
  useEffect(() => {
    if (!isOpen) {
      setDayGroups([]);
      setDataInitialized(false);
      return;
    }

    // INICIALIZAR APENAS UMA VEZ
    if (dataInitialized) {
      console.log('📌 Dados PIX Inter já inicializados, mantendo estado atual');
      return;
    }

    console.log('🔧 Organizando dados PIX Inter por dia...');

    // 1. Filtrar apenas PIX Inter com categoria COMPLEXA E não reconciliadas E valores positivos
    const pixTransactions = complexTransactions.filter(t => {
      const isPixInter = (
        t.origem === 'Inter' &&
        !t.descricao_origem?.toLowerCase().includes('inter pag') &&
        !t.descricao_origem?.toLowerCase().includes('interpag')
      );
      
      // ✅ CORREÇÃO: Apenas categoria COMPLEXA E não reconciliadas E valores positivos
      const COMPLEX_SUBTIPO_ID = 'e92f4f0f-4e94-4007-8945-a1fb47782051';
      const isComplexCategory = t.subtipo_id === COMPLEX_SUBTIPO_ID;
      const isNotReconciled = t.realizado !== 'r'; // ✅ Excluir reconciliadas
      const isPositiveValue = t.valor >= 0; // ✅ Apenas valores positivos (receitas)
      
      return isPixInter && isComplexCategory && isNotReconciled && isPositiveValue;
    });

    // 2. Filtrar apenas entradas PIX da planilha (excluir já utilizadas)
    const pixEntries = planilhaEntries.filter(entry => 
      entry.metodo?.toLowerCase().includes('pix') && !entry.utilizada
    );

    console.log(`📊 ${pixTransactions.length} transações PIX Inter encontradas`);
    console.log(`📋 ${pixEntries.length} entradas PIX na planilha`);

    // 3. Agrupar por data
    const groups = new Map<string, DayGroup>();

    // Processar transações PIX
    pixTransactions.forEach(transaction => {
      const dateStr = formatDateToLocal(transaction.data);
      
      if (!dateStr || dateStr === 'Data inválida') {
        console.warn('⚠️ Transação com data inválida ignorada:', transaction.id);
        return;
      }
      
      if (!groups.has(dateStr)) {
        groups.set(dateStr, {
          date: dateStr,
          displayDate: formatDateForDisplay(dateStr),
          pixTransactions: [],
          planilhaEntries: [],
          totalTransactionValue: 0,
          totalEntriesValue: 0
        });
      }
      
      const group = groups.get(dateStr)!;
      group.pixTransactions.push(transaction);
      group.totalTransactionValue += Math.abs(transaction.valor);
    });

    // Processar entradas da planilha PIX
    pixEntries.forEach(entry => {
      const dateStr = formatDateToLocal(entry.data_hora);
      
      if (!dateStr || dateStr === 'Data inválida') {
        console.warn('⚠️ Entrada com data inválida ignorada:', entry.id);
        return;
      }
      
      // Não criar grupo novo se não houver transações para o dia
      if (groups.has(dateStr)) {
        const group = groups.get(dateStr)!;
        group.planilhaEntries.push(entry);
        group.totalEntriesValue += entry.valor_final;
      }
    });

    // 4. Converter para array e ordenar cronologicamente
    const sortedGroups = Array.from(groups.values())
      .filter(group => group.pixTransactions.length > 0) // Apenas dias com transações
      .sort((a, b) => a.date.localeCompare(b.date));

    setDayGroups(sortedGroups);
    setCurrentDayIndex(0);
    resetSelections();
    setDataInitialized(true);

    console.log(`✅ ${sortedGroups.length} dias organizados`);
  }, [isOpen, dataInitialized]); // Controle de inicialização para evitar loop infinito

  // Funções auxiliares
  const getCurrentGroup = (): DayGroup | null => {
    return dayGroups[currentDayIndex] || null;
  };

  const resetSelections = () => {
    setSelectedTransactions(new Set());
    setSelectedEntries(new Set());
  };

  const goToPreviousDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
      resetSelections();
    }
  };

  const goToNextDay = () => {
    if (currentDayIndex < dayGroups.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
      resetSelections();
    }
  };

  // Toggle seleções
  const toggleTransactionSelection = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleEntrySelection = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  // Gerar classificação baseada na entrada da planilha (nova hierarquia)
  const generateClassificationFromEntry = (entry: EntradaFinanceira): {
    subtipo_id: string;
    descricao: string;
  } => {
    const tipo = entry.tipo.toLowerCase();
    const idContrato = entry.id_contrato.toUpperCase();
    
    // Determinar se é Individual ou Coletiva
    const isIndividual = idContrato.includes('IND');
    const isColetiva = idContrato.includes('COL');
    
    // Determinar se é Plano ou Catálogo
    const isPlano = tipo.includes('plano');
    const isCatalogo = tipo.includes('catalogo') || tipo.includes('catálogo');
    
    // Mapear para subtipo_id da nova hierarquia (Receitas Novas)
    let subtipo_id: string;
    
    if (isPlano && isIndividual) {
      subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_PLANO_INDIVIDUAL;
    } else if (isPlano && isColetiva) {
      subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_PLANO_COLETIVA;
    } else if (isCatalogo && isIndividual) {
      subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_CATALOGO_INDIVIDUAL;
    } else if (isCatalogo && isColetiva) {
      subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_CATALOGO_COLETIVA;
    } else {
      // Default: Plano Individual
      subtipo_id = SUBTIPO_IDS.RECEITA_NOVA_PLANO_INDIVIDUAL;
    }
    
    const tipoFormatado = isPlano ? 'Plano' : 'Catálogo';
    const modalidadeFormatada = isIndividual ? 'Individual' : 'Coletiva';
    
    return {
      subtipo_id,
      descricao: `Receita Nova ${tipoFormatado} ${modalidadeFormatada} - Contrato ${entry.id_contrato}`
    };
  };

  // Calcular totais selecionados
  const currentGroup = getCurrentGroup();
  const selectedTransactionTotal = currentGroup 
    ? currentGroup.pixTransactions
        .filter(t => selectedTransactions.has(t.id))
        .reduce((sum, t) => sum + Math.abs(t.valor), 0)
    : 0;

  const selectedEntriesTotal = currentGroup
    ? currentGroup.planilhaEntries
        .filter(e => selectedEntries.has(e.id))
        .reduce((sum, e) => sum + e.valor_final, 0)
    : 0;

  const hasSelections = selectedTransactions.size > 0 && selectedEntries.size > 0;
  const difference = selectedTransactionTotal - selectedEntriesTotal;

  // Executar reconciliação manual N para M
  const handleManualReconciliation = async () => {
    if (!currentGroup || !hasSelections) {
      alert('⚠️ Selecione pelo menos uma transação e uma entrada da planilha');
      return;
    }

    const selectedTransactionsList = currentGroup.pixTransactions.filter(t => selectedTransactions.has(t.id));
    const selectedEntriesList = currentGroup.planilhaEntries.filter(e => selectedEntries.has(e.id));

    const confirmText = 
      `🔗 Reconciliação N para M - Confirma?\n\n` +
      `📅 Data: ${currentGroup.displayDate}\n` +
      `📊 ORIGEM: ${selectedTransactionsList.length} transação(ões) PIX → serão RECONCILIADAS\n` +
      `📊 DESTINO: ${selectedEntriesList.length} entrada(s) planilha → ${selectedEntriesList.length} NOVOS lançamentos\n\n` +
      `💰 Total Origem: R$ ${selectedTransactionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `💰 Total Destino: R$ ${selectedEntriesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `📊 Diferença: R$ ${Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `⚡ RESULTADO:\n` +
      `   • ${selectedTransactionsList.length} transações originais → realizado = 'r' (não contam no saldo)\n` +
      `   • ${selectedEntriesList.length} novos lançamentos → realizado = 's' (contam no saldo)\n` +
      `   • Rastreabilidade completa mantida`;

    if (!window.confirm(confirmText)) return;

    setIsProcessing(true);

    try {
      // 🎯 LÓGICA N PARA M CORRETA
      
      // 1. RECONCILIAÇÃO: Marcar transações originais como reconciliadas
      const originalTransactionIds = selectedTransactionsList.map(t => t.id);
      
      // 2. CRIAÇÃO: Gerar NOVOS lançamentos baseados nas ENTRADAS da planilha
      const newTransactions = selectedEntriesList.map((entry, index) => {
        const classification = generateClassificationFromEntry(entry);
        const baseTransaction = selectedTransactionsList[0]; // Para herdar dados básicos
        
        return {
          // Novo ID único para o lançamento
          id: `PIX_REC_${entry.id}_${Date.now()}_${index}`,
          
          // DADOS DA ENTRADA DA PLANILHA (valores corretos)
          valor: entry.valor_final, // ✅ Valor da ENTRADA, não da transação
          
          // NOVA CLASSIFICAÇÃO HIERÁRQUICA
          subtipo_id: classification.subtipo_id, // ✅ Usar nova hierarquia
          descricao: classification.descricao,
          
          // DADOS HERDADOS DA TRANSAÇÃO ORIGINAL (contexto)
          data: baseTransaction.data,
          origem: baseTransaction.origem,
          cc: baseTransaction.cc,
          mes: baseTransaction.mes,
          descricao_origem: `PIX Inter Reconciliado - ${entry.tipo} - Contrato ${entry.id_contrato}`,
          
          // ESTADO E RASTREABILIDADE
          realizado: 's' as const, // ✅ Novo lançamento CONTA no saldo
          
          // METADADOS DE RECONCILIAÇÃO
          linked_future_group: `PIX_RECONCILIATION_${currentGroup.date}`,
          is_from_reconciliation: true,
          reconciliation_metadata: JSON.stringify({
            reconciliation_type: 'pix_inter_manual',
            reconciliation_date: new Date().toISOString(),
            original_transaction_ids: originalTransactionIds,
            planilha_entry_id: entry.id,
            planilha_entry_data: {
              id_contrato: entry.id_contrato,
              id_transacao: entry.id_transacao,
              tipo: entry.tipo,
              metodo: entry.metodo,
              valor_final: entry.valor_final
            },
            reconciliation_session: {
              date: currentGroup.date,
              display_date: currentGroup.displayDate,
              total_original_transactions: selectedTransactionsList.length,
              total_new_transactions: selectedEntriesList.length,
              value_difference: Math.abs(difference)
            }
          })
        };
      });

      // 3. DADOS PARA O HOOK DE RECONCILIAÇÃO
      const reconciliationData = {
        // IDs das transações que serão RECONCILIADAS (realizado = 'r')
        originalTransactionIds: originalTransactionIds,
        
        // IDs das entradas da planilha usadas
        selectedEntryIds: selectedEntriesList.map(e => e.id),
        
        // NOVOS lançamentos que serão CRIADOS
        newTransactions: newTransactions,
        
        // Nota explicativa
        reconciliationNote: `PIX Inter N→M: ${selectedTransactionsList.length} trans → ${selectedEntriesList.length} lançamentos | Contratos: ${selectedEntriesList.map(e => e.id_contrato).join(', ')} | ${currentGroup.displayDate}`,
        
        // Metadados da operação
        reconciliationMetadata: {
          type: 'pix_inter_n_to_m' as const,
          source_count: selectedTransactionsList.length,
          destination_count: selectedEntriesList.length,
          date: currentGroup.date,
          contracts: selectedEntriesList.map(e => e.id_contrato),
          total_original_value: selectedTransactionTotal,
          total_new_value: selectedEntriesTotal,
          difference: difference
        }
      };

      if (onApplyReconciliation) {
        await onApplyReconciliation(reconciliationData);
      }

      // ✅ NOVO: Marcar entradas como utilizadas
      if (onMarkEntriesAsUsed) {
        const entryIds = selectedEntriesList.map(e => e.id);
        console.log('🔄 PIX - Marcando entradas como utilizadas:', entryIds);
        await onMarkEntriesAsUsed(entryIds);
      }

      alert(
        `✅ Reconciliação N→M concluída!\n\n` +
        `📄 PROCESSAMENTO:\n` +
        `   • ${selectedTransactionsList.length} transações PIX reconciliadas (realizado='r')\n` +
        `   • ${selectedEntriesList.length} novos lançamentos criados (realizado='s')\n\n` +
        `💰 SALDO FINAL:\n` +
        `   • Transações originais: NÃO contam mais\n` +
        `   • Novos lançamentos: R$ ${selectedEntriesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} somam ao saldo\n\n` +
        `🔗 Rastreabilidade: Completa via reconciliation_metadata`
      );

      // Reset seleções
      resetSelections();

    } catch (error) {
      console.error('❌ Erro na reconciliação N→M:', error);
      alert('❌ Erro ao executar reconciliação N→M');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helpers de formatação
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              🟣 PIX Inter - Reconciliação Manual
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setDataInitialized(false);
                  resetSelections();
                }} 
                className="text-gray-400 hover:text-gray-200 transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* ✅ CALENDÁRIO LINEAR COMPACTO */}
          {dayGroups.length > 0 && (
            <div className="bg-purple-900/30 border border-purple-600 rounded-lg p-3 mb-3">
              <div className="text-purple-100 text-sm font-medium mb-2 flex items-center justify-between">
                <span>📅 Calendário ({dayGroups.length} dias)</span>
                {/* Navegação integrada */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousDay}
                    disabled={currentDayIndex === 0}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded text-xs transition-colors"
                  >
                    ←
                  </button>
                  <button
                    onClick={goToNextDay}
                    disabled={currentDayIndex === dayGroups.length - 1}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded text-xs transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
              
              {/* ✅ CALENDÁRIO COMPACTO EM LINHA HORIZONTAL */}
              <div className="flex gap-1 overflow-x-auto pb-2">
                {dayGroups.map((group, index) => {
                  const isActive = index === currentDayIndex;
                  const hasMatch = group.planilhaEntries.length > 0;
                  
                  // Extrair dia e mês da data
                  const parts = group.displayDate.split('/'); // DD/MM/YYYY
                  const day = parts[0]; // DD
                  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                  const month = monthNames[parseInt(parts[1]) - 1]; // mmm
                  
                  return (
                    <button
                      key={group.date}
                      onClick={() => {
                        setCurrentDayIndex(index);
                        resetSelections();
                      }}
                      className={`flex-shrink-0 p-2 rounded border transition-all text-center min-w-[50px] ${
                        isActive 
                          ? 'border-purple-400 bg-purple-700' 
                          : hasMatch
                            ? 'border-green-600 bg-green-900/30 hover:bg-green-800/50'
                            : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      {/* DD em cima */}
                      <div className={`text-lg font-bold ${
                        isActive ? 'text-purple-100' : hasMatch ? 'text-green-100' : 'text-gray-100'
                      }`}>
                        {day}
                      </div>
                      
                      {/* mmm embaixo */}
                      <div className={`text-xs ${
                        isActive ? 'text-purple-200' : hasMatch ? 'text-green-200' : 'text-gray-400'
                      }`}>
                        {month}
                      </div>
                      
                      {/* Badges de contagem */}
                      <div className="flex items-center gap-0.5 justify-center mt-1">
                        {/* Transações PIX (sempre presente) */}
                        <span className={`text-xs px-1 py-0.5 rounded ${
                          isActive ? 'bg-purple-600' : hasMatch ? 'bg-green-600' : 'bg-gray-600'
                        } text-white`}>
                          {group.pixTransactions.length}
                        </span>
                        
                        {/* Entradas da planilha (se houver) */}
                        {group.planilhaEntries.length > 0 && (
                          <span className="text-xs px-1 py-0.5 rounded bg-blue-600 text-blue-100">
                            {group.planilhaEntries.length}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Painel de Seleção Manual */}
          <div className={`rounded-lg p-3 border transition-all ${
            hasSelections 
              ? 'border-green-500 bg-green-900/20' 
              : 'border-gray-600 bg-gray-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-gray-400 text-sm">Seleção Manual:</span>
                <span className="font-medium text-gray-100">
                  PIX: R$ {formatCurrency(selectedTransactionTotal)}
                </span>
                <span className="text-gray-500">↔</span>
                <span className="font-medium text-gray-100">
                  Planilha: R$ {formatCurrency(selectedEntriesTotal)}
                </span>
                {hasSelections && (
                  <span className={`text-sm font-medium ${
                    Math.abs(difference) < 0.01 ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {Math.abs(difference) < 0.01 ? '✅ Match Perfeito' : `⚠️ Dif: R$ ${formatCurrency(Math.abs(difference))}`}
                  </span>
                )}
              </div>
              
              {hasSelections && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetSelections}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
                  >
                    🗑️ Limpar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-hidden">
          {dayGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🟣</div>
                <h3 className="text-xl font-semibold text-gray-100 mb-2">
                  Nenhum PIX Inter para Reconciliar
                </h3>
                <p className="text-gray-400">
                  Todas as transações PIX Inter já foram classificadas ou não há dados da planilha
                </p>
              </div>
            </div>
          ) : currentGroup ? (
            <div className="flex h-full">
              
              {/* COLUNA ESQUERDA: Transações PIX Inter */}
              <div className="w-1/2 border-r border-gray-700 flex flex-col">
                <div className="p-3 border-b border-gray-700 bg-gray-850">
                  <h4 className="font-medium text-gray-100 flex items-center gap-2">
                    💳 Transações PIX Inter ({currentGroup.pixTransactions.length})
                    <span className="text-sm text-gray-400">
                      R$ {formatCurrency(currentGroup.totalTransactionValue)}
                    </span>
                  </h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-2">
                    {currentGroup.pixTransactions
                      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
                      .map(transaction => (
                      <div
                        key={transaction.id}
                        className={`border rounded-lg p-3 transition-all cursor-pointer ${
                          selectedTransactions.has(transaction.id)
                            ? 'border-purple-500 bg-purple-900/20'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                        onClick={() => toggleTransactionSelection(transaction.id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(transaction.id)}
                            onChange={() => toggleTransactionSelection(transaction.id)}
                            className="w-4 h-4 rounded border-gray-500 bg-gray-700 mt-1"
                          />
                          
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-sm text-gray-200 font-medium">
                                {transaction.descricao_origem}
                              </span>
                              <span className="font-bold text-green-400 text-lg">
                                R$ {formatCurrency(Math.abs(transaction.valor))}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>🏦 {transaction.origem}</span>
                              <span>•</span>
                              <span>💳 {transaction.cc}</span>
                              <span>•</span>
                              <span>🆔 {transaction.id.slice(-8)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: Entradas da Planilha */}
              <div className="w-1/2 flex flex-col">
                <div className="p-3 border-b border-gray-700 bg-gray-850">
                  <h4 className="font-medium text-gray-100 flex items-center gap-2">
                    📋 Entradas da Planilha ({currentGroup.planilhaEntries.length})
                    <span className="text-sm text-gray-400">
                      R$ {formatCurrency(currentGroup.totalEntriesValue)}
                    </span>
                  </h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  {currentGroup.planilhaEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">🔭</div>
                      <p className="text-gray-400 text-sm">
                        Nenhuma entrada PIX na planilha para {currentGroup.displayDate}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentGroup.planilhaEntries
                        .sort((a, b) => b.valor_final - a.valor_final)
                        .map(entry => (
                        <div
                          key={entry.id}
                          className={`border rounded-lg p-3 transition-all cursor-pointer ${
                            selectedEntries.has(entry.id)
                              ? 'border-green-500 bg-green-900/20'
                              : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                          }`}
                          onClick={() => toggleEntrySelection(entry.id)}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedEntries.has(entry.id)}
                              onChange={() => toggleEntrySelection(entry.id)}
                              className="w-4 h-4 rounded border-gray-500 bg-gray-700 mt-1"
                            />
                            
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="text-sm text-gray-200 font-medium block">
                                    {entry.tipo}
                                  </span>
                                  <span className="text-xs text-blue-300">
                                    Contrato: {entry.id_contrato}
                                  </span>
                                </div>
                                <span className="font-bold text-green-400 text-lg">
                                  R$ {formatCurrency(entry.valor_final)}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>💳 {entry.metodo}</span>
                                <span>•</span>
                                <span>🏦 {entry.cc}</span>
                                <span>•</span>
                                <span>🔗 {entry.id_transacao}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer com Ações */}
        {currentGroup && (
          <div className="p-4 border-t border-gray-700 bg-gray-850">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Fechar
              </button>
              
              <div className="flex-1" />
              
              <button
                onClick={handleManualReconciliation}
                disabled={!hasSelections || isProcessing}
                className={`px-6 py-2 rounded transition-colors font-medium flex items-center gap-2 ${
                  hasSelections && !isProcessing
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : hasSelections ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Reconciliar Seleção Manual
                  </>
                ) : (
                  'Faça Seleções Manuais'
                )}
              </button>
            </div>
            
            {hasSelections && (
              <div className="mt-2 text-center">
                <p className="text-xs text-purple-300">
                  🎯 {selectedTransactions.size} transação(ões) e {selectedEntries.size} entrada(s) selecionadas
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}