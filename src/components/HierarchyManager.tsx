// components/HierarchyManager.tsx - MODAL COM MINIAPLICAÇÕES PARA HIERARQUIA

import React, { useState } from 'react';
import { 
  Building2, 
  TreePine, 
  Eye, 
  Edit3, 
  Trash2, 
  Move, 
  Search,
  Settings,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Save,
  Tag,
  Folder
} from 'lucide-react';
import { useHierarchy } from '@/hooks/useHierarchy';

type MiniAppType = 
  | 'view' 
  | 'create' 
  | 'edit' 
  | 'delete' 
  | 'move' 
  | 'search' 
  | 'settings';

interface HierarchyManagerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const HierarchyManager: React.FC<HierarchyManagerProps> = ({ 
  isOpen = false, 
  onClose 
}) => {
  const [selectedApp, setSelectedApp] = useState<MiniAppType>('view');
  const [expandedContas, setExpandedContas] = useState<Set<string>>(new Set());
  const [expandedCategorias, setExpandedCategorias] = useState<Set<string>>(new Set());
  
  // Estados para busca
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Estados para edição
  const [editingItem, setEditingItem] = useState<{type: 'conta' | 'categoria' | 'subtipo', id: string, data: any} | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  // Estados para exclusão
  const [deletingItem, setDeletingItem] = useState<{type: 'conta' | 'categoria' | 'subtipo', id: string, data: any} | null>(null);
  
  const { 
    contas, 
    categorias, 
    subtipos, 
    hierarquia, 
    loading, 
    error, 
    criarConta, 
    criarCategoria, 
    criarSubtipo,
    atualizarConta,
    atualizarCategoria,
    atualizarSubtipo,
    deletarConta,
    deletarCategoria,
    deletarSubtipo
  } = useHierarchy();

  // Lista de miniaplicações disponíveis
  const miniApps = [
    {
      id: 'view' as MiniAppType,
      name: 'Visualizar Estrutura',
      icon: Eye,
      description: 'Ver toda a hierarquia de contas, categorias e subtipos em formato árvore',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'create' as MiniAppType,
      name: 'Criar Novo',
      icon: Plus,
      description: 'Criar novas contas, categorias e subtipos com assistente guiado',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      id: 'edit' as MiniAppType,
      name: 'Editar Existente',
      icon: Edit3,
      description: 'Modificar nomes, códigos, ícones e propriedades de itens existentes',
      color: 'bg-orange-500 hover:bg-orange-600'
    },
    {
      id: 'move' as MiniAppType,
      name: 'Mover/Reorganizar',
      icon: Move,
      description: 'Reorganizar a estrutura, mover categorias entre contas',
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      id: 'delete' as MiniAppType,
      name: 'Excluir Itens',
      icon: Trash2,
      description: 'Remover contas, categorias ou subtipos (com validações de segurança)',
      color: 'bg-red-500 hover:bg-red-600'
    },
    {
      id: 'search' as MiniAppType,
      name: 'Buscar e Filtrar',
      icon: Search,
      description: 'Localizar rapidamente qualquer item na hierarquia por nome ou código',
      color: 'bg-teal-500 hover:bg-teal-600'
    },
    {
      id: 'settings' as MiniAppType,
      name: 'Configurações',
      icon: Settings,
      description: 'Definir regras de nomenclatura, validações e preferências',
      color: 'bg-gray-500 hover:bg-gray-600'
    }
  ];

  const currentApp = miniApps.find(app => app.id === selectedApp);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4" data-modal="hierarchy">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header do Modal */}
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-4 md:p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <TreePine className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-white">Central de Hierarquia</h1>
                <p className="text-xs md:text-sm text-gray-300 hidden sm:block">Gerencie toda a estrutura de contas e categorias</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 md:w-6 md:h-6 text-gray-300" />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          
          {/* Sidebar com Miniaplicações - Mobile: Horizontal scroll, Desktop: Vertical */}
          <div className="md:w-80 bg-gray-800 border-b md:border-b-0 md:border-r border-gray-700 overflow-auto flex-shrink-0">
            <div className="p-3 md:p-4">
              <h3 className="text-xs md:text-sm font-medium text-gray-400 uppercase mb-3 md:mb-4 hidden md:block">Miniaplicações</h3>
              
              {/* Mobile: Grid horizontal com scroll */}
              <div className="flex md:flex-col gap-2 md:space-y-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                {miniApps.map((app) => {
                  const IconComponent = app.icon;
                  const isSelected = selectedApp === app.id;
                  
                  return (
                    <button
                      key={app.id}
                      onClick={() => setSelectedApp(app.id)}
                      className={`flex-shrink-0 md:w-full text-left p-2 md:p-3 rounded-lg transition-all ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center md:items-start gap-2 md:gap-3 min-w-0">
                        <div className={`p-1.5 md:p-2 rounded-lg flex-shrink-0 ${
                          isSelected ? 'bg-white/20' : app.color
                        }`}>
                          <IconComponent className="w-3 h-3 md:w-4 md:h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs md:text-sm truncate md:whitespace-normal">{app.name}</div>
                          <div className="text-xs opacity-75 mt-1 hidden md:block">{app.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Área de Conteúdo da Miniaplicação */}
          <div className="flex-1 p-3 md:p-6 overflow-y-auto min-h-0">
            {currentApp && (
              <>
                <div className="mb-4 md:mb-6">
                  <div className="flex items-center gap-2 md:gap-3 mb-2">
                    <div className={`p-1.5 md:p-2 rounded-lg ${currentApp.color}`}>
                      <currentApp.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-white">{currentApp.name}</h2>
                  </div>
                  <p className="text-sm md:text-base text-gray-400">{currentApp.description}</p>
                </div>

                {/* Conteúdo específico de cada miniaplicação */}
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 min-h-[500px] md:min-h-[600px]">
                  {renderAppContent(selectedApp, { 
                    hierarquia, 
                    loading, 
                    error, 
                    contas, 
                    categorias, 
                    subtipos, 
                    criarConta, 
                    criarCategoria, 
                    criarSubtipo,
                    atualizarConta,
                    atualizarCategoria,
                    atualizarSubtipo,
                    deletarConta,
                    deletarCategoria,
                    deletarSubtipo
                  }, expandedContas, setExpandedContas, expandedCategorias, setExpandedCategorias, editingItem, setEditingItem, editForm, setEditForm, searchTerm, setSearchTerm, searchResults, setSearchResults)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para renderizar a árvore da hierarquia
function HierarchyTree({ hierarquia, loading, error, expandedContas, setExpandedContas, expandedCategorias, setExpandedCategorias }: {
  hierarquia: any[];
  loading: boolean;
  error: string | null;
  expandedContas: Set<string>;
  setExpandedContas: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedCategorias: Set<string>;
  setExpandedCategorias: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const toggleConta = (contaId: string) => {
    const newExpanded = new Set(expandedContas);
    if (newExpanded.has(contaId)) {
      newExpanded.delete(contaId);
    } else {
      newExpanded.add(contaId);
    }
    setExpandedContas(newExpanded);
  };

  const toggleCategoria = (categoriaId: string) => {
    const newExpanded = new Set(expandedCategorias);
    if (newExpanded.has(categoriaId)) {
      newExpanded.delete(categoriaId);
    } else {
      newExpanded.add(categoriaId);
    }
    setExpandedCategorias(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        <span className="ml-3 text-gray-400">Carregando hierarquia...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-2">❌ Erro ao carregar hierarquia</div>
        <div className="text-sm text-gray-400">{error}</div>
      </div>
    );
  }

  if (!hierarquia.length) {
    return (
      <div className="text-center py-12">
        <TreePine className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <div className="text-gray-400">Nenhuma estrutura encontrada</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hierarquia.map((contaItem) => {
        const conta = contaItem.conta;
        const isContaExpanded = expandedContas.has(conta.id);
        
        return (
          <div key={conta.id} className="border border-gray-700 rounded-lg">
            {/* Conta */}
            <div 
              className="flex items-center p-3 bg-gray-800 hover:bg-gray-750 cursor-pointer rounded-t-lg"
              onClick={() => toggleConta(conta.id)}
            >
              {contaItem.categorias.length > 0 ? (
                isContaExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                )
              ) : (
                <div className="w-4 h-4 mr-2" />
              )}
              <Building2 className="w-5 h-5 text-blue-400 mr-2" />
              <span className="font-medium text-white">{conta.nome}</span>
              <span className="text-xs text-gray-400 ml-2">({conta.codigo})</span>
              <span className="ml-auto text-xs text-gray-500">{contaItem.categorias.length} categorias</span>
            </div>

            {/* Categorias */}
            {isContaExpanded && (
              <div className="border-t border-gray-700">
                {contaItem.categorias.map((categoriaItem: any) => {
                  const categoria = categoriaItem.categoria;
                  const isCategoriaExpanded = expandedCategorias.has(categoria.id);
                  
                  return (
                    <div key={categoria.id}>
                      <div 
                        className="flex items-center p-3 pl-8 bg-gray-850 hover:bg-gray-800 cursor-pointer"
                        onClick={() => toggleCategoria(categoria.id)}
                      >
                        {categoriaItem.subtipos.length > 0 ? (
                          isCategoriaExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                          )
                        ) : (
                          <div className="w-4 h-4 mr-2" />
                        )}
                        <div className="text-lg mr-2">{categoria.icone}</div>
                        <span className="text-gray-200">{categoria.nome}</span>
                        <span className="text-xs text-gray-500 ml-2">({categoria.codigo})</span>
                        <span className="ml-auto text-xs text-gray-600">{categoriaItem.subtipos.length} subtipos</span>
                      </div>

                      {/* Subtipos */}
                      {isCategoriaExpanded && (
                        <div className="bg-gray-900">
                          {categoriaItem.subtipos.map((subtipo: any) => (
                            <div key={subtipo.id} className="flex items-center p-2 pl-16 hover:bg-gray-800">
                              <div className="text-sm mr-2">{subtipo.icone}</div>
                              <span className="text-gray-300 text-sm">{subtipo.nome}</span>
                              <span className="text-xs text-gray-600 ml-2">({subtipo.codigo})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Componente para criar novos itens na hierarquia
function CreateWizard({ contas, categorias, criarConta, criarCategoria, criarSubtipo }: {
  contas: any[];
  categorias: any[];
  criarConta: any;
  criarCategoria: any;
  criarSubtipo: any;
}) {
  const [step, setStep] = useState<'select' | 'form'>('select');
  const [itemType, setItemType] = useState<'conta' | 'categoria' | 'subtipo' | null>(null);
  const [selectedContaId, setSelectedContaId] = useState<string>('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('');
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    icone: '',
    ordem_exibicao: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setStep('select');
    setItemType(null);
    setSelectedContaId('');
    setSelectedCategoriaId('');
    setFormData({ codigo: '', nome: '', icone: '', ordem_exibicao: 0 });
    setSuccess(null);
    setError(null);
  };

  const handleSelectType = (type: 'conta' | 'categoria' | 'subtipo') => {
    setItemType(type);
    setStep('form');
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemType) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      let result;
      
      switch (itemType) {
        case 'conta':
          result = await criarConta({
            codigo: formData.codigo,
            nome: formData.nome,
            icone: formData.icone,
            ativo: true,
            ordem_exibicao: formData.ordem_exibicao || 0
          });
          setSuccess(`Conta "${formData.nome}" criada com sucesso!`);
          break;
          
        case 'categoria':
          if (!selectedContaId) {
            throw new Error('Selecione uma conta para a categoria');
          }
          result = await criarCategoria({
            codigo: formData.codigo,
            nome: formData.nome,
            icone: formData.icone,
            conta_id: selectedContaId,
            ativo: true,
            ordem_exibicao: formData.ordem_exibicao || 0
          });
          setSuccess(`Categoria "${formData.nome}" criada com sucesso!`);
          break;
          
        case 'subtipo':
          if (!selectedCategoriaId) {
            throw new Error('Selecione uma categoria para o subtipo');
          }
          result = await criarSubtipo({
            codigo: formData.codigo,
            nome: formData.nome,
            icone: formData.icone,
            categoria_id: selectedCategoriaId,
            ativo: true,
            ordem_exibicao: formData.ordem_exibicao || 0
          });
          setSuccess(`Subtipo "${formData.nome}" criado com sucesso!`);
          break;
      }
      
      // Limpar formulário após sucesso
      setTimeout(() => {
        resetForm();
      }, 2000);
      
    } catch (err) {
      console.error('Erro ao criar item:', err);
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
          <Plus className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Sucesso!</h3>
        <p className="text-green-400 mb-4">{success}</p>
        <button
          onClick={resetForm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Criar Outro Item
        </button>
      </div>
    );
  }

  if (step === 'select') {
    return (
      <div className="h-full">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-2">Assistente de Criação</h3>
          <p className="text-sm text-gray-400">Escolha o tipo de item que deseja criar</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => handleSelectType('conta')}
            className="bg-blue-900/20 border border-blue-600 rounded-lg p-6 hover:bg-blue-900/30 transition-colors group"
          >
            <Building2 className="w-12 h-12 text-blue-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <div className="text-white font-medium mb-2">Nova Conta</div>
            <div className="text-sm text-gray-400">Criar uma nova conta principal</div>
          </button>
          
          <button
            onClick={() => handleSelectType('categoria')}
            className="bg-green-900/20 border border-green-600 rounded-lg p-6 hover:bg-green-900/30 transition-colors group"
            disabled={!contas.length}
          >
            <TreePine className="w-12 h-12 text-green-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <div className="text-white font-medium mb-2">Nova Categoria</div>
            <div className="text-sm text-gray-400">Criar categoria dentro de uma conta</div>
            {!contas.length && <div className="text-xs text-red-400 mt-1">Crie uma conta primeiro</div>}
          </button>
          
          <button
            onClick={() => handleSelectType('subtipo')}
            className="bg-purple-900/20 border border-purple-600 rounded-lg p-6 hover:bg-purple-900/30 transition-colors group"
            disabled={!categorias.length}
          >
            <Plus className="w-12 h-12 text-purple-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <div className="text-white font-medium mb-2">Novo Subtipo</div>
            <div className="text-sm text-gray-400">Criar subtipo dentro de uma categoria</div>
            {!categorias.length && <div className="text-xs text-red-400 mt-1">Crie uma categoria primeiro</div>}
          </button>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-2">💡 Dica:</h4>
          <p className="text-xs text-gray-400">
            A hierarquia funciona assim: <strong>Contas</strong> contêm <strong>Categorias</strong>, que contêm <strong>Subtipos</strong>. 
            Comece criando uma conta se ainda não tiver nenhuma.
          </p>
        </div>
      </div>
    );
  }

  // Formulário
  const itemTypeNames = {
    conta: 'Conta',
    categoria: 'Categoria', 
    subtipo: 'Subtipo'
  };

  const filteredCategorias = categorias.filter(cat => cat.conta_id === selectedContaId);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-white mb-1">
            Criar {itemTypeNames[itemType!]}
          </h3>
          <p className="text-sm text-gray-400">Preencha os dados do novo item</p>
        </div>
        <button
          onClick={() => setStep('select')}
          className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
        >
          ← Voltar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Seleção de conta (para categoria) */}
        {itemType === 'categoria' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Conta *
            </label>
            <select
              value={selectedContaId}
              onChange={(e) => setSelectedContaId(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              required
            >
              <option value="">Selecione uma conta</option>
              {contas.map(conta => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome} ({conta.codigo})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Seleção de categoria (para subtipo) */}
        {itemType === 'subtipo' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Conta *
              </label>
              <select
                value={selectedContaId}
                onChange={(e) => {
                  setSelectedContaId(e.target.value);
                  setSelectedCategoriaId('');
                }}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                required
              >
                <option value="">Selecione uma conta</option>
                {contas.map(conta => (
                  <option key={conta.id} value={conta.id}>
                    {conta.nome} ({conta.codigo})
                  </option>
                ))}
              </select>
            </div>

            {selectedContaId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categoria *
                </label>
                <select
                  value={selectedCategoriaId}
                  onChange={(e) => setSelectedCategoriaId(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {filteredCategorias.map(categoria => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.icone} {categoria.nome} ({categoria.codigo})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* Campos do formulário */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Código *
            </label>
            <input
              type="text"
              value={formData.codigo}
              onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="Ex: PF, RECEITA, SALARIO"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nome *
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="Ex: Pessoa Física, Receitas, Salário"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ícone
            </label>
            <input
              type="text"
              value={formData.icone}
              onChange={(e) => setFormData(prev => ({ ...prev, icone: e.target.value }))}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="Ex: 🏢, 💰, 💵"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ordem de Exibição
            </label>
            <input
              type="number"
              value={formData.ordem_exibicao}
              onChange={(e) => setFormData(prev => ({ ...prev, ordem_exibicao: parseInt(e.target.value) || 0 }))}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              min="0"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-3">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setStep('select')}
            className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Criando...' : `Criar ${itemTypeNames[itemType!]}`}
          </button>
        </div>
      </form>
    </div>
  );
}

// Função para renderizar o conteúdo de cada miniaplicação
function renderAppContent(appType: MiniAppType, hierarchyData: any, expandedContas: Set<string>, setExpandedContas: any, expandedCategorias: Set<string>, setExpandedCategorias: any, editingItem: any, setEditingItem: any, editForm: any, setEditForm: any, searchTerm: string, setSearchTerm: any, searchResults: any[], setSearchResults: any) {
  switch (appType) {
    case 'view':
      return (
        <div className="h-full">
          <div className="mb-4">
            <h3 className="text-base md:text-lg font-medium text-white mb-2">Estrutura Hierárquica</h3>
            <p className="text-sm text-gray-400">Navegue pela árvore completa de contas, categorias e subtipos</p>
          </div>
          <div className="h-full overflow-y-auto">
            <HierarchyTree 
              hierarquia={hierarchyData.hierarquia}
              loading={hierarchyData.loading}
              error={hierarchyData.error}
              expandedContas={expandedContas}
              setExpandedContas={setExpandedContas}
              expandedCategorias={expandedCategorias}
              setExpandedCategorias={setExpandedCategorias}
            />
          </div>
        </div>
      );

    case 'create':
      return (
        <CreateWizard 
          contas={hierarchyData.contas}
          categorias={hierarchyData.categorias}
          criarConta={hierarchyData.criarConta}
          criarCategoria={hierarchyData.criarCategoria}
          criarSubtipo={hierarchyData.criarSubtipo}
        />
      );

    case 'edit':
      return (
        <EditApp 
          contas={hierarchyData.contas}
          categorias={hierarchyData.categorias}
          subtipos={hierarchyData.subtipos}
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          editForm={editForm}
          setEditForm={setEditForm}
          atualizarConta={hierarchyData.atualizarConta}
          atualizarCategoria={hierarchyData.atualizarCategoria}
          atualizarSubtipo={hierarchyData.atualizarSubtipo}
        />
      );

    case 'move':
      return (
        <MoveApp 
          contas={hierarchyData.contas}
          categorias={hierarchyData.categorias}
          subtipos={hierarchyData.subtipos}
          atualizarConta={hierarchyData.atualizarConta}
          atualizarCategoria={hierarchyData.atualizarCategoria}
          atualizarSubtipo={hierarchyData.atualizarSubtipo}
        />
      );

    case 'search':
      return (
        <SearchApp 
          contas={hierarchyData.contas}
          categorias={hierarchyData.categorias}
          subtipos={hierarchyData.subtipos}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchResults={searchResults}
          setSearchResults={setSearchResults}
        />
      );

    case 'delete':
      return (
        <DeleteApp 
          contas={hierarchyData.contas}
          categorias={hierarchyData.categorias}
          subtipos={hierarchyData.subtipos}
          deletarConta={hierarchyData.deletarConta}
          deletarCategoria={hierarchyData.deletarCategoria}
          deletarSubtipo={hierarchyData.deletarSubtipo}
        />
      );

    case 'settings':
      return (
        <SettingsApp />
      );

    default:
      return (
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Em Desenvolvimento</h3>
          <p className="text-gray-400">Esta miniaplicação será implementada em breve!</p>
        </div>
      );
  }
}

// Componente para busca e filtros
function SearchApp({ contas, categorias, subtipos, searchTerm, setSearchTerm, searchResults, setSearchResults }: {
  contas: any[];
  categorias: any[];
  subtipos: any[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: any[];
  setSearchResults: (results: any[]) => void;
}) {
  const performSearch = (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    const results: any[] = [];
    const searchLower = term.toLowerCase();

    // Buscar em contas
    contas.forEach(conta => {
      if (conta.nome.toLowerCase().includes(searchLower) || conta.codigo.toLowerCase().includes(searchLower)) {
        results.push({
          type: 'conta',
          id: conta.id,
          name: conta.nome,
          code: conta.codigo,
          icon: conta.icone,
          data: conta
        });
      }
    });

    // Buscar em categorias
    categorias.forEach(categoria => {
      if (categoria.nome.toLowerCase().includes(searchLower)) {
        const conta = contas.find(c => c.id === categoria.conta_id);
        results.push({
          type: 'categoria',
          id: categoria.id,
          name: categoria.nome,
          icon: categoria.icone,
          parent: conta ? conta.nome : 'Conta não encontrada',
          data: categoria
        });
      }
    });

    // Buscar em subtipos
    subtipos.forEach(subtipo => {
      if (subtipo.nome.toLowerCase().includes(searchLower) || subtipo.codigo.toLowerCase().includes(searchLower)) {
        const categoria = categorias.find(c => c.id === subtipo.categoria_id);
        const conta = categoria ? contas.find(c => c.id === categoria.conta_id) : null;
        results.push({
          type: 'subtipo',
          id: subtipo.id,
          name: subtipo.nome,
          code: subtipo.codigo,
          parent: categoria ? categoria.nome : 'Categoria não encontrada',
          grandParent: conta ? conta.nome : '',
          data: subtipo
        });
      }
    });

    setSearchResults(results);
  };

  return (
    <div className="h-full">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-white mb-2">Busca Avançada</h3>
        <p className="text-sm text-gray-400">Encontre rapidamente qualquer item na hierarquia</p>
      </div>
      
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Digite o nome ou código para buscar..." 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            performSearch(e.target.value);
          }}
          className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-teal-500 focus:outline-none"
        />
        <div className="mt-2 text-xs text-gray-500">
          💡 Busque por nomes ("Receitas") ou códigos ("PF", "SALARIO")
        </div>
      </div>

      {searchTerm && (
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-white font-medium">Resultados</h4>
            <span className="text-sm text-gray-400">{searchResults.length} encontrados</span>
          </div>
          
          {searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum resultado encontrado para "{searchTerm}"</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div key={`${result.type}-${result.id}-${index}`} className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                        result.type === 'conta' ? 'bg-blue-600' :
                        result.type === 'categoria' ? 'bg-green-600' : 'bg-purple-600'
                      }`}>
                        {result.icon || (result.type === 'conta' ? '🏦' : result.type === 'categoria' ? '📂' : '📄')}
                      </div>
                      <div>
                        <div className="text-white font-medium">{result.name}</div>
                        {result.code && (
                          <div className="text-xs text-gray-400">Código: {result.code}</div>
                        )}
                        {result.parent && (
                          <div className="text-xs text-gray-400">
                            {result.grandParent && `${result.grandParent} > `}{result.parent}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      result.type === 'conta' ? 'bg-blue-900 text-blue-300' :
                      result.type === 'categoria' ? 'bg-green-900 text-green-300' : 'bg-purple-900 text-purple-300'
                    }`}>
                      {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente para edição de itens existentes
function EditApp({ contas, categorias, subtipos, editingItem, setEditingItem, editForm, setEditForm, atualizarConta, atualizarCategoria, atualizarSubtipo }: {
  contas: any[];
  categorias: any[];
  subtipos: any[];
  editingItem: any;
  setEditingItem: (item: any) => void;
  editForm: any;
  setEditForm: (form: any) => void;
  atualizarConta: (id: string, data: any) => Promise<void>;
  atualizarCategoria: (id: string, data: any) => Promise<void>;
  atualizarSubtipo: (id: string, data: any) => Promise<void>;
}) {
  const [editType, setEditType] = useState<'conta' | 'categoria' | 'subtipo' | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectItem = (item: any, type: 'conta' | 'categoria' | 'subtipo') => {
    setEditingItem(item);
    setEditType(type);
    setEditForm({
      nome: item.nome,
      codigo: item.codigo,
      ...(type === 'categoria' && { conta_id: item.conta_id }),
      ...(type === 'subtipo' && { categoria_id: item.categoria_id })
    });
  };

  const handleSave = async () => {
    if (!editingItem || !editType) return;
    
    setIsLoading(true);
    try {
      const updateData = {
        nome: editForm.nome,
        codigo: editForm.codigo,
        ...(editType === 'categoria' && { conta_id: editForm.conta_id }),
        ...(editType === 'subtipo' && { categoria_id: editForm.categoria_id })
      };

      console.log('🔍 [HierarchyManager] Dados sendo enviados para update:');
      console.log('- editType:', editType);
      console.log('- editingItem.id:', editingItem.id);
      console.log('- updateData:', updateData);
      console.log('- editForm completo:', editForm);

      if (editType === 'conta') {
        console.log('📝 [HierarchyManager] Chamando atualizarConta...');
        await atualizarConta(editingItem.id, updateData);
      } else if (editType === 'categoria') {
        console.log('📝 [HierarchyManager] Chamando atualizarCategoria...');
        await atualizarCategoria(editingItem.id, updateData);
      } else if (editType === 'subtipo') {
        console.log('📝 [HierarchyManager] Chamando atualizarSubtipo...');
        await atualizarSubtipo(editingItem.id, updateData);
      }

      // Reset form
      setEditingItem(null);
      setEditType(null);
      setEditForm({});
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (editingItem && editType) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4 pb-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Editando {editType}</h3>
              <p className="text-sm text-gray-400">ID: {editingItem.id}</p>
            </div>
            <button
              onClick={() => {
                setEditingItem(null);
                setEditType(null);
                setEditForm({});
              }}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={editForm.nome || ''}
              onChange={(e) => setEditForm({...editForm, nome: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Código
            </label>
            <input
              type="text"
              value={editForm.codigo || ''}
              onChange={(e) => setEditForm({...editForm, codigo: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>


          {editType === 'categoria' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Conta
              </label>
              <select
                value={editForm.conta_id || ''}
                onChange={(e) => setEditForm({...editForm, conta_id: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione uma conta</option>
                {contas.map(conta => (
                  <option key={conta.id} value={conta.id}>
                    {conta.nome} ({conta.codigo})
                  </option>
                ))}
              </select>
            </div>
          )}

          {editType === 'subtipo' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Categoria
              </label>
              <select
                value={editForm.categoria_id || ''}
                onChange={(e) => setEditForm({...editForm, categoria_id: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione uma categoria</option>
                {categorias.map(categoria => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome} ({categoria.codigo})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={() => {
              setEditingItem(null);
              setEditType(null);
              setEditForm({});
            }}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !editForm.nome || !editForm.codigo}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-base md:text-lg font-medium text-white mb-2">Editor de Propriedades</h3>
        <p className="text-sm text-gray-400">Selecione um item para editar suas propriedades</p>
      </div>

      {/* Layout em 3 colunas */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        
        {/* Coluna Contas */}
        <div className="flex flex-col bg-gray-900/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2 sticky top-0 bg-gray-900/50 pb-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            Contas ({contas?.length || 0})
          </h4>
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {contas?.map(conta => (
              <div
                key={conta.id}
                onClick={() => handleSelectItem(conta, 'conta')}
                className="bg-gray-800 rounded-md p-2.5 cursor-pointer hover:bg-blue-900/30 hover:border hover:border-blue-600 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium text-sm truncate" title={conta.nome}>{conta.nome}</div>
                    <div className="text-xs text-gray-400">{conta.codigo}</div>
                  </div>
                  <Edit3 className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-300 flex-shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna Categorias */}
        <div className="flex flex-col bg-gray-900/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2 sticky top-0 bg-gray-900/50 pb-2">
            <Folder className="w-4 h-4 text-green-400" />
            Categorias ({categorias?.length || 0})
          </h4>
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {categorias?.map(categoria => {
              const conta = contas?.find(c => c.id === categoria.conta_id);
              return (
                <div
                  key={categoria.id}
                  onClick={() => handleSelectItem(categoria, 'categoria')}
                  className="bg-gray-800 rounded-md p-2.5 cursor-pointer hover:bg-green-900/30 hover:border hover:border-green-600 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium text-sm truncate" title={categoria.nome}>{categoria.nome}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {categoria.codigo} • {conta?.nome}
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-300 flex-shrink-0 ml-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna Subtipos */}
        <div className="flex flex-col bg-gray-900/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2 sticky top-0 bg-gray-900/50 pb-2">
            <Tag className="w-4 h-4 text-purple-400" />
            Subtipos ({subtipos?.length || 0})
          </h4>
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {subtipos?.map(subtipo => {
              const categoria = categorias?.find(c => c.id === subtipo.categoria_id);
              const conta = contas?.find(c => c.id === categoria?.conta_id);
              return (
                <div
                  key={subtipo.id}
                  onClick={() => handleSelectItem(subtipo, 'subtipo')}
                  className="bg-gray-800 rounded-md p-2.5 cursor-pointer hover:bg-purple-900/30 hover:border hover:border-purple-600 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium text-sm truncate" title={subtipo.nome}>{subtipo.nome}</div>
                      <div className="text-xs text-gray-400 truncate" title={`${subtipo.codigo} • ${conta?.nome} → ${categoria?.nome}`}>
                        {subtipo.codigo} • {conta?.nome} → {categoria?.nome}
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-300 flex-shrink-0 ml-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Responsive: Mobile - Lista vertical */}
      <div className="lg:hidden flex-1 space-y-4 overflow-y-auto">
        {/* Contas Mobile */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            Contas ({contas?.length || 0})
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {contas?.map(conta => (
              <div
                key={conta.id}
                onClick={() => handleSelectItem(conta, 'conta')}
                className="bg-gray-800 rounded-md p-2.5 cursor-pointer hover:bg-blue-900/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium text-sm">{conta.nome}</div>
                    <div className="text-xs text-gray-400">{conta.codigo}</div>
                  </div>
                  <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categorias Mobile */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Folder className="w-4 h-4 text-green-400" />
            Categorias ({categorias?.length || 0})
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {categorias?.map(categoria => {
              const conta = contas?.find(c => c.id === categoria.conta_id);
              return (
                <div
                  key={categoria.id}
                  onClick={() => handleSelectItem(categoria, 'categoria')}
                  className="bg-gray-800 rounded-md p-2.5 cursor-pointer hover:bg-green-900/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium text-sm">{categoria.nome}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {categoria.codigo} • {conta?.nome}
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subtipos Mobile */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-400" />
            Subtipos ({subtipos?.length || 0})
          </h4>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {subtipos?.map(subtipo => {
              const categoria = categorias?.find(c => c.id === subtipo.categoria_id);
              const conta = contas?.find(c => c.id === categoria?.conta_id);
              return (
                <div
                  key={subtipo.id}
                  onClick={() => handleSelectItem(subtipo, 'subtipo')}
                  className="bg-gray-800 rounded-md p-2.5 cursor-pointer hover:bg-purple-900/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium text-sm">{subtipo.nome}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {subtipo.codigo} • {conta?.nome} → {categoria?.nome}
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para exclusão de itens
function DeleteApp({ contas, categorias, subtipos, deletarConta, deletarCategoria, deletarSubtipo }: {
  contas: any[];
  categorias: any[];
  subtipos: any[];
  deletarConta: (id: string) => Promise<void>;
  deletarCategoria: (id: string) => Promise<void>;
  deletarSubtipo: (id: string) => Promise<void>;
}) {
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [deleteType, setDeleteType] = useState<'conta' | 'categoria' | 'subtipo' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectItem = (item: any, type: 'conta' | 'categoria' | 'subtipo') => {
    setItemToDelete(item);
    setDeleteType(type);
    setShowConfirmDialog(true);
  };

  const getDependencies = (item: any, type: 'conta' | 'categoria' | 'subtipo') => {
    if (type === 'conta') {
      const categoriasFilhas = categorias.filter(cat => cat.conta_id === item.id);
      const subtipósFilhos = subtipos.filter(sub => {
        const categoria = categorias.find(cat => cat.id === sub.categoria_id);
        return categoria?.conta_id === item.id;
      });
      return {
        categorias: categoriasFilhas.length,
        subtipos: subtipósFilhos.length,
        items: [...categoriasFilhas.map(c => `Categoria: ${c.nome}`), ...subtipósFilhos.map(s => `Subtipo: ${s.nome}`)]
      };
    }
    
    if (type === 'categoria') {
      const subtipósFilhos = subtipos.filter(sub => sub.categoria_id === item.id);
      return {
        subtipos: subtipósFilhos.length,
        items: subtipósFilhos.map(s => `Subtipo: ${s.nome}`)
      };
    }
    
    return { items: [] };
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !deleteType) return;
    
    setIsLoading(true);
    try {
      if (deleteType === 'conta') {
        await deletarConta(itemToDelete.id);
      } else if (deleteType === 'categoria') {
        await deletarCategoria(itemToDelete.id);
      } else if (deleteType === 'subtipo') {
        await deletarSubtipo(itemToDelete.id);
      }
      
      setShowConfirmDialog(false);
      setItemToDelete(null);
      setDeleteType(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmDialog && itemToDelete && deleteType) {
    const dependencies = getDependencies(itemToDelete, deleteType);
    const hasDependencies = dependencies.items.length > 0;

    return (
      <div className="h-full flex flex-col">
        <div className="mb-4 pb-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Confirmar Exclusão</h3>
              <p className="text-sm text-gray-400">Esta ação não pode ser desfeita</p>
            </div>
            <button
              onClick={() => {
                setShowConfirmDialog(false);
                setItemToDelete(null);
                setDeleteType(null);
              }}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-red-400 font-medium mb-1">
                  Excluir {deleteType}: {itemToDelete.nome}
                </h4>
                <p className="text-sm text-gray-300 mb-2">
                  Código: {itemToDelete.codigo}
                </p>
                
                {hasDependencies && (
                  <div className="mt-3 p-3 bg-red-800/30 rounded border border-red-600/30">
                    <h5 className="text-red-300 font-medium text-sm mb-2">
                      ⚠️ Atenção: Este item possui dependências
                    </h5>
                    <p className="text-xs text-gray-300 mb-2">
                      A exclusão também removerá os seguintes itens:
                    </p>
                    <ul className="text-xs text-gray-400 space-y-1 max-h-24 overflow-y-auto">
                      {dependencies.items.map((dep, idx) => (
                        <li key={idx}>• {dep}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {!hasDependencies && (
                  <p className="text-xs text-green-400">
                    ✓ Este item não possui dependências
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={() => {
              setShowConfirmDialog(false);
              setItemToDelete(null);
              setDeleteType(null);
            }}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Confirmar Exclusão
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-4">
        <h3 className="text-base md:text-lg font-medium text-white mb-2">Excluir Itens</h3>
        <p className="text-sm text-gray-400">Selecione um item para excluir (com validações de segurança)</p>
      </div>

      <div className="space-y-6">
        {/* Contas */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Contas ({contas?.length || 0})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {contas?.map(conta => {
              const dependencies = getDependencies(conta, 'conta');
              const hasWarning = dependencies.items.length > 0;
              
              return (
                <div
                  key={conta.id}
                  onClick={() => handleSelectItem(conta, 'conta')}
                  className={`rounded-md p-3 cursor-pointer transition-colors ${
                    hasWarning 
                      ? 'bg-red-900/20 border border-red-500/30 hover:bg-red-900/30' 
                      : 'bg-gray-800 hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{conta.nome}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        {conta.codigo}
                        {hasWarning && (
                          <span className="text-red-400 text-xs">
                            ⚠️ {dependencies.categorias} cat., {dependencies.subtipos} subt.
                          </span>
                        )}
                      </div>
                    </div>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categorias */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Categorias ({categorias?.length || 0})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {categorias?.map(categoria => {
              const conta = contas?.find(c => c.id === categoria.conta_id);
              const dependencies = getDependencies(categoria, 'categoria');
              const hasWarning = dependencies.items.length > 0;
              
              return (
                <div
                  key={categoria.id}
                  onClick={() => handleSelectItem(categoria, 'categoria')}
                  className={`rounded-md p-3 cursor-pointer transition-colors ${
                    hasWarning 
                      ? 'bg-red-900/20 border border-red-500/30 hover:bg-red-900/30' 
                      : 'bg-gray-800 hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{categoria.nome}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        {categoria.codigo} • {conta?.nome}
                        {hasWarning && (
                          <span className="text-red-400 text-xs">
                            ⚠️ {dependencies.subtipos} subtipos
                          </span>
                        )}
                      </div>
                    </div>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subtipos */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Subtipos ({subtipos?.length || 0})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {subtipos?.map(subtipo => {
              const categoria = categorias?.find(c => c.id === subtipo.categoria_id);
              const conta = contas?.find(c => c.id === categoria?.conta_id);
              
              return (
                <div
                  key={subtipo.id}
                  onClick={() => handleSelectItem(subtipo, 'subtipo')}
                  className="bg-gray-800 rounded-md p-3 cursor-pointer hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{subtipo.nome}</div>
                      <div className="text-xs text-gray-400">
                        {subtipo.codigo} • {conta?.nome} → {categoria?.nome}
                      </div>
                    </div>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para mover/reorganizar itens
function MoveApp({ contas, categorias, subtipos, atualizarConta, atualizarCategoria, atualizarSubtipo }: {
  contas: any[];
  categorias: any[];
  subtipos: any[];
  atualizarConta: (id: string, data: any) => Promise<void>;
  atualizarCategoria: (id: string, data: any) => Promise<void>;
  atualizarSubtipo: (id: string, data: any) => Promise<void>;
}) {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [moveType, setMoveType] = useState<'conta' | 'categoria' | 'subtipo' | null>(null);
  const [targetParent, setTargetParent] = useState<string>('');
  const [newOrdemExibicao, setNewOrdemExibicao] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const handleSelectItem = (item: any, type: 'conta' | 'categoria' | 'subtipo') => {
    setSelectedItem(item);
    setMoveType(type);
    setTargetParent('');
    setNewOrdemExibicao(item.ordem_exibicao || 0);
    setShowMoveDialog(true);
  };

  const handleMove = async () => {
    if (!selectedItem || !moveType) return;
    
    setIsLoading(true);
    try {
      const updateData = {
        ...selectedItem,
        ordem_exibicao: newOrdemExibicao
      };

      if (moveType === 'conta') {
        await atualizarConta(selectedItem.id, updateData);
      } else if (moveType === 'categoria') {
        if (targetParent) {
          updateData.conta_id = targetParent;
        }
        await atualizarCategoria(selectedItem.id, updateData);
      } else if (moveType === 'subtipo') {
        if (targetParent) {
          updateData.categoria_id = targetParent;
        }
        await atualizarSubtipo(selectedItem.id, updateData);
      }
      
      setShowMoveDialog(false);
      setSelectedItem(null);
      setMoveType(null);
      setTargetParent('');
      setNewOrdemExibicao(0);
    } catch (error) {
      console.error('Erro ao mover:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableParents = () => {
    if (moveType === 'categoria') {
      return contas.filter(conta => conta.id !== selectedItem?.conta_id).sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    } else if (moveType === 'subtipo') {
      return categorias.filter(categoria => categoria.id !== selectedItem?.categoria_id).sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    }
    return [];
  };

  const getSiblings = () => {
    if (moveType === 'conta') {
      return contas.filter(conta => conta.id !== selectedItem?.id).sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    } else if (moveType === 'categoria') {
      const parentId = targetParent || selectedItem?.conta_id;
      return categorias.filter(cat => cat.conta_id === parentId && cat.id !== selectedItem?.id).sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    } else if (moveType === 'subtipo') {
      const parentId = targetParent || selectedItem?.categoria_id;
      return subtipos.filter(sub => sub.categoria_id === parentId && sub.id !== selectedItem?.id).sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    }
    return [];
  };

  const getCurrentParent = () => {
    if (moveType === 'categoria') {
      return contas.find(conta => conta.id === selectedItem?.conta_id);
    } else if (moveType === 'subtipo') {
      return categorias.find(categoria => categoria.id === selectedItem?.categoria_id);
    }
    return null;
  };

  const getNextAvailableOrder = (siblings: any[]) => {
    if (siblings.length === 0) return 1;
    const maxOrder = Math.max(...siblings.map(s => s.ordem_exibicao || 0));
    return maxOrder + 1;
  };

  if (showMoveDialog && selectedItem && moveType) {
    const availableParents = getAvailableParents();
    const currentParent = getCurrentParent();
    const siblings = getSiblings();
    const suggestedOrder = getNextAvailableOrder(siblings);

    return (
      <div className="h-full flex flex-col">
        <div className="mb-4 pb-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Reorganizar {moveType}</h3>
              <p className="text-sm text-gray-400">Alterar hierarquia e ordem de exibição</p>
            </div>
            <button
              onClick={() => {
                setShowMoveDialog(false);
                setSelectedItem(null);
                setMoveType(null);
                setTargetParent('');
                setNewOrdemExibicao(0);
              }}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Move className="w-5 h-5 text-purple-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-purple-400 font-medium mb-1">
                  {selectedItem.nome}
                </h4>
                <p className="text-sm text-gray-300 mb-2">
                  Código: {selectedItem.codigo} • Ordem atual: {selectedItem.ordem_exibicao || 0}
                </p>
                
                <div className="mt-3 p-3 bg-purple-800/30 rounded border border-purple-600/30">
                  <h5 className="text-purple-300 font-medium text-sm mb-2">
                    Localização atual:
                  </h5>
                  <p className="text-xs text-gray-300">
                    {moveType === 'conta' 
                      ? 'Nível: Conta principal'
                      : moveType === 'categoria' 
                        ? `Conta: ${currentParent?.nome} (${currentParent?.codigo})`
                        : `Categoria: ${currentParent?.nome} (${currentParent?.codigo})`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Hierarquia (apenas para categorias e subtipos) */}
          {(moveType === 'categoria' || moveType === 'subtipo') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {moveType === 'categoria' ? 'Nova conta:' : 'Nova categoria:'}
              </label>
              <select
                value={targetParent}
                onChange={(e) => {
                  setTargetParent(e.target.value);
                  // Reset ordem quando mudar de parent
                  if (e.target.value) {
                    const newSiblings = moveType === 'categoria' 
                      ? categorias.filter(cat => cat.conta_id === e.target.value && cat.id !== selectedItem.id)
                      : subtipos.filter(sub => sub.categoria_id === e.target.value && sub.id !== selectedItem.id);
                    setNewOrdemExibicao(getNextAvailableOrder(newSiblings));
                  }
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">
                  {moveType === 'categoria' 
                    ? 'Manter na conta atual'
                    : 'Manter na categoria atual'
                  }
                </option>
                {availableParents.map(parent => (
                  <option key={parent.id} value={parent.id}>
                    {parent.nome} ({parent.codigo}) • Ordem: {parent.ordem_exibicao || 0}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seção de Ordem de Exibição */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nova ordem de exibição:
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                value={newOrdemExibicao}
                onChange={(e) => setNewOrdemExibicao(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                min="0"
              />
              <button
                onClick={() => setNewOrdemExibicao(suggestedOrder)}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
                title="Usar próxima ordem disponível"
              >
                Próx: {suggestedOrder}
              </button>
            </div>
            
            {/* Visualização dos irmãos */}
            {siblings.length > 0 && (
              <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-600">
                <h6 className="text-xs font-medium text-gray-400 mb-2">
                  Ordem dos itens {moveType === 'conta' ? 'de contas' : moveType === 'categoria' ? 'na mesma conta' : 'na mesma categoria'}:
                </h6>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {siblings.map(sibling => (
                    <div key={sibling.id} className="flex justify-between text-xs">
                      <span className="text-gray-300">{sibling.nome}</span>
                      <span className="text-gray-500">Ordem: {sibling.ordem_exibicao || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirmação visual */}
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
            <p className="text-sm text-green-400 font-medium mb-1">
              ✓ Pronto para reorganizar
            </p>
            <div className="text-xs text-gray-300 space-y-1">
              {(targetParent && (moveType === 'categoria' || moveType === 'subtipo')) && (
                <p>• Nova localização será aplicada</p>
              )}
              <p>• Nova ordem: {newOrdemExibicao}</p>
              {newOrdemExibicao !== (selectedItem.ordem_exibicao || 0) && (
                <p className="text-orange-400">• Ordem será alterada de {selectedItem.ordem_exibicao || 0} para {newOrdemExibicao}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={() => {
              setShowMoveDialog(false);
              setSelectedItem(null);
              setMoveType(null);
              setTargetParent('');
              setNewOrdemExibicao(0);
            }}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleMove}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Reorganizando...
              </>
            ) : (
              <>
                <Move className="w-4 h-4" />
                Confirmar Reorganização
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-4">
        <h3 className="text-base md:text-lg font-medium text-white mb-2">Reorganizar Estrutura</h3>
        <p className="text-sm text-gray-400">Altere hierarquia e ordem de exibição de contas, categorias e subtipos</p>
      </div>

      <div className="space-y-6">
        {/* Contas */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Contas reorganizáveis ({contas?.length || 0})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {contas?.sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0)).map(conta => {
              return (
                <div
                  key={conta.id}
                  onClick={() => handleSelectItem(conta, 'conta')}
                  className="bg-gray-800 rounded-md p-3 cursor-pointer hover:bg-gray-750 transition-colors border-l-4 border-blue-500"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{conta.nome}</div>
                      <div className="text-xs text-gray-400">
                        {conta.codigo} • Ordem: {conta.ordem_exibicao || 0}
                      </div>
                    </div>
                    <Move className="w-4 h-4 text-blue-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categorias */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Categorias reorganizáveis ({categorias?.length || 0})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {categorias?.sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0)).map(categoria => {
              const conta = contas?.find(c => c.id === categoria.conta_id);
              
              return (
                <div
                  key={categoria.id}
                  onClick={() => handleSelectItem(categoria, 'categoria')}
                  className="bg-gray-800 rounded-md p-3 cursor-pointer hover:bg-gray-750 transition-colors border-l-4 border-purple-500"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{categoria.nome}</div>
                      <div className="text-xs text-gray-400">
                        {categoria.codigo} • Conta: {conta?.nome} • Ordem: {categoria.ordem_exibicao || 0}
                      </div>
                    </div>
                    <Move className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subtipos */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Subtipos reorganizáveis ({subtipos?.length || 0})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {subtipos?.sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0)).map(subtipo => {
              const categoria = categorias?.find(c => c.id === subtipo.categoria_id);
              const conta = contas?.find(c => c.id === categoria?.conta_id);
              
              return (
                <div
                  key={subtipo.id}
                  onClick={() => handleSelectItem(subtipo, 'subtipo')}
                  className="bg-gray-800 rounded-md p-3 cursor-pointer hover:bg-gray-750 transition-colors border-l-4 border-green-500"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{subtipo.nome}</div>
                      <div className="text-xs text-gray-400">
                        {subtipo.codigo} • Categoria: {categoria?.nome} • Ordem: {subtipo.ordem_exibicao || 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        Conta: {conta?.nome}
                      </div>
                    </div>
                    <Move className="w-4 h-4 text-green-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <h5 className="text-sm text-gray-300 font-medium mb-2">Operações disponíveis:</h5>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Alterar ordem de exibição de contas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Mover categorias entre contas + alterar ordem</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Mover subtipos entre categorias + alterar ordem</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
              <span>Visualização dos itens irmãos ordenados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
              <span>Sugestão automática de próxima ordem</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para configurações do sistema
function SettingsApp() {
  const [settings, setSettings] = useState({
    autoRefresh: true,
    confirmDelete: true,
    expandTreeByDefault: false,
    showCodes: true,
    showDescriptions: true,
    maxResults: 100,
    sortBy: 'name' as 'name' | 'code' | 'created',
    theme: 'dark' as 'dark' | 'light' | 'auto'
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSettings({
      autoRefresh: true,
      confirmDelete: true,
      expandTreeByDefault: false,
      showCodes: true,
      showDescriptions: true,
      maxResults: 100,
      sortBy: 'name',
      theme: 'dark'
    });
  };

  return (
    <div className="h-full">
      <div className="mb-4">
        <h3 className="text-base md:text-lg font-medium text-white mb-2">Configurações do Sistema</h3>
        <p className="text-sm text-gray-400">Personalize o comportamento do gerenciador de hierarquias</p>
      </div>

      <div className="space-y-6 max-h-96 overflow-y-auto">
        {/* Configurações de Interface */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-md font-medium text-white mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Interface
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Expandir árvore por padrão</label>
              <input
                type="checkbox"
                checked={settings.expandTreeByDefault}
                onChange={(e) => handleSettingChange('expandTreeByDefault', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Mostrar códigos</label>
              <input
                type="checkbox"
                checked={settings.showCodes}
                onChange={(e) => handleSettingChange('showCodes', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Mostrar descrições</label>
              <input
                type="checkbox"
                checked={settings.showDescriptions}
                onChange={(e) => handleSettingChange('showDescriptions', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Tema</label>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="dark">Escuro</option>
                <option value="light">Claro</option>
                <option value="auto">Automático</option>
              </select>
            </div>
          </div>
        </div>

        {/* Configurações de Comportamento */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-md font-medium text-white mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Comportamento
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Auto-refresh de dados</label>
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) => handleSettingChange('autoRefresh', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Confirmar antes de excluir</label>
              <input
                type="checkbox"
                checked={settings.confirmDelete}
                onChange={(e) => handleSettingChange('confirmDelete', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Ordenar por</label>
              <select
                value={settings.sortBy}
                onChange={(e) => handleSettingChange('sortBy', e.target.value)}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Nome</option>
                <option value="code">Código</option>
                <option value="created">Data de criação</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Máximo de resultados</label>
              <select
                value={settings.maxResults}
                onChange={(e) => handleSettingChange('maxResults', parseInt(e.target.value))}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
        </div>

        {/* Configurações Avançadas */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-md font-medium text-white mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Avançadas
          </h4>
          <div className="space-y-3">
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
              <p className="text-sm text-yellow-400 font-medium mb-2">⚠️ Área de Configuração Avançada</p>
              <p className="text-xs text-gray-300">
                Essas configurações afetam o comportamento interno do sistema.
                Altere apenas se souber o que está fazendo.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                Cache Settings
              </button>
              <button className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors">
                Performance
              </button>
              <button className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors">
                Export Config
              </button>
              <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">
                Import Config
              </button>
            </div>
          </div>
        </div>

        {/* Status do Sistema */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-md font-medium text-white mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Status do Sistema
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Versão:</span>
              <span className="text-white ml-2">1.0.0</span>
            </div>
            <div>
              <span className="text-gray-400">Última sincronização:</span>
              <span className="text-green-400 ml-2">Agora</span>
            </div>
            <div>
              <span className="text-gray-400">Cache:</span>
              <span className="text-blue-400 ml-2">Ativo</span>
            </div>
            <div>
              <span className="text-gray-400">Performance:</span>
              <span className="text-green-400 ml-2">Ótima</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="mt-6 pt-4 border-t border-gray-700 flex gap-3">
        <button
          onClick={handleReset}
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Resetar
        </button>
        <button
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}