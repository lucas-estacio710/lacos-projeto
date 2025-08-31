// Script para adicionar categoria "Receita Legada PF" na hierarquia dinâmica
// Run with: npx tsx scripts/add-receita-legada-pf.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fubbvqkbhvqipskraedj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YmJ2cWtiaHZxaXBza3JhZWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNjU0MTYsImV4cCI6MjA2ODg0MTQxNn0.mZx9CrzB47PP1NOSxDZqYL3vA-ThIYI_fy1827e77oc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addReceitaLegadaPF() {
  console.log('🔧 Adicionando categoria "Receita Legada PF" na hierarquia dinâmica...\n');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // 1. Buscar a conta CONC.
    console.log('📋 1. Buscando conta CONC...');
    const { data: concConta, error: contaError } = await supabase
      .from('contas')
      .select('id, codigo, nome')
      .eq('user_id', user.id)
      .eq('codigo', 'CONC.')
      .single();

    if (contaError || !concConta) {
      throw new Error(`Erro ao buscar conta CONC.: ${contaError?.message}`);
    }

    console.log(`✅ Conta encontrada: ${concConta.codigo} - ${concConta.nome}`);

    // 2. Verificar se categoria já existe
    console.log('\n📋 2. Verificando se categoria já existe...');
    const { data: existingCategoria } = await supabase
      .from('categorias')
      .select('id, nome')
      .eq('user_id', user.id)
      .eq('conta_id', concConta.id)
      .eq('nome', 'Receita Legada PF')
      .single();

    if (existingCategoria) {
      console.log('⚠️  Categoria "Receita Legada PF" já existe!');
      console.log(`   ID: ${existingCategoria.id}`);
      return;
    }

    // 3. Criar categoria "Receita Legada PF"
    console.log('\n📋 3. Criando categoria "Receita Legada PF"...');
    const { data: novaCategoria, error: categoriaError } = await supabase
      .from('categorias')
      .insert({
        user_id: user.id,
        conta_id: concConta.id,
        nome: 'Receita Legada PF',
        icone: '📜',
        ordem_exibicao: 10,
        ativo: true
      })
      .select()
      .single();

    if (categoriaError || !novaCategoria) {
      throw new Error(`Erro ao criar categoria: ${categoriaError?.message}`);
    }

    console.log(`✅ Categoria criada: ${novaCategoria.nome}`);
    console.log(`   ID: ${novaCategoria.id}`);

    // 4. Criar subtipo "RECEITA LEGADA PF"
    console.log('\n📋 4. Criando subtipo "RECEITA LEGADA PF"...');
    const { data: novoSubtipo, error: subtipoError } = await supabase
      .from('subtipos')
      .insert({
        user_id: user.id,
        categoria_id: novaCategoria.id,
        nome: 'RECEITA LEGADA PF',
        ordem_exibicao: 1,
        ativo: true
      })
      .select()
      .single();

    if (subtipoError || !novoSubtipo) {
      throw new Error(`Erro ao criar subtipo: ${subtipoError?.message}`);
    }

    console.log(`✅ Subtipo criado: ${novoSubtipo.nome}`);
    console.log(`   ID: ${novoSubtipo.id}`);

    // 5. Verificar estrutura criada
    console.log('\n📋 5. Verificando estrutura criada...');
    const { data: hierarquia, error: hierarquiaError } = await supabase
      .from('vw_hierarquia_completa')
      .select('*')
      .eq('user_id', user.id)
      .eq('conta_codigo', 'CONC.')
      .eq('categoria_nome', 'Receita Legada PF');

    if (hierarquiaError || !hierarquia || hierarquia.length === 0) {
      throw new Error(`Erro ao verificar hierarquia: ${hierarquiaError?.message}`);
    }

    console.log(`✅ Hierarquia verificada na view:`);
    hierarquia.forEach(item => {
      console.log(`   ${item.conta_codigo} → ${item.categoria_nome} → ${item.subtipo_nome}`);
    });

    console.log('\n🎉 SUCESSO! Categoria "Receita Legada PF" adicionada com sucesso!');
    console.log('\n📋 ESTRUTURA CRIADA:');
    console.log('├── CONC.');
    console.log('│   ├── Receita Legada PF 📜');
    console.log('│   │   └── RECEITA LEGADA PF');

  } catch (error) {
    console.error('\n❌ ERRO:', error);
    console.error('Verifique se você está autenticado e se tem permissões no Supabase.');
  }
}

async function main() {
  await addReceitaLegadaPF();
  
  console.log('\n🎯 PRÓXIMOS PASSOS:');
  console.log('1. Verifique a hierarquia no dashboard');
  console.log('2. Teste criar transações com essa classificação');
  console.log('3. Execute migração se houver transações com "RECEITA LEGADA" para migrar');
}

main().catch(console.error);