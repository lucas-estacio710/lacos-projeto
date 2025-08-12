import { FutureTransaction, ReconciliationGroup, Transaction, SubscriptionTracking } from '@/types';
import { formatCurrency } from './utils';

/**
 * SERVIÇO DE RECONCILIAÇÃO - VERSÃO MANUAL
 * 
 * PRINCÍPIO CHAVE: SEM detecção automática - Todos os grupos são candidatos
 * O usuário escolhe manualmente qual grupo reconciliar com qual pagamento
 */

/**
 * Lista TODOS os grupos de futures disponíveis para reconciliação
 * SEM algoritmo de matching - todos são candidatos válidos
 */
export const getAllReconciliationGroups = (futures: FutureTransaction[]): ReconciliationGroup[] => {
  console.log('🔍 Buscando grupos de reconciliação...');
  console.log('📊 Total de futures:', futures.length);
  
  // Filtrar apenas futures não reconciliadas
  const availableFutures = futures.filter(f => !f.is_reconciled);
  console.log('📊 Futures disponíveis (não reconciliadas):', availableFutures.length);
  
  if (availableFutures.length === 0) {
    console.log('ℹ️ Nenhuma future transaction disponível para reconciliação');
    return [];
  }
  
  // Agrupar por reconciliation_group (ex: "NUBANK_072025")
  const groupsMap = new Map<string, FutureTransaction[]>();
  
  availableFutures.forEach(future => {
    // Se não tem reconciliation_group, criar baseado na origem e mês
    const groupId = future.reconciliation_group || `${future.origem}_${future.mes_vencimento}`;
    
    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, []);
    }
    groupsMap.get(groupId)!.push(future);
  });
  
  // Converter para ReconciliationGroup[]
  const groups: ReconciliationGroup[] = [];
  
  groupsMap.forEach((futures, groupId) => {
    // Calcular informações do grupo
    const totalValue = futures.reduce((sum, f) => sum + Math.abs(f.valor), 0);
    const estabelecimentos = [...new Set(futures.map(f => f.estabelecimento).filter(Boolean))];
    const mainEstabelecimento = estabelecimentos[0] || 'Vários estabelecimentos';
    
    // Gerar descrição amigável
    let description = `${mainEstabelecimento}`;
    if (estabelecimentos.length > 1) {
      description += ` +${estabelecimentos.length - 1} outros`;
    }
    description += ` (${futures.length} transações)`;
    
    // Usar o mês mais comum no grupo
    const monthCounts = new Map<string, number>();
    futures.forEach(f => {
      const count = monthCounts.get(f.mes_vencimento) || 0;
      monthCounts.set(f.mes_vencimento, count + 1);
    });
    
    const mostCommonMonth = Array.from(monthCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    
    groups.push({
      groupId,
      futures,
      totalValue,
      description,
      month: mostCommonMonth,
      estabelecimentos,
      count: futures.length
    });
  });
  
  // Ordenar por valor total (maiores primeiro)
  groups.sort((a, b) => b.totalValue - a.totalValue);
  
  console.log('✅ Grupos encontrados:', groups.length);
  groups.forEach((group, idx) => {
    console.log(`  ${idx + 1}. ${group.groupId}: R$ ${formatCurrency(group.totalValue)} - ${group.description}`);
  });
  
  return groups;
};

/**
 * Gera fingerprint único para assinaturas/compras recorrentes
 * Usado para evitar duplicatas em imports futuros
 */
export const generateSubscriptionFingerprint = (transaction: Transaction): string => {
  // Limpar e normalizar descrição
  const descClean = transaction.descricao_origem
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);
  
  // Normalizar valor (arredondar para evitar pequenas variações)
  const valorNormalizado = Math.round(Math.abs(transaction.valor) * 100) / 100;
  
  // Determinar frequência baseada no padrão
  let frequency = 'single';
  if (transaction.descricao_origem.toLowerCase().includes('parcela')) {
    frequency = 'installment';
  } else if (valorNormalizado < 100) {
    frequency = 'monthly'; // Valores pequenos são tipicamente mensais
  }
  
  return `${descClean}_${valorNormalizado}_${frequency}`;
};

