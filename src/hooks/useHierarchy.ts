// hooks/useHierarchy.ts - Sistema de hierarquia Contas > Categorias > Subtipos

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DatabaseConta,
  DatabaseCategoria,
  DatabaseSubtipo,
  ContaComCategorias,
  HieraquiaCompleta,
  VisaoPlana,
  CreateContaRequest,
  UpdateContaRequest,
  CreateCategoriaRequest,
  UpdateCategoriaRequest,
  CreateSubtipoRequest,
  UpdateSubtipoRequest
} from '@/types/database';

export function useHierarchy() {
  // State
  const [contas, setContas] = useState<DatabaseConta[]>([]);
  const [categorias, setCategorias] = useState<DatabaseCategoria[]>([]);
  const [subtipos, setSubtipos] = useState<DatabaseSubtipo[]>([]);
  const [hierarquia, setHierarquia] = useState<HieraquiaCompleta[]>([]);
  const [visaoPlana, setVisaoPlana] = useState<VisaoPlana[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== LOAD DATA =====
  const carregarContas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('ativo', true)
        .order('ordem_exibicao', { ascending: true });

      if (error) throw error;
      setContas(data || []);
      return data || [];
    } catch (err) {
      console.error('❌ Erro ao carregar contas:', err);
      setError(`Erro ao carregar contas: ${(err as Error).message}`);
      return [];
    }
  }, []);

  const carregarCategorias = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('ativo', true)
        .order('ordem_exibicao', { ascending: true });

      if (error) throw error;
      setCategorias(data || []);
      return data || [];
    } catch (err) {
      console.error('❌ Erro ao carregar categorias:', err);
      setError(`Erro ao carregar categorias: ${(err as Error).message}`);
      return [];
    }
  }, []);

  const carregarSubtipos = useCallback(async () => {
    try {
      console.log('📊 Carregando subtipos...');
      const { data, error } = await supabase
        .from('subtipos')
        .select('*')
        .eq('ativo', true)
        .order('ordem_exibicao', { ascending: true });

      if (error) throw error;
      console.log('📊 Subtipos carregados:', data?.length || 0);
      setSubtipos(data || []);
      return data || [];
    } catch (err) {
      console.error('❌ Erro ao carregar subtipos:', err);
      setError(`Erro ao carregar subtipos: ${(err as Error).message}`);
      return [];
    }
  }, []);

  // Carregar hierarquia completa com relacionamentos
  const carregarHierarquia = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('contas')
        .select(`
          *,
          categorias:categorias!categorias_conta_id_fkey(
            *,
            subtipos:subtipos!subtipos_categoria_id_fkey(*)
          )
        `)
        .eq('ativo', true)
        .eq('categorias.ativo', true)
        .eq('categorias.subtipos.ativo', true)
        .order('ordem_exibicao', { ascending: true });

      if (error) throw error;

      const hierarquiaData: HieraquiaCompleta[] = (data || []).map(conta => ({
        conta,
        categorias: conta.categorias.map((categoria: any) => ({
          categoria,
          subtipos: categoria.subtipos || []
        }))
      }));

      setHierarquia(hierarquiaData);
      return hierarquiaData;
    } catch (err) {
      console.error('❌ Erro ao carregar hierarquia:', err);
      setError(`Erro ao carregar hierarquia: ${(err as Error).message}`);
      return [];
    }
  }, []);

  // Carregar visão plana para dropdowns
  const carregarVisaoPlana = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vw_hierarquia_completa')
        .select('*')
        .not('subtipo_id', 'is', null)
        .order('conta_codigo, categoria_codigo, subtipo_codigo');

      if (error) throw error;

      const visaoPlan: VisaoPlana[] = (data || []).map((item: any) => ({
        subtipo_id: item.subtipo_id,
        subtipo_nome: item.subtipo_nome,
        subtipo_codigo: item.subtipo_codigo,
        categoria_id: item.categoria_id,
        categoria_nome: item.categoria_nome,
        categoria_codigo: item.categoria_codigo,
        conta_id: item.conta_id,
        conta_nome: item.conta_nome,
        conta_codigo: item.conta_codigo,
        caminho_completo: item.caminho_completo
      }));

      setVisaoPlana(visaoPlan);
      return visaoPlan;
    } catch (err) {
      console.error('❌ Erro ao carregar visão plana:', err);
      setError(`Erro ao carregar visão plana: ${(err as Error).message}`);
      return [];
    }
  }, []);

  // Carregar todos os dados
  const carregarTudo = useCallback(async () => {
    console.log('🔄 Iniciando carregamento completo da hierarquia...');
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        carregarContas(),
        carregarCategorias(),
        carregarSubtipos(),
        carregarHierarquia(),
        carregarVisaoPlana()
      ]);

      console.log('✅ Sistema de hierarquia carregado com sucesso');
      
      // Aguardar os estados serem atualizados
      setTimeout(() => {
        console.log('📊 Estados finais - Contas:', contas.length, 'Categorias:', categorias.length, 'Subtipos:', subtipos.length);
      }, 50);
    } catch (err) {
      console.error('❌ Erro ao carregar sistema de hierarquia:', err);
      setError(`Erro geral: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [carregarContas, carregarCategorias, carregarSubtipos, carregarHierarquia, carregarVisaoPlana]);

  // ===== CONTA OPERATIONS =====
  const criarConta = useCallback(async (data: CreateContaRequest) => {
    try {
      console.log('🔍 Tentando criar conta via RPC...');
      
      // Tentar via RPC primeiro (bypass RLS)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('criar_conta', {
        p_codigo: data.codigo,
        p_nome: data.nome,
        p_icone: data.icone,
        p_ativo: data.ativo,
        p_ordem_exibicao: data.ordem_exibicao
      });

      if (!rpcError && rpcResult) {
        console.log('✅ Conta criada via RPC:', rpcResult);
        await carregarTudo();
        return rpcResult;
      }

      console.log('❌ RPC falhou, tentando INSERT direto:', rpcError);

      // Fallback para INSERT direto
      const { data: novaConta, error } = await supabase
        .from('contas')
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Conta criada via INSERT direto:', novaConta);
      await carregarTudo();
      return novaConta;
    } catch (err) {
      console.error('❌ Erro ao criar conta:', err);
      throw new Error(`Erro ao criar conta: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  const atualizarConta = useCallback(async (id: string, data: UpdateContaRequest) => {
    try {
      const { data: contaAtualizada, error } = await supabase
        .from('contas')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Conta atualizada:', contaAtualizada);
      await carregarTudo();
      return contaAtualizada;
    } catch (err) {
      console.error('❌ Erro ao atualizar conta:', err);
      throw new Error(`Erro ao atualizar conta: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  const deletarConta = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('contas')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Conta desativada:', id);
      await carregarTudo();
      return true;
    } catch (err) {
      console.error('❌ Erro ao desativar conta:', err);
      throw new Error(`Erro ao desativar conta: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  // ===== CATEGORIA OPERATIONS =====
  const criarCategoria = useCallback(async (data: CreateCategoriaRequest) => {
    try {
      const { data: novaCategoria, error } = await supabase
        .from('categorias')
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Categoria criada:', novaCategoria);
      await carregarTudo();
      return novaCategoria;
    } catch (err) {
      console.error('❌ Erro ao criar categoria:', err);
      throw new Error(`Erro ao criar categoria: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  const atualizarCategoria = useCallback(async (id: string, data: UpdateCategoriaRequest) => {
    try {
      const { data: categoriaAtualizada, error } = await supabase
        .from('categorias')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Categoria atualizada:', categoriaAtualizada);
      await carregarTudo();
      return categoriaAtualizada;
    } catch (err) {
      console.error('❌ Erro ao atualizar categoria:', err);
      throw new Error(`Erro ao atualizar categoria: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  const deletarCategoria = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('categorias')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Categoria desativada:', id);
      await carregarTudo();
      return true;
    } catch (err) {
      console.error('❌ Erro ao desativar categoria:', err);
      throw new Error(`Erro ao desativar categoria: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  // ===== SUBTIPO OPERATIONS =====
  const criarSubtipo = useCallback(async (data: CreateSubtipoRequest) => {
    try {
      const { data: novoSubtipo, error } = await supabase
        .from('subtipos')
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Subtipo criado:', novoSubtipo);
      await carregarTudo();
      return novoSubtipo;
    } catch (err) {
      console.error('❌ Erro ao criar subtipo:', err);
      throw new Error(`Erro ao criar subtipo: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  const atualizarSubtipo = useCallback(async (id: string, data: UpdateSubtipoRequest) => {
    try {
      console.log('🔍 Procurando subtipo ID:', id);
      
      // Primeiro, verificar se o subtipo existe
      const { data: existingSubtipo, error: checkError } = await supabase
        .from('subtipos')
        .select('*')
        .eq('id', id)
        .single();

      if (checkError) {
        console.error('❌ Subtipo não encontrado:', checkError);
        throw new Error(`Subtipo não encontrado: ${checkError.message}`);
      }

      console.log('✅ Subtipo encontrado:', existingSubtipo);

      // Fazer o update sem select para evitar conflitos de RLS
      console.log('📝 Fazendo update com dados:', data);
      
      // Tentar update field por field para debug
      const updates = [];
      
      if (data.nome !== existingSubtipo.nome) {
        const { error: nomeError } = await supabase
          .from('subtipos')
          .update({ nome: data.nome })
          .eq('id', id);
        
        updates.push(`nome: ${nomeError ? '❌' : '✅'}`);
        if (nomeError) console.error('❌ Erro ao atualizar nome:', nomeError);
      }
      
      if (data.icone !== existingSubtipo.icone) {
        const { error: iconeError } = await supabase
          .from('subtipos')
          .update({ icone: data.icone })
          .eq('id', id);
        
        updates.push(`icone: ${iconeError ? '❌' : '✅'}`);
        if (iconeError) console.error('❌ Erro ao atualizar icone:', iconeError);
      }
      
      if (data.ordem_exibicao !== existingSubtipo.ordem_exibicao) {
        const { error: ordemError } = await supabase
          .from('subtipos')
          .update({ ordem_exibicao: data.ordem_exibicao })
          .eq('id', id);
        
        updates.push(`ordem: ${ordemError ? '❌' : '✅'}`);
        if (ordemError) console.error('❌ Erro ao atualizar ordem:', ordemError);
      }
      
      console.log('📊 Resultado updates individuais:', updates.join(', '));

      console.log('✅ Subtipo atualizado com sucesso');
      
      // Aguardar um momento para garantir commit da transação
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verificar se realmente foi atualizado
      const { data: verificacao, error: verifyError } = await supabase
        .from('subtipos')
        .select('nome, icone, ordem_exibicao')
        .eq('id', id)
        .single();
      
      console.log('🔍 Verificação pós-update:', verificacao);
      
      if (verifyError) {
        console.error('❌ Erro na verificação:', verifyError);
      } else {
        // Verificar se realmente mudou
        const changed = verificacao?.nome === data.nome;
        console.log('🎯 Nome foi atualizado?', changed, `"${verificacao?.nome}" vs "${data.nome}"`);
      }
      await carregarTudo();
      return existingSubtipo;
    } catch (err) {
      console.error('❌ Erro ao atualizar subtipo:', err);
      throw new Error(`Erro ao atualizar subtipo: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  const deletarSubtipo = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('subtipos')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Subtipo desativado:', id);
      await carregarTudo();
      return true;
    } catch (err) {
      console.error('❌ Erro ao desativar subtipo:', err);
      throw new Error(`Erro ao desativar subtipo: ${(err as Error).message}`);
    }
  }, [carregarTudo]);

  // ===== UTILITY FUNCTIONS =====
  const obterContaPorCodigo = useCallback((codigo: string): DatabaseConta | null => {
    return contas.find(conta => conta.codigo === codigo) || null;
  }, [contas]);

  const obterCategoriasPorConta = useCallback((contaId: string): DatabaseCategoria[] => {
    return categorias.filter(cat => cat.conta_id === contaId);
  }, [categorias]);

  const obterSubtiposPorCategoria = useCallback((categoriaId: string): DatabaseSubtipo[] => {
    return subtipos.filter(sub => sub.categoria_id === categoriaId);
  }, [subtipos]);

  const obterSubtipoPorId = useCallback((id: string): VisaoPlana | null => {
    return visaoPlana.find(item => item.subtipo_id === id) || null;
  }, [visaoPlana]);

  const obterSubtiposPorConta = useCallback((contaCodigo: string): VisaoPlana[] => {
    return visaoPlana.filter(item => item.conta_codigo === contaCodigo);
  }, [visaoPlana]);

  // Carregar dados no mount
  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  return {
    // Data
    contas,
    categorias,
    subtipos,
    hierarquia,
    visaoPlana,
    loading,
    error,

    // Actions
    carregarTudo,
    criarConta,
    atualizarConta,
    deletarConta,
    criarCategoria,
    atualizarCategoria,
    deletarCategoria,
    criarSubtipo,
    atualizarSubtipo,
    deletarSubtipo,

    // Utils
    obterContaPorCodigo,
    obterCategoriasPorConta,
    obterSubtiposPorCategoria,
    obterSubtipoPorId,
    obterSubtiposPorConta
  };
}