// Componente exemplo: Dropdown de classificação usando nova hierarquia

import React, { useState } from 'react';
import { useHierarchy } from '@/hooks/useHierarchy';
import { 
  prepareClassificationOptions, 
  groupClassificationByAccount,
  getTransactionHierarchy 
} from '@/lib/hierarchyHelpers';
import { Transaction } from '@/types';

interface TransactionClassificationDropdownProps {
  transaction?: Transaction;
  onClassificationChange: (subtipo_id: string, hierarchy: any) => void;
  contaFilter?: string; // Filtrar por conta específica
  className?: string;
}

export function TransactionClassificationDropdown({
  transaction,
  onClassificationChange,
  contaFilter,
  className = ''
}: TransactionClassificationDropdownProps) {
  const { visaoPlana, loading } = useHierarchy();
  const [selectedSubtipoId, setSelectedSubtipoId] = useState(transaction?.subtipo_id || '');

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Preparar opções para dropdown
  const options = prepareClassificationOptions(visaoPlana, contaFilter);
  const groupedOptions = groupClassificationByAccount(visaoPlana);

  const handleChange = (subtipo_id: string) => {
    setSelectedSubtipoId(subtipo_id);
    
    // Encontrar dados completos da hierarquia
    const hierarchy = visaoPlana.find(item => item.subtipo_id === subtipo_id);
    
    if (hierarchy) {
      onClassificationChange(subtipo_id, hierarchy);
    }
  };

  // Determinar valor atual
  const currentValue = selectedSubtipoId || (
    transaction ? getTransactionHierarchy(transaction, visaoPlana)?.subtipo_id || '' : ''
  );

  return (
    <div className="space-y-2">
      {/* Dropdown Simples */}
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      >
        <option value="">Selecione uma classificação...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Preview da classificação atual */}
      {currentValue && (
        <TransactionClassificationPreview 
          subtipo_id={currentValue} 
          visaoPlana={visaoPlana}
        />
      )}
    </div>
  );
}

// Componente auxiliar para mostrar preview da classificação
interface TransactionClassificationPreviewProps {
  subtipo_id: string;
  visaoPlana: any[];
}

function TransactionClassificationPreview({ 
  subtipo_id, 
  visaoPlana 
}: TransactionClassificationPreviewProps) {
  const hierarchy = visaoPlana.find(item => item.subtipo_id === subtipo_id);
  
  if (!hierarchy) return null;

  return (
    <div className="bg-gray-50 p-3 rounded-md border text-sm">
      <div className="flex items-center space-x-2">
        {/* Ícone da conta */}
        <span className="text-lg" title={hierarchy.conta_nome}>
          {hierarchy.conta_icone || '📁'}
        </span>
        
        {/* Separador */}
        <span className="text-gray-400">{'>'}</span>
        
        {/* Ícone da categoria */}
        <span className="text-lg" title={hierarchy.categoria_nome}>
          {hierarchy.categoria_icone || '📂'}
        </span>
        
        {/* Separador */}
        <span className="text-gray-400">{'>'}</span>
        
        {/* Ícone do subtipo */}
        <span className="text-lg" title={hierarchy.subtipo_nome}>
          {hierarchy.subtipo_icone || '📄'}
        </span>
        
        {/* Caminho completo */}
        <span className="text-gray-600 flex-1">
          {hierarchy.caminho_completo}
        </span>
      </div>
    </div>
  );
}

// Componente para dropdown agrupado por conta
export function GroupedTransactionClassificationDropdown({
  transaction,
  onClassificationChange,
  className = ''
}: Omit<TransactionClassificationDropdownProps, 'contaFilter'>) {
  const { visaoPlana, loading } = useHierarchy();
  const [selectedSubtipoId, setSelectedSubtipoId] = useState(transaction?.subtipo_id || '');

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const groupedOptions = groupClassificationByAccount(visaoPlana);

  const handleChange = (subtipo_id: string) => {
    setSelectedSubtipoId(subtipo_id);
    
    const hierarchy = visaoPlana.find(item => item.subtipo_id === subtipo_id);
    
    if (hierarchy) {
      onClassificationChange(subtipo_id, hierarchy);
    }
  };

  const currentValue = selectedSubtipoId || (
    transaction ? getTransactionHierarchy(transaction, visaoPlana)?.subtipo_id || '' : ''
  );

  return (
    <div className="space-y-2">
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      >
        <option value="">Selecione uma classificação...</option>
        {Object.entries(groupedOptions).map(([conta, options]) => (
          <optgroup key={conta} label={conta}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {currentValue && (
        <TransactionClassificationPreview 
          subtipo_id={currentValue} 
          visaoPlana={visaoPlana}
        />
      )}
    </div>
  );
}

// Hook personalizado para usar classificação de transações
export function useTransactionClassification(transaction?: Transaction) {
  const { visaoPlana } = useHierarchy();
  
  const getHierarchy = () => {
    if (!transaction) return null;
    return getTransactionHierarchy(transaction, visaoPlana);
  };

  const getIcon = () => {
    const hierarchy = getHierarchy();
    return hierarchy?.subtipo_icone || hierarchy?.categoria_icone || hierarchy?.conta_icone || '📄';
  };

  const getPath = () => {
    const hierarchy = getHierarchy();
    return hierarchy?.caminho_completo || `${transaction?.conta} > ${transaction?.categoria} > ${transaction?.subtipo}`;
  };

  const isUsingNewSystem = () => {
    return !!transaction?.subtipo_id;
  };

  return {
    hierarchy: getHierarchy(),
    icon: getIcon(),
    path: getPath(),
    isUsingNewSystem: isUsingNewSystem()
  };
}