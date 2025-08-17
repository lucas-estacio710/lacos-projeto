// PixInterConciliationModal.tsx - VERSÃO COM CALENDÁRIO LINEAR E MATCH EXATO - CORRIGIDO

import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { Transaction, FinancialEntry, FinancialSheetData } from '@/types';
import { formatDateToLocal, formatDateForDisplay, isSameDay } from '@/lib/dateUtils';

// Helper para formatação
const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface DayGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  transactions: Transaction[];
  sheetEntries: FinancialEntry[];
  totalTransactionValue: number;
  totalEntriesValue: number;
}

interface PixInterConciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  complexTransactions: Transaction[];
  sheetData: FinancialSheetData | null;
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
  // ✅ NOVA PROP PARA FORÇAR RECARREGAMENTO
  onDataRefresh?: () => Promise<void>;
}

export function PixInterConciliationModal({
  isOpen,
  onClose,
  complexTransactions,
  sheetData,
  onApplyClassification,
  onReconcileTransactions,
  onDataRefresh
}: PixInterConciliationModalProps) {
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  // ✅ ESTADO PARA CONTROLAR RECARREGAMENTO
  const [lastUpdateKey, setLastUpdateKey] = useState(0);

  // Organizar transações PIX Inter por dia
  useEffect(() => {
    if (!isOpen || !sheetData) {
      setDayGroups([]);
      return;
    }

    console.log('🔄 Organizando transações PIX Inter por dia...');

    // Filtrar apenas PIX Inter (não InterPag) não classificadas
    const pixTransactions = complexTransactions.filter(t => {
      // Verificar se é PIX Inter (origem Inter mas NÃO InterPag)
      const isPixInter = (
        t.origem === 'Inter' &&
        !t.descricao_origem?.toLowerCase().includes('inter pag')
      );
      
      // Verificar se não está classificada (múltiplas condições possíveis)
      const isNotClassified = (
        !t.categoria || 
        t.categoria === '' || 
        t.categoria === 'Não Classificado' ||
        t.categoria === 'Nao Classificado' ||
        t.categoria.toLowerCase().includes('não classificad') ||
        t.categoria.toLowerCase().includes('nao classificad') ||
        (!t.subtipo || t.subtipo === '') ||
        (t.realizado !== 's' && t.realizado !== 'r') // Não está executada nem reconciliada
      );
      
      console.log(`🔍 Transação ${t.id}:`, {
        descricao: t.descricao_origem,
        origem: t.origem,
        categoria: t.categoria,
        subtipo: t.subtipo,
        realizado: t.realizado,
        isPixInter,
        isNotClassified,
        shouldInclude: isPixInter && isNotClassified
      });
      
      return isPixInter && isNotClassified;
    });

    console.log(`📊 ${pixTransactions.length} transações PIX Inter encontradas`);

    // Agrupar por data
    const groups = new Map<string, DayGroup>();

    // Processar transações
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
          transactions: [],
          sheetEntries: [],
          totalTransactionValue: 0,
          totalEntriesValue: 0
        });
      }
      
      const group = groups.get(dateStr)!;
      group.transactions.push(transaction);
      group.totalTransactionValue += Math.abs(transaction.valor);
    });

    // Processar entradas da planilha (apenas PIX)
    const pixEntries = sheetData.entries.filter(entry => 
      entry.metodo?.toLowerCase().includes('pix')
    );

    pixEntries.forEach(entry => {
      const dateStr = formatDateToLocal(entry.dataHora);
      
      if (!dateStr || dateStr === 'Data inválida') {
        console.warn('⚠️ Entrada com data inválida ignorada:', entry.id);
        return;
      }
      
      // ✅ MATCH EXATO POR DIA - SEM TOLERÂNCIA
      if (groups.has(dateStr)) {
        const group = groups.get(dateStr)!;
        group.sheetEntries.push(entry);
        group.totalEntriesValue += entry.valorFinal;
      }
    });

    // Converter para array e ordenar por data (mais antiga primeiro)
    const sortedGroups = Array.from(groups.values())
      .filter(group => group.transactions.length > 0) // Apenas dias com transações
      .sort((a, b) => a.date.localeCompare(b.date)); // Cronológico

    setDayGroups(sortedGroups);
    setCurrentDayIndex(0);
    setSelectedTransactions(new Set());
    setSelectedEntries(new Set());

    console.log(`✅ ${sortedGroups.length} dias organizados`, sortedGroups);
    
    // ✅ INCLUIR lastUpdateKey COMO DEPENDÊNCIA PARA FORÇAR RECARREGAMENTO
  }, [isOpen, complexTransactions, sheetData, lastUpdateKey]);

  // Obter grupo do dia atual
  const getCurrentGroup = (): DayGroup | null => {
    return dayGroups[currentDayIndex] || null;
  };

  // Navegação entre dias
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

  const resetSelections = () => {
    setSelectedTransactions(new Set());
    setSelectedEntries(new Set());
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

  // Calcular totais selecionados
  const currentGroup = getCurrentGroup();
  const selectedTransactionTotal = currentGroup 
    ? currentGroup.transactions
        .filter(t => selectedTransactions.has(t.id))
        .reduce((sum, t) => sum + Math.abs(t.valor), 0)
    : 0;

  const selectedEntriesTotal = currentGroup
    ? currentGroup.sheetEntries
        .filter(e => selectedEntries.has(e.id))
        .reduce((sum, e) => sum + e.valorFinal, 0)
    : 0;

  const difference = selectedTransactionTotal - selectedEntriesTotal;
  const isPerfectMatch = Math.abs(difference) < 0.01 && selectedTransactions.size > 0 && selectedEntries.size > 0;

  // Gerar classificação automática
  const generateClassification = (entry: FinancialEntry): {
    subtipo: string;
    categoria: string;
    conta: string;
    descricao: string;
  } => {
    const tipo = entry.tipo.toLowerCase();
    const idContrato = entry.idContrato.toUpperCase();
    
    // Determinar se é Individual ou Coletiva
    const isIndividual = idContrato.includes('IND');
    const isColetiva = idContrato.includes('COL');
    
    // Determinar se é Plano ou Catálogo
    const isPlano = tipo.includes('plano');
    const isCatalogo = tipo.includes('catalogo') || tipo.includes('catálogo');
    
    let subtipo = 'REC. N. ';
    
    if (isPlano) {
      subtipo += 'P. ';
    } else if (isCatalogo) {
      subtipo += 'C. ';
    } else {
      subtipo += 'P. '; // Default para plano
    }
    
    if (isIndividual) {
      subtipo += 'IND.';
    } else if (isColetiva) {
      subtipo += 'COL.';
    } else {
      subtipo += 'IND.'; // Default para individual
    }
    
    return {
      subtipo,
      categoria: 'Receita Nova',
      conta: 'PJ',
      descricao: `Receita Nova ${isPlano ? 'Plano' : 'Catálogo'} ${isIndividual ? 'Individual' : 'Coletiva'} - Contrato ${entry.idContrato}`
    };
  };

  // ✅ FUNÇÃO PARA FORÇAR RECARREGAMENTO DOS DADOS
  const forceDataRefresh = async () => {
    console.log('🔄 Forçando recarregamento dos dados...');
    
    try {
      // Se existe função de refresh do pai, usar ela
      if (onDataRefresh) {
        await onDataRefresh();
      }
      
      // Incrementar key para forçar re-execução do useEffect
      setLastUpdateKey(prev => prev + 1);
      
      // Reset do estado local
      resetSelections();
      
      console.log('✅ Recarregamento forçado concluído');
    } catch (error) {
      console.error('❌ Erro no recarregamento:', error);
    }
  };

  // Executar reconciliação
  const handleReconciliation = async () => {
    if (!currentGroup || !isPerfectMatch) {
      alert('⚠️ Selecione transações e entradas que tenham match perfeito de valor');
      return;
    }

    const selectedTransactionsList = currentGroup.transactions.filter(t => selectedTransactions.has(t.id));
    const selectedEntriesList = currentGroup.sheetEntries.filter(e => selectedEntries.has(e.id));

    const confirmText = 
      `🔗 Reconciliar ${selectedTransactionsList.length} transação(ões) com ${selectedEntriesList.length} entrada(s)?\n\n` +
      `📅 Data: ${currentGroup.displayDate}\n` +
      `💰 Valor: R$ ${formatCurrency(selectedTransactionTotal)}\n\n` +
      `✅ Match Perfeito Confirmado\n\n` +
      `Isso irá classificar as transações selecionadas`;

    if (!window.confirm(confirmText)) return;

    setIsProcessing(true);

    try {
      // ✅ USAR FUNÇÃO EXISTENTE onApplyClassification
      if (onReconcileTransactions) {
        // Se a função de reconciliação existe, usar ela
        const baseTransaction = selectedTransactionsList[0];
        const contractIds = selectedEntriesList.map(e => e.idContrato).join(', ');
        
        const newTransactions = selectedEntriesList.map(entry => {
          const classification = generateClassification(entry);
          
          return {
            conta: classification.conta,
            categoria: classification.categoria,
            subtipo: classification.subtipo,
            descricao: classification.descricao,
            valor: entry.valorFinal,
            data: formatDateToLocal(entry.dataHora),
            origem: baseTransaction.origem,
            cc: baseTransaction.cc,
            mes: baseTransaction.mes,
            descricao_origem: baseTransaction.descricao_origem,
            realizado: 's' as const
          };
        });

        const reconciliationData = {
          originalTransactionIds: selectedTransactionsList.map(t => t.id),
          newTransactions,
          reconciliationNote: `Reconciliado com Contrato(s) ${contractIds}`
        };

        await onReconcileTransactions(reconciliationData);
      } else {
        // ✅ FALLBACK: Usar onApplyClassification (funcionalidade existente)
        const classifications = selectedTransactionsList.map(transaction => {
          // Usar primeira entrada como base para classificação
          const entry = selectedEntriesList[0];
          const classification = generateClassification(entry);
          
          return {
            id: transaction.id,
            conta: classification.conta,
            categoria: classification.categoria,
            subtipo: classification.subtipo,
            descricao: `${classification.descricao} - Reconciliado com Contrato ${entry.idContrato}`
          };
        });

        await onApplyClassification(classifications);
      }

      alert(`✅ Reconciliação concluída!\n\n📝 Transações classificadas com sucesso`);

      // ✅ FORÇAR RECARREGAMENTO DOS DADOS APÓS SUCESSO
      console.log('🔄 Iniciando recarregamento pós-reconciliação...');
      
      // Aguardar um pouco para garantir que o backend processou
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Forçar recarregamento
      await forceDataRefresh();

    } catch (error) {
      console.error('❌ Erro na reconciliação:', error);
      alert('❌ Erro ao executar reconciliação');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              🟣 PIX Inter - Reconciliação Cronológica
            </h3>
            <div className="flex items-center gap-2">
              {/* ✅ BOTÃO DE REFRESH MANUAL */}
              <button
                onClick={forceDataRefresh}
                disabled={isProcessing}
                className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded transition-colors"
                title="Recarregar dados"
              >
                🔄
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* 📅 CALENDÁRIO LINEAR COMPACTO */}
          {dayGroups.length > 0 && (
            <div className="bg-purple-900/30 border border-purple-600 rounded-lg p-2 mb-3">
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
              
              {/* Calendário compacto em linha horizontal */}
              <div className="flex gap-1 overflow-x-auto">
                {dayGroups.map((group, index) => {
                  const isActive = index === currentDayIndex;
                  const hasMatch = group.sheetEntries.length > 0;
                  // ✅ USAR formatDateForDisplay PARA EVITAR BUG DE TIMEZONE
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
                      className={`flex-shrink-0 p-1.5 rounded border transition-all text-center min-w-[45px] ${
                        isActive 
                          ? 'border-purple-400 bg-purple-700' 
                          : hasMatch
                            ? 'border-green-600 bg-green-900/30 hover:bg-green-800/50'
                            : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <div className={`text-sm font-bold ${
                        isActive ? 'text-purple-100' : hasMatch ? 'text-green-100' : 'text-gray-100'
                      }`}>
                        {day}
                      </div>
                      <div className={`text-xs ${
                        isActive ? 'text-purple-200' : hasMatch ? 'text-green-200' : 'text-gray-400'
                      }`}>
                        {month}
                      </div>
                      <div className="flex items-center gap-0.5 justify-center mt-1">
                        <span className={`text-xs px-1 py-0.5 rounded ${
                          isActive ? 'bg-purple-600' : hasMatch ? 'bg-green-600' : 'bg-gray-600'
                        } text-white`}>
                          {group.transactions.length}
                        </span>
                        {hasMatch && (
                          <span className="text-xs px-1 py-0.5 rounded bg-blue-600 text-blue-100">
                            {group.sheetEntries.length}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 💰 BATEDOR DE VALOR COMPACTO */}
          <div className={`rounded p-2 border transition-all text-sm ${
            isPerfectMatch 
              ? 'border-green-500 bg-green-900/30' 
              : selectedTransactions.size > 0 || selectedEntries.size > 0
                ? 'border-yellow-500 bg-yellow-900/30'
                : 'border-gray-600 bg-gray-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-xs">Selecionado:</span>
                <span className="font-medium text-gray-100">
                  R$ {formatCurrency(selectedTransactionTotal)}
                </span>
                <span className="text-gray-500">↔</span>
                <span className="font-medium text-gray-100">
                  R$ {formatCurrency(selectedEntriesTotal)}
                </span>
              </div>
              
              {isPerfectMatch && (
                <div className="flex items-center gap-1 text-green-300">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Match!</span>
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
                <p className="text-gray-400 mb-4">
                  Todas as transações PIX Inter já foram classificadas
                </p>
                {/* ✅ BOTÃO DE REFRESH NA TELA VAZIA */}
                <button
                  onClick={forceDataRefresh}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                >
                  🔄 Recarregar Dados
                </button>
              </div>
            </div>
          ) : currentGroup ? (
            <div className="flex h-full">
              
              {/* COLUNA ESQUERDA: Transações PIX Inter */}
              <div className="w-1/2 border-r border-gray-700 flex flex-col">
                <div className="p-2 border-b border-gray-700 bg-gray-850">
                  <h4 className="font-medium text-gray-100 text-sm">
                    💳 Transações PIX Inter ({currentGroup.transactions.length}) • R$ {formatCurrency(currentGroup.totalTransactionValue)}
                  </h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1">
                  <div className="space-y-1">
                    {/* ✅ LAYOUT EM LINHA ÚNICA */}
                    {[...currentGroup.transactions]
                      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
                      .map(transaction => (
                      <div
                        key={transaction.id}
                        className={`border rounded p-1.5 transition-all cursor-pointer flex items-center gap-2 ${
                          selectedTransactions.has(transaction.id)
                            ? 'border-purple-500 bg-purple-900/20'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                        onClick={() => toggleTransactionSelection(transaction.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(transaction.id)}
                          onChange={() => toggleTransactionSelection(transaction.id)}
                          className="w-3 h-3 rounded border-gray-500 bg-gray-700 flex-shrink-0"
                        />
                        
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-200 truncate block" title={transaction.descricao_origem}>
                              {transaction.descricao_origem}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-bold text-green-400 text-sm">
                              R$ {formatCurrency(Math.abs(transaction.valor))}
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
                <div className="p-2 border-b border-gray-700 bg-gray-850">
                  <h4 className="font-medium text-gray-100 text-sm">
                    📋 Entradas Planilha ({currentGroup.sheetEntries.length}) • R$ {formatCurrency(currentGroup.totalEntriesValue)}
                  </h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1">
                  {currentGroup.sheetEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-red-300 text-sm">Sem entradas PIX para {currentGroup.displayDate}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* ✅ LAYOUT EM LINHA ÚNICA */}
                      {[...currentGroup.sheetEntries]
                        .sort((a, b) => b.valorFinal - a.valorFinal)
                        .map(entry => (
                        <div
                          key={entry.id}
                          className={`border rounded p-1.5 transition-all cursor-pointer flex items-center gap-2 ${
                            selectedEntries.has(entry.id)
                              ? 'border-green-500 bg-green-900/20'
                              : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                          }`}
                          onClick={() => toggleEntrySelection(entry.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(entry.id)}
                            onChange={() => toggleEntrySelection(entry.id)}
                            className="w-3 h-3 rounded border-gray-500 bg-gray-700 flex-shrink-0"
                          />
                          
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="px-1 py-0.5 rounded text-xs font-medium bg-blue-600 text-blue-100 flex-shrink-0">
                                {entry.tipo}
                              </span>
                              <span className="text-xs text-gray-300 truncate">
                                {entry.idContrato}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <div className="font-bold text-green-400 text-sm">
                                R$ {formatCurrency(entry.valorFinal)}
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

        {/* Footer */}
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
                onClick={handleReconciliation}
                disabled={!isPerfectMatch || isProcessing}
                className={`px-6 py-2 rounded transition-colors font-medium flex items-center gap-2 ${
                  isPerfectMatch && !isProcessing
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </>
                ) : isPerfectMatch ? (
                  <>
                    <Zap className="w-4 h-4" />
                    Reconciliar Match Perfeito
                  </>
                ) : (
                  'Selecione Match Perfeito'
                )}
              </button>
            </div>
            
            {isPerfectMatch && (
              <div className="mt-2 text-center">
                <p className="text-xs text-green-300">
                  ✅ Match perfeito detectado! Valores batem exatamente.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}