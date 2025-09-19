// components/OverviewTab.tsx - VERSÃO COM PERÍODOS AGRUPADOS

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, TrendingUp, BarChart3, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { Transaction, countsInBalance } from '@/types';
import { useConfig } from '@/contexts/ConfigContext';
import { useHierarchy } from '@/hooks/useHierarchy';
import { CategorySection } from './CategorySection';
import { SummaryBox } from './SummaryBox';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getQuickActionCategories } from '@/lib/smartClassification';

// Function to get bank-specific colors for badges
const getBankColor = (bankName: string): string => {
  const colorMap: { [key: string]: string } = {
    'Inter': 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    'BB': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    'Nubank': 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    'Stone': 'bg-green-500/20 text-green-300 border border-green-500/30',
    'Santander': 'bg-red-600/20 text-red-300 border border-red-600/30',
    'Sicoob': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    'VISA': 'bg-blue-600/20 text-blue-300 border border-blue-600/30',
    'MasterCard': 'bg-red-500/20 text-red-300 border border-red-500/30',
    'Dinheiro': 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
    'Investimento Inter': 'bg-orange-600/20 text-orange-300 border border-orange-600/30',
    'Investimento Keka': 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
    // 🎨 Novos investimentos
    'Inv. CC Keka': 'bg-violet-600/20 text-violet-300 border border-violet-600/30',
    'Inv. CC Luli': 'bg-blue-400/20 text-blue-300 border border-blue-400/30',
    'Inv. PJ': 'bg-orange-700/20 text-orange-400 border border-orange-700/30'
  };

  return colorMap[bankName] || 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
};

interface OverviewTabProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
  onUpdateTransaction?: (transaction: Transaction) => Promise<void>;
}

// Tipo para agrupamento de períodos
type PeriodType = 'month' | 'quarter' | 'semester' | 'year';

interface PeriodItem {
  id: string;
  label: string;
  type: PeriodType;
  startMonth: string;
  endMonth: string;
  transactions: Transaction[];
  isAggregate: boolean;
}

