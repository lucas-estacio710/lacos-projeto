// components/CremacoesModal.tsx - MODAL PARA CREMAÇÕES (VALORES NEGATIVOS)

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, ArrowLeft, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { Transaction } from '@/types';
import { formatDateToLocal, formatDateForDisplay } from '@/lib/dateUtils';
import { SUBTIPO_IDS } from '@/lib/constants';
import { useHierarchy } from '@/hooks/useHierarchy';

interface DayGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  cremacoesTransactions: Transaction[];
  totalTransactionValue: number;
}

interface CremacoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  complexTransactions?: Transaction[]; // Transactions com categoria COMPLEXA
  onApplyReconciliation?: (reconciliationData: {
    originalTransactionIds: string[];
    newTransactions: Array<{
      id: string;
      valor: number;
      subtipo_id: string;
      descricao: string;
      data: string;
      origem: string;
      cc: string;
      mes: string;
      descricao_origem: string;
      realizado: 's';
      linked_future_group?: string;
      is_from_reconciliation: boolean;
      reconciliation_metadata: string;
    }>;
    reconciliationNote: string;
    reconciliationMetadata: {
      type: 'cremacao_create_new';
      source_count: number;
      destination_count: number;
      input_method: 'automatic' | 'manual';
      parsed_entries_count: number;
      total_individual: number;
      total_coletiva: number;
      total_manual: number;
      session_data: {
        date: string;
        user_input_preview: string;
      };
    };
  }) => Promise<void>;
  onMarkTransactionsAsReconciled?: (transactionIds: string[]) => Promise<void>;
}

