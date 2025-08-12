// hooks/useSimpleUndo.ts - Sistema Simplificado de Desfazer

import { useState, useEffect, useCallback } from 'react';

export interface UndoAction {
  id: string;
  type: 'UPDATE_TRANSACTION' | 'UPDATE_FUTURE' | 'DELETE_TRANSACTION' | 'QUICK_CLASSIFY';
  timestamp: string;
  previousState: any;
  targetId: string;
  description: string;
  tableName: 'transactions' | 'future_transactions';
}

const STORAGE_KEY = 'lacos_undo_history';
const MAX_HISTORY_SIZE = 10;

export function useSimpleUndo() {
  const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  // Carregar histórico do localStorage na inicialização
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UndoAction[];
        // Validar estrutura básica
        if (Array.isArray(parsed)) {
          setUndoHistory(parsed.slice(-MAX_HISTORY_SIZE));
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar histórico de undo:', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Salvar no localStorage sempre que o histórico mudar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(undoHistory));
    } catch (error) {
      console.warn('Erro ao salvar histórico de undo:', error);
    }
  }, [undoHistory]);

  // Adicionar nova ação ao histórico
  const pushUndoAction = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    if (isUndoing) return; // Não registrar durante undo
    
    const undoAction: UndoAction = {
      ...action,
      id: `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    console.log('📝 Registrando ação para undo:', undoAction.description);

    setUndoHistory(prev => {
      const newHistory = [...prev, undoAction];
      // Manter apenas as últimas MAX_HISTORY_SIZE ações
      return newHistory.slice(-MAX_HISTORY_SIZE);
    });
  }, [isUndoing]);

  // Obter a última ação disponível
  const getLastAction = useCallback((): UndoAction | null => {
    return undoHistory.length > 0 ? undoHistory[undoHistory.length - 1] : null;
  }, [undoHistory]);

  // Verificar se há ações para desfazer
  const canUndo = useCallback((): boolean => {
    return undoHistory.length > 0 && !isUndoing;
  }, [undoHistory.length, isUndoing]);

  // Remover a última ação do histórico (após undo bem-sucedido)
  const popLastAction = useCallback(() => {
    setUndoHistory(prev => prev.slice(0, -1));
  }, []);

  // Limpar todo o histórico
  const clearHistory = useCallback(() => {
    setUndoHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Erro ao limpar histórico:', error);
    }
  }, []);

  // Obter resumo do histórico para debug
  const getHistorySummary = useCallback(() => {
    return undoHistory.map(action => ({
      description: action.description,
      type: action.type,
      timestamp: action.timestamp,
      targetId: action.targetId
    }));
  }, [undoHistory]);

  // Marcar/desmarcar estado de undo em progresso
  const setUndoInProgress = useCallback((inProgress: boolean) => {
    setIsUndoing(inProgress);
  }, []);

  // Utilitário para formatar timestamp legível
  const formatActionTime = useCallback((timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffMinutes < 1) return 'agora';
      if (diffMinutes === 1) return '1 minuto atrás';
      if (diffMinutes < 60) return `${diffMinutes} minutos atrás`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours === 1) return '1 hora atrás';
      if (diffHours < 24) return `${diffHours} horas atrás`;
      
      return date.toLocaleDateString('pt-BR');
    } catch {
      return 'tempo inválido';
    }
  }, []);

  return {
    // Estado
    undoHistory,
    isUndoing,
    
    // Ações principais
    pushUndoAction,
    popLastAction,
    clearHistory,
    setUndoInProgress,
    
    // Consultas
    getLastAction,
    canUndo,
    getHistorySummary,
    formatActionTime,
    
    // Estatísticas
    historySize: undoHistory.length,
    maxHistorySize: MAX_HISTORY_SIZE,
  };
}