// components/HierarchyManager.tsx - GERENCIADOR DE HIERARQUIA COM ABAS

import React, { useState } from 'react';
import { Plus, Save, FolderPlus, Building } from 'lucide-react';
import { useHierarchy } from '@/hooks/useHierarchy';

type TabType = 'complete' | 'existing' | 'subtipo';

export const HierarchyManager: React.FC = () => {
  const { contas, categorias, criarConta, criarCategoria, criarSubtipo } = useHierarchy();
  const [activeTab, setActiveTab] = useState<TabType>('complete');
  
  // Formulário da aba "Estrutura Completa"
  const [formData, setFormData] = useState({
    // Conta
    conta_nome: '',
    conta_codigo: '',
    conta_icone: '🏢',
    
    // Categoria
    categoria_nome: '',
    categoria_codigo: '',
    categoria_icone: '📊',
    
    // Subtipo
    subtipo_nome: '',
    subtipo_codigo: '',
    subtipo_icone: '💰',
    categoria_rapida: false,
    cor_botao: 'bg-gray-600 hover:bg-gray-500'
  });

  // Formulário da aba "Adicionar à Existente"
  const [existingFormData, setExistingFormData] = useState({
    // Conta selecionada
    conta_id: '',
    
    // Nova categoria
    categoria_nome: '',
    categoria_codigo: '',
    categoria_icone: '📊',
    
    // Novo subtipo
    subtipo_nome: '',
    subtipo_codigo: '',
    subtipo_icone: '💰',
    categoria_rapida: false,
    cor_botao: 'bg-gray-600 hover:bg-gray-500'
  });

  // Formulário da aba "Criar Subtipo"
  const [subtipoFormData, setSubtipoFormData] = useState({
    // Conta selecionada
    conta_id: '',
    // Categoria selecionada
    categoria_id: '',
    
    // Novo subtipo
    subtipo_nome: '',
    subtipo_codigo: '',
    subtipo_icone: '💰',
    categoria_rapida: false,
    cor_botao: 'bg-gray-600 hover:bg-gray-500'
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      console.log('🚀 Criando hierarquia completa...');

      // 1. Criar Conta
      console.log('📝 Criando conta:', formData.conta_nome);
      const novaConta = await criarConta({
        codigo: formData.conta_codigo,
        nome: formData.conta_nome,
        icone: formData.conta_icone,
        ordem_exibicao: 1
      });

      // 2. Criar Categoria
      console.log('📝 Criando categoria:', formData.categoria_nome);
      const novaCategoria = await criarCategoria({
        conta_id: novaConta.id,
        codigo: formData.categoria_codigo,
        nome: formData.categoria_nome,
        icone: formData.categoria_icone,
        ordem_exibicao: 1
      });

      // 3. Criar Subtipo
      console.log('📝 Criando subtipo:', formData.subtipo_nome);
      const novoSubtipo = await criarSubtipo({
        categoria_id: novaCategoria.id,
        codigo: formData.subtipo_codigo,
        nome: formData.subtipo_nome,
        icone: formData.subtipo_icone,
        ordem_exibicao: 1,
        categoria_rapida: formData.categoria_rapida,
        cor_botao: formData.cor_botao
      });

      console.log('✅ Hierarquia criada com sucesso!');
      console.log('🏢 Conta:', novaConta.nome);
      console.log('📊 Categoria:', novaCategoria.nome); 
      console.log('💰 Subtipo:', novoSubtipo.nome);

      setSuccess(true);
      
      // Limpar formulário após sucesso
      setTimeout(() => {
        setFormData({
          conta_nome: '',
          conta_codigo: '',
          conta_icone: '🏢',
          categoria_nome: '',
          categoria_codigo: '',
          categoria_icone: '📊',
          subtipo_nome: '',
          subtipo_codigo: '',
          subtipo_icone: '💰',
          categoria_rapida: false,
          cor_botao: 'bg-gray-600 hover:bg-gray-500'
        });
        setSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('❌ Erro ao criar hierarquia:', error);
      alert(`Erro ao criar hierarquia: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      console.log('🚀 Criando categoria e subtipo em conta existente...');

      const contaSelecionada = contas.find(c => c.id === existingFormData.conta_id);
      if (!contaSelecionada) {
        throw new Error('Conta não encontrada');
      }

      // 1. Criar Categoria
      console.log('📝 Criando categoria:', existingFormData.categoria_nome);
      const novaCategoria = await criarCategoria({
        conta_id: existingFormData.conta_id,
        codigo: existingFormData.categoria_codigo,
        nome: existingFormData.categoria_nome,
        icone: existingFormData.categoria_icone,
        ordem_exibicao: 1
      });

      // 2. Criar Subtipo
      console.log('📝 Criando subtipo:', existingFormData.subtipo_nome);
      const novoSubtipo = await criarSubtipo({
        categoria_id: novaCategoria.id,
        codigo: existingFormData.subtipo_codigo,
        nome: existingFormData.subtipo_nome,
        icone: existingFormData.subtipo_icone,
        ordem_exibicao: 1,
        categoria_rapida: existingFormData.categoria_rapida,
        cor_botao: existingFormData.cor_botao
      });

      console.log('✅ Categoria e subtipo criados com sucesso!');
      console.log('🏢 Em conta:', contaSelecionada.nome);
      console.log('📊 Nova categoria:', novaCategoria.nome); 
      console.log('💰 Novo subtipo:', novoSubtipo.nome);

      setSuccess(true);
      
      // Limpar formulário após sucesso
      setTimeout(() => {
        setExistingFormData({
          conta_id: '',
          categoria_nome: '',
          categoria_codigo: '',
          categoria_icone: '📊',
          subtipo_nome: '',
          subtipo_codigo: '',
          subtipo_icone: '💰',
          categoria_rapida: false,
          cor_botao: 'bg-gray-600 hover:bg-gray-500'
        });
        setSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('❌ Erro ao criar categoria/subtipo:', error);
      alert(`Erro ao criar categoria/subtipo: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubtipoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      console.log('🚀 Criando subtipo...');

      const categoriaSelecionada = categorias.find(c => c.id === subtipoFormData.categoria_id);
      if (!categoriaSelecionada) {
        throw new Error('Categoria não encontrada');
      }

      // Criar Subtipo
      console.log('📝 Criando subtipo:', subtipoFormData.subtipo_nome);
      const novoSubtipo = await criarSubtipo({
        categoria_id: subtipoFormData.categoria_id,
        codigo: subtipoFormData.subtipo_codigo,
        nome: subtipoFormData.subtipo_nome,
        icone: subtipoFormData.subtipo_icone,
        ordem_exibicao: 1,
        categoria_rapida: subtipoFormData.categoria_rapida,
        cor_botao: subtipoFormData.cor_botao
      });

      console.log('✅ Subtipo criado com sucesso!');
      console.log('📊 Em categoria:', categoriaSelecionada.nome);
      console.log('💰 Novo subtipo:', novoSubtipo.nome);

      // Reset form e success
      setSubtipoFormData({
        conta_id: '',
        categoria_id: '',
        subtipo_nome: '',
        subtipo_codigo: '',
        subtipo_icone: '💰',
        categoria_rapida: false,
        cor_botao: 'bg-gray-600 hover:bg-gray-500'
      });
      setSuccess(true);

      // Hide success message after 2 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('❌ Erro ao criar subtipo:', error);
      alert(`Erro ao criar subtipo: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <Building className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Gerenciar Hierarquia</h2>
      </div>

      {/* Abas */}
      <div className="mb-6">
        <div className="flex border-b border-gray-600">
          <button
            onClick={() => setActiveTab('complete')}
            className={`px-6 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'complete'
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Building className="w-4 h-4" />
            Estrutura Completa
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            className={`px-6 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'existing'
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            Adicionar à Existente
          </button>
          <button
            onClick={() => setActiveTab('subtipo')}
            className={`px-6 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'subtipo'
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            Criar Subtipo
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-900 border border-green-600 rounded-lg">
          <div className="text-green-200 font-medium">✅ Operação realizada com sucesso!</div>
          <div className="text-green-300 text-sm mt-1">
            {activeTab === 'complete' 
              ? 'Conta → Categoria → Subtipo criados e relacionados.'
              : activeTab === 'existing'
                ? 'Categoria → Subtipo adicionados à conta existente.'
                : 'Subtipo adicionado à categoria existente.'
            }
          </div>
        </div>
      )}

      {/* Conteúdo das Abas */}
      {activeTab === 'complete' && (
        <>
        <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* CONTA */}
        <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-600">
          <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2">
            <span className="text-xl">🏢</span>
            1. Nova Conta
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Código</label>
              <input
                type="text"
                value={formData.conta_codigo}
                onChange={(e) => setFormData({...formData, conta_codigo: e.target.value.toUpperCase()})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="PJ"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
              <input
                type="text"
                value={formData.conta_nome}
                onChange={(e) => setFormData({...formData, conta_nome: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="Pessoa Jurídica"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
              <input
                type="text"
                value={formData.conta_icone}
                onChange={(e) => setFormData({...formData, conta_icone: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                placeholder="🏢"
              />
            </div>
          </div>
        </div>

        {/* CATEGORIA */}
        <div className="bg-green-900/20 p-4 rounded-lg border border-green-600">
          <h3 className="text-lg font-semibold text-green-300 mb-4 flex items-center gap-2">
            <span className="text-xl">📊</span>
            2. Nova Categoria
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Código</label>
              <input
                type="text"
                value={formData.categoria_codigo}
                onChange={(e) => setFormData({...formData, categoria_codigo: e.target.value.toUpperCase()})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="RECEITAS"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
              <input
                type="text"
                value={formData.categoria_nome}
                onChange={(e) => setFormData({...formData, categoria_nome: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="Receitas"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
              <input
                type="text"
                value={formData.categoria_icone}
                onChange={(e) => setFormData({...formData, categoria_icone: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                placeholder="📊"
              />
            </div>
          </div>
        </div>

        {/* SUBTIPO */}
        <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-600">
          <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
            <span className="text-xl">💰</span>
            3. Novo Subtipo
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Código</label>
              <input
                type="text"
                value={formData.subtipo_codigo}
                onChange={(e) => setFormData({...formData, subtipo_codigo: e.target.value.toUpperCase()})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="SALARIO"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
              <input
                type="text"
                value={formData.subtipo_nome}
                onChange={(e) => setFormData({...formData, subtipo_nome: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="Salário"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
              <input
                type="text"
                value={formData.subtipo_icone}
                onChange={(e) => setFormData({...formData, subtipo_icone: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                placeholder="💰"
              />
            </div>
          </div>

          {/* Categoria Rápida */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.categoria_rapida}
                  onChange={(e) => setFormData({...formData, categoria_rapida: e.target.checked})}
                  className="rounded"
                />
                Categoria Rápida (botão de classificação)
              </label>
            </div>
            
            {formData.categoria_rapida && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cor do Botão</label>
                <select
                  value={formData.cor_botao}
                  onChange={(e) => setFormData({...formData, cor_botao: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="bg-green-600 hover:bg-green-500">🟢 Verde</option>
                  <option value="bg-blue-600 hover:bg-blue-500">🔵 Azul</option>
                  <option value="bg-red-600 hover:bg-red-500">🔴 Vermelho</option>
                  <option value="bg-purple-600 hover:bg-purple-500">🟣 Roxo</option>
                  <option value="bg-orange-600 hover:bg-orange-500">🟠 Laranja</option>
                  <option value="bg-yellow-600 hover:bg-yellow-500">🟡 Amarelo</option>
                  <option value="bg-gray-600 hover:bg-gray-500">⚫ Cinza</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* SUBMIT */}
        <div className="flex justify-center pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
              loading
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                Criando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Criar Hierarquia Completa
              </>
            )}
          </button>
        </div>
        </form>

        {/* Exemplo */}
        <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-600">
          <h4 className="text-sm font-medium text-gray-300 mb-2">💡 Exemplo de estrutura criada:</h4>
          <div className="text-xs text-gray-400 font-mono">
            🏢 {formData.conta_nome || 'Pessoa Jurídica'} ({formData.conta_codigo || 'PJ'})
            <br />
            &nbsp;&nbsp;└── 📊 {formData.categoria_nome || 'Receitas'} ({formData.categoria_codigo || 'RECEITAS'})
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 💰 {formData.subtipo_nome || 'Salário'} ({formData.subtipo_codigo || 'SALARIO'})
            {formData.categoria_rapida && <span className="text-green-400"> [Botão Rápido]</span>}
          </div>
        </div>
        </>
      )}

      {activeTab === 'existing' && (
        <>
        <form onSubmit={handleExistingSubmit} className="space-y-8">
          
          {/* CONTA EXISTENTE */}
          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-600">
            <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2">
              <span className="text-xl">🏢</span>
              1. Selecionar Conta Existente
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Conta</label>
              <select
                value={existingFormData.conta_id}
                onChange={(e) => setExistingFormData({...existingFormData, conta_id: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                required
              >
                <option value="">Selecione uma conta...</option>
                {contas.map(conta => (
                  <option key={conta.id} value={conta.id}>
                    {conta.icone} {conta.nome} ({conta.codigo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NOVA CATEGORIA */}
          <div className="bg-green-900/20 p-4 rounded-lg border border-green-600">
            <h3 className="text-lg font-semibold text-green-300 mb-4 flex items-center gap-2">
              <span className="text-xl">📊</span>
              2. Nova Categoria
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Código</label>
                <input
                  type="text"
                  value={existingFormData.categoria_codigo}
                  onChange={(e) => setExistingFormData({...existingFormData, categoria_codigo: e.target.value.toUpperCase()})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="RECEITAS"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                <input
                  type="text"
                  value={existingFormData.categoria_nome}
                  onChange={(e) => setExistingFormData({...existingFormData, categoria_nome: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="Receitas"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
                <input
                  type="text"
                  value={existingFormData.categoria_icone}
                  onChange={(e) => setExistingFormData({...existingFormData, categoria_icone: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                  placeholder="📊"
                />
              </div>
            </div>
          </div>

          {/* NOVO SUBTIPO */}
          <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-600">
            <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
              <span className="text-xl">💰</span>
              3. Novo Subtipo
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Código</label>
                <input
                  type="text"
                  value={existingFormData.subtipo_codigo}
                  onChange={(e) => setExistingFormData({...existingFormData, subtipo_codigo: e.target.value.toUpperCase()})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="SALARIO"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                <input
                  type="text"
                  value={existingFormData.subtipo_nome}
                  onChange={(e) => setExistingFormData({...existingFormData, subtipo_nome: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="Salário"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
                <input
                  type="text"
                  value={existingFormData.subtipo_icone}
                  onChange={(e) => setExistingFormData({...existingFormData, subtipo_icone: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                  placeholder="💰"
                />
              </div>
            </div>

            {/* Categoria Rápida */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <input
                    type="checkbox"
                    checked={existingFormData.categoria_rapida}
                    onChange={(e) => setExistingFormData({...existingFormData, categoria_rapida: e.target.checked})}
                    className="rounded"
                  />
                  Categoria Rápida (botão de classificação)
                </label>
              </div>
              
              {existingFormData.categoria_rapida && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cor do Botão</label>
                  <select
                    value={existingFormData.cor_botao}
                    onChange={(e) => setExistingFormData({...existingFormData, cor_botao: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="bg-green-600 hover:bg-green-500">🟢 Verde</option>
                    <option value="bg-blue-600 hover:bg-blue-500">🔵 Azul</option>
                    <option value="bg-red-600 hover:bg-red-500">🔴 Vermelho</option>
                    <option value="bg-purple-600 hover:bg-purple-500">🟣 Roxo</option>
                    <option value="bg-orange-600 hover:bg-orange-500">🟠 Laranja</option>
                    <option value="bg-yellow-600 hover:bg-yellow-500">🟡 Amarelo</option>
                    <option value="bg-gray-600 hover:bg-gray-500">⚫ Cinza</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* SUBMIT */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
                loading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-purple-600 text-white hover:from-green-700 hover:to-purple-700 shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                  Criando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Adicionar à Conta
                </>
              )}
            </button>
          </div>
        </form>

        {/* Exemplo */}
        {existingFormData.conta_id && (
          <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-600">
            <h4 className="text-sm font-medium text-gray-300 mb-2">💡 Será adicionado à estrutura:</h4>
            <div className="text-xs text-gray-400 font-mono">
              🏢 {contas.find(c => c.id === existingFormData.conta_id)?.nome} ({contas.find(c => c.id === existingFormData.conta_id)?.codigo})
              <br />
              &nbsp;&nbsp;└── 📊 {existingFormData.categoria_nome || 'Nova Categoria'} ({existingFormData.categoria_codigo || 'CODIGO'})
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 💰 {existingFormData.subtipo_nome || 'Novo Subtipo'} ({existingFormData.subtipo_codigo || 'CODIGO'})
              {existingFormData.categoria_rapida && <span className="text-green-400"> [Botão Rápido]</span>}
            </div>
          </div>
        )}
        </>
      )}

      {activeTab === 'subtipo' && (
        <>
        <form onSubmit={handleSubtipoSubmit} className="space-y-8">
          
          {/* CONTA EXISTENTE */}
          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-600">
            <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2">
              <span className="text-xl">🏢</span>
              1. Selecionar Conta
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Conta</label>
              <select
                value={subtipoFormData.conta_id}
                onChange={(e) => {
                  setSubtipoFormData({
                    ...subtipoFormData, 
                    conta_id: e.target.value,
                    categoria_id: '' // Reset categoria when conta changes
                  });
                }}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                required
              >
                <option value="">Selecione uma conta...</option>
                {contas.map(conta => (
                  <option key={conta.id} value={conta.id}>
                    {conta.icone} {conta.nome} ({conta.codigo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CATEGORIA EXISTENTE */}
          {subtipoFormData.conta_id && (
            <div className="bg-green-900/20 p-4 rounded-lg border border-green-600">
              <h3 className="text-lg font-semibold text-green-300 mb-4 flex items-center gap-2">
                <span className="text-xl">📊</span>
                2. Selecionar Categoria
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
                <select
                  value={subtipoFormData.categoria_id}
                  onChange={(e) => setSubtipoFormData({...subtipoFormData, categoria_id: e.target.value})}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                >
                  <option value="">Selecione uma categoria...</option>
                  {categorias
                    .filter(categoria => categoria.conta_id === subtipoFormData.conta_id)
                    .map(categoria => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.icone} {categoria.nome} ({categoria.codigo})
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
          )}

          {/* NOVO SUBTIPO */}
          {subtipoFormData.categoria_id && (
            <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-600">
              <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
                <span className="text-xl">💰</span>
                3. Novo Subtipo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Código */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Código</label>
                  <input
                    type="text"
                    value={subtipoFormData.subtipo_codigo}
                    onChange={(e) => setSubtipoFormData({...subtipoFormData, subtipo_codigo: e.target.value.toUpperCase()})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="SALARIO"
                    required
                  />
                </div>
                
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                  <input
                    type="text"
                    value={subtipoFormData.subtipo_nome}
                    onChange={(e) => setSubtipoFormData({...subtipoFormData, subtipo_nome: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="Salário"
                    required
                  />
                </div>
                
                {/* Ícone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
                  <input
                    type="text"
                    value={subtipoFormData.subtipo_icone}
                    onChange={(e) => setSubtipoFormData({...subtipoFormData, subtipo_icone: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                    placeholder="💰"
                  />
                </div>
              </div>

              {/* Categoria Rápida */}
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={subtipoFormData.categoria_rapida}
                  onChange={(e) => setSubtipoFormData({...subtipoFormData, categoria_rapida: e.target.checked})}
                  className="rounded"
                />
                <label className="text-sm text-gray-300">
                  Criar botão rápido para classificação
                </label>
              </div>

              {/* Cor do Botão (se categoria rápida) */}
              {subtipoFormData.categoria_rapida && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cor do Botão</label>
                  <select
                    value={subtipoFormData.cor_botao}
                    onChange={(e) => setSubtipoFormData({...subtipoFormData, cor_botao: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="bg-blue-600 hover:bg-blue-500">🔵 Azul</option>
                    <option value="bg-green-600 hover:bg-green-500">🟢 Verde</option>
                    <option value="bg-red-600 hover:bg-red-500">🔴 Vermelho</option>
                    <option value="bg-yellow-600 hover:bg-yellow-500">🟡 Amarelo</option>
                    <option value="bg-purple-600 hover:bg-purple-500">🟣 Roxo</option>
                    <option value="bg-pink-600 hover:bg-pink-500">🩷 Rosa</option>
                    <option value="bg-indigo-600 hover:bg-indigo-500">🟦 Índigo</option>
                    <option value="bg-teal-600 hover:bg-teal-500">🟩 Teal</option>
                    <option value="bg-orange-600 hover:bg-orange-500">🟠 Laranja</option>
                    <option value="bg-gray-600 hover:bg-gray-500">⚫ Cinza</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* SUBMIT */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
                loading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                  Criando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Criar Subtipo
                </>
              )}
            </button>
          </div>
        </form>

        {/* Exemplo */}
        {subtipoFormData.categoria_id && (
          <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-600">
            <h4 className="text-sm font-medium text-gray-300 mb-2">💡 Será adicionado à estrutura:</h4>
            <div className="text-xs text-gray-400 font-mono">
              🏢 {contas.find(c => c.id === subtipoFormData.conta_id)?.nome} ({contas.find(c => c.id === subtipoFormData.conta_id)?.codigo})
              <br />
              &nbsp;&nbsp;└── 📊 {categorias.find(c => c.id === subtipoFormData.categoria_id)?.nome} ({categorias.find(c => c.id === subtipoFormData.categoria_id)?.codigo})
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 💰 {subtipoFormData.subtipo_nome || 'Novo Subtipo'} ({subtipoFormData.subtipo_codigo || 'CODIGO'})
              {subtipoFormData.categoria_rapida && <span className="text-green-400"> [Botão Rápido]</span>}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
};