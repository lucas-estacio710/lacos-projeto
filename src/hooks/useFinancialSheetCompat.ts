// hooks/useFinancialSheetCompat.ts - HOOK DE COMPATIBILIDADE PARA UNIFICAR TIPOS

import { useMemo } from 'react';
import { 
  FinancialSheetData, 
  LegacyFinancialSheetData,
  adaptLegacyToUnified,
  ensureUnifiedFormat,
  isLegacyFormat
} from '@/types';

/**
 * Hook para garantir compatibilidade entre formatos de dados financeiros
 * Converte automaticamente entre formato legado e novo formato unificado
 */
export const useFinancialSheetCompat = (
  rawData: FinancialSheetData | LegacyFinancialSheetData | null
): {
  data: FinancialSheetData | null;
  isLegacyFormat: boolean;
  hasCompatibilityIssues: boolean;
  conversionLog: string[];
} => {
  
  const result = useMemo(() => {
    const conversionLog: string[] = [];
    
    if (!rawData) {
      return {
        data: null,
        isLegacyFormat: false,
        hasCompatibilityIssues: false,
        conversionLog: []
      };
    }

    // Verificar se é formato legado
    const isLegacy = isLegacyFormat(rawData);
    
    if (isLegacy) {
      conversionLog.push('🔄 Detectado formato legado de dados financeiros');
      
      try {
        const convertedData = adaptLegacyToUnified(rawData);
        conversionLog.push('✅ Conversão para formato unificado bem-sucedida');
        conversionLog.push(`📊 Entradas: ${convertedData.entries.length}`);
        conversionLog.push(`💰 Valor total: R$ ${convertedData.summary.totalValue.toFixed(2)}`);
        conversionLog.push(`📅 Período: ${convertedData.summary.dateRange.start} até ${convertedData.summary.dateRange.end}`);
        
        return {
          data: convertedData,
          isLegacyFormat: true,
          hasCompatibilityIssues: false,
          conversionLog
        };
      } catch (error) {
        conversionLog.push(`❌ Erro na conversão: ${error}`);
        
        return {
          data: null,
          isLegacyFormat: true,
          hasCompatibilityIssues: true,
          conversionLog
        };
      }
    } else {
      // Dados já estão no formato unificado
      conversionLog.push('✅ Dados já estão no formato unificado');
      
      // Verificar se a estrutura está completa
      const data = rawData as FinancialSheetData;
      const hasIssues = 
        !data.summary.totalEntries ||
        !data.summary.dateRange ||
        !data.summary.dateRange.start ||
        !data.summary.dateRange.end;
      
      if (hasIssues) {
        conversionLog.push('⚠️ Estrutura incompleta detectada - alguns campos podem estar faltando');
      }
      
      return {
        data,
        isLegacyFormat: false,
        hasCompatibilityIssues: hasIssues,
        conversionLog
      };
    }
  }, [rawData]);

  return result;
};

/**
 * Hook simplificado que sempre retorna dados no formato unificado
 */
export const useUnifiedFinancialData = (
  rawData: FinancialSheetData | LegacyFinancialSheetData | null
): FinancialSheetData | null => {
  return useMemo(() => {
    return ensureUnifiedFormat(rawData);
  }, [rawData]);
};

/**
 * Helper para logging de debug de compatibilidade
 */
export const logCompatibilityInfo = (
  data: any,
  componentName: string = 'Unknown'
): void => {
  if (!data) {
    console.log(`🔍 [${componentName}] Nenhum dado financeiro fornecido`);
    return;
  }

  console.group(`🔍 [${componentName}] Análise de Compatibilidade`);
  
  console.log('📊 Estrutura dos dados:', {
    hasEntries: !!data.entries,
    entriesCount: data.entries?.length || 0,
    hasSummary: !!data.summary,
    summaryKeys: data.summary ? Object.keys(data.summary) : []
  });

  if (data.summary) {
    const summary = data.summary;
    console.log('📈 Análise do Summary:', {
      hasLegacyFields: !!(summary.totalDiscount !== undefined || summary.totalTax !== undefined),
      hasUnifiedFields: !!(summary.totalEntries !== undefined && summary.dateRange !== undefined),
      isLegacyFormat: isLegacyFormat(data),
      totalValue: summary.totalValue,
      fieldsPresent: Object.keys(summary)
    });
  }

  console.groupEnd();
};

// ✅ TIPOS PARA O HOOK DE COMPATIBILIDADE
export interface FinancialDataCompatResult {
  data: FinancialSheetData | null;
  isLegacyFormat: boolean;
  hasCompatibilityIssues: boolean;
  conversionLog: string[];
}

export type FinancialDataInput = FinancialSheetData | LegacyFinancialSheetData | null;