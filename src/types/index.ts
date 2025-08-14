// types/index.ts - TIPOS COMPLETOS COM VISA E MASTERCARD

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
  realizado: 's' | 'p';
  conta: string;
  is_from_reconciliation?: boolean;
  linked_future_group?: string;
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

export type ContaType = 'PF' | 'PJ'