export function OverviewTab({
  transactions,
  onEditTransaction,
  onUpdateTransaction
}: OverviewTabProps) {
  const { getAllAccountTypes, customAccounts } = useConfig();
  const { contas, categorias, subtipos: hierarchySubtipos, carregarTudo } = useHierarchy();
  
  // Load hierarchy data
  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);
  
  // Debug: ver como os dados estão chegando
  useEffect(() => {
    // console.log('🔍 Transactions no OverviewTab:', transactions.slice(0, 2));
    // console.log('🔍 Total transactions:', transactions.length);
    // console.log('🔍 Transactions CONC via hierarchy:', transactions.filter(t => t.hierarchy?.conta_codigo === 'CONC').length);
    // console.log('🔍 Transactions with hierarchy:', transactions.filter(t => t.hierarchy).length);
    // console.log('🔍 Sample transaction with hierarchy:', transactions.find(t => t.hierarchy));
    // console.log('🔍 Sample CONC transaction:', transactions.find(t => t.subtipo_id === '6171661e-3705-4040-bb9f-c299fcc0c765'));
  }, [transactions]);
  
  // ✅ FORÇA MOSTRAR TUDO - Helper functions para acessar dados da hierarquia
  const getTransactionAccount = (transaction: Transaction): string => {
    // PRIMEIRO: tenta hierarchy
    if (transaction.hierarchy?.conta_codigo) {
      return transaction.hierarchy.conta_codigo;
    }
    // SEGUNDO: tenta campo legacy conta
    if (transaction.conta) {
      return transaction.conta;
    }
    // TERCEIRO: FORÇA mostrar como OUTRAS se não tem classificação
    return 'OUTRAS';
  };
  
  const getTransactionCategory = (transaction: Transaction): string => {
    return transaction.hierarchy?.categoria_nome || transaction.categoria || 'Sem categoria';
  };
  
  const getTransactionSubtype = (transaction: Transaction): string => {
    return transaction.hierarchy?.subtipo_nome || transaction.subtipo || 'Sem subtipo';
  };
  
  // ✅ Helper to get category icon from hierarchy
  const getCategoryIcon = useMemo(() => {
    return (contaCodigo: string, categoriaNome: string) => {
      const conta = contas.find(c => c.codigo === contaCodigo);
      const categoria = categorias.find(c => 
        c.conta_id === conta?.id && c.nome === categoriaNome
      );
      return categoria?.icone || '📁';
    };
  }, [contas, categorias]);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // Calcular período atual automaticamente
    const now = new Date();
    const currentYear = now.getFullYear().toString().slice(-2);
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    return currentYear + currentMonth;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCCs, setSelectedCCs] = useState<Set<string>>(new Set());
  const [showCCFilters, setShowCCFilters] = useState(false);
  const [showAggregates, setShowAggregates] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    // Começar com o ano atual
    const now = new Date();
    return '20' + now.getFullYear().toString().slice(-2);
  });
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedSubtypes, setExpandedSubtypes] = useState<Record<string, boolean>>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Estados para MassiveChangeSubtipo
  const [massiveChangeMode, setMassiveChangeMode] = useState(true);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [massiveChangeSubtipo, setMassiveChangeSubtipo] = useState('');
  const [massiveChangeDescricao, setMassiveChangeDescricao] = useState('');
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  // Descrições individuais: { transactionId: customDescription }
  const [individualDescriptions, setIndividualDescriptions] = useState<Record<string, string>>({});

  const toggleCategory = (categoria: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  };

  const toggleSubtype = (key: string) => {
    setExpandedSubtypes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Funções para MassiveChangeSubtipo
  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
    setMassiveChangeSubtipo('');
    setMassiveChangeDescricao('');
    setIndividualDescriptions({});
  };

  const updateIndividualDescription = (transactionId: string, description: string) => {
    setIndividualDescriptions(prev => ({
      ...prev,
      [transactionId]: description
    }));
  };

  const applyMassiveChange = async () => {
    if (selectedTransactions.size === 0 || !massiveChangeSubtipo) {
      alert('Selecione transações e um subtipo antes de aplicar');
      return;
    }

    if (!onUpdateTransaction) {
      alert('Função de atualização não disponível');
      return;
    }

    if (isApplyingChanges) {
      return; // Evitar cliques duplos
    }

    // Buscar o subtipo_id baseado no nome selecionado
    const selectedSubtipoObj = hierarchySubtipos.find(s => s.nome === massiveChangeSubtipo);
    if (!selectedSubtipoObj) {
      alert('Subtipo selecionado não encontrado na hierarquia');
      return;
    }

    const confirmMessage = `Deseja alterar ${selectedTransactions.size} transações para:\n` +
                          `Subtipo: ${massiveChangeSubtipo}\n` +
                          `Descrição: ${massiveChangeDescricao || '(manter atual)'}`;

    if (!confirm(confirmMessage)) return;

    setIsApplyingChanges(true);

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Processar cada transação selecionada
      for (const transactionId of selectedTransactions) {
        try {
          const transaction = transactions.find(t => t.id === transactionId);
          if (!transaction) {
            errors.push(`Transação ${transactionId} não encontrada`);
            errorCount++;
            continue;
          }

          // Determinar descrição a usar seguindo a hierarquia:
          // 1. Descrição individual (se existe)
          // 2. Descrição do lote (se preenchida)
          // 3. Descrição original da transação
          const finalDescription =
            individualDescriptions[transactionId] || // Descrição individual tem prioridade
            massiveChangeDescricao ||                 // Depois descrição do lote
            transaction.descricao;                    // Por último, manter original

          const updatedTransaction: Transaction = {
            ...transaction,
            subtipo_id: selectedSubtipoObj.id,
            descricao: finalDescription,
            realizado: 's' // Marcar como classificada
          };

          await onUpdateTransaction(updatedTransaction);
          successCount++;

        } catch (error) {
          console.error(`Erro ao atualizar transação ${transactionId}:`, error);
          errors.push(`Transação ${transactionId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          errorCount++;
        }
      }

      // Relatório final
      let resultMessage = `✅ Alteração em massa concluída!\n\n`;
      resultMessage += `✅ ${successCount} transações alteradas com sucesso\n`;

      if (errorCount > 0) {
        resultMessage += `⚠️ ${errorCount} transações com erro\n\n`;
        resultMessage += `Erros:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          resultMessage += `\n... e mais ${errors.length - 5} erros`;
        }
      }

      alert(resultMessage);

      // Limpar seleção apenas se houve pelo menos uma alteração bem-sucedida
      if (successCount > 0) {
        clearSelection();
      }

    } catch (error) {
      console.error('Erro geral na alteração em massa:', error);
      alert('Erro ao processar alteração em massa');
    } finally {
      setIsApplyingChanges(false);
    }
  };

  const formatMonth = (mes: string) => {
    if (!mes || mes === 'todos') return 'Todos os períodos';
    const year = '20' + mes.substring(0, 2);
    const month = mes.substring(2, 4);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return monthNames[parseInt(month) - 1] + ' ' + year;
  };


  // ===== FUNÇÃO PARA CRIAR PERÍODOS AGRUPADOS =====
  const createPeriodItems = (): PeriodItem[] => {
    const balanceTransactions = transactions.filter(t => countsInBalance(t.realizado));
    // console.log('🔍 createPeriodItems - balanceTransactions:', balanceTransactions.length);
    // console.log('🔍 createPeriodItems - CONC in balance:', balanceTransactions.filter(t => getTransactionAccount(t) === 'CONC').length);
    
    const monthsSet = new Set(balanceTransactions.map(t => t.mes).filter(Boolean));
    const months = Array.from(monthsSet).sort();
    
    if (months.length === 0) return [];

    const items: PeriodItem[] = [];
    
    // Agrupar por ano
    const yearGroups: Record<string, string[]> = {};
    months.forEach(month => {
      const year = '20' + month.substring(0, 2);
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(month);
    });

    // Processar cada ano
    Object.entries(yearGroups)
      .sort(([a], [b]) => a.localeCompare(b)) // Anos mais antigos primeiro
      .forEach(([year, yearMonths]) => {
        const sortedYearMonths = yearMonths.sort().reverse(); // Meses mais recentes primeiro
        
        // ===== ADICIONAR MESES INDIVIDUAIS =====
        sortedYearMonths.forEach(month => {
          const monthTransactions = balanceTransactions.filter(t => t.mes === month);
          
          items.push({
            id: month,
            label: formatMonth(month),
            type: 'month',
            startMonth: month,
            endMonth: month,
            transactions: monthTransactions,
            isAggregate: false
          });
        });

        // ===== ADICIONAR TRIMESTRES (se houver pelo menos 3 meses) =====
        if (sortedYearMonths.length >= 3) {
          const quarters = [
            { q: 4, months: ['10', '11', '12'], label: '4º Tri' },
            { q: 3, months: ['07', '08', '09'], label: '3º Tri' },
            { q: 2, months: ['04', '05', '06'], label: '2º Tri' },
            { q: 1, months: ['01', '02', '03'], label: '1º Tri' }
          ];

          quarters.forEach(({ q, months: qMonths, label }) => {
            const quarterMonths = sortedYearMonths.filter(month => {
              const monthNum = month.substring(2, 4);
              return qMonths.includes(monthNum);
            });

            if (quarterMonths.length >= 2) { // Pelo menos 2 meses do trimestre
              const quarterTransactions = balanceTransactions.filter(t => 
                quarterMonths.includes(t.mes)
              );

              items.push({
                id: `${year}-Q${q}`,
                label: `${label}/${year.slice(-2)}`,
                type: 'quarter',
                startMonth: quarterMonths[quarterMonths.length - 1], // Primeiro mês do trimestre
                endMonth: quarterMonths[0], // Último mês do trimestre
                transactions: quarterTransactions,
                isAggregate: true
              });
            }
          });
        }

        // ===== ADICIONAR SEMESTRES (se houver pelo menos 6 meses) =====
        if (sortedYearMonths.length >= 6) {
          const semesters = [
            { s: 2, months: ['07', '08', '09', '10', '11', '12'], label: '2º Sem' },
            { s: 1, months: ['01', '02', '03', '04', '05', '06'], label: '1º Sem' }
          ];

          semesters.forEach(({ s, months: sMonths, label }) => {
            const semesterMonths = sortedYearMonths.filter(month => {
              const monthNum = month.substring(2, 4);
              return sMonths.includes(monthNum);
            });

            if (semesterMonths.length >= 4) { // Pelo menos 4 meses do semestre
              const semesterTransactions = balanceTransactions.filter(t => 
                semesterMonths.includes(t.mes)
              );

              items.push({
                id: `${year}-S${s}`,
                label: `${label}/${year.slice(-2)}`,
                type: 'semester',
                startMonth: semesterMonths[semesterMonths.length - 1],
                endMonth: semesterMonths[0],
                transactions: semesterTransactions,
                isAggregate: true
              });
            }
          });
        }

        // ===== ADICIONAR ANO COMPLETO (se houver pelo menos 8 meses) =====
        if (sortedYearMonths.length >= 8) {
          const yearTransactions = balanceTransactions.filter(t => 
            sortedYearMonths.includes(t.mes)
          );

          items.push({
            id: `${year}-YEAR`,
            label: `Ano ${year}`,
            type: 'year',
            startMonth: sortedYearMonths[sortedYearMonths.length - 1],
            endMonth: sortedYearMonths[0],
            transactions: yearTransactions,
            isAggregate: true
          });
        }
      });

    return items;
  };

  // ===== OBTER PERÍODOS DISPONÍVEIS =====
  const availablePeriods = createPeriodItems();

  // ===== FILTRAR PERÍODOS BASEADO NA CONFIGURAÇÃO =====
  const getFilteredPeriods = () => {
    if (!showAggregates) {
      return availablePeriods.filter(p => !p.isAggregate);
    }
    return availablePeriods;
  };

  const filteredPeriods = getFilteredPeriods();

  // ===== OBTER TRANSAÇÕES DO PERÍODO SELECIONADO =====
  const getSelectedPeriodTransactions = () => {
    if (selectedPeriod === 'todos') {
      return transactions.filter(t => countsInBalance(t.realizado));
    }

    // Se for um ano selecionado (formato "2023-YEAR"), buscar todas as transações do ano
    if (selectedPeriod.endsWith('-YEAR')) {
      const year = selectedPeriod.split('-')[0];
      return transactions.filter(t => 
        countsInBalance(t.realizado) && 
        t.mes && 
        ('20' + t.mes.substring(0, 2)) === year
      );
    }

    // Se for um semestre (formato "2023-S1"), buscar transações do semestre
    if (selectedPeriod.includes('-S')) {
      const [year, semester] = selectedPeriod.split('-S');
      const semesterMonths = semester === '1' 
        ? ['01', '02', '03', '04', '05', '06']
        : ['07', '08', '09', '10', '11', '12'];
      
      return transactions.filter(t => 
        countsInBalance(t.realizado) && 
        t.mes && 
        ('20' + t.mes.substring(0, 2)) === year &&
        semesterMonths.includes(t.mes.substring(2, 4))
      );
    }

    // Se for um trimestre (formato "2023-Q1"), buscar transações do trimestre
    if (selectedPeriod.includes('-Q')) {
      const [year, quarter] = selectedPeriod.split('-Q');
      const quarterMonths: Record<string, string[]> = {
        '1': ['01', '02', '03'],
        '2': ['04', '05', '06'], 
        '3': ['07', '08', '09'],
        '4': ['10', '11', '12']
      };
      
      return transactions.filter(t => 
        countsInBalance(t.realizado) && 
        t.mes && 
        ('20' + t.mes.substring(0, 2)) === year &&
        quarterMonths[quarter]?.includes(t.mes.substring(2, 4))
      );
    }

    // Se for um mês específico (formato "2308"), filtrar diretamente
    if (selectedPeriod.length === 4 && /^\d{4}$/.test(selectedPeriod)) {
      return transactions.filter(t => 
        countsInBalance(t.realizado) && 
        t.mes === selectedPeriod
      );
    }

    const selectedPeriodItem = availablePeriods.find(p => p.id === selectedPeriod);
    return selectedPeriodItem ? selectedPeriodItem.transactions : [];
  };

  const filteredByPeriod = getSelectedPeriodTransactions();

  // Get unique CCs for filter buttons with custom order
  const uniqueCCs = useMemo(() => {
    const ccSet = new Set<string>();
    transactions.forEach(t => {
      if (t.cc && t.cc.trim()) {
        ccSet.add(t.cc.trim());
      }
    });

    const allCCs = Array.from(ccSet);
    const priorityOrder = ['Inter', 'BB', 'Stone', 'Santander', 'Dinheiro'];

    // First line: priority CCs that exist
    const firstLine = priorityOrder.filter(cc => allCCs.includes(cc));

    // Second line: remaining CCs
    const secondLine = allCCs.filter(cc => !priorityOrder.includes(cc)).sort();

    return { firstLine, secondLine, all: allCCs };
  }, [transactions]);

  // Debug period filtering
  // console.log('🔍 filteredByPeriod:', filteredByPeriod.length);
  // console.log('🔍 filteredByPeriod CONC:', filteredByPeriod.filter(t => getTransactionAccount(t) === 'CONC').length);

  // ===== APLICAR FILTROS DE BUSCA E CC =====
  const getFilteredTransactions = () => {
    let filtered = filteredByPeriod;

    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getTransactionSubtype(t).toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.descricao_origem?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por CC selecionados
    if (selectedCCs.size > 0) {
      filtered = filtered.filter(t => t.cc && selectedCCs.has(t.cc.trim()));
    }
    
    return filtered.sort((a, b) => {
      if (a.mes !== b.mes) return b.mes.localeCompare(a.mes);
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return Math.abs(b.valor) - Math.abs(a.valor);
    });
  };

  const classifiedTransactions = getFilteredTransactions();

  // CC Filter functions
  const toggleCCFilter = (cc: string) => {
    const newSelectedCCs = new Set(selectedCCs);
    if (newSelectedCCs.has(cc)) {
      newSelectedCCs.delete(cc);
    } else {
      newSelectedCCs.add(cc);
    }
    setSelectedCCs(newSelectedCCs);
  };

  const clearCCFilters = () => {
    setSelectedCCs(new Set());
  };
  
  // Debug classified transactions
  console.log('🔍 Classified transactions:', classifiedTransactions.length);
  console.log('🔍 Classified CONC:', classifiedTransactions.filter(t => getTransactionAccount(t) === 'CONC').length);
  console.log('🔍 Classified OUTRAS:', classifiedTransactions.filter(t => getTransactionAccount(t) === 'OUTRAS').length);
  console.log('🔍 Classified PJ:', classifiedTransactions.filter(t => getTransactionAccount(t) === 'PJ').length);
  console.log('🔍 Classified PF:', classifiedTransactions.filter(t => getTransactionAccount(t) === 'PF').length);
  console.log('🔍 TODAS as contas encontradas:', [...new Set(classifiedTransactions.map(t => getTransactionAccount(t)))]);

  // ===== OBTER INFORMAÇÕES DO PERÍODO SELECIONADO =====
  const getSelectedPeriodInfo = () => {
    if (selectedPeriod === 'todos') {
      return { label: 'Todos os períodos', type: 'all' as const };
    }
    
    const periodItem = availablePeriods.find(p => p.id === selectedPeriod);
    return periodItem ? { 
      label: periodItem.label, 
      type: periodItem.type,
      isAggregate: periodItem.isAggregate 
    } : { label: 'Período desconhecido', type: 'month' as const };
  };

  const selectedPeriodInfo = getSelectedPeriodInfo();

  // ===== FUNÇÕES PARA DETERMINAR DESTAQUE DOS BOTÕES =====
  const isQuarterHighlighted = (quarterNum: number) => {
    if (!selectedYear) return false;
    
    // Se há semestre selecionado, destacar trimestres do semestre
    if (selectedSemester) {
      const semesterNum = selectedSemester === '1º Sem' ? 1 : 2;
      if (semesterNum === 1) {
        return quarterNum === 1 || quarterNum === 2;
      } else {
        return quarterNum === 3 || quarterNum === 4;
      }
    }
    
    // Se há trimestre selecionado, não destacar outros trimestres
    if (selectedQuarter) {
      return false;
    }
    
    return false;
  };

  const isMonthHighlighted = (monthName: string) => {
    if (!selectedYear) return false;
    
    const monthNumbers: Record<string, number> = {
      'Jan': 1, 'Fev': 2, 'Mar': 3, 'Abr': 4, 'Mai': 5, 'Jun': 6,
      'Jul': 7, 'Ago': 8, 'Set': 9, 'Out': 10, 'Nov': 11, 'Dez': 12
    };
    
    const monthNum = monthNumbers[monthName];
    
    // Se há semestre selecionado
    if (selectedSemester) {
      const semesterNum = selectedSemester === '1º Sem' ? 1 : 2;
      if (semesterNum === 1) {
        return monthNum >= 1 && monthNum <= 6; // Jan-Jun
      } else {
        return monthNum >= 7 && monthNum <= 12; // Jul-Dez
      }
    }
    
    // Se há trimestre selecionado
    if (selectedQuarter) {
      const quarterNum = parseInt(selectedQuarter.charAt(0));
      if (quarterNum === 1) return monthNum >= 1 && monthNum <= 3; // Jan-Mar
      if (quarterNum === 2) return monthNum >= 4 && monthNum <= 6; // Abr-Jun
      if (quarterNum === 3) return monthNum >= 7 && monthNum <= 9; // Jul-Set
      if (quarterNum === 4) return monthNum >= 10 && monthNum <= 12; // Out-Dez
    }
    
    return false;
  };

  return (
    <div className="space-y-4">

      {/* Filtros Compactos em Cascata */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-medium text-gray-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            {(() => {
              // Se for todos os períodos
              if (selectedPeriod === 'todos') {
                return 'Todos';
              }
              
              // Se for um ano (formato "2024-YEAR")
              if (selectedPeriod.endsWith('-YEAR')) {
                const year = selectedPeriod.split('-')[0];
                return year;
              }
              
              // Se for um semestre (formato "2024-S1" ou "2024-S2")
              if (selectedPeriod.includes('-S')) {
                const [year, semester] = selectedPeriod.split('-S');
                return `${semester === '1' ? '1º' : '2º'}Sem/${year}`;
              }
              
              // Se for um trimestre (formato "2024-Q1", "2024-Q2", etc)
              if (selectedPeriod.includes('-Q')) {
                const [year, quarter] = selectedPeriod.split('-Q');
                return `${quarter}ºTri/${year}`;
              }
              
              // Se for um mês específico (formato "2409" = setembro/24)
              if (selectedPeriod.length === 4 && /^\d{4}$/.test(selectedPeriod)) {
                const year = '20' + selectedPeriod.substring(0, 2);
                const month = parseInt(selectedPeriod.substring(2, 4));
                const monthNames = [
                  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
                ];
                return `${monthNames[month - 1]}/${year}`;
              }
              
              // Fallback
              return 'Período';
            })()}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedPeriod('todos');
                setSelectedYear('');
                setSelectedSemester('');
                setSelectedQuarter('');
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                selectedPeriod === 'todos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthYear = lastMonth.getFullYear().toString().slice(-2);
                const lastMonthMonth = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
                const lastMonthPeriod = lastMonthYear + lastMonthMonth;
                
                setSelectedPeriod(lastMonthPeriod);
                setSelectedYear('20' + lastMonthYear);
                setSelectedSemester('');
                setSelectedQuarter('');
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                (() => {
                  const now = new Date();
                  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const lastMonthYear = lastMonth.getFullYear().toString().slice(-2);
                  const lastMonthMonth = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
                  const lastMonthPeriod = lastMonthYear + lastMonthMonth;
                  return selectedPeriod === lastMonthPeriod;
                })()
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Anter.
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const currentYear = now.getFullYear().toString().slice(-2);
                const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                const currentPeriod = currentYear + currentMonth;
                
                setSelectedPeriod(currentPeriod);
                setSelectedYear('20' + currentYear);
                setSelectedSemester('');
                setSelectedQuarter('');
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                (() => {
                  const now = new Date();
                  const currentYear = now.getFullYear().toString().slice(-2);
                  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                  const currentPeriod = currentYear + currentMonth;
                  return selectedPeriod === currentPeriod;
                })()
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Atual
            </button>
            
            {/* Botão para mostrar/esconder filtros avançados */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="px-3 py-1 rounded text-sm font-medium transition-all bg-purple-600 text-white hover:bg-purple-500 flex items-center"
            >
              {showAdvancedFilters ? 
                <ChevronUp className="w-4 h-4" /> : 
                <ChevronDown className="w-4 h-4" />
              }
            </button>
          </div>
        </div>

        {/* Sistema Cascata Compacto - Mostra/Esconde TUDO com toggle */}
        {showAdvancedFilters && (
          <div className="space-y-3">
            {/* Anos - Sempre visível quando sistema expandido */}
            <div className="flex justify-center">
              <div className="flex flex-wrap gap-2 justify-center">
                {(() => {
                  const availableYears = [...new Set(
                    transactions
                      .filter(t => countsInBalance(t.realizado) && t.mes)
                      .map(t => '20' + t.mes.substring(0, 2))
                  )].sort().reverse();

                  return availableYears.sort().map(year => (
                    <button
                      key={year}
                      onClick={() => {
                        if (selectedYear === year) {
                          setSelectedYear('');
                          setSelectedSemester('');
                          setSelectedQuarter('');
                          setSelectedPeriod('todos');
                        } else {
                          setSelectedYear(year);
                          setSelectedSemester('');
                          setSelectedQuarter('');
                          setSelectedPeriod(`${year}-YEAR`);
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                        selectedYear === year
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {year}
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* Semestres - Sempre habilitados */}
            <div className="flex justify-center">
              <div className="flex gap-2 justify-center">
                {['1º Sem', '2º Sem'].map((sem, index) => {
                  const semesterNumber = index + 1;
                  const semesterId = selectedYear ? `${selectedYear}-S${semesterNumber}` : '';
                  
                  return (
                    <button
                      key={sem}
                      onClick={() => {
                        if (!selectedYear) return; // Não faz nada se não tem ano selecionado
                        
                        if (selectedSemester === sem) {
                          setSelectedSemester('');
                          setSelectedQuarter('');
                          setSelectedPeriod(`${selectedYear}-YEAR`);
                        } else {
                          setSelectedSemester(sem);
                          setSelectedQuarter('');
                          setSelectedPeriod(semesterId);
                        }
                      }}
                      disabled={!selectedYear}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                        selectedSemester === sem
                          ? 'bg-purple-600 text-white'
                          : selectedYear
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {sem}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trimestres - Sempre habilitados */}
            <div className="flex justify-center">
              <div className="flex gap-2 justify-center">
                {[
                  { label: '1º Tri', q: 1 }, 
                  { label: '2º Tri', q: 2 }, 
                  { label: '3º Tri', q: 3 }, 
                  { label: '4º Tri', q: 4 }
                ].map(({ label, q }) => {
                  const quarterId = selectedYear ? `${selectedYear}-Q${q}` : '';
                  const isActive = selectedQuarter === label;
                  
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        if (!selectedYear) return; // Precisa de ano selecionado
                        
                        if (selectedQuarter === label) {
                          setSelectedQuarter('');
                          // Voltar para o período anterior (semestre ou ano)
                          if (selectedSemester) {
                            setSelectedPeriod(`${selectedYear}-S${selectedSemester === '1º Sem' ? '1' : '2'}`);
                          } else {
                            setSelectedPeriod(`${selectedYear}-YEAR`);
                          }
                        } else {
                          setSelectedQuarter(label);
                          setSelectedSemester(''); // Reset semestre quando seleciona trimestre
                          setSelectedPeriod(quarterId);
                        }
                      }}
                      disabled={!selectedYear || (selectedSemester ? !isQuarterHighlighted(q) : false)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white'
                          : selectedYear && isQuarterHighlighted(q)
                            ? 'bg-blue-700 text-blue-200 hover:bg-blue-600'
                            : selectedYear
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meses - Sempre habilitados */}
            <div className="flex justify-center">
              <div className="flex flex-wrap gap-2 justify-center">
                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(monthName => {
                  const monthNumbers: Record<string, string> = {
                    'Jan': '01', 'Fev': '02', 'Mar': '03', 'Abr': '04',
                    'Mai': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08',
                    'Set': '09', 'Out': '10', 'Nov': '11', 'Dez': '12'
                  };
                  
                  const monthId = selectedYear ? selectedYear.slice(-2) + monthNumbers[monthName] : '';
                  const isActive = selectedPeriod === monthId;
                  
                  return (
                    <button
                      key={monthName}
                      onClick={() => {
                        if (!selectedYear) return; // Precisa de ano selecionado
                        setSelectedPeriod(monthId);
                      }}
                      disabled={!selectedYear || ((selectedSemester || selectedQuarter) ? !isMonthHighlighted(monthName) : false)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : selectedYear && isMonthHighlighted(monthName)
                            ? 'bg-blue-700 text-blue-200 hover:bg-blue-600'
                            : selectedYear
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        
        {/* Espaçamento entre filtros de período e busca */}
        <div className="h-4"></div>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descrição, subtipo ou origem..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* CC Filter Section */}
        {uniqueCCs.all.length > 0 && (
          <div className="mt-4">
            {/* Toggle Header */}
            <div className="flex items-center justify-between w-full mb-2">
              <button
                onClick={() => setShowCCFilters(!showCCFilters)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showCCFilters ? 'rotate-180' : ''}`} />
                <span>Filtrar por CC</span>
                {selectedCCs.size > 0 && (
                  <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded-full">
                    {selectedCCs.size}
                  </span>
                )}
              </button>

              {selectedCCs.size > 0 && showCCFilters && (
                <button
                  onClick={clearCCFilters}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Collapsible Content */}
            {showCCFilters && (
              <div className="space-y-2">
                {/* First line - Priority CCs */}
                {uniqueCCs.firstLine.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {uniqueCCs.firstLine.map(cc => {
                      const isSelected = selectedCCs.has(cc);
                      return (
                        <button
                          key={cc}
                          onClick={() => toggleCCFilter(cc)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                            isSelected
                              ? getBankColor(cc).replace('/20', '/30').replace('border-gray-500/30', 'border-current') + ' ring-1 ring-current'
                              : getBankColor(cc) + ' hover:bg-opacity-30'
                          }`}
                        >
                          {cc}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Second line - Remaining CCs */}
                {uniqueCCs.secondLine.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {uniqueCCs.secondLine.map(cc => {
                      const isSelected = selectedCCs.has(cc);
                      return (
                        <button
                          key={cc}
                          onClick={() => toggleCCFilter(cc)}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                            isSelected
                              ? getBankColor(cc).replace('/20', '/30').replace('border-gray-500/30', 'border-current') + ' ring-1 ring-current'
                              : getBankColor(cc) + ' hover:bg-opacity-30'
                          }`}
                        >
                          {cc}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Painel MassiveChangeSubtipo */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {selectedTransactions.size > 0 && (
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-blue-600 text-white rounded text-sm">
                  {selectedTransactions.size} selecionadas
                </span>
                {Object.keys(individualDescriptions).length > 0 && (
                  <span className="px-2 py-1 bg-purple-600 text-white rounded text-sm">
                    {Object.keys(individualDescriptions).length} com descrição própria
                  </span>
                )}
              </div>
            )}
          </div>

          {selectedTransactions.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
              >
                Limpar Tudo
              </button>
              {Object.keys(individualDescriptions).length > 0 && (
                <button
                  onClick={() => setIndividualDescriptions({})}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
                >
                  Limpar Descrições
                </button>
              )}
            </div>
          )}
        </div>

        {/* Painel de Classificação - só aparece quando há seleções */}
        {selectedTransactions.size > 0 && (
          <div className="bg-gray-700 p-4 rounded border border-gray-600 space-y-4">
            <h4 className="text-gray-100 font-medium flex items-center gap-2">
              🔧 Classificar {selectedTransactions.size} transações
            </h4>

            {/* Busca de Subtipo */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">Buscar Subtipo:</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Digite para buscar subtipo..."
                  value={massiveChangeSubtipo}
                  onChange={(e) => setMassiveChangeSubtipo(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-600 border border-gray-500 rounded text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Dropdown de sugestões de subtipo */}
              {massiveChangeSubtipo && massiveChangeSubtipo.length > 0 && (
                <div className="max-h-40 overflow-y-auto bg-gray-600 border border-gray-500 rounded">
                  {(() => {
                    // Filtrar subtipos que contêm o texto digitado
                    const filteredSubtipos = hierarchySubtipos.filter(s =>
                      s.nome.toLowerCase().includes(massiveChangeSubtipo.toLowerCase())
                    ).slice(0, 8); // Limitar a 8 resultados

                    if (filteredSubtipos.length === 0) {
                      return (
                        <div className="p-2 text-sm text-gray-400">
                          Nenhum subtipo encontrado
                        </div>
                      );
                    }

                    return filteredSubtipos.map(subtipo => {
                      const categoria = categorias.find(c => c.id === subtipo.categoria_id);
                      const conta = contas.find(c => c.id === categoria?.conta_id);

                      return (
                        <button
                          key={subtipo.id}
                          onClick={() => setMassiveChangeSubtipo(subtipo.nome)}
                          className="w-full text-left p-2 hover:bg-gray-500 transition-colors border-b border-gray-500 last:border-b-0"
                        >
                          <div className="text-sm text-gray-200 font-medium">{subtipo.nome}</div>
                          <div className="text-xs text-gray-400">
                            {conta?.nome} → {categoria?.nome}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Botões de Classificação Rápida (como presets) */}
              {massiveChangeSubtipo.length === 0 && (
                <div className="space-y-2 mt-3">
                  <span className="text-xs text-gray-400">Classificação rápida (presets):</span>
                  <div className="grid grid-cols-3 gap-1">
                    {getQuickActionCategories(contas, categorias, hierarchySubtipos).map(category => (
                      <button
                        key={category.id}
                        onClick={() => setMassiveChangeSubtipo(category.subtipo_nome)}
                        className={`px-2 py-2 ${category.color} text-white rounded text-xs transition-colors hover:scale-105 flex items-center gap-1 justify-center`}
                        title={`${category.title}: ${category.conta_codigo} > ${category.categoria_nome} > ${category.subtipo_nome}`}
                      >
                        <span>{category.label}</span>
                        <span className="text-[10px]">{category.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mostrar hierarquia do subtipo selecionado */}
            {massiveChangeSubtipo && (
              <div className="bg-gray-600 p-3 rounded border border-gray-500">
                <h5 className="text-sm font-medium text-gray-200 mb-2">Hierarquia:</h5>
                {(() => {
                  // Buscar a hierarquia do subtipo selecionado
                  const hierarchyItem = hierarchySubtipos.find(s => s.nome === massiveChangeSubtipo);
                  if (hierarchyItem) {
                    const categoria = categorias.find(c => c.id === hierarchyItem.categoria_id);
                    const conta = contas.find(c => c.id === categoria?.conta_id);

                    return (
                      <div className="text-sm text-gray-300">
                        <span className="text-blue-400">{conta?.nome || 'Conta'}</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-400">{categoria?.nome || 'Categoria'}</span>
                        <span className="mx-2">→</span>
                        <span className="text-yellow-400 font-medium">{massiveChangeSubtipo}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-sm text-gray-400">
                        Subtipo "{massiveChangeSubtipo}" não encontrado na hierarquia
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            {/* Campo de Descrição */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">Descrição do lote (opcional):</label>
              <input
                type="text"
                placeholder="Aplicada a todas, exceto quem tiver descrição individual"
                value={massiveChangeDescricao}
                onChange={(e) => setMassiveChangeDescricao(e.target.value)}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
              <div className="text-xs text-gray-400">
                💡 Hierarquia: Individual → Lote → Original
              </div>
            </div>

            {/* Botão Aplicar */}
            <div className="flex justify-end">
              <button
                onClick={applyMassiveChange}
                disabled={!massiveChangeSubtipo || isApplyingChanges}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  massiveChangeSubtipo && !isApplyingChanges
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isApplyingChanges ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Aplicando...
                  </span>
                ) : (
                  'Aplicar Alterações'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resto do conteúdo permanece igual... */}
      {classifiedTransactions.length === 0 ? (
        <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
          <div className="text-6xl mb-4">🔭</div>
          <h3 className="text-xl font-semibold text-gray-100 mb-2">
            Nenhuma Transação no Saldo
          </h3>
          <p className="text-gray-400">
            {selectedPeriod !== 'todos' 
              ? `Não há transações que contam no saldo para ${selectedPeriodInfo.label}`
              : 'Classifique suas transações na Caixa de Entrada para vê-las aqui'
            }
          </p>
        </div>
      ) : (
        <>
          {/* FORÇA MOSTRAR TUDO - Sistema hierárquico por conta com separação receitas/despesas */}
          {[...contas.map(c => c.codigo), 'OUTRAS', ...getAllAccountTypes()].filter((v, i, a) => a.indexOf(v) === i)
            .sort((a, b) => {
              // Ordenação usando ordem_exibicao das contas
              const getContaOrdem = (codConta: string) => {
                const conta = contas.find(c => c.codigo === codConta);
                if (conta) {
                  return conta.ordem_exibicao;
                }
                return codConta === 'OUTRAS' ? 1000 : 999;
              };
              return getContaOrdem(a) - getContaOrdem(b);
            })
            .map(conta => {
            const transacoesConta = classifiedTransactions.filter(t => getTransactionAccount(t) === conta);
            console.log(`📊 Conta ${conta}:`, { 
              total: transacoesConta.length, 
              amostra: transacoesConta.slice(0, 2).map(t => ({ desc: t.descricao, valor: t.valor, conta: getTransactionAccount(t) }))
            });
            
            // Separar receitas e despesas da conta
            const receitasConta = transacoesConta.filter(t => t.valor > 0);
            const despesasConta = transacoesConta.filter(t => t.valor < 0);
            
            // Buscar informações da conta (padrão ou personalizada)
            const customAccount = customAccounts?.find(acc => acc.id === conta);
            const baseConta = customAccount 
              ? {
                  title: customAccount.name,
                  icon: customAccount.icon,
                  color: 'blue' // Cor padrão para contas personalizadas
                }
              : (() => {
                  const contaObj = contas.find(c => c.codigo === conta);
                  return contaObj 
                    ? { title: contaObj.nome, icon: contaObj.icone || '📁', color: 'blue' }
                    : { title: conta, icon: '❓', color: 'gray' };
                })();

            // Array para renderizar as seções (receitas e despesas separadas)
            const secoes = [];
            
            if (receitasConta.length > 0) {
              secoes.push({
                tipo: 'receitas',
                titulo: `Receitas ${baseConta.title}`,
                icon: baseConta.icon,
                color: baseConta.color,
                transacoes: receitasConta
              });
            }
            
            if (despesasConta.length > 0) {
              secoes.push({
                tipo: 'despesas', 
                titulo: `Gastos ${baseConta.title}`,
                icon: baseConta.icon,
                color: baseConta.color,
                transacoes: despesasConta
              });
            }
            
            if (secoes.length === 0) return null;

            return secoes.map((secao, index) => {
              const transacoesSecao = secao.transacoes;
              
              if (transacoesSecao.length === 0) return null;

              // Calcular totais separados de receitas e despesas GLOBAIS
              const totalReceitas = classifiedTransactions
                .filter(t => t.valor > 0)
                .reduce((sum, t) => sum + t.valor, 0);
              
              const totalDespesas = Math.abs(classifiedTransactions
                .filter(t => t.valor < 0)
                .reduce((sum, t) => sum + t.valor, 0));

              // Calcular total da seção (sempre positivo para exibição)
              const valorSecao = transacoesSecao.reduce((sum, t) => sum + t.valor, 0);
              const totalSecao = Math.abs(valorSecao);
              
              // Determinar se a seção é receita ou despesa e calcular percentual adequado
              const isReceita = secao.tipo === 'receitas';
              const percentualSecao = isReceita 
                ? (totalReceitas > 0 ? ((totalSecao / totalReceitas) * 100).toFixed(1) : 0)
                : (totalDespesas > 0 ? ((totalSecao / totalDespesas) * 100).toFixed(1) : 0);
              const tipoPercentual = isReceita ? '% das receitas' : '% das despesas';

              // Agrupar hierarquicamente por categoria > subtipo (usando transações da seção)
              const groupedHierarchySecao = transacoesSecao.reduce((acc, transaction) => {
                const categoria = getTransactionCategory(transaction);
                const subtipo = getTransactionSubtype(transaction);
                
                if (!acc[categoria]) {
                  acc[categoria] = {};
                }
                if (!acc[categoria][subtipo]) {
                  acc[categoria][subtipo] = [];
                }
                acc[categoria][subtipo].push(transaction);
                return acc;
              }, {} as Record<string, Record<string, Transaction[]>>);

              return (
                <div key={`${conta}-${secao.tipo}`} className="space-y-3 mb-6">
                  {/* Header da Seção */}
                  <div className={`${
                    secao.tipo === 'receitas'
                      ? 'bg-[linear-gradient(0deg,_theme(colors.green.300)_2%,_theme(colors.green.200)_8%,_theme(colors.green.200)_100%)]' // Receitas: Verde
                      : 'bg-[linear-gradient(0deg,_theme(colors.red.300)_2%,_theme(colors.red.200)_8%,_theme(colors.red.200)_100%)]' // Despesas: Vermelho
                  } text-gray-900 p-4 rounded-lg shadow-lg`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{secao.icon}</span>
                        <div>
                          <h2 className="text-lg font-bold text-gray-800" style={{textShadow: '1px 1px 3px rgba(255,255,255,0.9)', fontFamily: 'Inter, system-ui, sans-serif'}}>{secao.titulo}</h2>
                          <p className="text-sm text-gray-700" style={{textShadow: '1px 1px 3px rgba(255,255,255,0.9)', fontFamily: 'Inter, system-ui, sans-serif'}}>{transacoesSecao.length} transações</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${valorSecao >= 0 ? 'text-green-700' : 'text-red-700'}`} style={{textShadow: '1px 1px 3px rgba(255,255,255,0.9)', fontFamily: 'Inter, system-ui, sans-serif'}}>
                          {valorSecao >= 0 ? '+' : '-'}R$ {formatCurrency(totalSecao)}
                        </p>
                        <p className="text-sm text-gray-700" style={{textShadow: '1px 1px 3px rgba(255,255,255,0.9)', fontFamily: 'Inter, system-ui, sans-serif'}}>
                          {percentualSecao} {tipoPercentual}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Categorias da Seção - ORDENADAS POR ordem_exibicao */}
                  {Object.entries(groupedHierarchySecao)
                    .sort(([catA,], [catB,]) => {
                      // Ordenação usando ordem_exibicao das categorias
                      const getCategoriaOrdem = (nomeCategoria: string) => {
                        const contaObj = contas.find(c => c.codigo === conta);
                        const categoria = categorias.find(c => 
                          c.conta_id === contaObj?.id && c.nome === nomeCategoria
                        );
                        return categoria?.ordem_exibicao || 999;
                      };
                      return getCategoriaOrdem(catA) - getCategoriaOrdem(catB);
                    })
                    .map(([categoria, subtipos]) => {
                      const categoriaTransactions = Object.values(subtipos).flat();
                      
                      // Calcular valor da categoria respeitando o sinal
                      const valorCategoria = categoriaTransactions.reduce((sum, t) => sum + t.valor, 0);
                      const totalCategoria = Math.abs(valorCategoria);
                      const countCategoria = categoriaTransactions.length;
                      
                      // Percentual da categoria sempre em relação à seção
                      const percentualCategoria = totalSecao > 0 ? ((totalCategoria / totalSecao) * 100).toFixed(1) : 0;
                    
                    // ✅ Buscar ícone da categoria usando sistema dinâmico
                    let categoryIcon = getCategoryIcon(conta, categoria) || '📊';
                    let categoryColor = 'red';
                    
                    // Fallback para sistema antigo se necessário
                    

                      const isExpanded = expandedCategories[`${conta}-${secao.tipo}-${categoria}`];

                      return (
                        <div key={`${conta}-${secao.tipo}-${categoria}`} className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                          {/* Header da Categoria */}
                          <button
                            onClick={() => toggleCategory(`${conta}-${secao.tipo}-${categoria}`)}
                            className="w-full p-3 flex items-center justify-between hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{categoryIcon}</span>
                            <div className="text-left">
                              <h3 className="font-medium text-gray-100 text-sm">{categoria}</h3>
                              <p className="text-xs text-gray-400">{countCategoria} transações</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className={`font-bold text-sm ${valorCategoria >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {valorCategoria >= 0 ? '+' : '-'}R$ {formatCurrency(totalCategoria)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {percentualCategoria}% da seção
                              </p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>

                        {/* Subtipos expandidos */}
                        {isExpanded && (
                          <div className="border-t border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750">
                            {Object.entries(subtipos)
                              .sort(([subA,], [subB,]) => {
                                // Ordenação usando ordem_exibicao dos subtipos
                                const getSubtipoOrdem = (nomeSubtipo: string) => {
                                  // ✅ USAR hierarchySubtipos (array do hook), não subtipos (objeto local)
                                  const contaObj = contas.find(c => c.codigo === conta);
                                  const categoriaObj = categorias.find(c => 
                                    c.conta_id === contaObj?.id && c.nome === categoria
                                  );
                                  const subtipo = hierarchySubtipos.find(s => 
                                    s.categoria_id === categoriaObj?.id && s.nome === nomeSubtipo
                                  );
                                  return subtipo?.ordem_exibicao || 999;
                                };
                                return getSubtipoOrdem(subA) - getSubtipoOrdem(subB);
                              })
                              .map(([subtipo, transactions]) => {
                                const valorSubtipo = transactions.reduce((sum, t) => sum + t.valor, 0);
                                const totalSubtipo = Math.abs(valorSubtipo);
                                const countSubtipo = transactions.length;
                                
                                // Percentual do subtipo sempre em relação à categoria
                                const percentualSubtipo = totalCategoria > 0 ? ((totalSubtipo / totalCategoria) * 100).toFixed(1) : 0;
                                const subtypeKey = `${conta}-${secao.tipo}-${categoria}-${subtipo}`;
                                const isSubtypeExpanded = expandedSubtypes[subtypeKey];

                                return (
                                  <div key={subtypeKey} className="border-b border-gray-700 last:border-b-0">
                                    {/* Header do Subtipo */}
                                    <button
                                      onClick={() => toggleSubtype(subtypeKey)}
                                      className="w-full px-5 py-2 flex items-center justify-between hover:bg-gray-700 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 flex items-center justify-center">
                                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                                        </div>
                                        <div className="text-left">
                                          <p className="font-medium text-gray-200 text-sm">{subtipo}</p>
                                          <p className="text-xs text-gray-400">{countSubtipo} transações</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-right">
                                          <p className={`font-semibold text-sm ${valorSubtipo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {valorSubtipo >= 0 ? '+' : '-'}R$ {formatCurrency(totalSubtipo)}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {percentualSubtipo}% da categoria
                                          </p>
                                        </div>
                                        {isSubtypeExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                                      </div>
                                    </button>

                                    {/* Transações */}
                                    {isSubtypeExpanded && (
                                      <div className="bg-gradient-to-r from-slate-800 to-blue-900">
                                        {transactions.map((transaction, idx) => (
                                          <div 
                                            key={`${transaction.id}-${idx}`} 
                                            className="px-6 py-2 border-b border-blue-800 last:border-b-0 hover:bg-blue-800"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <p className="text-sm text-gray-100 font-medium truncate">
                                                    {transaction.descricao || 'Sem descrição'}
                                                  </p>
                                                  {transaction.realizado === 'r' && (
                                                    <span className="text-xs bg-blue-700 text-blue-200 px-1.5 py-0.5 rounded">
                                                      🔗 Realizada
                                                    </span>
                                                  )}
                                                </div>
                                                
                                                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                                  <span>{formatDate(transaction.data)} • {transaction.descricao_origem}</span>
                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBankColor(transaction.cc)}`}>
                                                    {transaction.cc}
                                                  </span>
                                                </div>
                                              </div>
                                              
                                              <div className="text-right flex-shrink-0 ml-2">
                                                <span className={`font-medium text-sm ${
                                                  transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                  {transaction.valor >= 0 ? '+' : '-'}R$ {formatCurrency(Math.abs(transaction.valor))}
                                                </span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  {/* Checkbox para seleção em massa */}
                                                  {transaction.realizado !== 'r' && (
                                                    <button
                                                      onClick={() => toggleTransactionSelection(transaction.id)}
                                                      className={`w-6 h-6 rounded border-2 transition-colors flex items-center justify-center ${
                                                        selectedTransactions.has(transaction.id)
                                                          ? 'bg-blue-600 border-blue-600 text-white'
                                                          : 'border-gray-400 hover:border-blue-400'
                                                      }`}
                                                      title="Selecionar para alteração em massa"
                                                    >
                                                      {selectedTransactions.has(transaction.id) && (
                                                        <CheckSquare className="w-3 h-3" />
                                                      )}
                                                    </button>
                                                  )}

                                                  {/* Botão Editar */}
                                                  {transaction.realizado !== 'r' && (
                                                    <button
                                                      onClick={() => onEditTransaction(transaction)}
                                                      className="w-7 h-7 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs transition-colors flex items-center justify-center shadow-sm"
                                                      title="Editar/Classificar"
                                                    >
                                                      ✏️
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Campo de descrição individual - aparece quando transação está selecionada */}
                                            {selectedTransactions.has(transaction.id) && (
                                              <div className="px-6 py-3 bg-pink-900/20 border-t border-pink-700">
                                                <div className="space-y-2">
                                                  <label className="block text-xs text-pink-200 font-medium">
                                                    Descrição individual (opcional):
                                                  </label>
                                                  <input
                                                    type="text"
                                                    placeholder="Deixe vazio para usar descrição do lote ou original"
                                                    value={individualDescriptions[transaction.id] || ''}
                                                    onChange={(e) => updateIndividualDescription(transaction.id, e.target.value)}
                                                    className="w-full px-3 py-2 bg-pink-800 border border-pink-600 rounded text-pink-100 placeholder-pink-300 focus:border-pink-400 focus:outline-none text-sm"
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                    })}
                </div>
              );
            });
          })}

          {/* Resumo Total */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg mt-6 shadow-lg">
            <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
              💎 Resumo Total - {selectedPeriodInfo.label}
              {selectedPeriodInfo.isAggregate && <TrendingUp className="w-5 h-5" />}
            </h4>
            <div className="space-y-2">
              {[...contas.map(c => c.codigo), 'OUTRAS', ...getAllAccountTypes()].filter((v, i, a) => a.indexOf(v) === i).map(conta => {
                const transacoesConta = classifiedTransactions.filter(t => getTransactionAccount(t) === conta);
                if (transacoesConta.length === 0) return null;
                
                const customAccount = customAccounts?.find(acc => acc.id === conta);
                const contaObj = contas.find(c => c.codigo === conta);
                const accountLabel = customAccount 
                  ? `${customAccount.icon} ${customAccount.name}`
                  : contaObj
                    ? `${contaObj.icone || '📁'} ${contaObj.nome}`
                    : '❓ OUTRAS';
                
                const saldoConta = transacoesConta.reduce((sum, t) => sum + t.valor, 0);
                
                return (
                  <div key={conta} className="flex justify-between items-center">
                    <span>Saldo {accountLabel}:</span>
                    <span className="font-bold">
                      R$ {formatCurrency(saldoConta)}
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-white/30 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Resultado Final:</span>
                  <span className="font-bold text-xl">
                    R$ {formatCurrency(classifiedTransactions.reduce((sum, t) => sum + t.valor, 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Estatísticas Adicionais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h5 className="font-medium text-gray-100 mb-2 flex items-center gap-2">
                <span className="text-green-400">📈</span>
                Receitas
              </h5>
              <p className="text-2xl font-bold text-green-400">
                R$ {formatCurrency(classifiedTransactions.filter(t => t.valor > 0).reduce((sum, t) => sum + t.valor, 0))}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {classifiedTransactions.filter(t => t.valor > 0).length} transações
              </p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h5 className="font-medium text-gray-100 mb-2 flex items-center gap-2">
                <span className="text-red-400">📉</span>
                Despesas
              </h5>
              <p className="text-2xl font-bold text-red-400">
                R$ {formatCurrency(Math.abs(classifiedTransactions.filter(t => t.valor < 0).reduce((sum, t) => sum + t.valor, 0)))}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {classifiedTransactions.filter(t => t.valor < 0).length} transações
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}