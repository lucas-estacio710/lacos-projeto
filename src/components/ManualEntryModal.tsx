// ManualEntryModal.tsx - MODAL DE LANÇAMENTO MANUAL

import React, { useState } from 'react';
import { PlusCircle, Calendar, DollarSign } from 'lucide-react';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';
import { useTransactions } from '@/hooks/useTransactions';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ManualEntryForm {
  data: string;
  valor: number;
  origem: string;
  cc: string;
  descricao: string;
  conta: string;
  categoria: string;
  subtipo: string;
}

const ORIGEM_OPTIONS = [
  { value: 'Inter', label: '🟠 Inter' },
  { value: 'BB', label: '🟡 Banco do Brasil' },
  { value: 'Santander', label: '🔴 Santander' },
  { value: 'Stone', label: '🟢 Stone' },
  { value: 'Nubank', label: '🟣 Nubank' },
  { value: 'Manual', label: '✏️ Lançamento Manual' },
  { value: 'Ajuste', label: '⚙️ Ajuste Manual' }
];

const CC_OPTIONS = [
  { value: 'Inter', label: '🟠 Inter' },
  { value: 'BB', label: '🟡 Banco do Brasil' },
  { value: 'Santander', label: '🔴 Santander' },
  { value: 'Stone', label: '🟢 Stone' },
  { value: 'Investimento Inter', label: '💰 Investimento Inter' },
  { value: 'Tesouro + RF Santander', label: '💰 Tesouro + RF Santander' },
  { value: 'Investimento Sttd Kel', label: '💰 Investimento Sttd Kel' },
  { value: 'Dinheiro', label: '💵 Dinheiro' }
];

