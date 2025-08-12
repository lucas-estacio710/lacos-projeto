import React, { useState } from 'react';
import { FaturaAnalysis } from '@/types';
import { formatCurrency, formatMonth } from '@/lib/utils';
import { formatAnalysisSummary, calculateCorrectionsImpact } from '@/lib/faturaComparison';

interface FaturaAnalysisModalProps {
  isOpen: boolean;
  analysisData: FaturaAnalysis | null;
  onClose: () => void;
  onApplyCorrections: (corrections: FaturaAnalysis) => void;
}

export function FaturaAnalysisModal({ 
  isOpen, 
  analysisData, 
  onClose, 
  onApplyCorrections 
}: FaturaAnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'matched' | 'changed' | 'removed' | 'added'>('summary');

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const handleApplyCorrections = () => {
    if (analysisData) {
      onApplyCorrections(analysisData);
      onClose();
    }
  };

  if (!isOpen || !analysisData) return null;

  const impact = calculateCorrectionsImpact(analysisData);
  const needsCorrections = analysisData.changed.length > 0 || 
                          analysisData.removed.length > 0 || 
                          analysisData.added.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-100 flex items-center">
              <span className="mr-2">📊</span>
              Análise da Fatura
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Resumo geral */}
          <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-4 mb-6 border border-purple-700">
            <h4 className="font-medium text-purple-100 mb-2">📋 Resumo da Análise</h4>
            <p className="text-purple-200 text-sm mb-3">{formatAnalysisSummary(analysisData)}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-green-400 text-xl font-bold">{analysisData.matched.length}</p>
                <p className="text-green-300 text-xs">Confirmadas</p>
              </div>
              <div className="text-center">
                <p className="text-yellow-400 text-xl font-bold">{analysisData.changed.length}</p>
                <p className="text-yellow-300 text-xs">Alteradas</p>
              </div>
              <div className="text-center">
                <p className="text-red-400 text-xl font-bold">{analysisData.removed.length}</p>
                <p className="text-red-300 text-xs">Removidas</p>
              </div>
              <div className="text-center">
                <p className="text-blue-400 text-xl font-bold">{analysisData.added.length}</p>
                <p className="text-blue-300 text-xs">Novas</p>
              </div>
            </div>
            
            {Math.abs(analysisData.totalDifference) > 0.01 && (
              <div className="mt-3 pt-3 border-t border-purple-600">
                <p className="text-center">
                  <span className="text-purple-300 text-sm">Diferença total: </span>
                  <span className={`font-bold ${analysisData.totalDifference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {analysisData.totalDifference >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(analysisData.totalDifference))}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Abas de navegação */}
          <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
            {[
              { id: 'summary', label: 'Resumo', count: null },
              { id: 'matched', label: 'Confirmadas', count: analysisData.matched.length },
              { id: 'changed', label: 'Alteradas', count: analysisData.changed.length },
              { id: 'removed', label: 'Removidas', count: analysisData.removed.length },
              { id: 'added', label: 'Novas', count: analysisData.added.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="ml-1 text-xs opacity-75">({tab.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Conteúdo das abas */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6 min-h-[300px]">
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-900 border border-green-700 rounded-lg p-4">
                    <h5 className="text-green-100 font-medium mb-2">✅ Transações Confirmadas</h5>
                    <p className="text-green-200 text-sm">
                      {analysisData.matched.length} transações foram encontradas exatamente como projetadas.
                    </p>
                    <p className="text-green-300 text-xs mt-2">
                      Valor: R$ {formatCurrency(analysisData.matched.reduce((sum, t) => sum + Math.abs(t.valor), 0))}
                    </p>
                  </div>
                  
                  <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
                    <h5 className="text-yellow-100 font-medium mb-2">⚠️ Transações Alteradas</h5>
                    <p className="text-yellow-200 text-sm">
                      {analysisData.changed.length} transações tiveram valores ou detalhes modificados.
                    </p>
                    <p className="text-yellow-300 text-xs mt-2">
                      Diferença: R$ {formatCurrency(Math.abs(analysisData.changed.reduce((sum, c) => sum + (c.newValue - c.future.valor), 0)))}
                    </p>
                  </div>
                  
                  <div className="bg-red-900 border border-red-700 rounded-lg p-4">
                    <h5 className="text-red-100 font-medium mb-2">❌ Transações Removidas</h5>
                    <p className="text-red-200 text-sm">
                      {analysisData.removed.length} transações projetadas não apareceram na fatura real.
                    </p>
                    <p className="text-red-300 text-xs mt-2">
                      Valor: R$ {formatCurrency(analysisData.removed.reduce((sum, t) => sum + Math.abs(t.valor), 0))}
                    </p>
                  </div>
                  
                  <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
                    <h5 className="text-blue-100 font-medium mb-2">➕ Transações Novas</h5>
                    <p className="text-blue-200 text-sm">
                      {analysisData.added.length} transações não previstas apareceram na fatura real.
                    </p>
                    <p className="text-blue-300 text-xs mt-2">
                      Valor: R$ {formatCurrency(analysisData.added.reduce((sum, t) => sum + Math.abs(t.valor), 0))}
                    </p>
                  </div>
                </div>
                
                {needsCorrections && (
                  <div className="bg-purple-900 border border-purple-700 rounded-lg p-4">
                    <h5 className="text-purple-100 font-medium mb-2">🔧 Impacto das Correções</h5>
                    <p className="text-purple-200 text-sm">{impact.description}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'matched' && (
              <div>
                <h5 className="text-green-100 font-medium mb-3">✅ Transações Confirmadas ({analysisData.matched.length})</h5>
                {analysisData.matched.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nenhuma transação confirmada</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {analysisData.matched.map((future, idx) => (
                      <div key={`${future.id}-${idx}`} className="bg-green-900 border border-green-700 rounded p-3 flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-green-100 font-medium">{future.estabelecimento}</p>
                          <p className="text-green-300 text-sm">{formatDate(future.data_vencimento)}</p>
                        </div>
                        <span className="text-green-400 font-medium">
                          R$ {formatCurrency(Math.abs(future.valor))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'changed' && (
              <div>
                <h5 className="text-yellow-100 font-medium mb-3">⚠️ Transações Alteradas ({analysisData.changed.length})</h5>
                {analysisData.changed.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nenhuma transação alterada</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {analysisData.changed.map((change, idx) => (
                      <div key={`${change.future.id}-${idx}`} className="bg-yellow-900 border border-yellow-700 rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-yellow-100 font-medium">{change.future.estabelecimento}</p>
                            <p className="text-yellow-300 text-sm">{formatDate(change.future.data_vencimento)}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-yellow-300">
                            Projetado: R$ {formatCurrency(Math.abs(change.future.valor))}
                          </span>
                          <span className="text-yellow-100 font-medium">
                            Real: R$ {formatCurrency(Math.abs(change.newValue))}
                          </span>
                          <span className={`font-medium ${
                            change.newValue > change.future.valor ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {change.newValue > change.future.valor ? '+' : ''}
                            R$ {formatCurrency(Math.abs(change.newValue - change.future.valor))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'removed' && (
              <div>
                <h5 className="text-red-100 font-medium mb-3">❌ Transações Removidas ({analysisData.removed.length})</h5>
                {analysisData.removed.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nenhuma transação removida</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {analysisData.removed.map((future, idx) => (
                      <div key={`${future.id}-${idx}`} className="bg-red-900 border border-red-700 rounded p-3 flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-red-100 font-medium">{future.estabelecimento}</p>
                          <p className="text-red-300 text-sm">{formatDate(future.data_vencimento)}</p>
                          <p className="text-red-400 text-xs">Esta transação não apareceu na fatura real</p>
                        </div>
                        <span className="text-red-400 font-medium">
                          R$ {formatCurrency(Math.abs(future.valor))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'added' && (
              <div>
                <h5 className="text-blue-100 font-medium mb-3">➕ Transações Novas ({analysisData.added.length})</h5>
                {analysisData.added.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nenhuma transação nova</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {analysisData.added.map((transaction, idx) => (
                      <div key={`${transaction.id}-${idx}`} className="bg-blue-900 border border-blue-700 rounded p-3 flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-blue-100 font-medium">{transaction.descricao_origem}</p>
                          <p className="text-blue-300 text-sm">{formatDate(transaction.data)}</p>
                          <p className="text-blue-400 text-xs">Transação não prevista que apareceu na fatura</p>
                        </div>
                        <span className="text-blue-400 font-medium">
                          R$ {formatCurrency(Math.abs(transaction.valor))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="space-y-4">
            {needsCorrections && (
              <div className="bg-orange-900 border border-orange-700 rounded-lg p-4">
                <h4 className="text-orange-100 font-medium mb-2">🔧 Correções Necessárias</h4>
                <p className="text-orange-200 text-sm mb-3">
                  A fatura real difere da projeção. Aplicar correções irá:
                </p>
                <ul className="text-orange-300 text-sm space-y-1 mb-3">
                  {analysisData.changed.length > 0 && (
                    <li>• Atualizar {analysisData.changed.length} transações com novos valores</li>
                  )}
                  {analysisData.removed.length > 0 && (
                    <li>• Remover {analysisData.removed.length} transações que não ocorreram</li>
                  )}
                  {analysisData.added.length > 0 && (
                    <li>• Criar {analysisData.added.length} novas transações não previstas</li>
                  )}
                </ul>
                <p className="text-orange-200 text-sm font-medium">{impact.description}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                {needsCorrections ? 'Cancelar' : 'Fechar'}
              </button>
              
              {!needsCorrections && (
                <button
                  onClick={onClose}
                  className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded transition-colors font-medium"
                >
                  ✅ Fatura Confirmada
                </button>
              )}
              
              {needsCorrections && (
                <button
                  onClick={handleApplyCorrections}
                  className="flex-1 py-2 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors font-medium"
                >
                  🔧 Aplicar Correções
                </button>
              )}
            </div>
          </div>

          {/* Informações adicionais */}
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span>💡</span>
              <span>
                {needsCorrections 
                  ? 'Recomendamos aplicar as correções antes de prosseguir com a reconciliação.'
                  : 'A fatura está conforme a projeção e pode ser reconciliada normalmente.'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}