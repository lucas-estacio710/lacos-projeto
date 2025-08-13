// components/CardMatchingModal.tsx - SISTEMA DE ABAS COM CONTROLE GRANULAR

import React, { useState, useEffect } from 'react';
import { CardTransaction, FaturaMatch } from '@/hooks/useCardTransactions';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CardMatchingModalProps {
  isOpen: boolean;
  faturaId: string;
  matches: FaturaMatch[];
  onClose: () => void;
  onReplace: () => void;
  onMerge: (selectedIds: string[]) => void;
  onCancel: () => void;
}

interface ProcessedMatch {
  id: string;
  transaction: CardTransaction;
  type: 'nao_identificados' | 'suspeitos' | 'identificados' | 'sumiu';
  selected: boolean;
  confidence?: number;
  reason?: string;
}

export function CardMatchingModal({
  isOpen,
  faturaId,
  matches,
  onClose,
  onReplace,
  onMerge,
  onCancel
}: CardMatchingModalProps) {
  const [activeTab, setActiveTab] = useState<'nao_identificados' | 'suspeitos' | 'identificados' | 'sumiu'>('nao_identificados');
  const [processedMatches, setProcessedMatches] = useState<ProcessedMatch[]>([]);

  // Processar matches em categorias mais inteligentes
  useEffect(() => {
    if (!matches.length) return;

    const processed: ProcessedMatch[] = [];

    matches.forEach((match, index) => {
      // CATEGORIA 1: NÃO IDENTIFICADOS (AZUL) - Transações completamente novas
      if (match.tipo === 'NOVO') {
        processed.push({
          id: `novo-${index}`,
          transaction: match.transacaoNova!,
          type: 'nao_identificados',
          selected: true, // Por padrão, criar novas transações
          reason: 'Transação não encontrada na fatura anterior'
        });
      }

      // CATEGORIA 2: IDENTIFICADOS 100% (VERDE) - Matches perfeitos
      else if (match.tipo === 'PERFEITO') {
        processed.push({
          id: `perfeito-${index}`,
          transaction: match.transacaoExistente!,
          type: 'identificados',
          selected: true, // Por padrão, manter existentes
          confidence: 1.0,
          reason: 'Transação idêntica encontrada'
        });
      }

      // CATEGORIA 3: SUSPEITOS (AMARELO) - Matches parciais
      else if (match.tipo === 'QUASE_PERFEITO') {
        processed.push({
          id: `suspeito-${index}`,
          transaction: match.transacaoExistente!,
          type: 'suspeitos',
          selected: true, // Por padrão, manter (mas usuário pode alterar)
          confidence: 0.7,
          reason: `Diferenças: ${match.diferenca?.map(d => d.campo).join(', ')}`
        });
      }

      // CATEGORIA 4: SUMIU (VERMELHO) - Estavam na anterior, não estão na nova
      else if (match.tipo === 'REMOVIDO') {
        processed.push({
          id: `removido-${index}`,
          transaction: match.transacaoExistente!,
          type: 'sumiu',
          selected: false, // Por padrão, NÃO excluir (manter na base)
          reason: 'Não encontrada na nova fatura'
        });
      }
    });

    setProcessedMatches(processed);
  }, [matches]);

  // Filtrar por aba ativa
  const getMatchesForTab = (tab: typeof activeTab) => {
    return processedMatches.filter(m => m.type === tab);
  };

  // Contar por categoria
  const counts = {
    nao_identificados: processedMatches.filter(m => m.type === 'nao_identificados').length,
    suspeitos: processedMatches.filter(m => m.type === 'suspeitos').length,
    identificados: processedMatches.filter(m => m.type === 'identificados').length,
    sumiu: processedMatches.filter(m => m.type === 'sumiu').length
  };

  // Toggle seleção individual
  const toggleSelection = (id: string) => {
    setProcessedMatches(prev => prev.map(match => 
      match.id === id ? { ...match, selected: !match.selected } : match
    ));
  };

  // Selecionar todos da aba atual
  const selectAllInTab = () => {
    const tabMatches = getMatchesForTab(activeTab);
    const allSelected = tabMatches.every(m => m.selected);
    
    setProcessedMatches(prev => prev.map(match => 
      match.type === activeTab ? { ...match, selected: !allSelected } : match
    ));
  };

  // Calcular resultado final
  const calculateResult = () => {
    let willCreate = 0;
    let willKeep = 0;
    let willDelete = 0;
    let finalBillValue = 0;

    // Primeiro, somar TODAS as transações que estarão na fatura final
    const finalTransactions = new Set<string>();

    processedMatches.forEach(match => {
      if (match.type === 'nao_identificados' && match.selected) {
        // Nova transação será criada
        willCreate++;
        finalTransactions.add(`new-${match.transaction.id}`);
        finalBillValue += Math.abs(match.transaction.valor);
      }
      else if (match.type === 'identificados' && match.selected) {
        // Transação existente será mantida
        willKeep++;
        finalTransactions.add(`keep-${match.transaction.id}`);
        finalBillValue += Math.abs(match.transaction.valor);
      }
      else if (match.type === 'identificados' && !match.selected) {
        // Nova versão será criada (ignora a existente)
        willCreate++;
        finalTransactions.add(`new-${match.transaction.id}`);
        finalBillValue += Math.abs(match.transaction.valor);
      }
      else if (match.type === 'suspeitos' && !match.selected) {
        // Mantém a transação suspeita existente
        willKeep++;
        finalTransactions.add(`keep-${match.transaction.id}`);
        finalBillValue += Math.abs(match.transaction.valor);
      }
      else if (match.type === 'suspeitos' && match.selected) {
        // Nova transação será criada (ignora a suspeita)
        willCreate++;
        finalTransactions.add(`new-${match.transaction.id}`);
        finalBillValue += Math.abs(match.transaction.valor);
      }
      else if (match.type === 'sumiu' && !match.selected) {
        // Mantém a transação que "sumiu"
        willKeep++;
        finalTransactions.add(`keep-${match.transaction.id}`);
        finalBillValue += Math.abs(match.transaction.valor);
      }
      else if (match.type === 'sumiu' && match.selected) {
        // Transação será deletada (não conta no valor final)
        willDelete++;
      }
    });

    // Calcular valor da nova fatura original (o que deveria ser)
    const expectedBillValue = [
      ...matches.filter(m => m.tipo === 'NOVO').map(m => m.transacaoNova!),
      ...matches.filter(m => m.tipo === 'PERFEITO').map(m => m.transacaoExistente!),
      ...matches.filter(m => m.tipo === 'QUASE_PERFEITO').map(m => m.transacaoNova || m.transacaoExistente!),
    ].reduce((sum, t) => sum + Math.abs(t.valor), 0);

    const isCorrectValue = Math.abs(finalBillValue - expectedBillValue) < 0.01;

    return { 
      willCreate, 
      willKeep, 
      willDelete, 
      finalBillValue, 
      expectedBillValue,
      isCorrectValue,
      totalTransactions: finalTransactions.size
    };
  };

  const result = calculateResult();

  // Executar merge com as seleções
  const handleMerge = () => {
    const idsToKeep: string[] = [];
    
    processedMatches.forEach(match => {
      // Manter identificados selecionados
      if (match.type === 'identificados' && match.selected) {
        idsToKeep.push(match.transaction.id);
      }
      // Manter suspeitos NÃO selecionados (manter a suspeita existente)
      else if (match.type === 'suspeitos' && !match.selected) {
        idsToKeep.push(match.transaction.id);
      }
      // Manter "sumiu" não selecionados (não excluir)
      else if (match.type === 'sumiu' && !match.selected) {
        idsToKeep.push(match.transaction.id);
      }
    });

    onMerge(idsToKeep);
    onClose();
  };

  // Renderizar transação
  const renderTransaction = (match: ProcessedMatch) => {
    const typeConfig = {
      nao_identificados: { 
        color: 'border-blue-500 bg-blue-900/20', 
        badge: 'bg-blue-600 text-blue-100', 
        icon: '🆕',
        label: 'Não Identificado'
      },
      suspeitos: { 
        color: 'border-yellow-500 bg-yellow-900/20', 
        badge: 'bg-yellow-600 text-yellow-100', 
        icon: '⚠️',
        label: 'Suspeito'
      },
      identificados: { 
        color: 'border-green-500 bg-green-900/20', 
        badge: 'bg-green-600 text-green-100', 
        icon: '✅',
        label: 'Identificado'
      },
      sumiu: { 
        color: 'border-red-500 bg-red-900/20', 
        badge: 'bg-red-600 text-red-100', 
        icon: '🗑️',
        label: 'Sumiu'
      }
    };

    const config = typeConfig[match.type];

    return (
      <div 
        key={match.id}
        className={`border rounded-lg p-3 transition-all ${
          match.selected ? config.color : 'border-gray-600 bg-gray-800'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="mt-1">
            <input
              type="checkbox"
              checked={match.selected}
              onChange={() => toggleSelection(match.id)}
              className="w-4 h-4 rounded border-gray-500 bg-gray-700"
            />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${config.badge}`}>
                  {config.icon} {config.label}
                </span>
                {match.confidence && (
                  <span className="px-2 py-1 rounded text-xs bg-gray-600 text-gray-300">
                    {Math.round(match.confidence * 100)}%
                  </span>
                )}
                {match.transaction.status === 'classified' && (
                  <span className="px-2 py-1 rounded text-xs bg-purple-600 text-purple-200">
                    📝 Classificada
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className={`font-medium text-sm ${
                  match.transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {match.transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(match.transaction.valor))}
                </span>
              </div>
            </div>

            {/* Descrição */}
            <p className="text-sm text-gray-100 font-medium mb-1">
              {match.transaction.descricao_origem}
            </p>

            {/* Detalhes */}
            <div className="text-xs text-gray-400">
              {formatDate(match.transaction.data_transacao)} • {match.transaction.origem}
              {match.transaction.categoria && (
                <span className="text-blue-400 ml-2">
                  • {match.transaction.categoria} → {match.transaction.subtipo}
                </span>
              )}
            </div>

            {/* Razão */}
            {match.reason && (
              <p className="text-xs text-gray-500 mt-1">
                💭 {match.reason}
              </p>
            )}

            {/* Efeito da seleção */}
            <div className="mt-2">
              {match.type === 'nao_identificados' && (
                <p className="text-xs text-blue-300">
                  {match.selected ? '✅ Será criada como nova transação' : '❌ Não será importada'}
                </p>
              )}
              {match.type === 'suspeitos' && (
                <p className="text-xs text-yellow-300">
                  {match.selected ? '🆕 Criará nova transação (ignora a suspeita)' : '✅ Manterá a transação suspeita existente'}
                </p>
              )}
              {match.type === 'identificados' && (
                <p className="text-xs text-green-300">
                  {match.selected ? '✅ Manterá a transação existente' : '🆕 Registrará como nova transação'}
                </p>
              )}
              {match.type === 'sumiu' && (
                <p className="text-xs text-red-300">
                  {match.selected ? '🗑️ Excluirá da base de dados' : '✅ Manterá na base de dados'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-100">
              🔍 Análise de Fatura: {faturaId}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-2xl">
              ×
            </button>
          </div>

          {/* Navegação por abas */}
          <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('nao_identificados')}
              className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'nao_identificados'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <span>🆕 Não Identificados</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                {counts.nao_identificados}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('suspeitos')}
              className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'suspeitos'
                  ? 'bg-yellow-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <span>⚠️ Suspeitos</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                {counts.suspeitos}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('identificados')}
              className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'identificados'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <span>✅ Identificados</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                {counts.identificados}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sumiu')}
              className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'sumiu'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <span>🗑️ Sumiu</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                {counts.sumiu}
              </span>
            </button>
          </div>
        </div>

          {/* Conteúdo da aba */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Disclaimer para Suspeitos */}
          {activeTab === 'suspeitos' && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 text-lg">⚠️</span>
                <div>
                  <p className="text-yellow-100 font-medium text-sm">Atenção: Transações Suspeitas</p>
                  <p className="text-yellow-200 text-xs mt-1">
                    <strong>✅ Marcado:</strong> Criará uma nova transação (ignora a suspeita existente)<br/>
                    <strong>❌ Desmarcado:</strong> Manterá a transação suspeita existente na base
                  </p>
                  <p className="text-yellow-300 text-xs mt-2">
                    💡 Use "marcado" quando tiver certeza que são transações diferentes, mesmo com similaridades
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-100">
              {activeTab === 'nao_identificados' && '🆕 Transações Não Identificadas'}
              {activeTab === 'suspeitos' && '⚠️ Transações Suspeitas'}
              {activeTab === 'identificados' && '✅ Transações Identificadas'}
              {activeTab === 'sumiu' && '🗑️ Transações que Sumiram'}
            </h4>
            
            {getMatchesForTab(activeTab).length > 0 && (
              <button
                onClick={selectAllInTab}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
              >
                {getMatchesForTab(activeTab).every(m => m.selected) ? 'Desmarcar Todas' : 'Selecionar Todas'}
              </button>
            )}
          </div>

          {/* Lista de transações */}
          <div className="space-y-3">
            {getMatchesForTab(activeTab).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">Nenhuma transação nesta categoria</p>
              </div>
            ) : (
              getMatchesForTab(activeTab).map(renderTransaction)
            )}
          </div>
        </div>

        {/* Footer com resultado */}
        <div className="p-4 border-t border-gray-700 bg-gray-850">
          {/* Resumo do resultado */}
          <div className="bg-gray-700 rounded-lg p-3 mb-4">
            <h5 className="font-medium text-gray-100 mb-3">📊 Resultado da Operação:</h5>
            
            {/* Primeira linha: Operações */}
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div className="text-center">
                <p className="text-blue-400 font-medium text-lg">{result.willCreate}</p>
                <p className="text-gray-300 text-xs">Criar</p>
              </div>
              <div className="text-center">
                <p className="text-green-400 font-medium text-lg">{result.willKeep}</p>
                <p className="text-gray-300 text-xs">Manter</p>
              </div>
              <div className="text-center">
                <p className="text-red-400 font-medium text-lg">{result.willDelete}</p>
                <p className="text-gray-300 text-xs">Excluir</p>
              </div>
            </div>

            {/* Segunda linha: Valores */}
            <div className="border-t border-gray-600 pt-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Valor da Fatura Resultante:</p>
                  <p className={`font-bold text-lg ${result.isCorrectValue ? 'text-green-400' : 'text-yellow-400'}`}>
                    R$ {formatCurrency(result.finalBillValue)}
                  </p>
                  <p className="text-gray-500 text-xs">{result.totalTransactions} transações</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Valor Esperado (Nova Fatura):</p>
                  <p className="font-bold text-lg text-blue-400">
                    R$ {formatCurrency(result.expectedBillValue)}
                  </p>
                  <div className="mt-1">
                    {result.isCorrectValue ? (
                      <span className="text-green-400 text-xs flex items-center gap-1">
                        ✅ Valores conferem!
                      </span>
                    ) : (
                      <span className="text-yellow-400 text-xs flex items-center gap-1">
                        ⚠️ Diferença: R$ {formatCurrency(Math.abs(result.finalBillValue - result.expectedBillValue))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => { onReplace(); onClose(); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              🔄 Substituir Tudo
            </button>
            <button
              onClick={handleMerge}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors font-medium"
            >
              🔀 Aplicar Seleções
              <div className="text-xs opacity-90 mt-0.5">
                Fatura final: R$ {formatCurrency(result.finalBillValue)} {result.isCorrectValue ? '✅' : '⚠️'}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}