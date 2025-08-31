// Script para migrar card_transactions existentes para novo sistema de hierarquia
// Run with: npx tsx scripts/migrate-card-transactions-to-hierarchy.ts

import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fubbvqkbhvqipskraedj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YmJ2cWtiaHZxaXBza3JhZWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNjU0MTYsImV4cCI6MjA2ODg0MTQxNn0.mZx9CrzB47PP1NOSxDZqYL3vA-ThIYI_fy1827e77oc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CardTransaction {
  id: string;
  categoria: string | null;
  subtipo: string | null;
  subtipo_id?: string;
  origem: string; // Para determinar conta (PJ/PF)
}

interface VisaoPlana {
  subtipo_id: string;
  conta_codigo: string;
  categoria_nome: string;
  subtipo_nome: string;
  caminho_completo: string;
}

async function loadHierarchy(): Promise<VisaoPlana[]> {
  try {
    console.log('🔄 Carregando hierarquia...');
    
    const { data, error } = await supabase
      .from('vw_hierarquia_completa')
      .select('*')
      .not('subtipo_id', 'is', null);
    
    if (error) throw error;
    
    const hierarchy: VisaoPlana[] = (data || []).map((item: any) => ({
      subtipo_id: item.subtipo_id,
      conta_codigo: item.conta_codigo,
      categoria_nome: item.categoria_nome,
      subtipo_nome: item.subtipo_nome,
      caminho_completo: item.caminho_completo
    }));
    
    console.log(`✅ Hierarquia carregada: ${hierarchy.length} subtipos`);
    return hierarchy;
  } catch (err) {
    console.error('❌ Erro ao carregar hierarquia:', err);
    throw err;
  }
}

async function loadCardTransactionsToMigrate(): Promise<CardTransaction[]> {
  try {
    console.log('🔄 Carregando transações de cartão para migrar...');
    
    const { data, error } = await supabase
      .from('card_transactions')
      .select('id, categoria, subtipo, subtipo_id, origem')
      .is('subtipo_id', null) // Só card transactions sem subtipo_id
      .not('categoria', 'is', null) // Que já foram classificadas
      .not('subtipo', 'is', null);
    
    if (error) throw error;
    
    console.log(`📊 Encontradas ${data?.length || 0} transações de cartão para migrar`);
    return data || [];
  } catch (err) {
    console.error('❌ Erro ao carregar transações de cartão:', err);
    throw err;
  }
}

function determineAccountFromOrigin(origem: string): string {
  // Mapear origem para conta (você pode ajustar conforme sua lógica)
  const origemMap: Record<string, string> = {
    'VISA': 'PJ',
    'MasterCard': 'PJ',
    'Nubank': 'PF',
    // Adicione outros mapeamentos conforme necessário
  };
  
  return origemMap[origem] || 'PJ'; // Default para PJ
}

function findCardSubtipoIdFromLegacy(
  cardTransaction: CardTransaction,
  hierarchy: VisaoPlana[]
): string | null {
  if (!cardTransaction.categoria || !cardTransaction.subtipo) {
    return null;
  }
  
  const conta = determineAccountFromOrigin(cardTransaction.origem);
  
  const subtipo = hierarchy.find(item => 
    item.conta_codigo === conta &&
    item.categoria_nome === cardTransaction.categoria &&
    item.subtipo_nome === cardTransaction.subtipo
  );
  
  return subtipo?.subtipo_id || null;
}

