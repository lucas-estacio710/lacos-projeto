// lib/faturaComparison.ts

import { FutureTransaction, Transaction, FaturaAnalysis } from '@/types';
import { formatCurrency } from './utils';

/**
 * SERVIÇO DE COMPARAÇÃO DE FATURAS
 * 
 * Compara fatura projetada (futures) vs fatura real (transactions)
 * Detecta diferenças, mudanças e permite correções antes da reconciliação
 */

/**
 * Compara fatura projetada vs fatura real
 * Retorna análise detalhada das diferenças
 */
export const compareFaturas = (
  projectedFutures: FutureTransaction[], 
  realTransactions: Transaction[]
): FaturaAnalysis => {
  console.log('🔍 Iniciando comparação de faturas...');
  console.log('📊 Futures projetadas:', projectedFutures.length);
  console.log('📊 Transações reais:', realTransactions.length);
  
  const matched: FutureTransaction[] = [];
  const changed: Array<{future: FutureTransaction, newValue: number}> = [];
  const removed: FutureTransaction[] = [];
  const added: Transaction[] = [];
  
  // Criar mapas para comparação mais eficiente
  const futuresMap = new Map<string, FutureTransaction>();
  projectedFutures.forEach(future => {
    // Chave baseada em estabelecimento + valor aproximado + data
    const key = generateComparisonKey(
      future.estabelecimento, 
      future.valor, 
      future.data_vencimento
    );
    futuresMap.set(key, future);
  });
  
  const transactionsMap = new Map<string, Transaction>();
  realTransactions.forEach(transaction => {
    const key = generateComparisonKey(
      transaction.descricao_origem, 
      transaction.valor, 
      transaction.data
    );
    transactionsMap.set(key, transaction);
  });
  
  // ETAPA 1: Identificar matches e mudanças
  futuresMap.forEach((future, futureKey) => {
    let found = false;
    
    // Busca exata primeiro
    if (transactionsMap.has(futureKey)) {
      matched.push(future);
      transactionsMap.delete(futureKey); // Remove para não contar como "added"
      found = true;
    } else {
      // Busca por estabelecimento similar com valor diferente
      const similarTransaction = findSimilarTransaction(future, Array.from(transactionsMap.values()));
      
      if (similarTransaction) {
        // Mudança de valor detectada
        changed.push({
          future,
          newValue: similarTransaction.valor
        });
        
        // Remove da lista de transactions para não contar como "added"
        const similarKey = generateComparisonKey(
          similarTransaction.descricao_origem,
          similarTransaction.valor,
          similarTransaction.data
        );
        transactionsMap.delete(similarKey);
        found = true;
      }
    }
    
    // Se não encontrou, foi removida
    if (!found) {
      removed.push(future);
    }
  });
  
  // ETAPA 2: Transações restantes são "adicionadas"
  added.push(...Array.from(transactionsMap.values()));
  
  // ETAPA 3: Calcular diferença total
  const projectedTotal = projectedFutures.reduce((sum, f) => sum + Math.abs(f.valor), 0);
  const realTotal = realTransactions.reduce((sum, t) => sum + Math.abs(t.valor), 0);
  const totalDifference = realTotal - projectedTotal;
  
  console.log('✅ Análise de fatura concluída:');
  console.log(`  ✅ Matched: ${matched.length}`);
  console.log(`  ⚠️ Changed: ${changed.length}`);
  console.log(`  ❌ Removed: ${removed.length}`);
  console.log(`  ➕ Added: ${added.length}`);
  console.log(`  💰 Diferença total: R$ ${formatCurrency(Math.abs(totalDifference))}`);
  
  return {
    matched,
    changed,
    removed,
    added,
    totalDifference
  };
};

/**
 * Detecta mudanças específicas entre projeções e realidade
 */
