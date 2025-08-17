// types/index.ts - TIPOS UNIFICADOS E COMPATÍVEIS

export interface Transaction {
  id: string;
  mes: string;
  data: string;
  descricao_origem: string;
  subtipo: string;
  categoria: string;
  descricao: string;
  valor: number;
  origem: string;
  cc: string;
  realizado: 's' | 'p' | 'r'; // ✅ ATUALIZADO: 'r' = reconciliado (não conta no saldo)
  conta: string;
  is_from_reconciliation?: boolean;
  linked_future_group?: string;
  future_subscription_id?: string;
  reconciliation_metadata?: string;
}

export interface CardTransaction {
  id: string;
  fingerprint?: string;
  fatura_id: string;
  data_transacao: string;
  descricao_origem: string;
  valor: number;
  categoria: string | null;
  subtipo: string | null;
  descricao_classificada: string | null;
  status: 'pending' | 'classified' | 'reconciled';
  origem: string;
  cc: string;
}

// ✅ TIPO ATUALIZADO COM VISA E MASTERCARD
export type BankType = 
  | 'Inter' 
  | 'BB' 
  | 'Nubank' 
  | 'VISA' 
  | 'MasterCard' 
  | 'TON';

export interface CategoryData {
  subtipos: string[];
  icon: string;
  color: string;
}

export interface Categories {
  [key: string]: CategoryData;
}

export type ContaType = 'PF' | 'PJ' | 'CONC.';

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
  conta: ContaType;
  categoria: string;
  subtipo: string;
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
    id: 'rec_n_p_ind',
    name: 'Receita Nova Plano Individual',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. P. IND.',
    descriptionTemplate: 'Receita Nova Plano Individual - {{tipo}} - Contrato {{idContrato}}',
    conditions: {
      methods: ['pix', 'cartao'],
      keywords: ['individual', 'plano']
    }
  },
  {
    id: 'rec_n_p_col',
    name: 'Receita Nova Plano Coletiva',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. P. COL.',
    descriptionTemplate: 'Receita Nova Plano Coletiva - {{tipo}} - Contrato {{idContrato}}',
    conditions: {
      methods: ['pix', 'cartao'],
      keywords: ['coletiva', 'plano']
    }
  },
  {
    id: 'rec_n_c_ind',
    name: 'Receita Nova Catálogo Individual',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. C. IND.',
    descriptionTemplate: 'Receita Nova Catálogo Individual - {{tipo}} - Contrato {{idContrato}}',
    conditions: {
      methods: ['pix', 'cartao'],
      keywords: ['individual', 'catalogo']
    }
  },
  {
    id: 'rec_n_c_col',
    name: 'Receita Nova Catálogo Coletiva',
    conta: 'PJ',
    categoria: 'Receita Nova',
    subtipo: 'REC. N. C. COL.',
    descriptionTemplate: 'Receita Nova Catálogo Coletiva - {{tipo}} - Contrato {{idContrato}}',
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