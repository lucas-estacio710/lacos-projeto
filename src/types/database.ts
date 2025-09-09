// Database Types for Hierarchy System
// Contas -> Categorias -> Subtipos

export interface DatabaseConta {
  id: string;
  codigo: string;
  nome: string;
  icone?: string;
  ordem_exibicao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseCategoria {
  id: string;
  conta_id: string;
  codigo: string;
  nome: string;
  icone?: string;
  ordem_exibicao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSubtipo {
  id: string;
  categoria_id: string;
  codigo: string;
  nome: string;
  icone?: string;
  ordem_exibicao: number;
  ativo: boolean;
  categoria_rapida?: boolean;
  cor_botao?: string;
  created_at: string;
  updated_at: string;
}

// Enriched types with relationships
export interface ContaComCategorias extends DatabaseConta {
  categorias: CategoriaComSubtipos[];
}

export interface CategoriaComSubtipos extends DatabaseCategoria {
  subtipos: DatabaseSubtipo[];
  conta: DatabaseConta;
}

export interface SubtipoComRelacoes extends DatabaseSubtipo {
  categoria: DatabaseCategoria;
  conta: DatabaseConta;
}

// For forms and API requests
export interface CreateContaRequest {
  codigo: string;
  nome: string;
  icone?: string;
  ordem_exibicao?: number;
}

export interface UpdateContaRequest {
  codigo?: string;
  nome?: string;
  icone?: string;
  ordem_exibicao?: number;
  ativo?: boolean;
}

export interface CreateCategoriaRequest {
  conta_id: string;
  codigo: string;
  nome: string;
  icone?: string;
  ordem_exibicao?: number;
}

export interface UpdateCategoriaRequest {
  codigo?: string;
  nome?: string;
  icone?: string;
  conta_id?: string;
  ordem_exibicao?: number;
  ativo?: boolean;
}

export interface CreateSubtipoRequest {
  categoria_id: string;
  codigo: string;
  nome: string;
  icone?: string;
  ordem_exibicao?: number;
  categoria_rapida?: boolean;
  cor_botao?: string;
}

export interface UpdateSubtipoRequest {
  codigo?: string;
  nome?: string;
  icone?: string;
  categoria_id?: string;
  ordem_exibicao?: number;
  ativo?: boolean;
  categoria_rapida?: boolean;
  cor_botao?: string;
}

// View models for the UI
export interface HieraquiaCompleta {
  conta: DatabaseConta;
  categorias: {
    categoria: DatabaseCategoria;
    subtipos: DatabaseSubtipo[];
  }[];
}

export interface VisaoPlana {
  subtipo_id: string;
  subtipo_nome: string;
  subtipo_codigo: string;
  subtipo_icone: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_codigo: string;
  categoria_icone: string;
  conta_id: string;
  conta_nome: string;
  conta_codigo: string;
  conta_icone: string;
  caminho_completo: string; // "Pessoa Jurídica > Receitas > Vendas de Produtos"
}

// For transaction updates
export interface AtualizacaoClassificacao {
  subtipo_id: string;
  // Legacy fields for backward compatibility
  conta?: string;
  categoria?: string;
  subtipo?: string;
}