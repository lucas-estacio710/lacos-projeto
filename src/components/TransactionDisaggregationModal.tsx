// TransactionDisaggregationModal.tsx - MODAL DE DESAGREGAÇÃO DE TRANSAÇÕES

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calculator, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Transaction, FinancialEntry, FinancialSheetData } from '@/types';
import { formatDateToLocal, formatDateForDisplay, isSameDay } from '@/lib/dateUtils';

// Helper para formatação
const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface DisaggregationRule {
  id: string;
  sheetEntryId: string;
  sheetEntry: FinancialEntry;
  targetClassification: {
    conta: string;
    categoria: string;
    subtipo: string;
    descricao: string;
  };
}

interface DisaggregationResult {
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
    realizado: 's';
    reconciliation_metadata: string;
  }>;
  reconciliationSummary: {
    originalTotal: number;
    newTotal: number;
    difference: number;
    isBalanced: boolean;
  };
}

interface TransactionDisaggregationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTransactions: Transaction[];
  sheetData: FinancialSheetData | null;
  onCreateDisaggregatedTransactions: (result: DisaggregationResult) => Promise<void>;
}

const CLASSIFICATION_TEMPLATES = [
  {
    id: 'rec_n_p_ind',
    name: 'Receita Nova Plano Individual',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. P. IND.',
    color: 'bg-green-600'
  },
  {
    id: 'rec_n_p_col',
    name: 'Receita Nova Plano Coletiva',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. P. COL.',
    color: 'bg-green-700'
  },
  {
    id: 'rec_n_c_ind',
    name: 'Receita Nova Catálogo Individual',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. C. IND.',
    color: 'bg-blue-600'
  },
  {
    id: 'rec_n_c_col',
    name: 'Receita Nova Catálogo Coletiva',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. C. COL.',
    color: 'bg-blue-700'
  }
];

