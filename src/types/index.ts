// types/index.ts - TIPOS UNIFICADOS E COMPATÍVEIS COM INTER PAG
import { SUBTIPO_IDS } from '@/lib/constants';

export interface Transaction {
  id: string;
  mes: string;
  data: string;
  descricao_origem: string;
  descricao: string;
  valor: number;
  origem: string;
  cc: string;
  realizado: 's' | 'p' | 'r'; // ✅ ATUALIZADO: 'r' = reconciliado (não conta no saldo)
  is_from_reconciliation?: boolean;
  linked_future_group?: string;
  future_subscription_id?: string;
  reconciliation_metadata?: string;
  
  // ✅ NOVO: Apenas subtipo_id - sem campos legados
  subtipo_id: string | null; // UUID do subtipo na nova hierarquia (null = não classificado)
  
  // ✅ Hierarquia anexada dinamicamente pelos hooks
  hierarchy?: {
    conta_codigo: string;
    conta_nome: string;
    categoria_nome: string;
    subtipo_nome: string;
    subtipo_id: string;
  };
  
  // 🚨 DEPRECATED: Campos temporários para compatibilidade durante migração
  // TODO: Remover após migração completa dos componentes
  conta?: string;
  categoria?: string;
  subtipo?: string;
}

export interface CardTransaction {
  id: string;
  fingerprint?: string;
  fatura_id: string;
  data_transacao: string;
  descricao_origem: string;
  valor: number;
  descricao_classificada: string | null;
  status: 'pending' | 'classified' | 'reconciled';
  origem: string;
  cc: string;
  
  // ✅ NOVO: Apenas subtipo_id - sem campos legados
  subtipo_id: string | null; // UUID do subtipo na nova hierarquia
  
  // 🚨 DEPRECATED: Campos temporários para compatibilidade durante migração
  // TODO: Remover após migração completa dos componentes  
  categoria?: string;
  subtipo?: string;
}

// ✅ NOVOS TIPOS PARA INTER PAG
export interface InterPagEntry {
  idTransacao: string;
  dataHora: string;
  tipo: string;
  status: string;
  parcela: string;
  bandeira: string;
  valorBruto: number;
  valorTaxa: number;
  valorAntecipacao: number;
  valorLiquido: number;
  dataPagamento: string;
}

export interface InterPagPercentual {
  idTransacao: string;
  idContrato: string;
  percentualCatalogo: number; // 0-100
  percentualPlanos: number;   // 0-100
  totalPercentual: number;    // Deve ser 100
}

export interface InterPagDayGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  agendaEntries: InterPagEntry[];
  percentualMatches: Array<{
    agendaEntry: InterPagEntry;
    percentualData: InterPagPercentual;
    splitPreview: {
      catalogoValue: number;
      planosValue: number;
      total: number;
    };
  }>;
  totalValue: number;
  matchedCount: number;
  unmatchedCount: number;
}

export interface InterPagSplitResult {
  catalogoTransaction: Partial<Transaction>;
  planosTransaction: Partial<Transaction>;
  originalTransactionId: string;
  reconciliationNote: string;
}

// ✅ TIPO ATUALIZADO COM VISA, MASTERCARD E SANTANDER KEKA
export type BankType =
  | 'Inter'
  | 'BB'
  | 'TON'
  | 'Nubank'
  | 'VISA'
  | 'MasterCard'
  | 'Santander Keka';

export interface CategoryData {
  subtipos: string[];
  icon: string;
}

export interface Categories {
  [key: string]: CategoryData;
}

// TODO: Remover ContaType - usar hierarquia dinâmica
// export type ContaType = 'PF' | 'PJ' | 'CONC.';

// ✅ NOVOS TIPOS PARA CLAREZA
export type RealizadoType = 's' | 'p' | 'r';

// ✅ NOVOS TIPOS PARA FORMATOS DE DATA
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'ISO' | 'UNKNOWN';

export interface DateParseResult {
  success: boolean;
  isoDate: string | null;
  detectedFormat: DateFormat;
  originalInput: string;
  error?: string;
}

export interface DateValidationOptions {
  preferBrazilianFormat?: boolean;
  allowAmbiguousDates?: boolean;
  strictValidation?: boolean;
}

