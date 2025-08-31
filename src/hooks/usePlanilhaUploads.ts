// hooks/usePlanilhaUploads.ts - HOOKS PARA UPLOAD DAS 3 PLANILHAS

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface EntradaFinanceira {
  csv_id: string;
  id_contrato: string;
  data_hora: string; // ISO format
  tipo: string;
  metodo: string;
  cc: string;
  valor: number;
  desconto: number;
  desconto_percent: number;
  desconto_real: number;
  valor_com_desconto: number;
  flag_d: string;
  flag_t: string;
  taxa: number;
  taxa_percent: number;
  taxa_real: number;
  valor_final: number; // ⭐ CAMPO PRINCIPAL
  mes_competencia: string;
  parcelamento: string;
  id_transacao: string; // ⭐ CHAVE MATCHING
  utilizada: boolean; // ✅ NOVO: Vem do CSV ou padrão false
}

export interface AgendaInter {
  id_transacao: string; // ⭐ CHAVE PRINCIPAL
  data_hora: string;
  tipo: string;
  status: string;
  parcela: string;
  bandeira: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_antecipacao: number;
  valor_liquido: number; // ⭐ PARA MATCHING
  data_pagamento: string; // ⭐ USAR ESTA DATA
}

export interface PercentualContrato {
  id_transacao: string; // ⭐ CHAVE MATCHING
  id_contrato: string;
  percentual_catalogo: number; // 0-100
  percentual_planos: number; // 0-100
}

export interface UploadStats {
  total_registros: number;
  data_inicio: string;
  data_fim: string;
  valor_total?: number;
  contratos_unicos?: number;
  transacoes_unicas?: number;
  uploaded_at: string;
}

export interface UploadResult {
  success: boolean;
  stats?: UploadStats;
  errors: string[];
}

// ============================================================================
// UTILITÁRIOS DE PARSING
// ============================================================================

/**
 * Converte valor brasileiro (1.500,50) para decimal
 */
const parseValorBrasileiro = (valor: string): number => {
  if (!valor || valor.trim() === '') return 0;
  
  // Remover espaços e caracteres especiais
  let cleaned = valor.toString().trim();
  
  // Se já é um número válido, retornar
  if (!isNaN(Number(cleaned))) return Number(cleaned);
  
  // Remover pontos (separador de milhares) e substituir vírgula por ponto
  cleaned = cleaned
    .replace(/\./g, '') // Remove pontos
    .replace(',', '.'); // Vírgula vira ponto decimal
  
  const result = parseFloat(cleaned) || 0;
  return result;
};

/**
 * Converte percentual brasileiro (10%) para decimal (0.10)
 */
const parsePercentualBrasileiro = (percentual: string): number => {
  if (!percentual || percentual.trim() === '') return 0;
  
  let cleaned = percentual.toString().trim();
  
  // Remover % se existir
  cleaned = cleaned.replace('%', '');
  
  // Converter vírgula para ponto
  cleaned = cleaned.replace(',', '.');
  
  const result = parseFloat(cleaned) || 0;
  return result; // Manter como 0-100, não dividir por 100
};

/**
 * Converte data brasileira (DD/MM/YYYY HH:MM:SS) para ISO
 */
