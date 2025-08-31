// lib/constants.ts - IDs de subtipos específicos usados em todo o sistema

/**
 * IDs dos subtipos para classificações específicas
 * Estes IDs são hardcoded pois representam categorias específicas do negócio
 */
export const SUBTIPO_IDS = {
  // Classificação complexa (para transações que requerem análise manual)
  COMPLEXA: 'e92f4f0f-4e94-4007-8945-a1fb47782051',
  
  // Receitas Antigas - Planos
  RECEITA_ANTIGA_PLANO_INDIVIDUAL: '91c60dd5-c4da-48df-b5d4-7ae08f97040b', // REC. A. P. IND.
  RECEITA_ANTIGA_PLANO_COLETIVA: '7645b927-9e00-414f-9401-c23d0744e95a',    // REC. A. P. COL.
  
  // Receitas Antigas - Catálogos  
  RECEITA_ANTIGA_CATALOGO_INDIVIDUAL: '0304dd17-9be6-4589-b649-3409ad49af71', // REC. A. C. IND.
  RECEITA_ANTIGA_CATALOGO_COLETIVA: '2ec28e4b-3673-49c7-aa77-18caabcfe90f',   // REC. A. C. COL.

  // Receitas Novas - Planos
  RECEITA_NOVA_PLANO_INDIVIDUAL: 'dfbdd704-d1f3-4a5c-8abb-d2fa6d5bdf66', // REC. N. P. IND.
  RECEITA_NOVA_PLANO_COLETIVA: 'a0011fd4-99b5-49e6-8055-6159e53df249',   // REC. N. P. COL.
  
  // Receitas Novas - Catálogos
  RECEITA_NOVA_CATALOGO_INDIVIDUAL: '903eabdf-cb09-4b24-a3ec-19a99c14b83f', // REC. N. C. IND.
  RECEITA_NOVA_CATALOGO_COLETIVA: '8e7c7be2-6d71-466a-b142-5b40aeb4f6f8',   // REC. N. C. COL.
  
  // Custos Operacionais
  OUTROS_ABSORVIDOS: '3aa94cd4-2a32-48cd-a386-7d3fae679879', // OUTROS ABSORVIDOS
} as const;

/**
 * Helper para verificar se um subtipo_id é de Receita Antiga
 */
export function isReceitaAntiga(subtipo_id: string): boolean {
  const receitaAntigaIds = [
    SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_INDIVIDUAL,
    SUBTIPO_IDS.RECEITA_ANTIGA_PLANO_COLETIVA,
    SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_INDIVIDUAL,
    SUBTIPO_IDS.RECEITA_ANTIGA_CATALOGO_COLETIVA,
  ] as string[];
  return receitaAntigaIds.includes(subtipo_id);
}

/**
 * Helper para verificar se um subtipo_id é de classificação complexa
 */
export function isClassificacaoComplexa(subtipo_id: string): boolean {
  return subtipo_id === SUBTIPO_IDS.COMPLEXA;
}