// ✅ INTERFACE PARA ENTRADA DA PLANILHA FINANCEIRA - UNIFICADA
export interface FinancialEntry {
  id: string;
  dataHora: string;
  tipo: string;
  metodo: string;
  idContrato: string;
  idTransacao: string;
  valorFinal: number;
  cc: string;
  // Campos opcionais para metadados de reconciliação
  reconciled?: boolean;
  reconciliation_date?: string;
  linked_transaction_ids?: string[];
}

// ✅ INTERFACE DE RESUMO FINANCEIRO - COMPATÍVEL COM AMBOS OS HOOKS
export interface FinancialSummary {
  // Campos obrigatórios do novo tipo
  totalEntries: number;
  totalValue: number;
  dateRange: {
    start: string;
    end: string;
  };
  byMethod: Record<string, number>;
  byType: Record<string, number>;
  
  // Campos opcionais do tipo antigo (para compatibilidade)
  totalDiscount?: number;
  totalTax?: number;
  netValue?: number;
}

// ✅ INTERFACE PRINCIPAL DE DADOS FINANCEIROS - UNIFICADA
export interface FinancialSheetData {
  entries: FinancialEntry[];
  summary: FinancialSummary;
}

// ✅ INTERFACE PARA DADOS INTER PAG
export interface InterPagSheetData {
  agendaEntries: InterPagEntry[];
  percentuais: InterPagPercentual[];
  summary: {
    totalEntries: number;
    totalValue: number;
    dateRange: {
      start: string;
      end: string;
    };
    matchedEntries: number;
    unmatchedEntries: number;
  };
}

// ✅ HELPER PARA CONVERTER ENTRE FORMATOS DE RESUMO
export const convertToUnifiedSummary = (
  oldSummary: {
    totalValue: number;
    totalDiscount: number;
    totalTax: number;
    netValue: number;
    byMethod: Record<string, number>;
    byType: Record<string, number>;
  },
  entries: FinancialEntry[]
): FinancialSummary => {
  // Calcular range de datas dos entries
  const dates = entries
    .map(entry => entry.dataHora)
    .filter(date => date && date !== '')
    .sort();
  
  return {
    totalEntries: entries.length,
    totalValue: oldSummary.totalValue,
    dateRange: {
      start: dates[0] || '',
      end: dates[dates.length - 1] || ''
    },
    byMethod: oldSummary.byMethod,
    byType: oldSummary.byType,
    // Campos opcionais mantidos para compatibilidade
    totalDiscount: oldSummary.totalDiscount,
    totalTax: oldSummary.totalTax,
    netValue: oldSummary.netValue
  };
};

// ✅ HELPER PARA CRIAR RESUMO A PARTIR DE ENTRIES
export const createSummaryFromEntries = (entries: FinancialEntry[]): FinancialSummary => {
  const totalValue = entries.reduce((sum, entry) => sum + entry.valorFinal, 0);
  
  const byMethod = entries.reduce((acc, entry) => {
    acc[entry.metodo] = (acc[entry.metodo] || 0) + entry.valorFinal;
    return acc;
  }, {} as Record<string, number>);
  
  const byType = entries.reduce((acc, entry) => {
    acc[entry.tipo] = (acc[entry.tipo] || 0) + entry.valorFinal;
    return acc;
  }, {} as Record<string, number>);
  
  const dates = entries
    .map(entry => entry.dataHora)
    .filter(date => date && date !== '')
    .sort();
  
  return {
    totalEntries: entries.length,
    totalValue,
    dateRange: {
      start: dates[0] || '',
      end: dates[dates.length - 1] || ''
    },
    byMethod,
    byType
  };
};

