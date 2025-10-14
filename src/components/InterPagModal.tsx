// components/InterPagModal.tsx - MODAL 100% MANUAL PARA INTER PAG

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Calendar, ArrowLeft, ArrowRight, CheckCircle2, RefreshCw, TrendingUp, RotateCcw } from 'lucide-react';
import { Transaction } from '@/types';
import { formatDateToLocal, formatDateForDisplay } from '@/lib/dateUtils';
import { supabase } from '@/lib/supabase';
import { SUBTIPO_IDS } from '@/lib/constants';

// Interfaces para agenda e percentuais (baseadas no usePlanilhaUploads.ts)
interface AgendaInter {
  id_transacao: string;
  data_hora: string;
  tipo: string;
  status: string;
  parcela: string;
  bandeira: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_antecipacao: number;
  valor_liquido: number;
  data_pagamento: string;
  uploaded_at: string;
  user_id: string;
}

interface PercentualContrato {
  id_transacao: string;
  id_contrato: string;
  percentual_catalogo: number; // 0-100
  percentual_planos: number;   // 0-100
  uploaded_at: string;
  user_id: string;
}

// Interface para entrada enriquecida (agenda + percentuais)
interface AgendaEnriquecida {
  agenda: AgendaInter;
  percentual?: PercentualContrato;
  previewQuebra: {
    catalogoValue: number;
    planosValue: number;
    catalogoDesc: string;
    planosDesc: string;
  };
}

interface DayGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  interPagTransactions: Transaction[];
  agendaEnriquecida: AgendaEnriquecida[];
  agendaNegativa: AgendaInter[]; // ⭐ Valores negativos separados
  totalTransactionValue: number;
  totalAgendaValue: number;
  totalNegativeValue: number; // ⭐ Total dos valores negativos
}

interface InterPagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // ✅ NOVO: Callback para quando operação é bem-sucedida
  complexTransactions?: Transaction[]; // Transactions complexas
  agendaEntries?: AgendaInter[]; // Entradas da agenda inter
  percentuaisEntries?: PercentualContrato[]; // Percentuais contrato
  onApplyReconciliation?: (reconciliationData: {
    originalTransactionIds: string[];
    selectedAgendaIds: string[];
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
    reconciliationNote: string;
    reconciliationMetadata: {
      type: 'inter_pag_n_to_m';
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

// Função para mapear classificações InterPag para subtipo_id
const mapInterPagToSubtipoId = (
  isDebito: boolean,
  isIndividual: boolean,
  isCatalogo: boolean
): { subtipo_id: string; categoria_nome: string } => {
  // Receita Nova (Débito) ou Receita Antiga (Crédito/Parcela)
  const isReceitaNova = isDebito;
  
  if (isReceitaNova) {
    // RECEITA NOVA
    if (isCatalogo && isIndividual) {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_NOVA_CATALOGO_INDIVIDUAL, categoria_nome: 'Receita Nova' };
    } else if (isCatalogo && !isIndividual) {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_NOVA_CATALOGO_COLETIVA, categoria_nome: 'Receita Nova' };
    } else if (!isCatalogo && isIndividual) {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_NOVA_PLANO_INDIVIDUAL, categoria_nome: 'Receita Nova' };
    } else {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_NOVA_PLANO_COLETIVA, categoria_nome: 'Receita Nova' };
    }
  } else {
    // RECEITA ANTIGA
    if (isCatalogo && isIndividual) {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_INDIVIDUAL, categoria_nome: 'Receita Antiga' };
    } else if (isCatalogo && !isIndividual) {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_COLETIVA, categoria_nome: 'Receita Antiga' };
    } else if (!isCatalogo && isIndividual) {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_INDIVIDUAL, categoria_nome: 'Receita Antiga' };
    } else {
      return { subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_COLETIVA, categoria_nome: 'Receita Antiga' };
    }
  }
};

