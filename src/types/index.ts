// types/index.ts - VERSÃO ATUALIZADA COM RECONCILIAÇÃO

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
  
  // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
  linked_future_group?: string;         // Grupo de futures reconciliado
  is_from_reconciliation?: boolean;     // Veio de reconciliação?
  future_subscription_id?: string;      // ID da assinatura original
  reconciliation_metadata?: string;     // JSON com dados extras
}

export interface FutureTransaction {
  id: string;
  original_transaction_id?: string; // Link para transação original (para parcelas)
  mes_vencimento: string; // Formato AAMM
  data_vencimento: string; // Formato ISO YYYY-MM-DD
  descricao_origem: string;
  categoria: string;
  subtipo: string;
  descricao: string;
  valor: number;
  origem: string;
  cc: string;
  parcela_atual: number;
  parcela_total: number;
  estabelecimento: string;
  status: 'projected' | 'confirmed' | 'paid';
  conta?: string; // Adicionando campo conta que pode ser usado
  
  // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
  subscription_fingerprint?: string;     // "netflix_29.90_monthly"
  original_future_id?: string;           // ID da projeção original
  reconciliation_group?: string;         // "NUBANK_072025"  
  is_reconciled?: boolean;               // Foi reconciliada?
  fatura_fechada_id?: string;           // ID da fatura oficial
  valor_original?: number;               // Valor antes de ajustes
  reconciled_at?: string;                // Quando foi reconciliada
  reconciled_with_transaction_id?: string; // Com qual transaction
}

// ===== NOVAS INTERFACES PARA RECONCILIAÇÃO =====

export interface SubscriptionTracking {
  id: string;
  user_id: string;
  fingerprint: string;
  estabelecimento: string;
  valor: number;
  last_reconciled_parcela: number;
  total_parcelas: number;
  next_expected_month: string;
  transaction_pattern: string;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationGroup {
  groupId: string;
  futures: FutureTransaction[];
  totalValue: number;
  description: string;
  month: string;
  estabelecimentos: string[]; // Lista de estabelecimentos únicos
  count: number; // Número de transações
}

export interface FaturaAnalysis {
  matched: FutureTransaction[];
  changed: Array<{future: FutureTransaction, newValue: number}>;
  removed: FutureTransaction[];
  added: Transaction[];
  totalDifference: number;
}

export interface ReconciliationModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedGroup: ReconciliationGroup) => void;
  availableGroups: ReconciliationGroup[];
}

export interface FaturaAnalysisModalProps {
  isOpen: boolean;
  analysisData: FaturaAnalysis | null;
  onClose: () => void;
  onApplyCorrections: (corrections: FaturaAnalysis) => void;
}

// ===== INTERFACES EXISTENTES MANTIDAS =====

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
  onTransactionsImported: (transactions: Transaction[]) => Promise<{ success: boolean; stats?: { total: number; added: number; duplicates: number } } | void>;
  onFutureTransactionsImported?: (futureTransactions: FutureTransaction[], referenceMes: string) => Promise<{ success: boolean; stats?: { total: number; added: number; duplicates: number } } | void>;
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