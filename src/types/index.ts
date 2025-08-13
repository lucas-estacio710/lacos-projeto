// types/index.ts - VERSÃO LIMPA SEM FUTURE TRANSACTIONS

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
  realizado: string;
  conta: string;
  
  // ===== CAMPOS PARA RECONCILIAÇÃO =====
  linked_future_group?: string;         // Grupo de faturas reconciliado
  is_from_reconciliation?: boolean;     // Veio de reconciliação?
  future_subscription_id?: string;      // ID do pagamento original
  reconciliation_metadata?: string;     // JSON com dados extras
}

// ===== INTERFACES PRINCIPAIS =====

export interface CategoryData {
  subtipos: string[];
  icon: string;
  color: 'green' | 'red' | 'blue';
}

export interface Categories {
  [key: string]: CategoryData;
}

export interface BankUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionsImported: (transactions: Transaction[]) => Promise<{ 
    success: boolean; 
    stats?: { 
      total: number; 
      added: number; 
      duplicates: number 
    } 
  } | void>;
  onCardTransactionsImported?: (transactions: any[]) => Promise<any>;
}

export interface ParsedTransaction {
  id: string;
  mes: string;
  data: string;
  descricao_origem: string;
  valor: number;
  origem: string;
  cc: string;
}

export interface ImportResult {
  transactions: Transaction[];
  duplicatesCount: number;
  processedLines: number;
}

export type BankType = 'Inter' | 'BB' | 'Nubank' | 'TON';
export type ContaType = 'PF' | 'PJ' | 'CONC.';
export type RealizadoType = 's' | 'p'; // 's' = sim/realizado, 'p' = pendente

export interface BankConfig {
  name: string;
  skipLines: number;
  separator: ',' | ';';
  hasQuotes: boolean;
  columns: {
    data: number;
    descricao: number;
    valor: number;
    saldo?: number;
  };
}

// Tipos para filtros e estados
export interface FilterState {
  month: string;
  account: ContaType | 'todos';
  category: string;
  subtype: string;
  searchTerm: string;
}

export interface ExpandedState {
  [key: string]: boolean;
}

// Tipo para estatísticas
export interface Statistics {
  average: number;
  min: number;
  max: number;
  stdDev: number;
  trend: number;
}

// Tipo para dados do gráfico
export interface ChartData {
  month: string;
  value: number;
}