export function ManualEntryModal({ isOpen, onClose }: ManualEntryModalProps) {
  const { createManualTransaction } = useTransactions();
  
  const [form, setForm] = useState<ManualEntryForm>({
    data: new Date().toISOString().split('T')[0], // Data atual
    valor: 0,
    origem: 'Manual',
    cc: 'Inter',
    descricao: '',
    conta: 'PF',
    categoria: '',
    subtipo: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form quando modal fecha
  React.useEffect(() => {
    if (!isOpen) {
      setForm({
        data: new Date().toISOString().split('T')[0],
        valor: 0,
        origem: 'Manual',
        cc: 'Inter',
        descricao: '',
        conta: 'PF',
        categoria: '',
        subtipo: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // Atualizar form
  const updateForm = (field: keyof ManualEntryForm, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // Reset categoria e subtipo quando conta muda
      if (field === 'conta') {
        updated.categoria = '';
        updated.subtipo = '';
      }
      
      // Reset subtipo quando categoria muda
      if (field === 'categoria') {
        updated.subtipo = '';
      }
      
      return updated;
    });
    
    // Limpar erro do campo
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!form.data) {
      newErrors.data = 'Data é obrigatória';
    }
    
    if (form.valor === 0) {
      newErrors.valor = 'Valor deve ser diferente de zero';
    }
    
    if (!form.descricao.trim()) {
      newErrors.descricao = 'Descrição é obrigatória';
    }
    
    if (!form.categoria) {
      newErrors.categoria = 'Categoria é obrigatória';
    }
    
    if (!form.subtipo) {
      newErrors.subtipo = 'Subtipo é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submeter formulário
  const handleSubmit = async () => {
    if (!validateForm()) {
      alert('⚠️ Por favor, corrija os erros no formulário');
      return;
    }
    
    const confirmText = 
      `📝 Criar lançamento manual?\n\n` +
      `📅 Data: ${new Date(form.data).toLocaleDateString('pt-BR')}\n` +
      `💰 Valor: ${form.valor >= 0 ? '+' : ''}R$ ${Math.abs(form.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `🏷️ Classificação: ${form.conta} → ${form.categoria} → ${form.subtipo}\n` +
      `📄 Descrição: ${form.descricao}\n` +
      `🏦 Origem/CC: ${form.origem} / ${form.cc}`;

    if (!window.confirm(confirmText)) return;

    setIsSubmitting(true);
    
    try {
      await createManualTransaction(form);
      
      alert('✅ Lançamento manual criado com sucesso!');
      onClose();
      
    } catch (error) {
      console.error('⛔ Erro ao criar lançamento manual:', error);
      alert('⛔ Erro ao criar lançamento manual: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Obter categorias para a conta selecionada
  const getCategoriesForAccount = (conta: string) => {
    switch (conta) {
      case 'PJ': return categoriesPJ;
      case 'PF': return categoriesPF;
      case 'CONC.': return categoriesCONC;
      default: return categoriesPF;
    }
  };
  
  const categories = getCategoriesForAccount(form.conta);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              <PlusCircle className="w-6 h-6" />
              ⚪ Lançamento Manual
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Formulário */}
          <div className="space-y-4">
            
            {/* Data e Valor */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Data *
                </label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => updateForm('data', e.target.value)}
                  className={`w-full p-2 bg-gray-700 border rounded text-gray-100 text-sm ${
                    errors.data ? 'border-red-500' : 'border-gray-600'
                  }`}
                />
                {errors.data && <p className="text-red-400 text-xs mt-1">{errors.data}</p>}
              </div>
              
              <div>
                <label className="text-sm text-gray-400 block mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Valor *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.valor || ''}
                  onChange={(e) => updateForm('valor', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={`w-full p-2 bg-gray-700 border rounded text-gray-100 text-sm ${
                    errors.valor ? 'border-red-500' : 'border-gray-600'
                  }`}
                />
                {errors.valor && <p className="text-red-400 text-xs mt-1">{errors.valor}</p>}
              </div>
            </div>

            {/* Origem e CC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Origem *</label>
                <select
                  value={form.origem}
                  onChange={(e) => updateForm('origem', e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                >
                  {ORIGEM_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 block mb-1">Conta/CC *</label>
                <select
                  value={form.cc}
                  onChange={(e) => updateForm('cc', e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                >
                  {CC_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Descrição *</label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => updateForm('descricao', e.target.value)}
                placeholder="Ex: Ajuste de saldo, Transferência manual..."
                className={`w-full p-2 bg-gray-700 border rounded text-gray-100 text-sm ${
                  errors.descricao ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {errors.descricao && <p className="text-red-400 text-xs mt-1">{errors.descricao}</p>}
            </div>

            {/* Conta */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Tipo de Conta *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateForm('conta', 'PF')}
                  className={`p-2 rounded text-sm font-medium transition-colors ${
                    form.conta === 'PF'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  👤 PF
                </button>
                <button
                  onClick={() => updateForm('conta', 'PJ')}
                  className={`p-2 rounded text-sm font-medium transition-colors ${
                    form.conta === 'PJ'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🏢 PJ
                </button>
                <button
                  onClick={() => updateForm('conta', 'CONC.')}
                  className={`p-2 rounded text-sm font-medium transition-colors ${
                    form.conta === 'CONC.'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🔄 CONC.
                </button>
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Categoria *</label>
              <select
                value={form.categoria}
                onChange={(e) => updateForm('categoria', e.target.value)}
                className={`w-full p-2 bg-gray-700 border rounded text-gray-100 text-sm ${
                  errors.categoria ? 'border-red-500' : 'border-gray-600'
                }`}
                disabled={!form.conta}
              >
                <option value="">Selecione...</option>
                {Object.keys(categories).map(cat => (
                  <option key={cat} value={cat}>
                    {categories[cat].icon} {cat}
                  </option>
                ))}
              </select>
              {errors.categoria && <p className="text-red-400 text-xs mt-1">{errors.categoria}</p>}
            </div>

            {/* Subtipo */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Subtipo *</label>
              <select
                value={form.subtipo}
                onChange={(e) => updateForm('subtipo', e.target.value)}
                className={`w-full p-2 bg-gray-700 border rounded text-gray-100 text-sm ${
                  errors.subtipo ? 'border-red-500' : 'border-gray-600'
                }`}
                disabled={!form.categoria}
              >
                <option value="">Selecione...</option>
                {form.categoria && categories[form.categoria]?.subtipos.map((subtipo: string) => (
                  <option key={subtipo} value={subtipo}>
                    {subtipo}
                  </option>
                ))}
              </select>
              {errors.subtipo && <p className="text-red-400 text-xs mt-1">{errors.subtipo}</p>}
            </div>

            {/* Preview */}
            {form.valor !== 0 && form.descricao && (
              <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                <h4 className="text-sm font-medium text-gray-200 mb-2">📋 Preview do Lançamento</h4>
                <div className="text-xs text-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span>📅 Data:</span>
                    <span>{new Date(form.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>💰 Valor:</span>
                    <span className={form.valor >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {form.valor >= 0 ? '+' : ''}R$ {Math.abs(form.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🏦 Origem/CC:</span>
                    <span>{form.origem} / {form.cc}</span>
                  </div>
                  {form.categoria && form.subtipo && (
                    <div className="flex justify-between">
                      <span>🏷️ Classificação:</span>
                      <span>{form.conta} → {form.categoria} → {form.subtipo}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancelar
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !validateForm()}
                className={`flex-1 px-4 py-2 rounded transition-colors font-medium ${
                  isSubmitting || !validateForm()
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
              >
                {isSubmitting ? '⏳ Criando...' : '✅ Criar Lançamento'}
              </button>
            </div>
          </div>

          {/* Dica */}
          <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
            <p className="text-xs text-blue-300">
              💡 <strong>Dica:</strong> Os campos ID e Mês serão gerados automaticamente. 
              Valores positivos são receitas, negativos são gastos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}