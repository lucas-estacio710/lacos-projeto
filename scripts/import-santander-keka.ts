// Script para importar extrato Santander Keka da planilha Excel
// Executar: npx tsx scripts/import-santander-keka.ts

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Carregar variáveis de ambiente do .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente SUPABASE não encontradas em .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mapeamento de nomes de mês em português para número
const mesMap: Record<string, string> = {
  'Janeiro': '01',
  'Fevereiro': '02',
  'Março': '03',
  'Abril': '04',
  'Maio': '05',
  'Junho': '06',
  'Julho': '07',
  'Agosto': '08',
  'Setembro': '09',
  'Outubro': '10',
  'Novembro': '11',
  'Dezembro': '12'
};

interface ExcelRow {
  'Mês': string;      // "Dezembro 2024"
  'Data': string;     // "31/12"
  'Descrição': string;
  'Documento'?: string;
  'Valor': number;
  'Saldo': number;
}

interface Transaction {
  id: string;
  user_id: string;
  mes: string;
  data: string;
  descricao_origem: string;
  descricao: string;
  valor: number;
  origem: string;
  cc: string;
  realizado: 's' | 'p' | 'r';
  subtipo_id: string | null;
}

function parseDate(mesStr: string, dataStr: string): { dataISO: string; mesAAMM: string } {
  // mesStr: "Dezembro 2024"
  // dataStr: "31/12"

  const [mesNome, ano] = mesStr.split(' ');
  const mesNum = mesMap[mesNome];
  const [dia, mes] = dataStr.split('/');

  // Formato ISO: YYYY-MM-DD
  const dataISO = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

  // Formato mês: AAMM (ex: 2412 para dezembro 2024)
  const mesAAMM = `${ano.slice(-2)}${mes.padStart(2, '0')}`;

  return { dataISO, mesAAMM };
}

function generateId(data: string, descricao: string, valor: number, index: number): string {
  // Gerar ID único baseado nos dados
  const cleanDesc = descricao.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  const valorStr = Math.abs(valor).toString().replace('.', '');
  return `SANT_KEKA_${data.replace(/-/g, '')}_${cleanDesc}_${valorStr}_${index}`;
}

async function importTransactions() {
  console.log('📊 Iniciando importação Santander Keka...\n');

  // 1. Autenticar (precisa de um usuário logado)
  // Vamos buscar o primeiro usuário disponível ou usar um token de serviço

  // Ler planilha
  const xlsxPath = path.join(__dirname, '..', 'Extratos_Consolidados_v12.xlsx');
  console.log('📁 Lendo arquivo:', xlsxPath);

  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets['Movimentações'];

  if (!ws) {
    console.error('❌ Aba "Movimentações" não encontrada');
    process.exit(1);
  }

  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(ws);
  console.log(`📄 Total de linhas: ${rows.length}\n`);

  // Converter para formato de transação
  const transactions: Omit<Transaction, 'user_id'>[] = [];

  // SALDO INICIAL - ajuste para o saldo bater
  transactions.push({
    id: 'SANT_KEKA_20241201_SALDO_INICIAL_11801_0',
    mes: '2412',
    data: '2024-12-01',
    descricao_origem: 'SALDO INICIAL - AJUSTE',
    descricao: 'SALDO INICIAL - AJUSTE',
    valor: 118.01,
    origem: 'Santander Keka',
    cc: 'Santander Keka',
    realizado: 's', // Já realizado pois é saldo inicial
    subtipo_id: null
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Pular linhas vazias ou com dados incompletos
    if (!row['Mês'] || !row['Data'] || row['Valor'] === undefined) {
      console.log(`⚠️ Linha ${i + 2} ignorada: dados incompletos`);
      continue;
    }

    try {
      const { dataISO, mesAAMM } = parseDate(row['Mês'], row['Data']);
      const id = generateId(dataISO, row['Descrição'], row['Valor'], i);

      transactions.push({
        id,
        mes: mesAAMM,
        data: dataISO,
        descricao_origem: row['Descrição'],
        descricao: row['Descrição'],
        valor: row['Valor'],
        origem: 'Santander Keka',
        cc: 'Santander Keka',
        realizado: 'p', // Pendente para classificação posterior
        subtipo_id: null
      });
    } catch (err) {
      console.error(`❌ Erro na linha ${i + 2}:`, err);
    }
  }

  console.log(`✅ ${transactions.length} transações preparadas para importação\n`);

  // Mostrar preview
  console.log('📋 Preview das primeiras 5 transações:');
  transactions.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.data} | ${t.descricao.substring(0, 40)}... | R$ ${t.valor.toFixed(2)}`);
  });

  console.log('\n📋 Preview das últimas 5 transações:');
  transactions.slice(-5).forEach((t, i) => {
    console.log(`  ${transactions.length - 4 + i}. ${t.data} | ${t.descricao.substring(0, 40)}... | R$ ${t.valor.toFixed(2)}`);
  });

  // Calcular totais
  const totalEntradas = transactions.filter(t => t.valor > 0).reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = transactions.filter(t => t.valor < 0).reduce((sum, t) => sum + t.valor, 0);

  console.log('\n💰 Resumo:');
  console.log(`  Entradas: R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`  Saídas: R$ ${Math.abs(totalSaidas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`  Saldo: R$ ${(totalEntradas + totalSaidas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Solicitar confirmação antes de inserir
  console.log('\n⚠️ Para confirmar a importação, execute com --confirm');
  console.log('   npx tsx scripts/import-santander-keka.ts --confirm\n');

  if (!process.argv.includes('--confirm')) {
    console.log('🔸 Modo preview - nenhuma transação foi inserida');
    return;
  }

  // INSERIR NO BANCO
  console.log('\n🚀 Iniciando inserção no banco de dados...');

  // Buscar usuário atual (você precisa estar autenticado ou usar service role key)
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    console.error('❌ Erro de autenticação:', authError?.message || 'Usuário não encontrado');
    console.log('\n💡 Dica: Execute o app no navegador e faça login primeiro.');
    console.log('   Ou configure uma service role key para scripts de importação.');
    return;
  }

  const userId = authData.user.id;
  console.log(`👤 Usuário: ${authData.user.email}`);

  // Preparar transações com user_id
  const transactionsToInsert = transactions.map(t => ({
    ...t,
    user_id: userId
  }));

  // Verificar duplicatas
  const existingIds = transactionsToInsert.map(t => t.id);
  const { data: existing, error: checkError } = await supabase
    .from('transactions')
    .select('id')
    .in('id', existingIds);

  if (checkError) {
    console.error('❌ Erro ao verificar duplicatas:', checkError);
    return;
  }

  const existingIdSet = new Set(existing?.map(t => t.id) || []);
  const newTransactions = transactionsToInsert.filter(t => !existingIdSet.has(t.id));

  console.log(`📊 ${existingIdSet.size} duplicatas encontradas`);
  console.log(`📊 ${newTransactions.length} transações novas para inserir`);

  if (newTransactions.length === 0) {
    console.log('✅ Nenhuma transação nova para inserir');
    return;
  }

  // Inserir em lotes
  const BATCH_SIZE = 50;
  let insertedCount = 0;

  for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
    const batch = newTransactions.slice(i, i + BATCH_SIZE);

    const { error: insertError } = await supabase
      .from('transactions')
      .insert(batch);

    if (insertError) {
      console.error(`❌ Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError);
    } else {
      insertedCount += batch.length;
      console.log(`✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} transações inseridas`);
    }
  }

  console.log(`\n🎉 Importação concluída! ${insertedCount} transações inseridas.`);
}

// Executar
importTransactions().catch(console.error);
