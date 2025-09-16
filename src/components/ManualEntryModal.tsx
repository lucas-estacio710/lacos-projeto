// ManualEntryModalNew.tsx - VERSÃO LIMPA COM NOVA HIERARQUIA

import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useHierarchy } from '@/hooks/useHierarchy';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ManualEntryForm {
  data: string;
  valor: number;
  origem: string;
  cc: string;
  descricao: string;
  subtipo_id: string;
  // ✅ Campos auxiliares para navegação em cascata (não salvos no banco)
  selected_conta?: string;
  selected_categoria?: string;
}

const ORIGEM_OPTIONS = [
  { value: 'Inter', label: '🟠 Inter' },
  { value: 'BB', label: '🟡 Banco do Brasil' },
  { value: 'Santander', label: '🔴 Santander' },
  { value: 'Stone', label: '🟢 Stone' },
  { value: 'Nubank', label: '🟣 Nubank' },
  { value: 'MasterCard', label: '💳 MasterCard' },
  { value: 'Visa', label: '💳 Visa' },
  { value: 'Investimento Inter', label: '📊 Investimento Inter' },
  { value: 'Investimento Keka', label: '📈 Investimento Keka' },
  { value: 'Dinheiro', label: '💵 Dinheiro' }
];

const CC_OPTIONS = [
  { value: 'Inter', label: '🟠 Inter' },
  { value: 'BB', label: '🟡 Banco do Brasil' },
  { value: 'Santander', label: '🔴 Santander' },
  { value: 'Stone', label: '🟢 Stone' },
  { value: 'Nubank', label: '🟣 Nubank' },
  { value: 'Investimento Inter', label: '📊 Investimento Inter' },
  { value: 'Investimento Keka', label: '📈 Investimento Keka' },
  { value: 'Dinheiro', label: '💵 Dinheiro' }
];