async function migrateCardTransaction(
  cardTransaction: CardTransaction, 
  hierarchy: VisaoPlana[]
): Promise<boolean> {
  try {
    const subtipo_id = findCardSubtipoIdFromLegacy(cardTransaction, hierarchy);
    
    if (!subtipo_id) {
      const conta = determineAccountFromOrigin(cardTransaction.origem);
      console.warn(`⚠️  Classificação não encontrada para card transaction ${cardTransaction.id}:`);
      console.warn(`   ${conta} > ${cardTransaction.categoria} > ${cardTransaction.subtipo} (origem: ${cardTransaction.origem})`);
      return false;
    }
    
    const { error } = await supabase
      .from('card_transactions')
      .update({ subtipo_id })
      .eq('id', cardTransaction.id);
    
    if (error) {
      console.error(`❌ Erro ao migrar card transaction ${cardTransaction.id}:`, error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Erro inesperado na card transaction ${cardTransaction.id}:`, err);
    return false;
  }
}

async function generateMigrationReport(
  cardTransactions: CardTransaction[],
  hierarchy: VisaoPlana[]
) {
  console.log('\n📊 RELATÓRIO DE MIGRAÇÃO - CARD TRANSACTIONS');
  console.log('='.repeat(55));
  
  const stats = {
    total: cardTransactions.length,
    found: 0,
    notFound: 0,
    byOrigin: {} as Record<string, number>
  };
  
  const notFoundClassifications = new Set<string>();
  
  cardTransactions.forEach(cardTransaction => {
    const subtipo_id = findCardSubtipoIdFromLegacy(cardTransaction, hierarchy);
    
    if (subtipo_id) {
      stats.found++;
      stats.byOrigin[cardTransaction.origem] = (stats.byOrigin[cardTransaction.origem] || 0) + 1;
    } else {
      stats.notFound++;
      const conta = determineAccountFromOrigin(cardTransaction.origem);
      const classification = `${conta} > ${cardTransaction.categoria} > ${cardTransaction.subtipo} (${cardTransaction.origem})`;
      notFoundClassifications.add(classification);
    }
  });
  
  console.log(`Total de card transactions: ${stats.total}`);
  console.log(`Classificações encontradas: ${stats.found} (${((stats.found/stats.total)*100).toFixed(1)}%)`);
  console.log(`Classificações não encontradas: ${stats.notFound} (${((stats.notFound/stats.total)*100).toFixed(1)}%)`);
  
  console.log('\n📈 Por origem:');
  Object.entries(stats.byOrigin).forEach(([origem, count]) => {
    console.log(`  ${origem}: ${count} transações`);
  });
  
  if (notFoundClassifications.size > 0) {
    console.log('\n⚠️  Classificações não encontradas:');
    Array.from(notFoundClassifications).sort().forEach(classification => {
      console.log(`  - ${classification}`);
    });
    
    console.log('\n💡 Dica: Verifique se o mapeamento origem->conta está correto no código');
  }
}

async function main() {
  console.log('🚀 Iniciando migração de card transactions para novo sistema de hierarquia\n');
  
  try {
    // 1. Carregar hierarquia
    const hierarchy = await loadHierarchy();
    
    if (hierarchy.length === 0) {
      console.error('❌ Nenhuma hierarquia encontrada. Execute primeiro as migrações de hierarquia.');
      process.exit(1);
    }
    
    // 2. Carregar card transactions para migrar
    const cardTransactions = await loadCardTransactionsToMigrate();
    
    if (cardTransactions.length === 0) {
      console.log('✅ Nenhuma card transaction precisa ser migrada!');
      return;
    }
    
    // 3. Gerar relatório antes de migrar
    await generateMigrationReport(cardTransactions, hierarchy);
    
    console.log('\n🔄 Iniciando migração...');
    console.log('(Para cancelar, pressione Ctrl+C)\n');
    
    // Aguardar 3 segundos para o usuário cancelar se quiser
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 4. Migrar card transactions
    let migrated = 0;
    let errors = 0;
    
    for (let i = 0; i < cardTransactions.length; i++) {
      const cardTransaction = cardTransactions[i];
      const success = await migrateCardTransaction(cardTransaction, hierarchy);
      
      if (success) {
        migrated++;
        if (migrated % 50 === 0) {
          console.log(`⏳ Migradas ${migrated}/${cardTransactions.length} card transactions...`);
        }
      } else {
        errors++;
      }
    }
    
    // 5. Relatório final
    console.log('\n🎉 MIGRAÇÃO DE CARD TRANSACTIONS CONCLUÍDA!');
    console.log('='.repeat(40));
    console.log(`✅ Migradas com sucesso: ${migrated}`);
    console.log(`❌ Erros: ${errors}`);
    console.log(`📊 Total processado: ${cardTransactions.length}`);
    
    if (errors > 0) {
      console.log('\n💡 Dicas para card transactions com erro:');
      console.log('- Verifique o mapeamento origem->conta no código');
      console.log('- Verifique se todas as classificações existem na hierarquia');
    }
    
  } catch (err) {
    console.error('❌ Erro na migração:', err);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { main as migrateCardTransactions };