// ✅ HELPER PARA PROCESSAR DADOS INTER PAG
export const parseInterPagPercentage = (percentStr: string): number => {
  if (!percentStr || percentStr.trim() === '') return 0;
  
  // Remover aspas e caracteres especiais
  const cleanStr = percentStr.replace(/["%,]/g, '').trim();
  const num = parseFloat(cleanStr);
  
  return isNaN(num) ? 0 : num;
};

export const createInterPagSplitTransactions = (
  originalTransaction: Transaction,
  agendaEntry: InterPagEntry,
  percentualData: InterPagPercentual
): InterPagSplitResult => {
  const catalogoValue = Math.round((agendaEntry.valorLiquido * percentualData.percentualCatalogo / 100) * 100) / 100;
  const planosValue = Math.round((agendaEntry.valorLiquido * percentualData.percentualPlanos / 100) * 100) / 100;
  
  // Determinar tipo baseado no contrato
  const isIndividual = percentualData.idContrato.includes('IND');
  const isColetivo = percentualData.idContrato.includes('COL');
  
  const baseProps = {
    mes: originalTransaction.mes,
    data: originalTransaction.data,
    origem: originalTransaction.origem,
    cc: originalTransaction.cc,
    // conta: 'PJ' as const, // TODO: Migrar para subtipo_id
    categoria: 'Receita Antiga', // ✅ INTER PAG = Receita Antiga
    realizado: 's' as const,
    is_from_reconciliation: true,
    linked_future_group: `INTERPAG_${agendaEntry.idTransacao}`,
    reconciliation_metadata: JSON.stringify({
      original_transaction_id: originalTransaction.id,
      agenda_entry_id: agendaEntry.idTransacao,
      contract_id: percentualData.idContrato,
      split_type: 'interpag_percentage',
      split_date: new Date().toISOString(),
      percentuals: {
        catalogo: percentualData.percentualCatalogo,
        planos: percentualData.percentualPlanos
      }
    })
  };
  
  const catalogoTransaction: Partial<Transaction> = {
    ...baseProps,
    id: `${originalTransaction.id}_CAT`,
    subtipo_id: isIndividual ? SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_INDIVIDUAL : SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_COLETIVA,
    descricao: `Receita Antiga Catálogo ${isIndividual ? 'Individual' : 'Coletivo'} - Contrato ${percentualData.idContrato}`,
    descricao_origem: `${originalTransaction.descricao_origem} [CATÁLOGO]`,
    valor: catalogoValue
  };
  
  const planosTransaction: Partial<Transaction> = {
    ...baseProps,
    id: `${originalTransaction.id}_PLAN`,
    subtipo_id: isIndividual ? SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_INDIVIDUAL : SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_COLETIVA,
    descricao: `Receita Antiga Plano ${isIndividual ? 'Individual' : 'Coletivo'} - Contrato ${percentualData.idContrato}`,
    descricao_origem: `${originalTransaction.descricao_origem} [PLANOS]`,
    valor: planosValue
  };
  
  return {
    catalogoTransaction,
    planosTransaction,
    originalTransactionId: originalTransaction.id,
    reconciliationNote: `Inter Pag split: ${percentualData.percentualCatalogo}% Catálogo / ${percentualData.percentualPlanos}% Planos - Contrato ${percentualData.idContrato}`
  };
};

// Helper para verificar se transação conta no saldo
export const countsInBalance = (realizado: RealizadoType): boolean => {
  return realizado === 's'; // Só 's' conta no saldo, 'p' e 'r' não
};

// Helper para verificar se transação está executada
export const isExecuted = (realizado: RealizadoType): boolean => {
  return ['s', 'r'].includes(realizado); // 's' e 'r' estão executadas
};

// Helper para verificar se transação está pendente
export const isPending = (realizado: RealizadoType): boolean => {
  return realizado === 'p';
};

// Helper para verificar se transação está reconciliada
export const isReconciled = (realizado: RealizadoType): boolean => {
  return realizado === 'r';
};

// ✅ NOVOS HELPERS PARA DATAS
export const isValidDateString = (dateStr: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  // Regex básicos para formatos comuns
  const patterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // DD/MM/YYYY ou MM/DD/YYYY
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ // ISO com tempo
  ];
  
  return patterns.some(pattern => pattern.test(dateStr.trim()));
};

export const getDateFormatDisplayName = (format: DateFormat): string => {
  const names: Record<DateFormat, string> = {
    'DD/MM/YYYY': 'Brasileiro (DD/MM/YYYY)',
    'MM/DD/YYYY': 'Americano (MM/DD/YYYY)',
    'YYYY-MM-DD': 'ISO Simples (YYYY-MM-DD)',
    'ISO': 'ISO Completo (com horário)',
    'UNKNOWN': 'Formato não reconhecido'
  };
  
  return names[format];
};

// ✅ INTERFACE PARA RECONCILIAÇÃO
export interface ReconciliationMatch {
  transactionId: string;
  entryId: string;
  confidence: number; // 0-1
  dateMatch: boolean;
  valueMatch: boolean;
  methodMatch: boolean;
  metadata?: Record<string, any>;
}

export interface ReconciliationRule {
  id: string;
  name: string;
  description: string;
  active: boolean;
  conditions: {
    dateToleranceDays?: number;
    valueTolerance?: number; // percentual
    requiredFields?: string[];
    methodFilters?: string[];
  };
}

export interface ConciliationSession {
  id: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'cancelled';
  totalTransactions: number;
  totalEntries: number;
  matchedCount: number;
  rules: ReconciliationRule[];
  matches: ReconciliationMatch[];
}

// ✅ TIPOS PARA CLASSIFICAÇÃO AUTOMÁTICA
export interface ClassificationTemplate {
  id: string;
  name: string;
  subtipo_id: string;
  descriptionTemplate: string;
  conditions: {
    amountRange?: [number, number];
    methods?: string[];
    keywords?: string[];
    datePattern?: RegExp;
  };
}

export const DEFAULT_CLASSIFICATION_TEMPLATES: ClassificationTemplate[] = [
  {
    id: 'rec_a_p_ind',
    name: 'Receita Antiga Plano Individual',
    subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_INDIVIDUAL,
    descriptionTemplate: 'Receita Antiga Plano Individual - {{tipo}} - Contrato {{idContrato}}',
    conditions: {
      methods: ['pix', 'cartao'],
      keywords: ['individual', 'plano']
    }
  },
  {
    id: 'rec_a_p_col',
    name: 'Receita Antiga Plano Coletiva',
    subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_COLETIVA,
    descriptionTemplate: 'Receita Antiga Plano Coletiva - {{tipo}} - Contrato {{idContrato}}',
    conditions: {
      methods: ['pix', 'cartao'],
      keywords: ['coletiva', 'plano']
    }
  },
  {
    id: 'rec_a_c_ind',
    name: 'Receita Antiga Catálogo Individual',
    subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_INDIVIDUAL,
    descriptionTemplate: 'Receita Antiga Catálogo Individual - {{tipo}} - Contrato {{idContrato}}',
    conditions: {
      methods: ['pix', 'cartao'],
      keywords: ['individual', 'catalogo']
    }
  },
  {
    id: 'rec_a_c_col',
    name: 'Receita Antiga Catálogo Coletiva',
    subtipo_id: SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_COLETIVA,
    descriptionTemplate: 'Receita Antiga Catálogo Coletiva - {{tipo}} - Contrato {{idContrato}}',
    conditions: {
      methods: ['pix', 'cartao'],
      keywords: ['coletiva', 'catalogo']
    }
  }
];

// ✅ TIPOS PARA COMPATIBILIDADE COM HOOKS EXISTENTES
export interface LegacyFinancialSummary {
  totalValue: number;
  totalDiscount: number;
  totalTax: number;
  netValue: number;
  byMethod: Record<string, number>;
  byType: Record<string, number>;
}

export interface LegacyFinancialSheetData {
  entries: FinancialEntry[];
  summary: LegacyFinancialSummary;
}

// ✅ ADAPTER PARA CONVERTER DADOS LEGADOS
export const adaptLegacyToUnified = (
  legacyData: LegacyFinancialSheetData
): FinancialSheetData => {
  return {
    entries: legacyData.entries,
    summary: convertToUnifiedSummary(legacyData.summary, legacyData.entries)
  };
};

// ✅ VERIFICADOR DE COMPATIBILIDADE
export const isLegacyFormat = (
  data: any
): data is LegacyFinancialSheetData => {
  return (
    data &&
    data.summary &&
    'totalDiscount' in data.summary &&
    'totalTax' in data.summary &&
    !('totalEntries' in data.summary) &&
    !('dateRange' in data.summary)
  );
};

// ✅ FUNÇÃO HELPER PARA USO EM COMPONENTES
export const ensureUnifiedFormat = (
  data: FinancialSheetData | LegacyFinancialSheetData | null
): FinancialSheetData | null => {
  if (!data) return null;
  
  if (isLegacyFormat(data)) {
    return adaptLegacyToUnified(data);
  }
  
  return data as FinancialSheetData;
};