export function TransactionDisaggregationModal({
  isOpen,
  onClose,
  selectedTransactions,
  sheetData,
  onCreateDisaggregatedTransactions
}: TransactionDisaggregationModalProps) {
  const [disaggregationRules, setDisaggregationRules] = useState<DisaggregationRule[]>([]);
  const [availableEntries, setAvailableEntries] = useState<FinancialEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);

  // Calcular totais
  const originalTotal = selectedTransactions.reduce((sum, t) => sum + Math.abs(t.valor), 0);
  const newTotal = disaggregationRules.reduce((sum, rule) => sum + rule.sheetEntry.valorFinal, 0);
  const difference = originalTotal - newTotal;
  const isBalanced = Math.abs(difference) < 0.01; // Tolerância de 1 centavo

  // Filtrar entradas da planilha por proximidade de data
  useEffect(() => {
    if (!sheetData || !selectedTransactions.length) {
      setAvailableEntries([]);
      return;
    }

    // Obter datas das transações selecionadas
    const transactionDates = selectedTransactions.map(t => formatDateToLocal(t.data));
    
    // Filtrar entradas da planilha que estão próximas (±3 dias)
    const filtered = sheetData.entries.filter(entry => {
      const entryDate = formatDateToLocal(entry.dataHora);
      
      return transactionDates.some(transDate => {
        const diffDays = Math.abs(
          (new Date(entryDate).getTime() - new Date(transDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 3;
      });
    });

    // Ordenar por proximidade de valor e data
    filtered.sort((a, b) => {
      const aValueDiff = Math.abs(a.valorFinal - originalTotal);
      const bValueDiff = Math.abs(b.valorFinal - originalTotal);
      return aValueDiff - bValueDiff;
    });

    setAvailableEntries(filtered);
  }, [sheetData, selectedTransactions, originalTotal]);

  const addDisaggregationRule = (sheetEntry: FinancialEntry) => {
    // Determinar classificação automática baseada no tipo
    let autoClassification = CLASSIFICATION_TEMPLATES[0]; // Default

    const entryType = sheetEntry.tipo.toLowerCase();
    if (entryType.includes('individual')) {
      if (entryType.includes('plano')) {
        autoClassification = CLASSIFICATION_TEMPLATES.find(t => t.id === 'rec_n_p_ind') || autoClassification;
      } else if (entryType.includes('catalogo') || entryType.includes('catálogo')) {
        autoClassification = CLASSIFICATION_TEMPLATES.find(t => t.id === 'rec_n_c_ind') || autoClassification;
      }
    } else if (entryType.includes('coletiva')) {
      if (entryType.includes('plano')) {
        autoClassification = CLASSIFICATION_TEMPLATES.find(t => t.id === 'rec_n_p_col') || autoClassification;
      } else if (entryType.includes('catalogo') || entryType.includes('catálogo')) {
        autoClassification = CLASSIFICATION_TEMPLATES.find(t => t.id === 'rec_n_c_col') || autoClassification;
      }
    }

    const newRule: DisaggregationRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sheetEntryId: sheetEntry.id,
      sheetEntry,
      targetClassification: {
        conta: autoClassification.conta,
        categoria: autoClassification.categoria,
        subtipo: autoClassification.subtipo,
        descricao: `${autoClassification.name} - ${sheetEntry.tipo} - Contrato ${sheetEntry.idContrato}`
      }
    };

    setDisaggregationRules(prev => [...prev, newRule]);
  };

  const removeDisaggregationRule = (ruleId: string) => {
    setDisaggregationRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const updateRuleClassification = (ruleId: string, field: string, value: string) => {
    setDisaggregationRules(prev => prev.map(rule => {
      if (rule.id === ruleId) {
        return {
          ...rule,
          targetClassification: {
            ...rule.targetClassification,
            [field]: value
          }
        };
      }
      return rule;
    }));
  };

  const handleAutoMatch = () => {
    // Lógica de matching automático
    if (!sheetData) return;

    const candidates = availableEntries.slice(0, 5); // Top 5 candidatos
    const autoRules: DisaggregationRule[] = [];

    for (const entry of candidates) {
      // Verificar se já não foi adicionado
      if (disaggregationRules.some(rule => rule.sheetEntryId === entry.id)) continue;

      autoRules.push({
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sheetEntryId: entry.id,
        sheetEntry: entry,
        targetClassification: {
          conta: 'PJ',
          categoria: 'Receita Nova',
          subtipo: entry.tipo.includes('Individual') ? 'REC. N. P. IND.' : 'REC. N. P. COL.',
          descricao: `Receita Nova - ${entry.tipo} - Contrato ${entry.idContrato}`
        }
      });

      // Parar se chegou próximo do valor total
      const currentTotal = [...disaggregationRules, ...autoRules].reduce((sum, r) => sum + r.sheetEntry.valorFinal, 0);
      if (Math.abs(currentTotal - originalTotal) < originalTotal * 0.1) break; // 10% de tolerância
    }

    setDisaggregationRules(prev => [...prev, ...autoRules]);
  };

  const handleExecuteDisaggregation = async () => {
    if (!isBalanced && !window.confirm(`⚠️ Os valores não estão balanceados (diferença: R$ ${formatCurrency(Math.abs(difference))}). Deseja continuar?`)) {
      return;
    }

    setIsProcessing(true);

    try {
      // Preparar transações para criação
      const newTransactions = disaggregationRules.map(rule => {
        const baseTransaction = selectedTransactions[0]; // Usar primeira como base
        
        return {
          conta: rule.targetClassification.conta,
          categoria: rule.targetClassification.categoria,
          subtipo: rule.targetClassification.subtipo,
          descricao: rule.targetClassification.descricao,
          valor: rule.sheetEntry.valorFinal,
          data: formatDateToLocal(rule.sheetEntry.dataHora),
          origem: baseTransaction.origem,
          cc: baseTransaction.cc,
          mes: baseTransaction.mes,
          realizado: 's' as const,
          reconciliation_metadata: JSON.stringify({
            type: 'disaggregation',
            originalTransactionIds: selectedTransactions.map(t => t.id),
            sheetEntryId: rule.sheetEntryId,
            createdAt: new Date().toISOString()
          })
        };
      });

      const result: DisaggregationResult = {
        originalTransactionIds: selectedTransactions.map(t => t.id),
        newTransactions,
        reconciliationSummary: {
          originalTotal,
          newTotal,
          difference,
          isBalanced
        }
      };

      await onCreateDisaggregatedTransactions(result);

      alert(`✅ Desagregação concluída!\n\n📝 ${newTransactions.length} novas transações criadas\n💰 Valor total: R$ ${formatCurrency(newTotal)}`);
      onClose();

    } catch (error) {
      console.error('❌ Erro na desagregação:', error);
      alert('❌ Erro ao executar desagregação');
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
              🧮 Desagregação de Transações
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Resumo das transações originais */}
          <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 mb-4">
            <h4 className="text-blue-100 font-medium mb-2">📊 Transações Selecionadas</h4>
            <div className="space-y-1">
              {selectedTransactions.map(transaction => (
                <div key={transaction.id} className="text-sm text-blue-200">
                  {transaction.descricao_origem} • {formatDateForDisplay(transaction.data)} • R$ {formatCurrency(Math.abs(transaction.valor))}
                </div>
              ))}
              <div className="pt-2 border-t border-blue-600 font-medium text-blue-100">
                Total: R$ {formatCurrency(originalTotal)}
              </div>
            </div>
          </div>

          {/* Controles */}
          <div className="flex gap-3">
            <button
              onClick={handleAutoMatch}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors flex items-center gap-2"
            >
              <Calculator className="w-4 h-4" />
              Auto Match
            </button>
            
            <button
              onClick={() => setShowAdvancedMode(!showAdvancedMode)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              {showAdvancedMode ? 'Modo Simples' : 'Modo Avançado'}
            </button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-hidden flex">
          
          {/* COLUNA ESQUERDA: Entradas Disponíveis */}
          <div className="w-1/2 border-r border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700 bg-gray-850">
              <h4 className="font-medium text-gray-100">
                📋 Entradas da Planilha ({availableEntries.length})
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Entradas próximas em data (±3 dias)
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {availableEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Nenhuma entrada encontrada na planilha</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableEntries.map(entry => {
                    const isAlreadySelected = disaggregationRules.some(rule => rule.sheetEntryId === entry.id);
                    
                    return (
                      <div
                        key={entry.id}
                        className={`border rounded-lg p-3 transition-all ${
                          isAlreadySelected 
                            ? 'border-green-500 bg-green-900/20 opacity-50'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500 cursor-pointer'
                        }`}
                        onClick={() => !isAlreadySelected && addDisaggregationRule(entry)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-blue-100">
                            {entry.tipo}
                          </span>
                          <span className="font-medium text-green-400">
                            R$ {formatCurrency(entry.valorFinal)}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-100 mb-1">
                          Contrato {entry.idContrato}
                        </p>
                        
                        <div className="text-xs text-gray-400">
                          {formatDateForDisplay(entry.dataHora)} • {entry.metodo} • {entry.cc}
                        </div>
                        
                        {isAlreadySelected && (
                          <div className="mt-2 text-xs text-green-300 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Já selecionada
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: Regras de Desagregação */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b border-gray-700 bg-gray-850">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-100">
                  ⚙️ Regras de Desagregação ({disaggregationRules.length})
                </h4>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    isBalanced ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'
                  }`}>
                    {isBalanced ? '✅ Balanceado' : '⚠️ Desbalanceado'}
                  </span>
                </div>
              </div>
              
              {/* Resumo financeiro */}
              <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-700 rounded p-2 text-center">
                  <div className="text-gray-400">Original</div>
                  <div className="text-white font-bold">R$ {formatCurrency(originalTotal)}</div>
                </div>
                <div className="bg-gray-700 rounded p-2 text-center">
                  <div className="text-gray-400">Novo Total</div>
                  <div className="text-white font-bold">R$ {formatCurrency(newTotal)}</div>
                </div>
                <div className="bg-gray-700 rounded p-2 text-center">
                  <div className="text-gray-400">Diferença</div>
                  <div className={`font-bold ${difference === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    R$ {formatCurrency(Math.abs(difference))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {disaggregationRules.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Selecione entradas da planilha para criar regras</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {disaggregationRules.map(rule => (
                    <div key={rule.id} className="border border-gray-600 bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-green-100">
                            {rule.sheetEntry.tipo}
                          </span>
                          <span className="font-medium text-green-400">
                            R$ {formatCurrency(rule.sheetEntry.valorFinal)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeDisaggregationRule(rule.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-sm text-gray-100 mb-2">
                        Contrato {rule.sheetEntry.idContrato}
                      </div>

                      {showAdvancedMode && (
                        <div className="space-y-2 pt-2 border-t border-gray-700">
                          <div>
                            <label className="text-xs text-gray-400">Categoria:</label>
                            <input
                              type="text"
                              value={rule.targetClassification.categoria}
                              onChange={(e) => updateRuleClassification(rule.id, 'categoria', e.target.value)}
                              className="w-full mt-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400">Subtipo:</label>
                            <input
                              type="text"
                              value={rule.targetClassification.subtipo}
                              onChange={(e) => updateRuleClassification(rule.id, 'subtipo', e.target.value)}
                              className="w-full mt-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400">Descrição:</label>
                            <input
                              type="text"
                              value={rule.targetClassification.descricao}
                              onChange={(e) => updateRuleClassification(rule.id, 'descricao', e.target.value)}
                              className="w-full mt-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-850">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            
            <div className="flex-1" />
            
            <button
              onClick={handleExecuteDisaggregation}
              disabled={disaggregationRules.length === 0 || isProcessing}
              className={`px-6 py-2 rounded transition-colors font-medium flex items-center gap-2 ${
                disaggregationRules.length > 0 && !isProcessing
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Executar Desagregação ({disaggregationRules.length})
                </>
              )}
            </button>
          </div>
          
          {!isBalanced && disaggregationRules.length > 0 && (
            <div className="mt-2 text-center">
              <p className="text-xs text-yellow-300">
                ⚠️ Valores desbalanceados. Diferença: R$ {formatCurrency(Math.abs(difference))}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}