export function CremacoesModal({
  isOpen,
  onClose,
  onSuccess,
  complexTransactions = [],
  onApplyReconciliation,
  onMarkTransactionsAsReconciled
}: CremacoesModalProps) {
  // Estados principais
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);
  const [textToParse, setTextToParse] = useState('');
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([]);
  const [inputMode, setInputMode] = useState<'automatico' | 'manual'>('automatico');
  const [manualEntry, setManualEntry] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: '',
    origem: 'Inter',
    cc: 'Inter', 
    descricao: '',
    subtipo_id: '',
    selected_conta: '',
    selected_categoria: ''
  });
  const [copyAnimating, setCopyAnimating] = useState(false);
  
  // Hook para hierarquia
  const { hierarquia, carregarTudo } = useHierarchy();

  // Carregar hierarquia quando modal abre
  useEffect(() => {
    if (isOpen) {
      carregarTudo();
    }
  }, [isOpen, carregarTudo]);

  // Organizar hierarquia em cascata
  const availableContas = useMemo(() => {
    return hierarquia.map(contaGroup => ({
      id: contaGroup.conta.id,
      nome: contaGroup.conta.nome,
      icone: contaGroup.conta.icone
    }));
  }, [hierarquia]);

  const availableCategorias = useMemo(() => {
    if (!manualEntry.selected_conta) return [];
    
    const contaGroup = hierarquia.find(h => h.conta.id === manualEntry.selected_conta);
    if (!contaGroup) return [];
    
    return contaGroup.categorias.map(catGroup => ({
      id: catGroup.categoria.id,
      nome: catGroup.categoria.nome,
      icone: catGroup.categoria.icone
    }));
  }, [hierarquia, manualEntry.selected_conta]);

  const availableSubtipos = useMemo(() => {
    if (!manualEntry.selected_conta || !manualEntry.selected_categoria) return [];
    
    const contaGroup = hierarquia.find(h => h.conta.id === manualEntry.selected_conta);
    if (!contaGroup) return [];
    
    const catGroup = contaGroup.categorias.find(c => c.categoria.id === manualEntry.selected_categoria);
    if (!catGroup) return [];
    
    return catGroup.subtipos.map(subtipo => ({
      id: subtipo.id,
      nome: subtipo.nome,
      icone: subtipo.icone
    }));
  }, [hierarquia, manualEntry.selected_conta, manualEntry.selected_categoria]);

  // Hierarquia linear para facilitar buscas
  const availableHierarchy = useMemo(() => {
    const hierarchy: Array<{
      subtipo_id: string;
      subtipo_nome: string;
      subtipo_icone: string;
      categoria_nome: string;
      conta_nome: string;
      caminho_completo: string;
    }> = [];
    
    hierarquia.forEach(contaGroup => {
      contaGroup.categorias.forEach(catGroup => {
        catGroup.subtipos.forEach(subtipo => {
          hierarchy.push({
            subtipo_id: subtipo.id,
            subtipo_nome: subtipo.nome,
            subtipo_icone: subtipo.icone || '',
            categoria_nome: catGroup.categoria.nome,
            conta_nome: contaGroup.conta.nome,
            caminho_completo: `${contaGroup.conta.nome} > ${catGroup.categoria.nome} > ${subtipo.nome}`
          });
        });
      });
    });
    
    return hierarchy;
  }, [hierarquia]);

  // Organizar dados por dia quando modal abre
  useEffect(() => {
    if (!isOpen) {
      setDayGroups([]);
      setDataInitialized(false);
      return;
    }

    // INICIALIZAR APENAS UMA VEZ
    if (dataInitialized) {
      console.log('📌 Dados Cremações já inicializados, mantendo estado atual');
      return;
    }

    console.log('🔧 Organizando dados Cremações por dia...');

    // 1. Filtrar apenas valores NEGATIVOS com categoria COMPLEXA E não reconciliadas
    const cremacoesTransactions = complexTransactions.filter(t => {
      const COMPLEX_SUBTIPO_ID = 'e92f4f0f-4e94-4007-8945-a1fb47782051';
      const isComplexCategory = t.subtipo_id === COMPLEX_SUBTIPO_ID;
      const isNotReconciled = t.realizado !== 'r'; // ✅ Excluir reconciliadas
      const isNegativeValue = t.valor < 0; // ✅ Apenas valores negativos (gastos/saídas)
      
      return isComplexCategory && isNotReconciled && isNegativeValue;
    });

    console.log(`📊 ${cremacoesTransactions.length} transações Cremações encontradas`);

    // 2. Agrupar por data
    const groups = new Map<string, DayGroup>();

    // Processar transações de cremações
    cremacoesTransactions.forEach(transaction => {
      const dateStr = formatDateToLocal(transaction.data);
      
      if (!dateStr || dateStr === 'Data inválida') {
        console.warn('⚠️ Transação com data inválida ignorada:', transaction.id);
        return;
      }
      
      if (!groups.has(dateStr)) {
        groups.set(dateStr, {
          date: dateStr,
          displayDate: formatDateForDisplay(dateStr),
          cremacoesTransactions: [],
          totalTransactionValue: 0
        });
      }
      
      const group = groups.get(dateStr)!;
      group.cremacoesTransactions.push(transaction);
      group.totalTransactionValue += Math.abs(transaction.valor);
    });

    // 3. Converter para array e ordenar cronologicamente
    const sortedGroups = Array.from(groups.values())
      .filter(group => group.cremacoesTransactions.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    setDayGroups(sortedGroups);
    resetSelections();
    setDataInitialized(true);

    console.log(`✅ ${sortedGroups.length} dias organizados`);
  }, [isOpen, dataInitialized]);

  // Funções auxiliares
  const resetSelections = () => {
    setSelectedTransactions(new Set());
  };

  // IDs dos subtipos para cremações (baseado nos exemplos)
  const SUBTIPO_CREMACAO_INDIVIDUAL = 'b862fc92-e098-4a48-90ac-4c051f89c0cf';
  const SUBTIPO_CREMACAO_COLETIVA = 'c6300f87-068a-4be9-bc3b-695669cb420a';


  // Função para processar o texto e gerar transações baseado nas selecionadas
  const parseTextToTransactions = (text: string) => {
    if (!text.trim()) {
      setPreviewTransactions([]);
      return;
    }

    // Pegar origem e CC das transações selecionadas (usar a primeira como padrão)
    const selectedTransactionsList = allCremacoesTransactions.filter(t => selectedTransactions.has(t.id));
    const baseTransaction = selectedTransactionsList[0];
    const defaultOrigem = baseTransaction?.origem || 'Inter';
    const defaultCC = baseTransaction?.cc || 'Inter';

    const lines = text.trim().split('\n').filter(line => line.trim());
    const transactions: any[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(';');
      if (parts.length !== 3) return;

      const [dateStr, nameAndPet, valueStr] = parts;

      // Parse nome-pet-tipo
      const nameParts = nameAndPet.split('-');
      if (nameParts.length < 3) return;

      const tipo = nameParts[nameParts.length - 1]; // Último item é o tipo
      const pet = nameParts[nameParts.length - 2]; // Penúltimo é o pet
      const nome = nameParts.slice(0, -2).join('-'); // Resto é o nome

      // Parse valor
      const valor = parseFloat(valueStr);

      // ✅ Parse data da colagem (formato DD/MM/AAAA -> YYYY-MM-DD)
      let parsedDate = baseTransaction.data; // Fallback para data original
      try {
        const [day, month, year] = dateStr.split('/');
        if (day && month && year) {
          parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      } catch (error) {
        console.warn('⚠️ Erro ao processar data da colagem, usando data original:', dateStr);
      }

      // Determinar subtipo baseado no tipo
      const isIndividual = tipo.toUpperCase() === 'INDIVIDUAL';
      const subtipo_id = isIndividual ? SUBTIPO_CREMACAO_INDIVIDUAL : SUBTIPO_CREMACAO_COLETIVA;

      // ✅ Gerar ID único baseado nos dados (NOME_PET_TIMESTAMP)
      const timestamp = Date.now() + index; // Evitar duplicatas no mesmo milissegundo
      const nomeCode = nome.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
      const petCode = pet.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3);
      const tipoCode = tipo.toUpperCase().substring(0, 1); // I=Individual, C=Coletiva
      const id = `CREM_${nomeCode}_${petCode}_${tipoCode}_${timestamp}`;

      const transaction = {
        id,
        mes: baseTransaction.mes, // ✅ Herdar mes da transação original
        data: parsedDate, // ✅ Usar data da colagem
        descricao_origem: baseTransaction.descricao_origem, // Herdar da transação original
        descricao: `${nome.toUpperCase()} - ${pet.toUpperCase()} - ${tipo.toUpperCase()}`,
        valor: valor,
        origem: baseTransaction.origem, // Herdar origem da transação original
        cc: baseTransaction.cc, // Herdar cc da transação original
        realizado: 's' as const,
        subtipo_id,
        is_from_reconciliation: false,
        linked_future_group: null,
        future_subscription_id: null,
        reconciliation_metadata: null
      };
      
      transactions.push(transaction);
    });

    setPreviewTransactions(transactions);
    console.log('🔄 Parsed transactions:', transactions);
  };

  // Preview não é mais limpo ao trocar de modo - mantém todos os lançamentos

  // Função para limpar preview
  const clearPreview = () => {
    setPreviewTransactions([]);
    if (inputMode === 'automatico') {
      setTextToParse('');
    }
  };

  // Função para deletar um lançamento específico do preview
  const deletePreviewTransaction = (transactionId: string) => {
    setPreviewTransactions(prev => prev.filter(t => t.id !== transactionId));
  };

  // Função para gerar preview do texto automático
  const generateAutomaticPreview = () => {
    // Limpar apenas preview automático existente, manter manuais
    setPreviewTransactions(prev => prev.filter(t => t.id.startsWith('MANUAL_')));
    
    // Gerar novos automáticos
    if (!textToParse.trim()) {
      return;
    }
    
    const selectedTransactionsList = allCremacoesTransactions.filter(t => selectedTransactions.has(t.id));
    const baseTransaction = selectedTransactionsList[0];
    const defaultOrigem = baseTransaction?.origem || 'Inter';
    const defaultCC = baseTransaction?.cc || 'Inter';

    const lines = textToParse.trim().split('\n').filter(line => line.trim());
    const transactions: any[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(';');
      if (parts.length !== 3) return;

      const [dateStr, nameAndPet, valueStr] = parts;

      // Parse nome-pet-tipo
      const nameParts = nameAndPet.split('-');
      if (nameParts.length < 3) return;

      const tipo = nameParts[nameParts.length - 1];
      const pet = nameParts[nameParts.length - 2];
      const nome = nameParts.slice(0, -2).join('-');

      // Parse valor
      const valor = parseFloat(valueStr);

      // ✅ Parse data da colagem (formato DD/MM/AAAA -> YYYY-MM-DD)
      let parsedDate = baseTransaction.data; // Fallback para data original
      try {
        const [day, month, year] = dateStr.split('/');
        if (day && month && year) {
          parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      } catch (error) {
        console.warn('⚠️ Erro ao processar data da colagem, usando data original:', dateStr);
      }

      // Determinar subtipo baseado no tipo
      const isIndividual = tipo.toUpperCase() === 'INDIVIDUAL';
      const subtipo_id = isIndividual ? SUBTIPO_CREMACAO_INDIVIDUAL : SUBTIPO_CREMACAO_COLETIVA;

      // ✅ Gerar ID único baseado nos dados (NOME_PET_TIMESTAMP)
      const timestamp = Date.now() + index; // Evitar duplicatas no mesmo milissegundo
      const nomeCode = nome.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
      const petCode = pet.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3);
      const tipoCode = tipo.toUpperCase().substring(0, 1); // I=Individual, C=Coletiva
      const id = `CREM_${nomeCode}_${petCode}_${tipoCode}_${timestamp}`;

      const transaction = {
        id,
        mes: baseTransaction.mes, // ✅ Herdar mes da transação original
        data: parsedDate, // ✅ Usar data da colagem
        descricao_origem: baseTransaction.descricao_origem, // Herdar da transação original
        descricao: `${nome.toUpperCase()} - ${pet.toUpperCase()} - ${tipo.toUpperCase()}`,
        valor: valor,
        origem: baseTransaction.origem, // Herdar origem da transação original
        cc: baseTransaction.cc, // Herdar cc da transação original
        realizado: 's' as const,
        subtipo_id,
        is_from_reconciliation: false,
        linked_future_group: null,
        future_subscription_id: null,
        reconciliation_metadata: null
      };
      
      transactions.push(transaction);
    });

    // Adicionar novos automáticos ao preview
    setPreviewTransactions(prev => [...prev, ...transactions]);
  };

  // Função para copiar fórmula com animação
  const copyFormula = async () => {
    try {
      await navigator.clipboard.writeText('=TEXTO(A3;"DD/MM/AAAA")&";"&D3&"-"&B3&"-"&F3&";"&-G3');
      setCopyAnimating(true);
      setTimeout(() => setCopyAnimating(false), 1000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  // Função para adicionar entry manual ao preview
  const addManualEntry = () => {
    if (!manualEntry.descricao || !manualEntry.valor) {
      alert('⚠️ Preencha todos os campos obrigatórios');
      return;
    }

    if (selectedTransactions.size === 0) {
      alert('⚠️ Selecione uma transação não classificada primeiro');
      return;
    }

    // Pegar dados da transação selecionada
    const selectedTransactionsList = allCremacoesTransactions.filter(t => selectedTransactions.has(t.id));
    const baseTransaction = selectedTransactionsList[0];
    
    // Parse valor
    const valor = parseFloat(manualEntry.valor.toString().replace(',', '.'));
    
    // Gerar ID único
    const timestamp = Date.now();
    const id = `MANUAL_${timestamp}`;
    
    const transaction = {
      id,
      mes: baseTransaction.mes, // Usar mes da transação original
      data: baseTransaction.data, // Usar data da transação original
      descricao_origem: baseTransaction.descricao_origem, // Usar descricao_origem da transação original
      descricao: manualEntry.descricao, // Só esta fica do input manual
      valor: valor,
      origem: baseTransaction.origem, // Usar origem da transação original
      cc: baseTransaction.cc, // Usar cc da transação original
      realizado: 's' as const,
      subtipo_id: manualEntry.subtipo_id || null,
      is_from_reconciliation: false,
      linked_future_group: null,
      future_subscription_id: null,
      reconciliation_metadata: null
    };
    
    // Adicionar ao preview existente
    setPreviewTransactions(prev => [...prev, transaction]);
    
    // Limpar apenas descrição e valor (manter seleções de hierarquia)
    setManualEntry({
      ...manualEntry,
      descricao: '',
      valor: ''
    });
  };


  // Toggle seleções - APENAS UMA TRANSAÇÃO
  const toggleTransactionSelection = (transactionId: string) => {
    if (selectedTransactions.has(transactionId)) {
      // Se já está selecionada, desmarcar
      setSelectedTransactions(new Set());
    } else {
      // Se não está selecionada, selecionar APENAS esta (substituir qualquer outra)
      setSelectedTransactions(new Set([transactionId]));
    }
  };

  // Todas as transações de cremações (de todos os dias)
  const allCremacoesTransactions = dayGroups.flatMap(group => group.cremacoesTransactions);
  
  // Calcular totais selecionados
  const selectedTransactionTotal = allCremacoesTransactions
    .filter(t => selectedTransactions.has(t.id))
    .reduce((sum, t) => sum + Math.abs(t.valor), 0);

  const hasSelections = selectedTransactions.size > 0;

  // Criar lançamentos a partir do texto
  const handleCreateFromText = async () => {
    if (previewTransactions.length === 0) {
      alert('⚠️ Nenhum lançamento para criar');
      return;
    }

    const confirmText = 
      `🆕 Criar ${previewTransactions.length} lançamentos - Confirma?\n\n` +
      `💰 Total: R$ ${Math.abs(previewTransactions.reduce((sum, t) => sum + t.valor, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `⚡ RESULTADO:\n` +
      `   • Novos lançamentos serão criados\n` +
      `   • Status: realizado = 's' (contam no saldo)`;

    if (!window.confirm(confirmText)) return;

    setIsProcessing(true);

    try {
      if (onApplyReconciliation) {
        // Marcar a transação original selecionada como reconciliada
        const selectedTransactionsList = allCremacoesTransactions.filter(t => selectedTransactions.has(t.id));
        const originalTransactionIds = selectedTransactionsList.map(t => t.id);
        
        // Contar tipos de lançamentos
        const totalIndividual = previewTransactions.filter(t => t.subtipo_id === SUBTIPO_CREMACAO_INDIVIDUAL).length;
        const totalColetiva = previewTransactions.filter(t => t.subtipo_id === SUBTIPO_CREMACAO_COLETIVA).length;
        const totalManual = previewTransactions.filter(t => t.subtipo_id && t.subtipo_id !== SUBTIPO_CREMACAO_INDIVIDUAL && t.subtipo_id !== SUBTIPO_CREMACAO_COLETIVA).length;

        // Enriquecer transações com metadados de reconciliação
        const enrichedTransactions = previewTransactions.map((transaction, index) => ({
          ...transaction,
          linked_future_group: `CREMACAO_RECONCILIATION_${selectedTransactionsList[0]?.data}`,
          is_from_reconciliation: true,
          reconciliation_metadata: JSON.stringify({
            reconciliation_type: 'cremacao_manual_create',
            reconciliation_date: new Date().toISOString(),
            original_transaction_ids: originalTransactionIds,
            input_method: inputMode === 'automatico' ? 'automatic' : 'manual',
            entry_index: index,
            session_data: {
              date: selectedTransactionsList[0]?.data,
              user_input: inputMode === 'automatico' ? textToParse : 'manual_entry',
              total_entries: previewTransactions.length
            }
          })
        }));

        // Callback padronizado de reconciliação
        await onApplyReconciliation({
          originalTransactionIds,
          newTransactions: enrichedTransactions,
          reconciliationNote: `Cremação ${inputMode === 'automatico' ? 'automática' : 'manual'}: ${previewTransactions.length} lançamentos criados`,
          reconciliationMetadata: {
            type: 'cremacao_create_new',
            source_count: originalTransactionIds.length,
            destination_count: previewTransactions.length,
            input_method: inputMode === 'automatico' ? 'automatic' : 'manual',
            parsed_entries_count: previewTransactions.length,
            total_individual: totalIndividual,
            total_coletiva: totalColetiva,
            total_manual: totalManual,
            session_data: {
              date: selectedTransactionsList[0]?.data || new Date().toISOString().split('T')[0],
              user_input_preview: inputMode === 'automatico' 
                ? textToParse.slice(0, 100) + (textToParse.length > 100 ? '...' : '')
                : `Manual: ${totalManual} entries`
            }
          }
        });

        console.log('🆕 Reconciliação aplicada:', enrichedTransactions);
        
        alert(
          `✅ ${previewTransactions.length} lançamentos criados!\n\n` +
          `💰 Total: R$ ${Math.abs(previewTransactions.reduce((sum, t) => sum + t.valor, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
          `📊 Detalhes:\n` +
          `   • Individual: ${previewTransactions.filter(t => t.subtipo_id === SUBTIPO_CREMACAO_INDIVIDUAL).length}\n` +
          `   • Coletiva: ${previewTransactions.filter(t => t.subtipo_id === SUBTIPO_CREMACAO_COLETIVA).length}`
        );

        // Limpar o texto e preview
        setTextToParse('');
        setPreviewTransactions([]);

        // Callback de sucesso
        if (onSuccess) {
          onSuccess();
        }
      }

    } catch (error) {
      console.error('❌ Erro ao criar lançamentos:', error);
      alert('❌ Erro ao criar lançamentos');
    } finally {
      setIsProcessing(false);
    }
  };


  // Helpers de formatação
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full h-[95vh] sm:h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-100 flex items-center gap-2">
              💛 Cremações
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setDataInitialized(false);
                  resetSelections();
                }} 
                className="text-gray-400 hover:text-gray-200 transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal em 3 Blocos */}
        <div className="flex-1 overflow-hidden">
          {dayGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">💛</div>
                <h3 className="text-xl font-semibold text-gray-100 mb-2">
                  Nenhuma Cremação para Classificar
                </h3>
                <p className="text-gray-400">
                  Não há transações com valores negativos na categoria COMPLEXA
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              
              {/* BLOCO 1: Transações Não Classificadas */}
              <div className="min-h-[15%] max-h-[30%] border-b border-gray-700 flex flex-col">
                <div className="p-2 border-b border-gray-700 bg-gray-850">
                  <h4 className="font-medium text-gray-100 text-sm flex items-center gap-2">
                    💛 Não Classificadas ({allCremacoesTransactions.length})
                    <span className="text-xs text-gray-400">
                      R$ {formatCurrency(allCremacoesTransactions.reduce((sum, t) => sum + Math.abs(t.valor), 0))}
                    </span>
                  </h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1">
                  <div className="space-y-1">
                    {allCremacoesTransactions
                      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
                      .map(transaction => (
                      <div
                        key={transaction.id}
                        className={`border rounded transition-all cursor-pointer ${
                          selectedTransactions.has(transaction.id)
                            ? 'border-yellow-500 bg-yellow-900/20'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                        onClick={() => toggleTransactionSelection(transaction.id)}
                      >
                        <div className="flex items-center gap-2 p-2">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(transaction.id)}
                            onChange={() => toggleTransactionSelection(transaction.id)}
                            className="w-3 h-3 rounded border-gray-500 bg-gray-700"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-gray-100 font-medium text-xs truncate max-w-[63%]">
                                {transaction.descricao_origem}
                              </div>
                              <div className="text-red-400 font-bold text-sm shrink-0">
                                -R$ {formatCurrency(Math.abs(transaction.valor))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <span>{transaction.data}</span>
                              <span>•</span>
                              <span>{transaction.origem}</span>
                              <span>•</span>
                              <span>{transaction.cc}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Match/Diferença - Colado aos botões de input */}
              {previewTransactions.length > 0 && (
                <div className="p-2 bg-blue-900/30 border-t border-blue-600">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-300">
                        R$ {formatCurrency(selectedTransactionTotal)}
                      </span>
                      <span className="text-blue-400">→</span>
                      <span className="font-bold text-green-300">
                        R$ {formatCurrency(Math.abs(previewTransactions.reduce((sum, t) => sum + t.valor, 0)))}
                      </span>
                    </div>
                    <div>
                      {selectedTransactionTotal === Math.abs(previewTransactions.reduce((sum, t) => sum + t.valor, 0)) 
                        ? <span className="text-green-400">✓ Match</span> 
                        : <span className="text-yellow-400">⚠ Diferença</span>
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* BLOCO 2: Seletor de Input */}
              <div className="flex-1 border-b border-gray-700 flex flex-col overflow-hidden">
                <div className="p-2 border-b border-gray-700 bg-gray-850 flex-1 flex flex-col overflow-hidden">
                  {/* Seletor Automático/Manual - Full Width */}
                  <div className="w-full bg-gray-700 rounded-lg p-0.5 grid grid-cols-2 gap-0.5 mb-2">
                    <button
                      onClick={() => setInputMode('automatico')}
                      className={`py-1.5 px-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        inputMode === 'automatico'
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'
                          : 'text-gray-300 hover:text-white hover:bg-gray-600'
                      }`}
                    >
                      🤖 Input Automático
                    </button>
                    <button
                      onClick={() => setInputMode('manual')}
                      className={`py-1.5 px-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        inputMode === 'manual'
                          ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/25'
                          : 'text-gray-300 hover:text-white hover:bg-gray-600'
                      }`}
                    >
                      ✏️ Input Manual
                    </button>
                  </div>

                  {/* Grid 2x2 - Campo de texto + botões */}
                  {inputMode === 'automatico' && (
                    <div className="mx-2 mb-2">
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        {/* Coluna 1: Campo de texto (ocupa 2 linhas) */}
                        <div className="row-span-2">
                          <textarea
                            value={textToParse}
                            onChange={(e) => setTextToParse(e.target.value)}
                            placeholder="Cole aqui os dados no formato:
DD/MM/AAAA;NOME-PET-TIPO;VALOR
01/07/2025;MARCELA-ESTRANHO-INDIVIDUAL;-500"
                            className="w-full h-20 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-gray-100 text-sm placeholder-gray-400 resize-none focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        
                        {/* Coluna 2, Linha 1: Botão Copiar Fórmula */}
                        <button
                          onClick={copyFormula}
                          className={`py-1.5 px-2 text-sm font-medium rounded-md transition-all duration-300 ${
                            copyAnimating
                              ? 'bg-green-700 shadow-lg shadow-green-500/50 text-white'
                              : 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/25 hover:from-green-700 hover:to-green-600'
                          }`}
                        >
                          {copyAnimating ? '✅ Copiado!' : '📋 Fórmula'}
                        </button>
                        
                        {/* Coluna 2, Linha 2: Botão Pré-lançar */}
                        <button
                          onClick={generateAutomaticPreview}
                          disabled={!textToParse.trim()}
                          className={`py-1.5 px-2 text-sm font-medium rounded-md transition-all duration-200 ${
                            textToParse.trim()
                              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-blue-600'
                              : 'text-gray-300 bg-gray-600 cursor-not-allowed'
                          }`}
                        >
                          🚀 Pré-lançar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Input Manual - Grid 3x2 */}
                  {inputMode === 'manual' && (
                    <div className="mx-2 mb-2">
                      {selectedTransactions.size === 0 && (
                        <div className="text-center py-4 text-yellow-400 text-sm">
                          ⚠️ Selecione uma transação não classificada acima para usar como base
                        </div>
                      )}
                      
                      {selectedTransactions.size > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {/* Primeira linha: Conta, Categoria, Subtipo */}
                          <select
                            value={manualEntry.selected_conta || ''}
                            onChange={(e) => setManualEntry(prev => ({
                              ...prev, 
                              selected_conta: e.target.value,
                              selected_categoria: '', // Reset categoria
                              subtipo_id: '' // Reset subtipo
                            }))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-gray-100 text-sm focus:border-green-500 focus:outline-none"
                          >
                            <option value="">Conta</option>
                            {availableContas.map((conta) => (
                              <option key={conta.id} value={conta.id}>
                                {conta.icone} {conta.nome}
                              </option>
                            ))}
                          </select>

                          <select
                            value={manualEntry.selected_categoria || ''}
                            onChange={(e) => setManualEntry(prev => ({
                              ...prev, 
                              selected_categoria: e.target.value,
                              subtipo_id: '' // Reset subtipo
                            }))}
                            disabled={!manualEntry.selected_conta}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-gray-100 text-sm focus:border-green-500 focus:outline-none disabled:bg-gray-800 disabled:text-gray-500"
                          >
                            <option value="">Categoria</option>
                            {availableCategorias.map((categoria) => (
                              <option key={categoria.id} value={categoria.id}>
                                {categoria.icone} {categoria.nome}
                              </option>
                            ))}
                          </select>

                          <select
                            value={manualEntry.subtipo_id || ''}
                            onChange={(e) => setManualEntry(prev => ({...prev, subtipo_id: e.target.value}))}
                            disabled={!manualEntry.selected_categoria}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-gray-100 text-sm focus:border-green-500 focus:outline-none disabled:bg-gray-800 disabled:text-gray-500"
                          >
                            <option value="">Subtipo</option>
                            {availableSubtipos.map((subtipo) => (
                              <option key={subtipo.id} value={subtipo.id}>
                                {subtipo.icone} {subtipo.nome}
                              </option>
                            ))}
                          </select>

                          {/* Segunda linha: Descrição, Valor, Pré-lançar */}
                          <input
                            type="text"
                            value={manualEntry.descricao}
                            onChange={(e) => setManualEntry(prev => ({...prev, descricao: e.target.value}))}
                            placeholder="Descrição"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-gray-100 text-sm focus:border-green-500 focus:outline-none"
                          />

                          <input
                            type="number"
                            step="0.01"
                            value={manualEntry.valor}
                            onChange={(e) => setManualEntry(prev => ({...prev, valor: e.target.value}))}
                            placeholder="-500.00"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-gray-100 text-sm focus:border-green-500 focus:outline-none"
                          />

                          <button
                            onClick={addManualEntry}
                            disabled={!manualEntry.descricao || !manualEntry.valor || !manualEntry.subtipo_id}
                            className={`py-1.5 px-2 text-sm font-medium rounded-md transition-all duration-200 ${
                              manualEntry.descricao && manualEntry.valor && manualEntry.subtipo_id
                                ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/25 hover:from-green-700 hover:to-green-600'
                                : 'text-gray-300 bg-gray-600 cursor-not-allowed'
                            }`}
                          >
                            🚀 Pré-lançar
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preview de Lançamentos - Compartilhado entre automático e manual */}
                  {previewTransactions.length > 0 && (
                    <div className="border-b border-blue-600 mt-2 flex-1 flex flex-col overflow-hidden">
                      <div className="p-2 border-b border-blue-600 bg-blue-900/30">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-blue-100 text-sm flex items-center gap-2">
                            🆕 Preview ({previewTransactions.length})
                            <span className="text-xs text-blue-400">
                              R$ {formatCurrency(Math.abs(previewTransactions.reduce((sum, t) => sum + t.valor, 0)))}
                            </span>
                          </h4>
                          <button
                            onClick={clearPreview}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                          >
                            🗑️ Limpar
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-1">
                        <div className="space-y-1">
                          {previewTransactions.map((transaction, index) => (
                            <div key={`preview-${index}`} className="border rounded transition-all border-blue-600 bg-gray-900 hover:border-blue-500">
                              <div className="flex items-center gap-2 p-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-blue-100 font-medium text-xs truncate max-w-[55%]">
                                      {transaction.descricao}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <div className="text-red-400 font-bold text-sm">
                                        -R$ {formatCurrency(Math.abs(transaction.valor))}
                                      </div>
                                      <button
                                        onClick={() => deletePreviewTransaction(transaction.id)}
                                        className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                                        title="Remover lançamento"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between mt-0.5">
                                    <div className="flex items-center gap-1 text-xs text-blue-400">
                                      <span>{transaction.data}</span>
                                    </div>
                                    <div className="text-xs">
                                      {transaction.subtipo_id === SUBTIPO_CREMACAO_INDIVIDUAL && <span className="text-blue-300">👤 Ind</span>}
                                      {transaction.subtipo_id === SUBTIPO_CREMACAO_COLETIVA && <span className="text-blue-300">👥 Col</span>}
                                      {transaction.subtipo_id && transaction.subtipo_id !== SUBTIPO_CREMACAO_INDIVIDUAL && transaction.subtipo_id !== SUBTIPO_CREMACAO_COLETIVA && (
                                        <span className="text-green-300">
                                          📄 {availableHierarchy.find(h => h.subtipo_id === transaction.subtipo_id)?.subtipo_icone} {availableHierarchy.find(h => h.subtipo_id === transaction.subtipo_id)?.subtipo_nome || 'Manual'}
                                        </span>
                                      )}
                                      {!transaction.subtipo_id && <span className="text-green-300">📄 Manual</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
              
            </div>
          )}
        </div>

        {/* Footer fixo - 2 botões full width */}
        <div className="p-2 border-t border-gray-700 bg-gray-850">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onClose}
              className="py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors font-medium"
            >
              Cancelar
            </button>
            
            <button
              onClick={handleCreateFromText}
              disabled={isProcessing || !previewTransactions.length || selectedTransactionTotal !== Math.abs(previewTransactions.reduce((sum, t) => sum + t.valor, 0))}
              className={`py-2 rounded text-sm font-medium transition-colors ${
                !isProcessing && previewTransactions.length > 0 && selectedTransactionTotal === Math.abs(previewTransactions.reduce((sum, t) => sum + t.valor, 0))
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