export const detectChanges = (
  projectedFutures: FutureTransaction[], 
  realTransactions: Transaction[]
): Array<{
  type: 'value_change' | 'date_change' | 'description_change';
  future: FutureTransaction;
  transaction: Transaction;
  details: string;
}> => {
  const changes: Array<{
    type: 'value_change' | 'date_change' | 'description_change';
    future: FutureTransaction;
    transaction: Transaction;
    details: string;
  }> = [];
  
  // Para cada future, tentar encontrar a transação correspondente
  projectedFutures.forEach(future => {
    const matchingTransaction = findSimilarTransaction(future, realTransactions);
    
    if (matchingTransaction) {
      // Verificar mudança de valor
      if (Math.abs(Math.abs(future.valor) - Math.abs(matchingTransaction.valor)) > 0.01) {
        changes.push({
          type: 'value_change',
          future,
          transaction: matchingTransaction,
          details: `Valor mudou de R$ ${formatCurrency(Math.abs(future.valor))} para R$ ${formatCurrency(Math.abs(matchingTransaction.valor))}`
        });
      }
      
      // Verificar mudança de data
      if (future.data_vencimento !== matchingTransaction.data) {
        changes.push({
          type: 'date_change',
          future,
          transaction: matchingTransaction,
          details: `Data mudou de ${future.data_vencimento} para ${matchingTransaction.data}`
        });
      }
      
      // Verificar mudança de descrição
      if (!descriptionsAreSimilar(future.estabelecimento, matchingTransaction.descricao_origem)) {
        changes.push({
          type: 'description_change',
          future,
          transaction: matchingTransaction,
          details: `Descrição mudou de "${future.estabelecimento}" para "${matchingTransaction.descricao_origem}"`
        });
      }
    }
  });
  
  return changes;
};

/**
 * Calcula ajustes necessários baseados nas diferenças
 */
export const calculateAdjustments = (analysis: FaturaAnalysis): {
  futureUpdates: Array<{id: string, updates: Partial<FutureTransaction>}>;
  futureCreations: FutureTransaction[];
  futureDeletions: string[];
} => {
  const futureUpdates: Array<{id: string, updates: Partial<FutureTransaction>}> = [];
  const futureCreations: FutureTransaction[] = [];
  const futureDeletions: string[] = [];
  
  // ETAPA 1: Atualizações para transações que mudaram
  analysis.changed.forEach(change => {
    futureUpdates.push({
      id: change.future.id,
      updates: {
        valor: change.newValue,
        valor_original: change.future.valor, // Salvar valor original
        status: 'confirmed' // Marcar como confirmada
      }
    });
  });
  
  // ETAPA 2: Criações para transações adicionadas
  analysis.added.forEach(transaction => {
    // Gerar nova future transaction baseada na transação real
    const newFuture: FutureTransaction = {
      id: `REAL_${transaction.id}`,
      mes_vencimento: transaction.mes,
      data_vencimento: transaction.data,
      descricao_origem: transaction.descricao_origem,
      categoria: '',
      subtipo: '',
      descricao: transaction.descricao_origem,
      valor: transaction.valor,
      origem: transaction.origem,
      cc: transaction.cc,
      parcela_atual: 1,
      parcela_total: 1,
      estabelecimento: transaction.descricao_origem,
      status: 'confirmed',
      fatura_fechada_id: transaction.id // Link para transação real
    };
    
    futureCreations.push(newFuture);
  });
  
  // ETAPA 3: Deleções para transações removidas
  analysis.removed.forEach(future => {
    futureDeletions.push(future.id);
  });
  
  return {
    futureUpdates,
    futureCreations,
    futureDeletions
  };
};

/**
 * Aplica correções nas future transactions
 */
export const applyCorrections = async (
  corrections: {
    futureUpdates: Array<{id: string, updates: Partial<FutureTransaction>}>;
    futureCreations: FutureTransaction[];
    futureDeletions: string[];
  }
): Promise<{
  success: boolean;
  updatedCount: number;
  createdCount: number;
  deletedCount: number;
  errors: string[];
}> => {
  const errors: string[] = [];
  let updatedCount = 0;
  let createdCount = 0;
  let deletedCount = 0;
  
  try {
    // Esta função seria implementada nos hooks específicos
    // Por enquanto, retorna sucesso simulado
    console.log('✅ Aplicando correções:', corrections);
    
    updatedCount = corrections.futureUpdates.length;
    createdCount = corrections.futureCreations.length;
    deletedCount = corrections.futureDeletions.length;
    
    return {
      success: true,
      updatedCount,
      createdCount,
      deletedCount,
      errors
    };
    
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
    return {
      success: false,
      updatedCount: 0,
      createdCount: 0,
      deletedCount: 0,
      errors
    };
  }
};

// ===== FUNÇÕES AUXILIARES =====

/**
 * Gera chave para comparação de transações
 */
function generateComparisonKey(description: string, value: number, date: string): string {
  const descClean = description
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);
  
  const valueRounded = Math.round(Math.abs(value) * 100);
  const dateClean = date.replace(/\D/g, '').substring(0, 8);
  
  return `${descClean}_${valueRounded}_${dateClean}`;
}