export function ManualEntryModal({ isOpen, onClose, onSuccess }: ManualEntryModalProps) {
  const { createManualTransaction } = useTransactions();
  const { hierarquia, carregarTudo } = useHierarchy();

  const [form, setForm] = useState<ManualEntryForm>({
    data: new Date().toISOString().split('T')[0],
    valor: 0,
    origem: 'Manual',
    cc: 'Inter',
    descricao: '',
    subtipo_id: '',
    selected_conta: '',
    selected_categoria: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load hierarchy when modal opens
  useEffect(() => {
    if (isOpen) {
      carregarTudo();
    }
  }, [isOpen, carregarTudo]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setForm({
        data: new Date().toISOString().split('T')[0],
        valor: 0,
        origem: 'Manual',
        cc: 'Inter',
        descricao: '',
        subtipo_id: '',
        selected_conta: '',
        selected_categoria: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // Flatten hierarchy for easy selection
  const availableHierarchy = useMemo(() => {
    const flattened: Array<{
      subtipo_id: string;
      conta_nome: string;
      conta_icone?: string;
      categoria_nome: string;
      categoria_icone?: string;
      subtipo_nome: string;
      subtipo_icone?: string;
      caminho_completo: string;
    }> = [];

    hierarquia.forEach(contaGroup => {
      contaGroup.categorias.forEach(catGroup => {
        catGroup.subtipos.forEach(subtipo => {
          flattened.push({
            subtipo_id: subtipo.id,
            conta_nome: contaGroup.conta.nome,
            conta_icone: contaGroup.conta.icone,
            categoria_nome: catGroup.categoria.nome,
            categoria_icone: catGroup.categoria.icone,
            subtipo_nome: subtipo.nome,
            subtipo_icone: subtipo.icone,
            caminho_completo: `${contaGroup.conta.nome} > ${catGroup.categoria.nome} > ${subtipo.nome}`
          });
        });
      });
    });

    return flattened;
  }, [hierarquia]);

  // ✅ NOVO: Contas únicas para o primeiro toggle
  const availableContas = useMemo(() => {
    const contas = new Set<string>();
    hierarquia.forEach(contaGroup => {
      contas.add(contaGroup.conta.nome);
    });
    return Array.from(contas).map(nome => {
      const contaGroup = hierarquia.find(h => h.conta.nome === nome);
      return {
        nome,
        icone: contaGroup?.conta.icone || '🏢',
        id: contaGroup?.conta.id || ''
      };
    });
  }, [hierarquia]);

  // ✅ NOVO: Categorias filtradas pela conta selecionada
  const availableCategorias = useMemo(() => {
    if (!form.selected_conta) return [];
    
    const contaGroup = hierarquia.find(h => h.conta.nome === form.selected_conta);
    if (!contaGroup) return [];
    
    return contaGroup.categorias.map(catGroup => ({
      nome: catGroup.categoria.nome,
      icone: catGroup.categoria.icone || '📊',
      id: catGroup.categoria.id
    }));
  }, [hierarquia, form.selected_conta]);

  // ✅ NOVO: Subtipos filtrados pela categoria selecionada
  const availableSubtipos = useMemo(() => {
    if (!form.selected_conta || !form.selected_categoria) return [];
    
    const contaGroup = hierarquia.find(h => h.conta.nome === form.selected_conta);
    if (!contaGroup) return [];
    
    const catGroup = contaGroup.categorias.find(c => c.categoria.nome === form.selected_categoria);
    if (!catGroup) return [];
    
    return catGroup.subtipos.map(subtipo => ({
      nome: subtipo.nome,
      icone: subtipo.icone || '💰',
      id: subtipo.id
    }));
  }, [hierarquia, form.selected_conta, form.selected_categoria]);

  const updateForm = (field: keyof ManualEntryForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    
    // Clear error
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // ✅ NOVO: Navegação em cascata
  const selectConta = (contaNome: string) => {
    setForm(prev => ({
      ...prev,
      selected_conta: contaNome,
      selected_categoria: '', // Reset categoria
      subtipo_id: '' // Reset subtipo
    }));
  };

  const selectCategoria = (categoriaNome: string) => {
    setForm(prev => ({
      ...prev,
      selected_categoria: categoriaNome,
      subtipo_id: '' // Reset subtipo
    }));
  };

  const selectSubtipo = (subtipoId: string) => {
    setForm(prev => ({
      ...prev,
      subtipo_id: subtipoId
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.data) newErrors.data = 'Data é obrigatória';
    if (form.valor === 0) newErrors.valor = 'Valor deve ser diferente de zero';
    if (!form.descricao.trim()) newErrors.descricao = 'Descrição é obrigatória';
    // Classificação agora é opcional - pode ficar vazia para ir para InboxTab

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    const selectedHierarchy = availableHierarchy.find(h => h.subtipo_id === form.subtipo_id);
    const isUnclassified = !form.subtipo_id;

    const confirmText =
      `📝 Criar lançamento manual?\n\n` +
      `📅 Data: ${new Date(form.data).toLocaleDateString('pt-BR')}\n` +
      `💰 Valor: ${form.valor >= 0 ? '+' : ''}R$ ${Math.abs(form.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `🏷️ Classificação: ${isUnclassified ? '❌ SEM CLASSIFICAÇÃO (irá para InboxTab)' : selectedHierarchy?.caminho_completo}\n` +
      `📄 Descrição: ${form.descricao}\n` +
      `🏦 Origem/CC: ${form.origem} / ${form.cc}` +
      (isUnclassified ? '\n\n⚠️ Este lançamento aparecerá na InboxTab para classificação posterior.' : '');

    if (!window.confirm(confirmText)) return;

    setIsSubmitting(true);
    
    try {
      await createManualTransaction({
        data: form.data,
        valor: form.valor,
        origem: form.origem,
        cc: form.cc,
        descricao: form.descricao,
        subtipo_id: form.subtipo_id
      });
      
      const successMessage = isUnclassified
        ? '✅ Lançamento manual criado com sucesso!\n📥 O lançamento está na InboxTab aguardando classificação.'
        : '✅ Lançamento manual criado e classificado com sucesso!';

      alert(successMessage);
      onSuccess?.();
      onClose();
      
    } catch (error) {
      console.error('❌ Erro ao criar lançamento manual:', error);
      alert(`❌ Erro ao criar lançamento: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Lançamento Manual
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Data */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Data *</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => updateForm('data', e.target.value)}
                className={`w-full p-2 bg-gray-700 border border-gray-600 rounded text-white ${
                  errors.data ? 'border-red-500' : ''
                }`}
                required
              />
              {errors.data && <p className="text-red-400 text-xs mt-1">{errors.data}</p>}
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => updateForm('valor', parseFloat(e.target.value) || 0)}
                className={`w-full p-2 bg-gray-700 border border-gray-600 rounded text-white ${
                  errors.valor ? 'border-red-500' : ''
                }`}
                placeholder="0,00"
                required
              />
              {errors.valor && <p className="text-red-400 text-xs mt-1">{errors.valor}</p>}
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Descrição *</label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => updateForm('descricao', e.target.value)}
                className={`w-full p-2 bg-gray-700 border border-gray-600 rounded text-white ${
                  errors.descricao ? 'border-red-500' : ''
                }`}
                placeholder="Descrição do lançamento"
                required
              />
              {errors.descricao && <p className="text-red-400 text-xs mt-1">{errors.descricao}</p>}
            </div>

            {/* ✅ NOVO: Sistema de Cascata com Toggles */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Classificação Hierárquica (opcional)
                <span className="text-xs text-gray-400 block mt-1">
                  💡 Deixe em branco para criar lançamento não classificado que irá para a InboxTab
                </span>
              </label>

              {/* Botão para limpar classificação */}
              {(form.selected_conta || form.selected_categoria || form.subtipo_id) && (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      selected_conta: '',
                      selected_categoria: '',
                      subtipo_id: ''
                    }))}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                  >
                    🗑️ Limpar Classificação (deixar sem classificar)
                  </button>
                </div>
              )}

              {/* Passo 1: Selecionar Conta */}
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1">1. Selecione a Conta:</div>
                <div className="flex flex-wrap gap-2">
                  {availableContas.map((conta) => (
                    <button
                      key={conta.id}
                      type="button"
                      onClick={() => selectConta(conta.nome)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        form.selected_conta === conta.nome
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {conta.icone} {conta.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passo 2: Selecionar Categoria (se conta selecionada) */}
              {form.selected_conta && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">2. Selecione a Categoria:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableCategorias.map((categoria) => (
                      <button
                        key={categoria.id}
                        type="button"
                        onClick={() => selectCategoria(categoria.nome)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          form.selected_categoria === categoria.nome
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {categoria.icone} {categoria.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Passo 3: Selecionar Subtipo (se categoria selecionada) */}
              {form.selected_categoria && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">3. Selecione o Subtipo:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableSubtipos.map((subtipo) => (
                      <button
                        key={subtipo.id}
                        type="button"
                        onClick={() => selectSubtipo(subtipo.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          form.subtipo_id === subtipo.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {subtipo.icone} {subtipo.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview da seleção completa */}
              {form.subtipo_id ? (
                <div className="mt-2 p-3 bg-green-900/30 border border-green-600 rounded text-sm text-green-200">
                  ✅ <strong>Selecionado:</strong><br />
                  {availableHierarchy.find(item => item.subtipo_id === form.subtipo_id)?.caminho_completo}
                </div>
              ) : (
                <div className="mt-2 p-3 bg-yellow-900/30 border border-yellow-600 rounded text-sm text-yellow-200">
                  ⚠️ <strong>Sem Classificação:</strong><br />
                  Este lançamento será criado sem classificação e aparecerá na <strong>InboxTab</strong> para ser classificado posteriormente.
                </div>
              )}

              {errors.subtipo_id && <p className="text-red-400 text-xs mt-1">{errors.subtipo_id}</p>}
            </div>

            {/* Origem */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Origem</label>
                <select
                  value={form.origem}
                  onChange={(e) => updateForm('origem', e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  {ORIGEM_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">CC</label>
                <select
                  value={form.cc}
                  onChange={(e) => updateForm('cc', e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  {CC_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                isSubmitting
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isSubmitting ? 'Criando...' : 'Criar Lançamento'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}