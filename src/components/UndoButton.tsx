// components/UndoButton.tsx - Componente do Botão Desfazer

import React, { useState } from 'react';
import { useIntegratedUndo } from '@/hooks/useIntegratedUndo';

interface UndoButtonProps {
  onUndoSuccess?: (message: string) => void;
  onUndoError?: (error: string) => void;
}

export function UndoButton({ onUndoSuccess, onUndoError }: UndoButtonProps) {
  const {
    executeUndo,
    canUndo,
    getLastActionDescription,
    getUndoStats,
    historySize
  } = useIntegratedUndo();

  const [isExecuting, setIsExecuting] = useState(false);

  const handleUndo = async () => {
    if (!canUndo() || isExecuting) return;

    setIsExecuting(true);
    
    try {
      const result = await executeUndo();
      
      if (result.success) {
        console.log('✅ Undo executado com sucesso:', result.message);
        onUndoSuccess?.(result.message);
        
        // Mostrar notificação de sucesso
        if (typeof window !== 'undefined') {
          // Simples alert por enquanto - pode ser substituído por toast
          alert(result.message);
        }
      } else {
        console.error('❌ Erro no undo:', result.message);
        onUndoError?.(result.message);
        
        // Mostrar erro
        if (typeof window !== 'undefined') {
          alert(`❌ ${result.message}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado';
      console.error('❌ Erro no handleUndo:', error);
      onUndoError?.(errorMessage);
      
      if (typeof window !== 'undefined') {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const lastActionDescription = getLastActionDescription();
  const stats = getUndoStats();

  // Se não há ações para desfazer, não mostrar o botão
  if (!canUndo()) {
    return null;
  }

  return (
    <div className="relative group">
      <button
        onClick={handleUndo}
        disabled={!canUndo() || isExecuting}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
          canUndo() && !isExecuting
            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-sm hover:shadow-md hover:scale-105'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
        title={lastActionDescription || 'Nenhuma ação para desfazer'}
      >
        {isExecuting ? (
          // Spinner de loading
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          // Ícone de undo
          <span className="text-lg leading-none">↶</span>
        )}
      </button>

      {/* Tooltip com informações detalhadas */}
      {canUndo() && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 shadow-lg border border-gray-700">
          <div className="space-y-1">
            <div className="font-medium text-orange-300">
              ↶ Desfazer
            </div>
            {lastActionDescription && (
              <div className="text-gray-300">
                {lastActionDescription}
              </div>
            )}
            <div className="text-gray-400 text-xs">
              {historySize} ação{historySize !== 1 ? 'ões' : ''} disponível{historySize !== 1 ? 'eis' : ''}
            </div>
          </div>
          
          {/* Seta do tooltip */}
          <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

export default UndoButton;