/**
 * Valida se uma reconciliação é possível
 * Por enquanto, sempre retorna true (reconciliação manual)
 */
export const validateReconciliation = (transaction: Transaction, futures: FutureTransaction[]): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Validação básica
  if (!transaction) {
    errors.push('Transação não fornecida');
    return { valid: false, warnings, errors };
  }
  
  if (!futures || futures.length === 0) {
    errors.push('Nenhuma future transaction selecionada');
    return { valid: false, warnings, errors };
  }
  
  // Verificar se futures já foram reconciliadas
  const alreadyReconciled = futures.filter(f => f.is_reconciled);
  if (alreadyReconciled.length > 0) {
    errors.push(`${alreadyReconciled.length} transações já foram reconciliadas`);
  }
  
  // Comparar valores (apenas warning, não bloqueia)
  const totalFuturesValue = futures.reduce((sum, f) => sum + Math.abs(f.valor), 0);
  const transactionValue = Math.abs(transaction.valor);
  const difference = Math.abs(totalFuturesValue - transactionValue);
  
  if (difference > 0.01) {
    warnings.push(`Diferença de valores: R$ ${formatCurrency(difference)}`);
    warnings.push(`Transaction: R$ ${formatCurrency(transactionValue)}`);
    warnings.push(`Futures: R$ ${formatCurrency(totalFuturesValue)}`);
  }
  
  // Verificar se a transação já foi reconciliada
  if (transaction.is_from_reconciliation) {
    warnings.push('Esta transação já veio de uma reconciliação anterior');
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
};

/**
 * Agrupa futures por reconciliation_group
 * Função auxiliar para organização
 */
export const groupFuturesByReconciliation = (futures: FutureTransaction[]): Map<string, FutureTransaction[]> => {
  const groupsMap = new Map<string, FutureTransaction[]>();
  
  futures.forEach(future => {
    // Se não tem reconciliation_group, criar baseado na origem e mês
    const groupId = future.reconciliation_group || `${future.origem}_${future.mes_vencimento}`;
    
    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, []);
    }
    groupsMap.get(groupId)!.push(future);
  });
  
  return groupsMap;
};

/**
 * Gera um novo reconciliation_group ID único
 */
export const generateReconciliationGroupId = (origem: string, mesVencimento: string): string => {
  return `${origem.toUpperCase()}_${mesVencimento}`;
};

/**
 * Busca subscription tracking para evitar duplicatas
 */
export const findExistingSubscription = (
  trackings: SubscriptionTracking[], 
  fingerprint: string
): SubscriptionTracking | null => {
  return trackings.find(t => t.fingerprint === fingerprint) || null;
};

/**
 * Calcula próximo mês esperado para uma subscription
 */
export const calculateNextExpectedMonth = (currentMonth: string, increment: number = 1): string => {
  // currentMonth formato: AAMM (ex: 2507)
  const ano = parseInt('20' + currentMonth.substring(0, 2)); // 2025
  const mes = parseInt(currentMonth.substring(2, 4)); // 07
  
  const date = new Date(ano, mes - 1 + increment, 1);
  const novoAno = date.getFullYear().toString().slice(-2); // 25
  const novoMes = (date.getMonth() + 1).toString().padStart(2, '0'); // 08
  
  return `${novoAno}${novoMes}`;
};

/**
 * Formata informações de um grupo para exibição
 */
export const formatGroupInfo = (group: ReconciliationGroup): string => {
  const valorFormatado = formatCurrency(group.totalValue);
  return `${group.description} - R$ ${valorFormatado}`;
};

/**
 * Verifica se dois valores são aproximadamente iguais (tolerância para centavos)
 */
export const valuesAreApproximatelyEqual = (value1: number, value2: number, tolerance: number = 0.01): boolean => {
  return Math.abs(value1 - value2) <= tolerance;
};

export default {
  getAllReconciliationGroups,
  generateSubscriptionFingerprint,
  validateReconciliation,
  groupFuturesByReconciliation,
  generateReconciliationGroupId,
  findExistingSubscription,
  calculateNextExpectedMonth,
  formatGroupInfo,
  valuesAreApproximatelyEqual
};