/**
 * Busca transação similar baseada em estabelecimento
 */
function findSimilarTransaction(
  future: FutureTransaction, 
  transactions: Transaction[]
): Transaction | null {
  // Buscar por estabelecimento similar
  const candidates = transactions.filter(t => 
    descriptionsAreSimilar(future.estabelecimento, t.descricao_origem)
  );
  
  if (candidates.length === 0) return null;
  
  // Se só há um candidato, retorna ele
  if (candidates.length === 1) return candidates[0];
  
  // Se há múltiplos candidatos, escolher o mais próximo em valor
  return candidates.reduce((closest, current) => {
    const closestDiff = Math.abs(Math.abs(closest.valor) - Math.abs(future.valor));
    const currentDiff = Math.abs(Math.abs(current.valor) - Math.abs(future.valor));
    return currentDiff < closestDiff ? current : closest;
  });
}

/**
 * Verifica se duas descrições são similares
 */
function descriptionsAreSimilar(desc1: string, desc2: string): boolean {
  if (!desc1 || !desc2) return false;
  
  const clean1 = desc1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean2 = desc2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Verificar se uma está contida na outra
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
  
  // Verificar similaridade por palavras comuns
  const words1: string[] = clean1.match(/.{1,4}/g) || []; // ✅ Tipo explícito
  const words2: string[] = clean2.match(/.{1,4}/g) || []; // ✅ Tipo explícito
  
  const commonWords = words1.filter((word: string) => words2.includes(word)); // ✅ Tipo explícito no parâmetro
  const similarity = commonWords.length / Math.max(words1.length, words2.length);
  
  return similarity > 0.5;
}

/**
 * Formata resumo da análise para exibição
 */
export const formatAnalysisSummary = (analysis: FaturaAnalysis): string => {
  const parts: string[] = [];
  
  if (analysis.matched.length > 0) {
    parts.push(`✅ ${analysis.matched.length} confirmadas`);
  }
  
  if (analysis.changed.length > 0) {
    parts.push(`⚠️ ${analysis.changed.length} alteradas`);
  }
  
  if (analysis.removed.length > 0) {
    parts.push(`❌ ${analysis.removed.length} removidas`);
  }
  
  if (analysis.added.length > 0) {
    parts.push(`➕ ${analysis.added.length} novas`);
  }
  
  const diffText = analysis.totalDifference >= 0 
    ? `+R$ ${formatCurrency(analysis.totalDifference)}`
    : `-R$ ${formatCurrency(Math.abs(analysis.totalDifference))}`;
  
  parts.push(`💰 ${diffText}`);
  
  return parts.join(' | ');
};

/**
 * Verifica se a fatura precisa de correções
 */
export const needsCorrections = (analysis: FaturaAnalysis): boolean => {
  return analysis.changed.length > 0 || 
         analysis.removed.length > 0 || 
         analysis.added.length > 0;
};

/**
 * Calcula impacto das correções
 */
export const calculateCorrectionsImpact = (analysis: FaturaAnalysis): {
  valueImpact: number;
  transactionImpact: number;
  description: string;
} => {
  const valueChanges = analysis.changed.reduce((sum, change) => 
    sum + (change.newValue - change.future.valor), 0
  );
  
  const removedValue = analysis.removed.reduce((sum, future) => 
    sum + Math.abs(future.valor), 0
  );
  
  const addedValue = analysis.added.reduce((sum, transaction) => 
    sum + Math.abs(transaction.valor), 0
  );
  
  const valueImpact = valueChanges + addedValue - removedValue;
  const transactionImpact = analysis.added.length - analysis.removed.length;
  
  let description = '';
  if (Math.abs(valueImpact) > 0.01) {
    description += `Valor ${valueImpact >= 0 ? 'aumentará' : 'diminuirá'} em R$ ${formatCurrency(Math.abs(valueImpact))}`;
  }
  
  if (transactionImpact !== 0) {
    if (description) description += '. ';
    description += `${Math.abs(transactionImpact)} transações ${transactionImpact > 0 ? 'adicionadas' : 'removidas'}`;
  }
  
  return {
    valueImpact,
    transactionImpact,
    description: description || 'Nenhum impacto significativo'
  };
};

export default {
  compareFaturas,
  detectChanges,
  calculateAdjustments,
  applyCorrections,
  formatAnalysisSummary,
  needsCorrections,
  calculateCorrectionsImpact
};