const parseDataBrasileira = (data: string): string => {
  if (!data || data.trim() === '') return '';
  
  try {
    // Regex para DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY
    const match = data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    
    if (!match) {
      console.warn('⚠️ Formato de data não reconhecido:', data);
      return '';
    }
    
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
    
    // Criar data em UTC para evitar problemas de timezone
    const isoDate = new Date(
      parseInt(year),
      parseInt(month) - 1, // Mês é 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    
    return isoDate.toISOString();
  } catch (error) {
    console.error('❌ Erro ao parsear data:', data, error);
    return '';
  }
};

/**
 * Converte data brasileira (DD/MM/YYYY) para YYYY-MM-DD
 */
const parseDataBrasileiraSimples = (data: string): string => {
  if (!data || data.trim() === '') return '';
  
  try {
    const match = data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    
    if (!match) {
      console.warn('⚠️ Formato de data não reconhecido:', data);
      return '';
    }
    
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch (error) {
    console.error('❌ Erro ao parsear data simples:', data, error);
    return '';
  }
};

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function usePlanilhaUploads() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<Record<string, UploadStats | null>>({
    entradas_financeiras: null,
    agenda_inter: null,
    percentuais_contrato: null
  });

  // ========================================================================
  // 1️⃣ UPLOAD ENTRADAS FINANCEIRAS
  // ========================================================================
  
  const uploadEntradasFinanceiras = async (file: File): Promise<UploadResult> => {
    console.log('📤 Iniciando upload Entradas Financeiras...');
    setLoading(prev => ({ ...prev, entradas_financeiras: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Parse CSV
      const text = await file.text();
      const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: ','
      }) as Papa.ParseResult<Record<string, any>>;

      if (parseResult.errors.length > 0) {
        console.error('❌ Erros no parse CSV:', parseResult.errors);
        return { success: false, errors: parseResult.errors.map((e: any) => e.message) };
      }

      console.log(`📊 ${parseResult.data.length} registros encontrados`);
      
      // ✅ DEBUG: Mostrar colunas disponíveis
      if (parseResult.data.length > 0) {
        const firstRow = parseResult.data[0] as Record<string, any>;
        console.log('🔍 DEBUG - Colunas encontradas no CSV:', Object.keys(firstRow));
        console.log('🔍 DEBUG - Colunas relacionadas a utilizada:', 
          Object.keys(firstRow).filter(k => 
            k.toLowerCase().includes('utiliz') || 
            k.toLowerCase().includes('usado') ||
            k.toLowerCase().includes('used')
          )
        );
      }

      // Processar e validar dados
      const entradas: EntradaFinanceira[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i] as Record<string, any>;
        
        try {
          // Validações obrigatórias
          if (!row['ID'] || !row['IDContrato'] || !row['Data e Hora']) {
            errors.push(`Linha ${i + 2}: Campos obrigatórios faltando`);
            continue;
          }

          const entrada: EntradaFinanceira = {
            csv_id: String(row['ID']).trim(),
            id_contrato: String(row['IDContrato']).trim(),
            data_hora: parseDataBrasileira(row['Data e Hora']),
            tipo: String(row['TIpo'] || '').trim(),
            metodo: String(row['Método'] || '').trim(),
            cc: String(row['CC'] || '').trim(),
            valor: parseValorBrasileiro(row['Valor']),
            desconto: parseValorBrasileiro(row['Desconto']),
            desconto_percent: parsePercentualBrasileiro(row['Desconto%']),
            desconto_real: parseValorBrasileiro(row['DescontoReal']),
            valor_com_desconto: parseValorBrasileiro(row['Valor com desconto']),
            flag_d: String(row['FlagD'] || '').trim(),
            flag_t: String(row['FlagT'] || '').trim(),
            taxa: parseValorBrasileiro(row['Taxa']),
            taxa_percent: parsePercentualBrasileiro(row['Taxa%']),
            taxa_real: parseValorBrasileiro(row['TaxaReal']),
            valor_final: parseValorBrasileiro(row['Valor final']),
            mes_competencia: String(row['Mês Competência'] || '').trim(),
            parcelamento: String(row['Parcelamento'] || '').trim(),
            id_transacao: String(row['IDTransação'] || '').trim(),
            // ✅ LER COLUNA UTILIZADA DO CSV (verificar vários formatos possíveis)
            utilizada: (() => {
              const utilizadaValue = row['Utilizada'] || row['utilizada'] || row['UTILIZADA'] || row['Usado'] || row['usado'];
              console.log('🔍 DEBUG - Valor utilizada do CSV:', { 
                linha: i + 2, 
                valor: utilizadaValue, 
                tipo: typeof utilizadaValue,
                keys: Object.keys(row).filter(k => k.toLowerCase().includes('utiliz') || k.toLowerCase().includes('usado'))
              });
              
              if (!utilizadaValue) return false;
              
              const strValue = String(utilizadaValue).toLowerCase().trim();
              return strValue === 'true' || strValue === '1' || strValue === 'sim' || strValue === 'yes';
            })()
          };

          // Validações específicas
          if (!entrada.data_hora) {
            errors.push(`Linha ${i + 2}: Data inválida`);
            continue;
          }

          if (entrada.valor_final <= 0) {
            errors.push(`Linha ${i + 2}: Valor final deve ser maior que zero`);
            continue;
          }

          entradas.push(entrada);
        } catch (error) {
          errors.push(`Linha ${i + 2}: ${error}`);
        }
      }

      console.log(`✅ ${entradas.length} registros válidos, ${errors.length} erros`);

      if (entradas.length === 0) {
        return { success: false, errors: ['Nenhum registro válido encontrado'] };
      }

      // ✅ VERIFICAR SE CAMPO UTILIZADA EXISTE
      console.log('🔧 Verificando se campo utilizada existe...');
      let hasUtilizadaField = false;
      try {
        const { error: checkError } = await supabase
          .from('entradas_financeiras')
          .select('utilizada')
          .limit(1);

        if (checkError && (checkError.code === 'PGRST116' || checkError.code === 'PGRST204')) {
          console.log('📝 Campo utilizada não existe na tabela.');
          console.log('📝 Para funcionalidade completa, execute no Supabase SQL Editor:');
          console.log('   ALTER TABLE entradas_financeiras ADD COLUMN utilizada BOOLEAN DEFAULT FALSE;');
          console.log('🔄 Upload continuará sem este campo...');
          hasUtilizadaField = false;
        } else {
          // ✅ Campo utilizada encontrado na tabela
          hasUtilizadaField = true;
        }
      } catch (error) {
        console.warn('⚠️ Erro ao verificar estrutura da tabela:', error);
        hasUtilizadaField = false;
      }

      // Limpar tabela existente
      const { error: deleteError } = await supabase
        .from('entradas_financeiras')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Inserir novos dados em lotes
      console.log('💾 Inserindo registros em lotes...');
      const BATCH_SIZE = 100;
      
      for (let i = 0; i < entradas.length; i += BATCH_SIZE) {
        const batch = entradas.slice(i, i + BATCH_SIZE);
        const batchToInsert = batch.map(entrada => {
          const baseEntry = {
            user_id: user.id,
            ...entrada
          };
          
          // ✅ Campo utilizada sempre incluído no baseEntry (vem do CSV ou padrão false)
          // Não precisa adicionar nada extra
          
          return baseEntry;
        });

        const { error: insertError } = await supabase
          .from('entradas_financeiras')
          .insert(batchToInsert);

        if (insertError) {
          console.error('❌ Erro detalhado no insert entradas_financeiras:');
          console.error('  - Erro completo:', JSON.stringify(insertError, null, 2));
          console.error('  - Message:', insertError.message);
          console.error('  - Code:', insertError.code);
          console.error('  - Details:', insertError.details);
          console.error('  - Hint:', insertError.hint);
          console.error('❌ Dados que causaram erro:', JSON.stringify(batchToInsert.slice(0, 1), null, 2));
          throw insertError;
        }

        // Log apenas a cada 5 batches para reduzir spam
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        if (batchNumber % 5 === 0) {
          console.log(`✅ ${batchNumber} batches inseridos...`);
        }
      }

      // Calcular estatísticas
      const dataHoras = entradas.map(e => e.data_hora).filter(Boolean).sort();
      const contratos = new Set(entradas.map(e => e.id_contrato)).size;
      const valorTotal = entradas.reduce((sum, e) => sum + e.valor_final, 0);

      const uploadStats: UploadStats = {
        total_registros: entradas.length,
        data_inicio: dataHoras[0] || '',
        data_fim: dataHoras[dataHoras.length - 1] || '',
        valor_total: valorTotal,
        contratos_unicos: contratos,
        uploaded_at: new Date().toISOString()
      };

      setStats(prev => ({ ...prev, entradas_financeiras: uploadStats }));

      console.log('🎉 Upload Entradas Financeiras concluído!');
      return { success: true, stats: uploadStats, errors };

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'] 
      };
    } finally {
      setLoading(prev => ({ ...prev, entradas_financeiras: false }));
    }
  };

  // ========================================================================
  // 2️⃣ UPLOAD AGENDA INTER
  // ========================================================================
  
  const uploadAgendaInter = async (file: File): Promise<UploadResult> => {
    console.log('📤 Iniciando upload Agenda Inter...');
    setLoading(prev => ({ ...prev, agenda_inter: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Parse CSV com separador ponto-e-vírgula
      const text = await file.text();
      const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';' // ⭐ SEPARADOR PONTO-E-VÍRGULA
      }) as Papa.ParseResult<Record<string, any>>;

      if (parseResult.errors.length > 0) {
        console.error('❌ Erros no parse CSV:', parseResult.errors);
        return { success: false, errors: parseResult.errors.map((e: any) => e.message) };
      }

      console.log(`📊 ${parseResult.data.length} registros encontrados`);

      // Processar dados
      const agenda: AgendaInter[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i] as Record<string, any>;
        
        try {
          // Campos obrigatórios
          if (!row['ID Transação'] || !row['Data pagamento']) {
            errors.push(`Linha ${i + 2}: ID Transação e Data pagamento são obrigatórios`);
            continue;
          }

          const agendaItem: AgendaInter = {
            id_transacao: String(row['ID Transação']).trim(),
            data_hora: parseDataBrasileira(row['Data e Hora'] || ''),
            tipo: String(row['Tipo'] || '').trim(),
            status: String(row['Status'] || '').trim(),
            parcela: String(row['Parcela'] || '').trim(),
            bandeira: String(row['Bandeira'] || '').trim(),
            valor_bruto: parseValorBrasileiro(row['Valor bruto']),
            valor_taxa: parseValorBrasileiro(row['Valor taxa']),
            valor_antecipacao: parseValorBrasileiro(row['Valor antecipação']),
            valor_liquido: parseValorBrasileiro(row['Valor líquido']),
            data_pagamento: parseDataBrasileiraSimples(row['Data pagamento'])
          };

          // Validações
          if (!agendaItem.data_pagamento) {
            errors.push(`Linha ${i + 2}: Data de pagamento inválida`);
            continue;
          }

          // Só considerar registros com status "Pago"
          if (agendaItem.status !== 'Pago') {
            continue; // Pular, não é erro
          }

          agenda.push(agendaItem);
        } catch (error) {
          errors.push(`Linha ${i + 2}: ${error}`);
        }
      }

      console.log(`✅ ${agenda.length} registros "Pago" válidos, ${errors.length} erros`);

      if (agenda.length === 0) {
        return { success: false, errors: ['Nenhum registro "Pago" válido encontrado'] };
      }

      // Limpar e inserir
      console.log('🗑️ Limpando registros anteriores...');
      const { error: deleteError } = await supabase
        .from('agenda_inter')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      console.log('💾 Inserindo novos registros...');
      const agendaToInsert = agenda.map(item => ({
        user_id: user.id,
        ...item
      }));

      const { error: insertError } = await supabase
        .from('agenda_inter')
        .insert(agendaToInsert);

      if (insertError) {
        console.error('❌ Erro detalhado no insert agenda_inter:');
        console.error('  - Erro completo:', JSON.stringify(insertError, null, 2));
        console.error('  - Message:', insertError.message);
        console.error('  - Code:', insertError.code);
        console.error('  - Details:', insertError.details);
        console.error('  - Hint:', insertError.hint);
        console.error('❌ Dados que causaram erro:', JSON.stringify(agendaToInsert.slice(0, 1), null, 2));
        throw insertError;
      }

      // Estatísticas
      const datas = agenda.map(a => a.data_pagamento).filter(Boolean).sort();
      const transacoes = new Set(agenda.map(a => a.id_transacao)).size;
      const valorTotal = agenda.reduce((sum, a) => sum + a.valor_liquido, 0);

      const uploadStats: UploadStats = {
        total_registros: agenda.length,
        data_inicio: datas[0] || '',
        data_fim: datas[datas.length - 1] || '',
        valor_total: valorTotal,
        transacoes_unicas: transacoes,
        uploaded_at: new Date().toISOString()
      };

      setStats(prev => ({ ...prev, agenda_inter: uploadStats }));

      console.log('🎉 Upload Agenda Inter concluído!');
      return { success: true, stats: uploadStats, errors };

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'] 
      };
    } finally {
      setLoading(prev => ({ ...prev, agenda_inter: false }));
    }
  };

  // ========================================================================
  // 3️⃣ UPLOAD PERCENTUAIS CONTRATO
  // ========================================================================
  
  const uploadPercentuaisContrato = async (file: File): Promise<UploadResult> => {
    console.log('📤 Iniciando upload Percentuais Contrato...');
    setLoading(prev => ({ ...prev, percentuais_contrato: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Parse CSV
      const text = await file.text();
      const lines = text.split('\n');
      
      // ⭐ IGNORAR PRIMEIRA LINHA (cabeçalho inútil)
      const csvContent = lines.slice(1).join('\n');
      
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ','
      }) as Papa.ParseResult<Record<string, any>>;

      if (parseResult.errors.length > 0) {
        console.error('❌ Erros no parse CSV:', parseResult.errors);
        return { success: false, errors: parseResult.errors.map((e: any) => e.message) };
      }

      console.log(`📊 ${parseResult.data.length} registros encontrados`);

      // Processar dados
      const percentuais: PercentualContrato[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i] as Record<string, any>;
        
        try {
          // Campos obrigatórios
          if (!row['IDTransação'] || !row['IDContrato']) {
            errors.push(`Linha ${i + 3}: IDTransação e IDContrato são obrigatórios`); // +3 por causa da linha ignorada
            continue;
          }

          const percentualItem: PercentualContrato = {
            id_transacao: String(row['IDTransação']).trim(),
            id_contrato: String(row['IDContrato']).trim(),
            percentual_catalogo: parsePercentualBrasileiro(row['Catálogo'] || '0'),
            percentual_planos: parsePercentualBrasileiro(row['Planos'] || '0')
          };

          // Validação dos percentuais
          const total = percentualItem.percentual_catalogo + percentualItem.percentual_planos;
          if (Math.abs(total - 100) > 0.01) { // Tolerância de 0.01%
            errors.push(`Linha ${i + 3}: Percentuais não somam 100% (${total}%)`);
            continue;
          }

          percentuais.push(percentualItem);
        } catch (error) {
          errors.push(`Linha ${i + 3}: ${error}`);
        }
      }

      console.log(`✅ ${percentuais.length} registros válidos, ${errors.length} erros`);

      if (percentuais.length === 0) {
        return { success: false, errors: ['Nenhum registro válido encontrado'] };
      }

      // Limpar e inserir
      console.log('🗑️ Limpando registros anteriores...');
      const { error: deleteError } = await supabase
        .from('percentuais_contrato')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      console.log('💾 Inserindo novos registros...');
      const percentuaisToInsert = percentuais.map(item => ({
        user_id: user.id,
        ...item
      }));

      const { error: insertError } = await supabase
        .from('percentuais_contrato')
        .insert(percentuaisToInsert);

      if (insertError) {
        console.error('❌ Erro detalhado no insert percentuais_contrato:');
        console.error('  - Erro completo:', JSON.stringify(insertError, null, 2));
        console.error('  - Message:', insertError.message);
        console.error('  - Code:', insertError.code);
        console.error('  - Details:', insertError.details);
        console.error('  - Hint:', insertError.hint);
        console.error('❌ Dados que causaram erro:', JSON.stringify(percentuaisToInsert.slice(0, 1), null, 2));
        throw insertError;
      }

      // Estatísticas
      const contratos = new Set(percentuais.map(p => p.id_contrato)).size;
      const transacoes = new Set(percentuais.map(p => p.id_transacao)).size;

      const uploadStats: UploadStats = {
        total_registros: percentuais.length,
        data_inicio: '',
        data_fim: '',
        contratos_unicos: contratos,
        transacoes_unicas: transacoes,
        uploaded_at: new Date().toISOString()
      };

      setStats(prev => ({ ...prev, percentuais_contrato: uploadStats }));

      console.log('🎉 Upload Percentuais Contrato concluído!');
      return { success: true, stats: uploadStats, errors };

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'] 
      };
    } finally {
      setLoading(prev => ({ ...prev, percentuais_contrato: false }));
    }
  };

  // ========================================================================
  // FUNÇÕES AUXILIARES
  // ========================================================================

  const getStats = (tipo: 'entradas_financeiras' | 'agenda_inter' | 'percentuais_contrato') => {
    return stats[tipo];
  };

  const isLoading = (tipo: 'entradas_financeiras' | 'agenda_inter' | 'percentuais_contrato') => {
    return loading[tipo] || false;
  };

  const clearStats = () => {
    setStats({
      entradas_financeiras: null,
      agenda_inter: null,
      percentuais_contrato: null
    });
  };

  return {
    // Funções de upload
    uploadEntradasFinanceiras,
    uploadAgendaInter,
    uploadPercentuaisContrato,
    
    // Estado
    loading,
    stats,
    
    // Helpers
    getStats,
    isLoading,
    clearStats
  };
}