export const InterPagModal: React.FC<InterPagModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  complexTransactions = [],
  agendaEntries = [],
  percentuaisEntries = [],
  onApplyReconciliation
}) => {
  // Estados principais
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedAgenda, setSelectedAgenda] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false); // Flag para controlar inicialização
  const [isRefreshing, setIsRefreshing] = useState(false); // Estado do refresh

  // Função para resetar seleções
  const resetSelections = useCallback(() => {
    setSelectedTransactions(new Set());
    setSelectedAgenda(new Set());
  }, []);

  // COPIAR DADOS PARA ESTADO INTERNO NA PRIMEIRA EXECUÇÃO
  useEffect(() => {
    if (!isOpen) {
      // Limpar tudo quando modal fecha
      setDayGroups([]);
      setCurrentDayIndex(0);
      setSelectedTransactions(new Set());
      setSelectedAgenda(new Set());
      setDataInitialized(false);
      return;
    }

    // INICIALIZAR APENAS UMA VEZ
    if (dataInitialized) {
      // 📌 Dados Inter Pag já inicializados
      return;
    }

    // 🆕 Primeira inicialização dos dados do modal Inter Pag
    
    // Fazer snapshot dos dados atuais
    const currentTransactions = [...complexTransactions];
    const currentAgendaEntries = [...agendaEntries];
    const currentPercentuaisEntries = [...percentuaisEntries];
    
    // 1. Filtrar apenas Inter Pag não classificadas
    const interPagTransactions = currentTransactions.filter(t => {
      const isInterPag = (
        t.origem === 'Inter' &&
        (t.descricao_origem?.toLowerCase().includes('inter pag') ||
         t.descricao_origem?.toLowerCase().includes('interpag'))
      );
      
      const COMPLEX_SUBTIPO_ID = 'e92f4f0f-4e94-4007-8945-a1fb47782051';
      const isComplexCategory = t.subtipo_id === COMPLEX_SUBTIPO_ID;
      const isNotReconciled = t.realizado !== 'r';
      
      return isInterPag && isComplexCategory && isNotReconciled;
    });

    // 2. Filtrar apenas agenda com status "Pago" E não utilizadas
    const agendaPaga = currentAgendaEntries.filter(entry => 
      entry.status?.toLowerCase() === 'pago' && 
      entry.bandeira !== 'Utilizado' // ⭐ Excluir já utilizadas
    );

    // 📊 Transações Inter Pag capturadas
    // 📋 Entradas da agenda "Pago" capturadas

    // 3. Agrupar por data
    const groups = new Map<string, DayGroup>();

    // Processar transações Inter Pag
    interPagTransactions.forEach(transaction => {
      const dateStr = formatDateToLocal(transaction.data);
      
      if (!dateStr || dateStr === 'Data inválida') {
        console.warn('⚠️ Transação com data inválida ignorada:', transaction.id);
        return;
      }
      
      if (!groups.has(dateStr)) {
        groups.set(dateStr, {
          date: dateStr,
          displayDate: formatDateForDisplay(dateStr),
          interPagTransactions: [],
          agendaEnriquecida: [],
          agendaNegativa: [], // ⭐ Inicializar array de valores negativos
          totalTransactionValue: 0,
          totalAgendaValue: 0,
          totalNegativeValue: 0 // ⭐ Inicializar total negativo
        });
      }
      
      const group = groups.get(dateStr)!;
      group.interPagTransactions.push(transaction);
      group.totalTransactionValue += Math.abs(transaction.valor);
    });

    // 4. Processar agenda e enriquecer com percentuais
    agendaPaga.forEach(agendaEntry => {
      const dateStr = formatDateToLocal(agendaEntry.data_pagamento);
      
      if (!dateStr || dateStr === 'Data inválida') {
        console.warn('⚠️ Agenda com data inválida ignorada:', agendaEntry.id_transacao);
        return;
      }
      
      // Só adicionar se houver transações para o dia
      if (groups.has(dateStr)) {
        const group = groups.get(dateStr)!;
        
        // ⭐ SEPARAR VALORES POSITIVOS E NEGATIVOS
        // Detectar custos operacionais pelo tipo (ex: "116 - DÉBITO REFERENTE A PAGAMENTO DE MÁQUINAS")
        const isCustoOperacional = agendaEntry.tipo?.includes('116') ||
                                    agendaEntry.tipo?.toLowerCase().includes('referente a pagamento') ||
                                    agendaEntry.tipo?.toLowerCase().includes('pagamento de máquina');

        if (agendaEntry.valor_liquido < 0 || isCustoOperacional) {
          // VALOR NEGATIVO OU CUSTO OPERACIONAL: Adicionar à agenda negativa
          group.agendaNegativa.push(agendaEntry);
          group.totalNegativeValue += Math.abs(agendaEntry.valor_liquido); // Valor absoluto para total

          console.log(`⚠️ Custo operacional detectado: R$ ${agendaEntry.valor_liquido} - Tipo: ${agendaEntry.tipo} - ID: ${agendaEntry.id_transacao}`);

        } else {
          // VALOR POSITIVO: Processar normalmente com quebra por percentuais
          
          // Buscar percentual correspondente
          const percentualMatch = currentPercentuaisEntries.find(p =>
            p.id_transacao === agendaEntry.id_transacao
          );

          // ⭐ DETECTAR SE É DÉBITO OU CRÉDITO (PARCELA) - PRECISA VIR ANTES
          const isDebito = agendaEntry.tipo?.toLowerCase().includes('débito') ||
                          agendaEntry.tipo?.toLowerCase().includes('debito') ||
                          agendaEntry.tipo?.toLowerCase() === 'débito';

          // Calcular preview da quebra
          const catalogoPercent = percentualMatch?.percentual_catalogo || 0;
          const planosPercent = percentualMatch?.percentual_planos || 0;

          console.log(`🔍 DEBUG DÉBITO - ID: ${agendaEntry.id_transacao}`, {
            tipo: agendaEntry.tipo,
            isDebito,
            valor_liquido: agendaEntry.valor_liquido,
            catalogoPercent,
            planosPercent,
            percentualMatch: percentualMatch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'
          });

          const catalogoValue = Math.round((agendaEntry.valor_liquido * catalogoPercent / 100) * 100) / 100;
          const planosValue = Math.round((agendaEntry.valor_liquido * planosPercent / 100) * 100) / 100;

          console.log(`🔍 DEBUG CÁLCULO - ID: ${agendaEntry.id_transacao}`, {
            catalogoValue,
            planosValue,
            soma: catalogoValue + planosValue,
            esperado: agendaEntry.valor_liquido,
            diferenca: (catalogoValue + planosValue) - agendaEntry.valor_liquido
          });
          
          // Determinar tipo (Individual/Coletivo) baseado no contrato
          const contrato = percentualMatch?.id_contrato || '';
          const isIndividual = contrato.includes('IND');
          const isColetivo = contrato.includes('COL');
          const tipoSuffix = isIndividual ? 'IND.' : isColetivo ? 'COL.' : 'IND.';

          // isDebito já foi detectado nas linhas 265-267
          const receitaTipo = isDebito ? 'N.' : 'A.'; // Nova ou Antiga
          const parcelaDesc = isDebito ? '' : ` - Parcela ${agendaEntry.parcela}`;
          
          const agendaEnriquecida: AgendaEnriquecida = {
            agenda: agendaEntry,
            percentual: percentualMatch,
            previewQuebra: {
              catalogoValue,
              planosValue,
              catalogoDesc: `REC. ${receitaTipo} C. ${tipoSuffix} - ${contrato}${parcelaDesc}`,
              planosDesc: `REC. ${receitaTipo} P. ${tipoSuffix} - ${contrato}${parcelaDesc}`
            }
          };
          
          group.agendaEnriquecida.push(agendaEnriquecida);
          group.totalAgendaValue += agendaEntry.valor_liquido;
        }
      }
    });

    // 5. Converter para array e ordenar cronologicamente
    const sortedGroups = Array.from(groups.values())
      .filter(group => group.interPagTransactions.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Definir dados e marcar como inicializado
    setDayGroups(sortedGroups);
    setCurrentDayIndex(0);
    
    // PRÉ-SELECIONAR TUDO AUTOMATICAMENTE
    if (sortedGroups.length > 0) {
      const firstGroup = sortedGroups[0];
      
      // Pré-selecionar todas as transações do primeiro dia
      const allTransactionIds = new Set(firstGroup.interPagTransactions.map(t => t.id));
      
      // Pré-selecionar todas as agendas do primeiro dia
      const allAgendaIds = new Set(firstGroup.agendaEnriquecida.map(a => a.agenda.id_transacao));
      
      setSelectedTransactions(allTransactionIds);
      setSelectedAgenda(allAgendaIds);
      
      // ✅ Pré-selecionadas automáticas
    } else {
      setSelectedTransactions(new Set());
      setSelectedAgenda(new Set());
    }
    
    setDataInitialized(true); // MARCAR COMO INICIALIZADO

    // ✅ Dias organizados para Inter Pag
  }, [isOpen, dataInitialized]); // Remover arrays das dependências para evitar loop infinito

  // Funções auxiliares
  const getCurrentGroup = useCallback((): DayGroup | null => {
    return dayGroups[currentDayIndex] || null;
  }, [dayGroups, currentDayIndex]);

  // FUNÇÃO PARA REFRESH MANUAL DOS DADOS
  const handleRefreshData = useCallback(async () => {
    if (isRefreshing) return; // Evitar múltiplos refreshes simultâneos
    
    setIsRefreshing(true);
    // 🔄 Iniciando refresh manual
    
    try {
      // Forçar reinicialização dos dados
      setDataInitialized(false);
      setDayGroups([]);
      
      // Pequeno delay para UI feedback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 🔄 Forçando reprocessamento
      
    } catch (error) {
      console.error('⌀ Erro no refresh manual:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // DETECTAR QUANDO PRECISA REPROCESSAR
  useEffect(() => {
    if (!isOpen || dataInitialized) return;
    
    // Aguardar um pouco se está refreshing para evitar conflito
    if (isRefreshing) {
      const timer = setTimeout(() => {
        // Reprocessar após refresh
        if (!dataInitialized) {
          // 🔄 Reprocessando após refresh
          // O useEffect principal vai rodar automaticamente
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, dataInitialized, isRefreshing]);

  // FUNÇÃO PARA PRÉ-SELECIONAR TUDO DO DIA ATUAL
  const selectAllCurrentDay = useCallback(() => {
    const currentGroup = getCurrentGroup();
    if (!currentGroup) return;
    
    const allTransactionIds = new Set(currentGroup.interPagTransactions.map(t => t.id));
    const allAgendaIds = new Set(currentGroup.agendaEnriquecida.map(a => a.agenda.id_transacao));
    
    setSelectedTransactions(allTransactionIds);
    setSelectedAgenda(allAgendaIds);
    
    console.log(`✅ Selecionadas todas: ${allTransactionIds.size} transações + ${allAgendaIds.size} agendas do dia ${currentGroup.displayDate}`);
  }, [getCurrentGroup]);

  const goToPreviousDay = useCallback(() => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
      resetSelections();
      // PRÉ-SELECIONAR TUDO DO NOVO DIA
      setTimeout(() => selectAllCurrentDay(), 50); // Pequeno delay para o state atualizar
    }
  }, [currentDayIndex, resetSelections, selectAllCurrentDay]);

  const goToNextDay = useCallback(() => {
    if (currentDayIndex < dayGroups.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
      resetSelections();
      // PRÉ-SELECIONAR TUDO DO NOVO DIA
      setTimeout(() => selectAllCurrentDay(), 50); // Pequeno delay para o state atualizar
    }
  }, [currentDayIndex, dayGroups.length, resetSelections, selectAllCurrentDay]);

  // Toggle seleções - MEMOIZADAS PARA EVITAR RE-RENDERS
  const toggleTransactionSelection = useCallback((transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(transactionId)) {
        newSelected.delete(transactionId);
      } else {
        newSelected.add(transactionId);
      }
      return newSelected;
    });
  }, []);

  const toggleAgendaSelection = useCallback((agendaId: string) => {
    setSelectedAgenda(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(agendaId)) {
        newSelected.delete(agendaId);
      } else {
        newSelected.add(agendaId);
      }
      return newSelected;
    });
  }, []);

  // Calcular totais selecionados
  const currentGroup = getCurrentGroup();
  const selectedTransactionTotal = useMemo(() => {
    if (!currentGroup) return 0;
    return currentGroup.interPagTransactions
      .filter(t => selectedTransactions.has(t.id))
      .reduce((sum: number, t: Transaction) => sum + Math.abs(t.valor), 0);
  }, [currentGroup, selectedTransactions]);

  const selectedAgendaList = useMemo(() => {
    if (!currentGroup) return [];
    return currentGroup.agendaEnriquecida.filter(a => selectedAgenda.has(a.agenda.id_transacao));
  }, [currentGroup, selectedAgenda]);

  const selectedAgendaTotal = useMemo(() => {
    return selectedAgendaList.reduce((sum: number, a: AgendaEnriquecida) => sum + a.agenda.valor_liquido, 0);
  }, [selectedAgendaList]);

  const selectedNewTransactionsTotal = useMemo(() => {
    // Somar receitas dos lançamentos positivos
    const receitasTotal = selectedAgendaList.reduce((sum: number, a: AgendaEnriquecida) => sum + a.previewQuebra.catalogoValue + a.previewQuebra.planosValue, 0);

    // ⭐ SOMAR CUSTOS DOS LANÇAMENTOS NEGATIVOS apenas quando TODAS as transações E TODAS as agendas do dia forem selecionadas
    const allTransactionsSelected = currentGroup && selectedTransactions.size === currentGroup.interPagTransactions.length;
    const allAgendasSelected = currentGroup && selectedAgenda.size === currentGroup.agendaEnriquecida.length;
    const shouldIncludeNegatives = allTransactionsSelected && allAgendasSelected;

    const custosTotal = shouldIncludeNegatives && currentGroup ? currentGroup.totalNegativeValue : 0;

    return receitasTotal - custosTotal; // Receitas - Custos = Total líquido
  }, [selectedAgendaList, selectedTransactions, selectedAgenda, currentGroup]);

  const hasSelections = selectedTransactions.size > 0 && selectedAgenda.size > 0;
  const difference = selectedTransactionTotal - selectedNewTransactionsTotal;
  const hasMatch = Math.abs(difference) < 0.01; // Match perfeito (diferença menor que 1 centavo)

  // Executar reconciliação manual Inter Pag
  const handleInterPagReconciliation = async () => {
    if (!currentGroup || !hasSelections) {
      alert('⚠️ Selecione pelo menos uma transação e uma entrada da agenda');
      return;
    }

    const selectedTransactionsList = currentGroup.interPagTransactions.filter(t => selectedTransactions.has(t.id));

    // ⭐ MENSAGEM LIMPA E MOBILE-FRIENDLY
    const totalReceitas = selectedAgendaList.length * 2;
    const totalCustos = currentGroup.agendaNegativa.length;
    const totalLancamentos = totalReceitas + totalCustos;
    
    const confirmText = 
      `🟠 Reconciliação InterPag\n` +
      `📅 ${currentGroup.displayDate}\n\n` +
      `📊 PROCESSAMENTO:\n` +
      `• ${selectedTransactionsList.length} transações → reconciliadas\n` +
      `• ${totalLancamentos} novos lançamentos:\n` +
      `  - ${totalReceitas} receitas (quebra %)\n` +
      `${totalCustos > 0 ? `  - ${totalCustos} custos operacionais\n` : ''}` +
      `\n💰 VALORES:\n` +
      `• Origem: R$ ${selectedTransactionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `• Destino: R$ ${selectedNewTransactionsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `• Match: ${Math.abs(difference) < 0.01 ? '✅ Perfeito' : `⚠️ Dif: R$ ${Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}\n\n` +
      `Confirma a reconciliação?`;

    if (!window.confirm(confirmText)) return;

    setIsProcessing(true);

    try {
      // Gerar novos lançamentos baseados na quebra por percentuais
      const newTransactions: any[] = [];
      
      selectedAgendaList.forEach((agendaEnriquecida, index) => {
        const baseTransaction = selectedTransactionsList[0]; // Para herdar dados básicos
        const agenda = agendaEnriquecida.agenda;
        const preview = agendaEnriquecida.previewQuebra;
        
        // ⭐ DETECTAR TIPO E MODALIDADE PARA MAPEAMENTO
        const isDebito = agenda.tipo?.toLowerCase().includes('débito') || 
                        agenda.tipo?.toLowerCase().includes('debito') ||
                        agenda.tipo?.toLowerCase() === 'débito';
        
        const contrato = agendaEnriquecida.percentual?.id_contrato || '';
        const isIndividual = contrato.includes('IND');
        
        // ID base único
        const baseId = `INTERPAG_${agenda.id_transacao}_${Date.now()}_${index}`;
        
        // 1. Lançamento CATÁLOGO
        if (preview.catalogoValue > 0) {
          const catalogoMapping = mapInterPagToSubtipoId(isDebito, isIndividual, true);
          
          newTransactions.push({
            id: `${baseId}_CAT`,
            valor: preview.catalogoValue,
            subtipo_id: catalogoMapping.subtipo_id, // ✅ Nova hierarquia
            descricao: preview.catalogoDesc,
            data: baseTransaction.data,
            origem: baseTransaction.origem,
            cc: baseTransaction.cc,
            mes: baseTransaction.mes,
            descricao_origem: `${baseTransaction.descricao_origem} [CATÁLOGO]`,
            realizado: 's' as const,
            linked_future_group: `INTERPAG_RECONCILIATION_${currentGroup.date}`,
            is_from_reconciliation: true,
            reconciliation_metadata: JSON.stringify({
              reconciliation_type: 'inter_pag_n_to_m',
              reconciliation_date: new Date().toISOString(),
              original_transaction_ids: selectedTransactionsList.map(t => t.id),
              agenda_entry_id: agenda.id_transacao,
              agenda_entry_data: {
                id_transacao: agenda.id_transacao,
                parcela: agenda.parcela,
                valor_liquido: agenda.valor_liquido,
                data_pagamento: agenda.data_pagamento
              },
              percentual_data: agendaEnriquecida.percentual,
              split_type: 'catalogo',
              split_percentage: agendaEnriquecida.percentual?.percentual_catalogo || 0
            })
          });
        }
        
        // 2. Lançamento PLANOS
        if (preview.planosValue > 0) {
          const planosMapping = mapInterPagToSubtipoId(isDebito, isIndividual, false);
          
          newTransactions.push({
            id: `${baseId}_PLAN`,
            valor: preview.planosValue,
            subtipo_id: planosMapping.subtipo_id, // ✅ Nova hierarquia
            descricao: preview.planosDesc,
            data: baseTransaction.data,
            origem: baseTransaction.origem,
            cc: baseTransaction.cc,
            mes: baseTransaction.mes,
            descricao_origem: `${baseTransaction.descricao_origem} [PLANOS]`,
            realizado: 's' as const,
            linked_future_group: `INTERPAG_RECONCILIATION_${currentGroup.date}`,
            is_from_reconciliation: true,
            reconciliation_metadata: JSON.stringify({
              reconciliation_type: 'inter_pag_n_to_m',
              reconciliation_date: new Date().toISOString(),
              original_transaction_ids: selectedTransactionsList.map(t => t.id),
              agenda_entry_id: agenda.id_transacao,
              agenda_entry_data: {
                id_transacao: agenda.id_transacao,
                parcela: agenda.parcela,
                valor_liquido: agenda.valor_liquido,
                data_pagamento: agenda.data_pagamento
              },
              percentual_data: agendaEnriquecida.percentual,
              split_type: 'planos',
              split_percentage: agendaEnriquecida.percentual?.percentual_planos || 0
            })
          });
        }
      });

      // ⭐ PROCESSAR VALORES NEGATIVOS COMO CUSTOS OPERACIONAIS
      if (currentGroup.agendaNegativa.length > 0) {
        console.log(`🏷️ Processando ${currentGroup.agendaNegativa.length} valores negativos como custos operacionais...`);
        
        currentGroup.agendaNegativa.forEach((agendaNegativa, negIndex) => {
          const baseTransaction = selectedTransactionsList[0];
          const valorAbsoluto = Math.abs(agendaNegativa.valor_liquido);
          
          newTransactions.push({
            id: `INTERPAG_NEG_${agendaNegativa.id_transacao}_${Date.now()}_${negIndex}`,
            valor: -valorAbsoluto, // Manter como negativo (é um custo)
            subtipo_id: SUBTIPO_IDS.OUTROS_ABSORVIDOS, // ✅ Custos Operacionais
            descricao: `Custo Inter Pag - ${agendaNegativa.tipo || 'Maquininha'} - ${agendaNegativa.id_transacao}`,
            data: baseTransaction.data,
            origem: baseTransaction.origem,
            cc: baseTransaction.cc,
            mes: baseTransaction.mes,
            descricao_origem: `${baseTransaction.descricao_origem} [CUSTO OPERACIONAL]`,
            realizado: 's' as const,
            linked_future_group: `INTERPAG_RECONCILIATION_${currentGroup.date}`,
            is_from_reconciliation: true,
            reconciliation_metadata: JSON.stringify({
              reconciliation_type: 'inter_pag_negative_cost',
              reconciliation_date: new Date().toISOString(),
              original_transaction_ids: selectedTransactionsList.map(t => t.id),
              agenda_entry_id: agendaNegativa.id_transacao,
              agenda_entry_data: {
                id_transacao: agendaNegativa.id_transacao,
                valor_liquido: agendaNegativa.valor_liquido,
                data_pagamento: agendaNegativa.data_pagamento,
                tipo: agendaNegativa.tipo
              },
              cost_type: 'operational_inter_pag'
            })
          });
        });
      }

      const reconciliationData = {
        originalTransactionIds: selectedTransactionsList.map(t => t.id),
        selectedAgendaIds: selectedAgendaList.map(a => a.agenda.id_transacao),
        newTransactions,
        reconciliationNote: `Inter Pag N→M: ${selectedTransactionsList.length} trans → ${newTransactions.length} lançamentos | Contratos: ${selectedAgendaList.map(a => a.percentual?.id_contrato || 'N/A').join(', ')} | ${currentGroup.displayDate}`,
        reconciliationMetadata: {
          type: 'inter_pag_n_to_m' as const,
          source_count: selectedTransactionsList.length,
          destination_count: newTransactions.length,
          date: currentGroup.date,
          contracts: selectedAgendaList.map(a => a.percentual?.id_contrato || 'N/A'),
          total_original_value: selectedTransactionTotal,
          total_new_value: selectedNewTransactionsTotal,
          difference: difference
        }
      };

      if (onApplyReconciliation) {
        await onApplyReconciliation(reconciliationData);
      }

      // ⭐ MARCAR ENTRADAS DA AGENDA COMO UTILIZADAS (POSITIVAS E NEGATIVAS)
      try {
        console.log('🏷️ Marcando entradas da agenda como utilizadas...');
        
        // IDs das agendas positivas (selecionadas)
        const agendaIds = selectedAgendaList.map(a => a.agenda.id_transacao);
        
        // IDs das agendas negativas (processadas automaticamente)
        const agendaNegativaIds = currentGroup.agendaNegativa.map(a => a.id_transacao);
        
        // Combinar todos os IDs
        const allAgendaIds = [...agendaIds, ...agendaNegativaIds];
        
        if (allAgendaIds.length > 0) {
          const { error: updateError } = await supabase
            .from('agenda_inter')
            .update({ bandeira: 'Utilizado' })
            .in('id_transacao', allAgendaIds);
          
          if (updateError) {
            console.error('⚠️ Erro ao marcar agenda como utilizada:', updateError);
          } else {
            console.log(`✅ ${agendaIds.length} positivas + ${agendaNegativaIds.length} negativas = ${allAgendaIds.length} entradas marcadas como utilizadas`);
          }
        }
      } catch (markError) {
        console.error('⚠️ Erro ao marcar entradas como utilizadas:', markError);
      }

      // ⭐ MENSAGEM DE SUCESSO LIMPA E MOBILE-FRIENDLY
      const totalEntradas = selectedAgendaList.length + currentGroup.agendaNegativa.length;
      
      alert(
        `✅ InterPag Reconciliado!\n\n` +
        `📊 CRIADO:\n` +
        `• ${newTransactions.length} novos lançamentos\n` +
        `• ${totalEntradas} entradas processadas\n` +
        `${currentGroup.agendaNegativa.length > 0 ? `• ${currentGroup.agendaNegativa.length} custos automáticos\n` : ''}` +
        `\n💰 SALDO IMPACTO:\n` +
        `• Originais: ${selectedTransactionsList.length} não contam mais\n` +
        `• Novos: R$ ${selectedNewTransactionsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no saldo\n` +
        `\n🎯 Reconciliação completa!`
      );

      resetSelections();
      
      // ⭐ REFRESH DUPLO AUTOMÁTICO PARA LIMPAR CACHE
      setTimeout(async () => {
        // 🔄 Refresh automático #1
        await handleRefreshData();
        
        // Segundo refresh após pequeno delay
        setTimeout(async () => {
          // 🔄 Refresh automático #2
          await handleRefreshData();
        }, 500);
      }, 1000);

    } catch (error) {
      console.error('⌀ Erro na reconciliação Inter Pag N→M:', error);
      alert('⌀ Erro ao executar reconciliação Inter Pag N→M');
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1 sm:p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full h-[95vh] sm:h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-2 sm:p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h3 className="text-sm sm:text-xl font-semibold text-gray-100">
              🟠 InterPag - % Quebra
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              <X className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* CALENDÁRIO LINEAR COMPACTO */}
          {dayGroups.length > 0 && (
            <div className="bg-orange-900/30 border border-orange-600 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3">
              <div className="text-orange-100 text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center justify-between">
                <span>📅 Cal ({dayGroups.length}d)</span>
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* BOTÃO DE REFRESH */}
                  <button
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                      isRefreshing 
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                    title="Recarregar dados"
                  >
                    <RotateCcw className={`w-2 h-2 sm:w-3 sm:h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isRefreshing ? 'Atualizando...' : 'Refresh'}</span>
                  </button>
                  
                  {/* NAVEGAÇÃO EXISTENTE */}
                  <button
                    onClick={goToPreviousDay}
                    disabled={currentDayIndex === 0}
                    className="px-1 sm:px-2 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded text-xs transition-colors"
                  >
                    ←
                  </button>
                  <button
                    onClick={goToNextDay}
                    disabled={currentDayIndex === dayGroups.length - 1}
                    className="px-1 sm:px-2 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded text-xs transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
              
              <div className="flex gap-1 overflow-x-auto pb-2">
                {dayGroups.map((group, index) => {
                  const isActive = index === currentDayIndex;
                  const hasMatch = group.agendaEnriquecida.length > 0;
                  
                  const parts = group.displayDate.split('/');
                  const day = parts[0];
                  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                  const month = monthNames[parseInt(parts[1]) - 1];
                  
                  return (
                    <button
                      key={group.date}
                      onClick={() => {
                        setCurrentDayIndex(index);
                        resetSelections();
                      }}
                      className={`flex-shrink-0 p-1 sm:p-2 rounded border transition-all text-center min-w-[35px] sm:min-w-[50px] ${
                        isActive 
                          ? 'border-orange-400 bg-orange-700' 
                          : hasMatch
                            ? 'border-green-600 bg-green-900/30 hover:bg-green-800/50'
                            : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <div className={`text-sm sm:text-lg font-bold ${
                        isActive ? 'text-orange-100' : hasMatch ? 'text-green-100' : 'text-gray-100'
                      }`}>
                        {day}
                      </div>
                      <div className={`text-xs ${
                        isActive ? 'text-orange-200' : hasMatch ? 'text-green-200' : 'text-gray-400'
                      }`}>
                        {month}
                      </div>
                      <div className="flex items-center gap-0.5 justify-center mt-0.5 sm:mt-1">
                        <span className={`text-xs px-0.5 sm:px-1 py-0.5 rounded ${
                          isActive ? 'bg-orange-600' : hasMatch ? 'bg-green-600' : 'bg-gray-600'
                        } text-white`}>
                          {group.interPagTransactions.length}
                        </span>
                        {group.agendaEnriquecida.length > 0 && (
                          <span className="text-xs px-0.5 sm:px-1 py-0.5 rounded bg-blue-600 text-blue-100">
                            {group.agendaEnriquecida.length}
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
          <div className={`rounded-lg p-2 sm:p-3 border transition-all ${
            hasSelections 
              ? 'border-green-500 bg-green-900/20' 
              : 'border-gray-600 bg-gray-800'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs sm:text-sm">
                <span className="font-medium text-gray-100">
                  Inter: R$ {formatCurrency(selectedTransactionTotal)}
                </span>
                <span className="font-medium text-gray-100">
                  Quebra: R$ {formatCurrency(selectedNewTransactionsTotal)}
                </span>
                {hasSelections && (
                  <span className={`text-xs sm:text-sm font-medium ${
                    Math.abs(difference) < 0.01 ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {Math.abs(difference) < 0.01 ? '✅ Match' : `⚠️ Dif: R$ ${formatCurrency(Math.abs(difference))}`}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button
                  onClick={selectAllCurrentDay}
                  className="px-2 sm:px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs sm:text-sm transition-colors"
                >
                  <span className="sm:hidden">✅</span>
                  <span className="hidden sm:inline">✅ Selecionar Tudo</span>
                </button>
                {hasSelections && (
                  <button
                    onClick={resetSelections}
                    className="px-2 sm:px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs sm:text-sm transition-colors"
                  >
                    <span className="sm:hidden">🗑️</span>
                    <span className="hidden sm:inline">🗑️ Limpar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-hidden">
          {dayGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">🟠</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-100 mb-1 sm:mb-2">
                  Nenhum Inter Pag para Reconciliar
                </h3>
                <p className="text-sm sm:text-base text-gray-400">
                  Todas as transações já foram classificadas ou não há dados da agenda
                </p>
              </div>
            </div>
          ) : currentGroup ? (
            <div className="flex flex-col sm:flex-row h-full">
              
              {/* COLUNA ESQUERDA: Transações Inter Pag */}
              <div className="w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r border-gray-700 flex flex-col">
                <div className="p-1.5 sm:p-3 border-b border-gray-700 bg-gray-850">
                  <h4 className="text-xs sm:text-sm font-medium text-gray-100 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span>🟠 Transações InterPag ({currentGroup.interPagTransactions.length})</span>
                    <span className="text-xs text-gray-400">
                      R$ {formatCurrency(currentGroup.totalTransactionValue)}
                    </span>
                  </h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1 sm:p-2 max-h-64 sm:max-h-none">
                  <div className="space-y-2">
                    {currentGroup.interPagTransactions
                      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
                      .map(transaction => (
                      <div
                        key={transaction.id}
                        className={`border rounded p-1.5 sm:p-3 transition-all cursor-pointer ${
                          selectedTransactions.has(transaction.id)
                            ? 'border-orange-500 bg-orange-900/20'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                        onClick={() => toggleTransactionSelection(transaction.id)}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(transaction.id)}
                            onChange={() => toggleTransactionSelection(transaction.id)}
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-500 bg-gray-700 mt-0.5 sm:mt-1 flex-shrink-0"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1 sm:mb-2">
                              <span className="text-xs sm:text-sm text-gray-200 font-medium truncate mr-2">
                                {transaction.descricao_origem}
                              </span>
                              <span className="font-bold text-green-400 text-sm sm:text-lg flex-shrink-0">
                                R$ {formatCurrency(Math.abs(transaction.valor))}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs text-gray-400 overflow-hidden">
                              <span className="truncate">{transaction.origem}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="hidden sm:inline">{transaction.cc}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="hidden sm:inline">{transaction.id.slice(-8)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: Agenda Enriquecida */}
              <div className="w-full sm:w-1/2 flex flex-col">
                <div className="p-1.5 sm:p-3 border-b border-gray-700 bg-gray-850">
                  <h4 className="text-xs sm:text-sm font-medium text-gray-100 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span>📋 Agenda + % ({currentGroup.agendaEnriquecida.length})</span>
                    <span className="text-xs text-gray-400">
                      R$ {formatCurrency(currentGroup.totalAgendaValue)}
                    </span>
                    {/* ⭐ ALERTA DISCRETO PARA VALORES NEGATIVOS */}
                    {currentGroup.agendaNegativa.length > 0 && (
                      <span className="text-xs bg-red-900/30 text-red-300 px-1 sm:px-2 py-0.5 rounded border border-red-700/50">
                        <span className="hidden sm:inline">⚠️ {currentGroup.agendaNegativa.length} custos: R$ {formatCurrency(currentGroup.totalNegativeValue)}</span>
                        <span className="sm:hidden">⚠️ -{formatCurrency(currentGroup.totalNegativeValue)}</span>
                      </span>
                    )}
                  </h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1 sm:p-2 max-h-64 sm:max-h-none">
                  {currentGroup.agendaEnriquecida.length === 0 ? (
                    <div className="text-center py-4 sm:py-8">
                      <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">🔭</div>
                      <p className="text-gray-400 text-xs sm:text-sm">
                        Sem agenda para {currentGroup.displayDate.split('/').slice(0, 2).join('/')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentGroup.agendaEnriquecida
                        .sort((a, b) => b.agenda.valor_liquido - a.agenda.valor_liquido)
                        .map(agendaEnriquecida => (
                        <div
                          key={agendaEnriquecida.agenda.id_transacao}
                          className={`border rounded p-1.5 sm:p-3 transition-all cursor-pointer ${
                            selectedAgenda.has(agendaEnriquecida.agenda.id_transacao)
                              ? 'border-green-500 bg-green-900/20'
                              : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                          }`}
                          onClick={() => toggleAgendaSelection(agendaEnriquecida.agenda.id_transacao)}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <input
                              type="checkbox"
                              checked={selectedAgenda.has(agendaEnriquecida.agenda.id_transacao)}
                              onChange={() => toggleAgendaSelection(agendaEnriquecida.agenda.id_transacao)}
                              className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-500 bg-gray-700 mt-0.5 sm:mt-1 flex-shrink-0"
                            />
                            
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1 sm:mb-2">
                                <div className="min-w-0 flex-1 mr-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="text-xs sm:text-sm text-gray-200 font-medium truncate">
                                      {agendaEnriquecida.agenda.tipo}
                                    </span>
                                    <span className="text-xs bg-orange-700 text-orange-200 px-1 sm:px-2 py-0.5 sm:py-1 rounded w-fit">
                                      P{agendaEnriquecida.agenda.parcela}
                                    </span>
                                  </div>
                                  {agendaEnriquecida.percentual && (
                                    <span className="text-xs text-blue-300 truncate block">
                                      {agendaEnriquecida.percentual.id_contrato}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-green-400 text-sm sm:text-lg flex-shrink-0">
                                  R$ {formatCurrency(agendaEnriquecida.agenda.valor_liquido)}
                                </span>
                              </div>
                              
                              {/* Preview da Quebra */}
                              {agendaEnriquecida.percentual && (
                                <div className="mt-1 sm:mt-2 bg-gray-700 rounded p-1.5 sm:p-2">
                                  <div className="text-xs text-gray-300 mb-1">
                                    <span className="hidden sm:inline">📊 Preview da Quebra:</span>
                                    <span className="sm:hidden">📊 Quebra:</span>
                                  </div>
                                  <div className="space-y-0.5 sm:space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-blue-300 truncate">
                                        <span className="hidden sm:inline">Catálogo ({agendaEnriquecida.percentual.percentual_catalogo}%)</span>
                                        <span className="sm:hidden">Cat ({agendaEnriquecida.percentual.percentual_catalogo}%)</span>
                                      </span>
                                      <span className="text-green-400 font-medium text-xs flex-shrink-0 ml-2">
                                        R$ {formatCurrency(agendaEnriquecida.previewQuebra.catalogoValue)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-purple-300 truncate">
                                        <span className="hidden sm:inline">Planos ({agendaEnriquecida.percentual.percentual_planos}%)</span>
                                        <span className="sm:hidden">Plan ({agendaEnriquecida.percentual.percentual_planos}%)</span>
                                      </span>
                                      <span className="text-green-400 font-medium text-xs flex-shrink-0 ml-2">
                                        R$ {formatCurrency(agendaEnriquecida.previewQuebra.planosValue)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 sm:mt-2 overflow-hidden">
                                <span className="truncate">🔗 {agendaEnriquecida.agenda.id_transacao.slice(-8)}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className="hidden sm:inline">💳 {agendaEnriquecida.agenda.bandeira}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* ⭐ LANÇAMENTOS NEGATIVOS (custos operacionais) */}
                      {currentGroup.agendaNegativa.map(agendaNegativa => (
                        <div
                          key={agendaNegativa.id_transacao}
                          className="border rounded p-1.5 sm:p-3 border-red-600 bg-red-900/10"
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border-red-500 bg-red-900/50 mt-0.5 sm:mt-1 flex-shrink-0 flex items-center justify-center">
                              <span className="text-red-400 text-xs">💸</span>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1 sm:mb-2">
                                <div className="min-w-0 flex-1 mr-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="text-xs sm:text-sm text-red-200 font-medium truncate">
                                      {agendaNegativa.tipo} - Custo Operacional
                                    </span>
                                    <span className="text-xs bg-red-700 text-red-200 px-1 sm:px-2 py-0.5 sm:py-1 rounded w-fit">
                                      AUTO
                                    </span>
                                  </div>
                                  <span className="text-xs text-red-300 truncate block">
                                    OUTROS ABSORVIDOS
                                  </span>
                                </div>
                                <span className="font-bold text-red-400 text-sm sm:text-lg flex-shrink-0">
                                  R$ {formatCurrency(Math.abs(agendaNegativa.valor_liquido))}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1 text-xs text-red-400 mt-1 sm:mt-2 overflow-hidden">
                                <span className="truncate">🏷️ {agendaNegativa.id_transacao.slice(-8)}</span>
                                <span className="hidden sm:inline">• Processado automaticamente</span>
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
          <div className="p-2 sm:p-4 border-t border-gray-700 bg-gray-850">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={onClose}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors order-2 sm:order-1"
              >
                Fechar
              </button>
              
              <div className="flex-1 hidden sm:block" />
              
              <button
                onClick={handleInterPagReconciliation}
                disabled={!hasSelections || isProcessing || !hasMatch}
                className={`px-4 py-2 rounded transition-colors font-medium flex items-center justify-center gap-1 sm:gap-2 text-sm order-1 sm:order-2 ${
                  hasSelections && !isProcessing && hasMatch
                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : hasSelections && hasMatch ? (
                  <>
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Quebrar por Percentuais</span>
                    <span className="sm:hidden">Quebrar por %</span>
                  </>
                ) : hasSelections && !hasMatch ? (
                  <span className="text-center">
                    <span className="hidden sm:inline">⚠️ Valores não batem</span>
                    <span className="sm:hidden">⚠️ Sem match</span>
                  </span>
                ) : (
                  <span className="text-center">
                    <span className="hidden sm:inline">Faça Seleções Manuais</span>
                    <span className="sm:hidden">Faça Seleções</span>
                  </span>
                )}
              </button>
            </div>
            
            {hasSelections && (
              <div className="mt-2 text-center">
                <p className="text-xs text-orange-300">
                  <span className="hidden sm:inline">🎯 {selectedTransactions.size} transação(ões) e {selectedAgenda.size} entrada(s) selecionadas → {selectedAgendaList.length * 2} novos lançamentos</span>
                  <span className="sm:hidden">🎯 {selectedTransactions.size}T + {selectedAgenda.size}A → {selectedAgendaList.length * 2} novos</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};