// components/BankUpload.tsx - VERSÃO SIMPLIFICADA - SEMPRE VAI PARA SIMPLEDIFF

import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Transaction, BankType } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { formatMonth, formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { TonUploadReview } from './TonUploadReview';

interface BankUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionsImported: (transactions: Transaction[]) => Promise<{ success: boolean; stats?: { total: number; added: number; duplicates: number } } | void>;
  onCardTransactionsImported?: (transactions: CardTransaction[]) => Promise<any>;
  existingTransactions?: Transaction[]; // ✅ NOVA PROP: Para calcular prévia do saldo
}

export function BankUpload({
  isOpen,
  onClose,
  onTransactionsImported,
  onCardTransactionsImported,
  existingTransactions = [] // ✅ NOVA PROP
}: BankUploadProps) {
  const [selectedBank, setSelectedBank] = useState<BankType>('Inter');
  const [referenceMes, setReferenceMes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMethod, setInputMethod] = useState<'file' | 'paste'>('paste'); // ✅ PADRÃO: Colar dados
  const [pastedData, setPastedData] = useState(''); // ✅ NOVO: Dados colados
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ NOVO: Estados para modal de revisão TON
  const [showTonReview, setShowTonReview] = useState(false);
  const [tonPendingTransactions, setTonPendingTransactions] = useState<Transaction[]>([]);

  // ✅ FUNÇÃO: Detectar se primeira linha é cabeçalho do BB
  const detectBBHeader = (lines: string[]): boolean => {
    if (lines.length === 0) return false;

    const firstLine = lines[0].trim();
    if (!firstLine) return false;

    // Parse da primeira linha
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < firstLine.length; j++) {
      const char = firstLine[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    // Verificar se primeira linha tem padrões de cabeçalho
    if (cols.length >= 5) {
      const data = cols[0].replace(/^"|"$/g, '').trim().toLowerCase();
      const lancamento = cols[1].replace(/^"|"$/g, '').trim().toLowerCase();
      const valor = cols[4].replace(/^"|"$/g, '').trim().toLowerCase();

      // Padrões de cabeçalho
      const headerPatterns = [
        'data', 'date', 'lançamento', 'lancamento', 'histórico', 'historico',
        'valor', 'value', 'tipo', 'type', 'descrição', 'descricao', 'detalhes'
      ];

      // Se algum campo contém padrão de cabeçalho, é cabeçalho
      return headerPatterns.some(pattern =>
        data.includes(pattern) ||
        lancamento.includes(pattern) ||
        valor.includes(pattern)
      );
    }

    return false;
  };

  // ✅ FUNÇÃO: Calcular saldo atual do banco (igual ContasTab)
  const getSaldoAtualBanco = (bancoCodigo: string) => {
    return existingTransactions
      .filter(t =>
        t.cc === bancoCodigo &&
        (t.realizado === 's' || t.realizado === 'p') // s + p
      )
      .reduce((sum, t) => sum + t.valor, 0);
  };

  // ✅ FUNÇÃO: Mapear banco selecionado para código do banco
  const getBankCode = (selectedBank: string): string => {
    const bankMapping: Record<string, string> = {
      'Inter': 'Inter',
      'BB': 'BB',
      'Santander': 'Santander',
      'TON': 'Stone',
      'Nubank': 'MasterCard', // Cartões usam códigos diferentes
      'VISA': 'VISA',
      'MasterCard': 'MasterCard'
    };
    return bankMapping[selectedBank] || selectedBank;
  };

  // Parse de valor brasileiro
  const parseValorBR = (valorStr: string): number => {
    if (!valorStr) return 0;

    let valor = valorStr.toString().trim();
    valor = valor.replace(/R\$|RS/gi, '');
    valor = valor.replace(/\s+/g, '');

    const isNegative = valor.includes('(') || valor.includes(')') || valor.startsWith('-');
    valor = valor.replace(/[\(\)\-\+]/g, '');

    if (valor.includes(',')) {
      if (valor.includes('.') && valor.lastIndexOf('.') < valor.lastIndexOf(',')) {
        valor = valor.replace(/\./g, '').replace(',', '.');
      } else {
        valor = valor.replace(',', '.');
      }
    }

    const numericValue = parseFloat(valor) || 0;
    return isNegative ? -numericValue : numericValue;
  };

  // Parse específico para BB
  const parseBBValue = (valorStr: string): number => {
    if (!valorStr) return 0;

    let valor = valorStr.toString().trim();
    valor = valor.replace(/^"|"$/g, '');

    const isNegative = valor.startsWith('-');
    if (isNegative) {
      valor = valor.substring(1);
    }

    if (valor.includes(',')) {
      valor = valor.replace(/\./g, '').replace(',', '.');
    }

    const numericValue = parseFloat(valor) || 0;
    return isNegative ? -numericValue : numericValue;
  };

  // ✅ FUNÇÃO PARA CALCULAR SOMATÓRIA DOS DADOS COLADOS
  const calculatePastedDataSummary = () => {
    if (!pastedData.trim()) return { count: 0, total: 0 };

    const lines = pastedData.split('\n').filter(line => line.trim());
    if (lines.length <= 1) return { count: 0, total: 0 }; // Só cabeçalho ou vazio

    let total = 0;
    let validCount = 0;

    // Para cartões, usar formato: data,descricao,valor
    const isCardTransaction = selectedBank === 'Nubank' || selectedBank === 'VISA' || selectedBank === 'MasterCard';

    if (isCardTransaction) {
      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        if (cols.length >= 3) {
          const dataCompra = cols[0].trim();
          const titulo = cols[1].trim();
          const valorStr = cols[2].trim();

          // ✅ USAR MESMAS VALIDAÇÕES DO PROCESSAMENTO REAL
          if (!dataCompra || !titulo || titulo === 'title' || titulo === 'data' || titulo === 'date' || titulo.toLowerCase() === 'descricao') {
            continue;
          }

          // ✅ USAR MESMO ALGORITMO DO PROCESSAMENTO REAL
          const valorOriginal = parseFloat(valorStr) || 0;

          if (!isNaN(valorOriginal) && valorOriginal !== 0) {
            // ✅ USAR MESMO CÁLCULO DO PROCESSAMENTO REAL
            let valorFinal: number;
            if (valorOriginal > 0) {
              valorFinal = -valorOriginal; // Gasto
            } else if (valorOriginal < 0) {
              valorFinal = Math.abs(valorOriginal); // Estorno
            } else {
              valorFinal = 0;
            }

            total += valorFinal; // Soma com sinais corretos
            validCount++;
          }
        }
      }
    } else if (selectedBank === 'Inter') {
      // Para Inter (formato: Data Lançamento;Histórico;Descrição;Valor;Saldo)
      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(';');
        if (cols.length >= 4) {
          const dataLancamento = cols[0].trim();
          const historico = cols[1].trim();
          const descricao = cols[2].trim();
          const valorStr = cols[3].trim();

          // Validações básicas
          if (!dataLancamento || !historico || !descricao || !valorStr) {
            continue;
          }

          // Converter valor (formato brasileiro: 1.234,56 ou negativo -1.234,56)
          const valor = parseValorBR(valorStr);
          if (!isNaN(valor) && valor !== 0) {
            total += valor;
            validCount++;
          }
        }
      }
    } else if (selectedBank === 'BB') {
      // Para BB (formato: "data","lançamento","detalhes","nº doc","valor","tipo")
      const hasHeader = detectBBHeader(lines);
      const startIndex = hasHeader ? 1 : 0; // ✅ Detecção automática de cabeçalho

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV com aspas (igual ao processamento de arquivo)
        const cols: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cols.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        cols.push(current.trim());

        if (cols.length >= 5) {
          const data = cols[0].replace(/^"|"$/g, '').trim();
          const lancamento = cols[1].replace(/^"|"$/g, '').trim();
          const detalhes = cols[2].replace(/^"|"$/g, '').trim();
          const valorStr = cols[4].replace(/^"|"$/g, '').trim();

          // Validações expandidas para formato de extrato
          const lancamentosIgnorados = [
            'SALDO ANTERIOR', 'S A L D O', 'SALDO', 'SALDO ATUAL', 'SALDO FINAL', 'SALDO DO DIA'
          ];

          const descricao_origem = `${lancamento}${detalhes ? ' - ' + detalhes : ''}`.trim();
          const shouldIgnore = lancamentosIgnorados.some(termo =>
            lancamento.toUpperCase().includes(termo) ||
            descricao_origem.toUpperCase().includes(termo)
          );

          // Ignorar também linhas com data inválida (00/00/0000) ou sem data válida
          if (!shouldIgnore && data.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) && data !== '00/00/0000' && descricao_origem && descricao_origem !== ' - ') {
            const valor = parseBBValue(valorStr);
            if (!isNaN(valor) && valor !== 0) {
              total += valor;
              validCount++;
            }
          }
        }
      }
    }

    return { count: validCount, total };
  };

  // Função simples de hash para gerar IDs únicos
  const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
  };

  // Gerador de UUID v4 válido
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Gerador de ID único DETERMINÍSTICO (para outros bancos)
  const generateUniqueID = (banco: string, data: string, descricao: string, valor: number, uniqueField?: string): string => {
    const dataFormatada = data.replace(/\D/g, ''); // Usar data completa: DDMMYYYY
    const valorHash = Math.abs(Math.round(valor * 100)).toString(36).slice(-4);
    const descHash = simpleHash(descricao).slice(0, 4);

    // Usar campo único quando disponível para evitar duplicatas
    const uniqueHash = uniqueField
      ? simpleHash(String(uniqueField)).slice(0, 3)
      : '';

    const id = `${banco}${dataFormatada}${descHash}${valorHash}${uniqueHash}`;
    console.log(`🔧 ID Generation: data='${data}' -> dataFormatada='${dataFormatada}', desc='${descricao}' -> descHash='${descHash}', valor=${valor} -> valorHash='${valorHash}', unique='${uniqueField}' -> uniqueHash='${uniqueHash}' => ID='${id}'`);

    return id;
  };

  // Converter formato de data brasileiro para ISO
  const convertDateFormat = (brDate: string): string => {
    if (!brDate || !brDate.includes('/')) return brDate;

    const [day, month, year] = brDate.split('/');
    if (!day || !month || !year) return brDate;

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Gerar mês a partir da data
  const generateMonth = (dateStr: string): string => {
    // Suportar formato DD/MM/YYYY e YYYY-MM-DD
    let dateParts;

    if (dateStr.includes('/')) {
      // Formato DD/MM/YYYY
      dateParts = dateStr.split('/');
      if (dateParts.length === 3) {
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        const yearShort = year.slice(-2);
        return `${yearShort}${month}`;
      }
    } else if (dateStr.includes('-')) {
      // Formato YYYY-MM-DD
      dateParts = dateStr.split('-');
      if (dateParts.length === 3) {
        const year = dateParts[0];
        const month = dateParts[1].padStart(2, '0');
        const yearShort = year.slice(-2);
        return `${yearShort}${month}`;
      }
    }

    return '';
  };

  // ✅ FUNÇÃO PRINCIPAL: Processar cartões (ACEITA TODOS OS VALORES)
  const processCardTransactions = async (
    lines: string[],
    cardType: 'Nubank' | 'VISA' | 'MasterCard',
    faturaId: string
  ): Promise<CardTransaction[]> => {
    const cardTransactions: CardTransaction[] = [];
    let processedLines = 0;

    console.log(`🔗 Processando fatura ${cardType}: ${faturaId}`);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      processedLines++;
      const cols = line.split(',');

      if (cols.length >= 3) {
        const dataCompra = cols[0].trim();
        const titulo = cols[1].trim();
        const valorStr = cols[2].trim();

        if (!dataCompra || !titulo || titulo === 'title' || titulo === 'data' || titulo === 'date' || titulo.toLowerCase() === 'descricao') {
          continue;
        }

        // ✅ ACEITAR QUALQUER VALOR (incluindo zero, positivo, negativo)
        const valorOriginal = parseFloat(valorStr) || 0;

        // ✅ LÓGICA DE CONVERSÃO ATUALIZADA
        let valorFinal: number;
        if (valorOriginal > 0) {
          // Valor positivo no CSV = Gasto = Negativo no sistema
          valorFinal = -valorOriginal;
        } else if (valorOriginal < 0) {
          // Valor negativo no CSV = Estorno/Crédito = Positivo no sistema
          valorFinal = Math.abs(valorOriginal);
        } else {
          // Valor zero = zero
          valorFinal = 0;
        }

        // Gerar fingerprint determinístico
        const bankCode = cardType === 'Nubank' ? 'NUB' : cardType === 'VISA' ? 'VIS' : 'MST';
        const fingerprint = generateUniqueID(bankCode, dataCompra, titulo, Math.abs(valorOriginal));

        // Criar transação de cartão
        const cardTransaction: CardTransaction = {
          id: generateUUID(),
          fingerprint: fingerprint,
          fatura_id: faturaId,
          data_transacao: dataCompra,
          descricao_origem: titulo,
          valor: valorFinal,
          subtipo_id: null,
          descricao_classificada: null,
          status: 'pending',
          origem: cardType,
          cc: cardType
        };

        cardTransactions.push(cardTransaction);
      }
    }

    console.log(`📊 ${cardType}: ${cardTransactions.length} transações processadas`);
    return cardTransactions;
  };

  // ✅ FUNÇÃO: Processar extrato do Inter
  const processInterTransactions = async (lines: string[]): Promise<Transaction[]> => {
    const transactions: Transaction[] = [];
    let processedLines = 0;

    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(';');
      if (cols.length >= 4) {
        const dataLancamento = cols[0].trim();
        const historico = cols[1].trim();
        const descricao = cols[2].trim();
        const valorStr = cols[3].trim();

        // Validações básicas
        if (!dataLancamento || !historico || !descricao || !valorStr) {
          continue;
        }

        // Converter data de DD/MM/AAAA para AAAA-MM-DD
        const [dia, mes, ano] = dataLancamento.split('/');
        if (!dia || !mes || !ano) continue;

        const dataFormatted = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

        // Converter valor (formato brasileiro)
        const valor = parseValorBR(valorStr);
        if (isNaN(valor) || valor === 0) continue;

        // Gerar ID único
        const transactionId = `INTER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Gerar mês no formato AAMM
        const anoShort = ano.slice(-2);
        const mesFormatted = `${anoShort}${mes.padStart(2, '0')}`;

        // Criar transação
        const transaction: Transaction = {
          id: transactionId,
          mes: mesFormatted,
          data: dataFormatted,
          descricao_origem: `${historico} - ${descricao}`,
          descricao: `${historico} - ${descricao}`,
          valor: valor,
          origem: 'Inter',
          cc: 'Inter',
          realizado: 'p' as const, // Pendente para classificação
          subtipo_id: null,
          linked_future_group: undefined,
          is_from_reconciliation: false,
          future_subscription_id: undefined,
          reconciliation_metadata: JSON.stringify({
            imported_from: 'inter_paste',
            original_data: {
              data_lancamento: dataLancamento,
              historico: historico,
              descricao: descricao,
              valor_original: valorStr
            },
            imported_at: new Date().toISOString()
          })
        };

        transactions.push(transaction);
        processedLines++;
      }
    }

    console.log(`📊 Inter: ${transactions.length} transações processadas`);
    return transactions;
  };

  // ✅ FUNÇÃO: Processar extrato do BB
  const processBBTransactions = async (lines: string[]): Promise<Transaction[]> => {
    const transactions: Transaction[] = [];
    const usedIds = new Set<string>();

    // ✅ Detecção automática de cabeçalho
    const hasHeader = detectBBHeader(lines);
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV com aspas (igual ao processamento de arquivo)
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());

      if (cols.length >= 5) {
        const data = cols[0].replace(/^"|"$/g, '').trim();
        const lancamento = cols[1].replace(/^"|"$/g, '').trim();
        const detalhes = cols[2].replace(/^"|"$/g, '').trim();
        const valorStr = cols[4].replace(/^"|"$/g, '').trim();

        const descricao_origem = `${lancamento}${detalhes ? ' - ' + detalhes : ''}`.trim();

        // Validações expandidas para formato de extrato
        const lancamentosIgnorados = [
          'SALDO ANTERIOR', 'S A L D O', 'SALDO', 'SALDO ATUAL', 'SALDO FINAL', 'SALDO DO DIA'
        ];

        const shouldIgnore = lancamentosIgnorados.some(termo =>
          lancamento.toUpperCase().includes(termo) ||
          descricao_origem.toUpperCase().includes(termo)
        );

        // Ignorar também linhas com data inválida (00/00/0000) ou sem data válida
        if (shouldIgnore || !data.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) || data === '00/00/0000' || !descricao_origem || descricao_origem === ' - ') {
          continue;
        }

        const valor = parseBBValue(valorStr);
        const nroDocumento = cols[3]?.replace(/^"|"$/g, '').trim() || '';

        const id = generateUniqueID('BB', data, descricao_origem, valor, nroDocumento);

        if (usedIds.has(id)) {
          console.log(`⚠️ ID duplicado encontrado: ${id}`);
          continue;
        }
        usedIds.add(id);

        // Converter data de DD/MM/YYYY para YYYY-MM-DD
        const [dia, mes, ano] = data.split('/');
        const formattedDate = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

        // Determinar o mês (formato AAMM)
        const anoFormatted = ano.slice(-2);
        const mesFormatted = mes.padStart(2, '0');
        const mesReferencia = `${anoFormatted}${mesFormatted}`;

        const transaction: Transaction = {
          id,
          mes: mesReferencia,
          data: formattedDate,
          descricao_origem,
          subtipo_id: '',
          descricao: '',
          valor,
          origem: 'BB',
          cc: 'BB',
          realizado: 'p'
        };

        transactions.push(transaction);
      }
    }

    console.log(`📊 BB: ${transactions.length} transações processadas`);
    return transactions;
  };

  // ✅ NOVA FUNÇÃO: Processar dados colados
  const handlePasteProcess = async () => {
    if (!pastedData.trim()) {
      alert('⚠️ Por favor, cole os dados das transações na área de texto');
      return;
    }

    const isCardTransaction = ['Nubank', 'VISA', 'MasterCard'].includes(selectedBank);
    if (isCardTransaction && !referenceMes) {
      alert('⚠️ Por favor, informe o mês de referência da fatura (formato AAMM, ex: 2412 para Dez/2024)');
      return;
    }

    setIsProcessing(true);

    try {
      const lines = pastedData.trim().split('\n').filter(line => line.trim());

      console.log(`=== IMPORTAÇÃO MANUAL ${selectedBank.toUpperCase()} ===`);
      console.log('Total de linhas coladas:', lines.length);

      if (isCardTransaction) {
        // ===== PROCESSAR CARTÕES DE CRÉDITO =====
        if (!onCardTransactionsImported) {
          alert('⚠️ Função de importação de cartões não configurada');
          return;
        }

        const faturaId = `${selectedBank.toUpperCase()}_${referenceMes}`;
        const cardTransactions = await processCardTransactions(lines, selectedBank as 'Nubank' | 'VISA' | 'MasterCard', faturaId);

        if (cardTransactions.length === 0) {
          alert(`⚠️ Nenhuma transação válida encontrada nos dados colados do ${selectedBank}`);
          return;
        }

        console.log(`🎯 Enviando ${cardTransactions.length} transações coladas para SimpleDiff`);
        await onCardTransactionsImported(cardTransactions);

        setPastedData(''); // Limpar dados após processar
        onClose();
      } else if (selectedBank === 'Inter') {
        // ===== PROCESSAR INTER =====
        const importedTransactions = await processInterTransactions(lines);

        if (importedTransactions.length === 0) {
          alert('⚠️ Nenhuma transação válida encontrada nos dados colados do Inter');
          return;
        }

        console.log(`🎯 Enviando ${importedTransactions.length} transações do Inter para o sistema`);

        // Enviar para o hook de transações
        const result = await onTransactionsImported(importedTransactions);

        let message = `✅ Importação do Inter concluída!\n\n`;
        message += `📊 ${importedTransactions.length} transações processadas\n`;
        message += `📍 Todas as transações foram marcadas como pendentes\n`;
        message += `📥 Vá para a InboxTab para classificá-las\n`;

        if (result && typeof result === 'object' && 'stats' in result) {
          const stats = result.stats!;
          message += `\n📈 Estatísticas:\n`;
          message += `• Total processadas: ${stats.total}\n`;
          message += `• Novas adicionadas: ${stats.added}\n`;
          message += `• Duplicatas ignoradas: ${stats.duplicates}`;
        }

        alert(message);
        setPastedData(''); // Limpar dados após processar
        onClose();
      } else if (selectedBank === 'BB') {
        // ===== PROCESSAR BB =====
        const importedTransactions = await processBBTransactions(lines);

        if (importedTransactions.length === 0) {
          alert('⚠️ Nenhuma transação válida encontrada nos dados colados do BB');
          return;
        }

        console.log(`🎯 Enviando ${importedTransactions.length} transações do BB para o sistema`);

        // Enviar para o hook de transações
        const result = await onTransactionsImported(importedTransactions);

        let message = `✅ Importação do BB concluída!\n\n`;
        message += `📊 ${importedTransactions.length} transações processadas\n`;
        message += `📍 Todas as transações foram marcadas como pendentes\n`;
        message += `📥 Vá para a InboxTab para classificá-las\n`;

        if (result && typeof result === 'object' && 'stats' in result) {
          const stats = result.stats!;
          message += `\n📈 Estatísticas:\n`;
          message += `• Total processadas: ${stats.total}\n`;
          message += `• Novas adicionadas: ${stats.added}\n`;
          message += `• Duplicatas ignoradas: ${stats.duplicates}`;
        }

        alert(message);
        setPastedData(''); // Limpar dados após processar
        onClose();
      } else {
        alert('⚠️ Entrada manual disponível apenas para cartões de crédito (Nubank, VISA, MasterCard), Inter e BB');
      }
    } catch (error) {
      console.error('❌ Erro ao processar dados colados:', error);
      alert(`❌ Erro ao processar dados: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ NOVA FUNÇÃO: Confirmar importação das transações TON selecionadas
  const handleTonConfirm = async (selectedTransactions: Transaction[]) => {
    try {
      const result = await onTransactionsImported(selectedTransactions);

      let message = '';
      if (result?.success && result?.stats) {
        const { total = 0, added = 0, duplicates = 0 } = result.stats;

        message = `✅ Importação TON concluída!\n\n`;
        message += `📊 ${total} transações processadas\n`;
        message += `➕ ${added} novas transações adicionadas\n`;

        if (duplicates > 0) {
          message += `🔄 ${duplicates} duplicatas ignoradas\n`;
        }
      } else {
        message = `✅ ${selectedTransactions.length} transações importadas!`;
      }

      alert(message);
      setShowTonReview(false);
      setTonPendingTransactions([]);
      onClose();
    } catch (error) {
      console.error('Erro ao importar transações TON:', error);
      alert('❌ Erro ao importar transações TON. Tente novamente.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação específica para cartões de crédito
    const isCardTransaction = ['Nubank', 'VISA', 'MasterCard'].includes(selectedBank);
    if (isCardTransaction && !referenceMes) {
      alert('⚠️ Por favor, informe o mês de referência da fatura (formato AAMM, ex: 2412 para Dez/2024)');
      return;
    }

    setIsProcessing(true);

    try {
      const text = await file.text();
      const lines = text.split('\n');

      console.log(`=== IMPORTAÇÃO ${selectedBank.toUpperCase()} ===`);
      console.log('Total de linhas no arquivo:', lines.length);

      if (isCardTransaction) {
        // ===== PROCESSAR CARTÕES DE CRÉDITO =====
        if (!onCardTransactionsImported) {
          alert('⚠️ Função de importação de cartões não configurada');
          return;
        }

        const faturaId = `${selectedBank.toUpperCase()}_${referenceMes}`;

        const cardTransactions = await processCardTransactions(
          lines,
          selectedBank as 'Nubank' | 'VISA' | 'MasterCard',
          faturaId
        );

        if (cardTransactions.length === 0) {
          alert(`⚠️ Nenhuma transação encontrada no arquivo do ${selectedBank}`);
          return;
        }

        console.log(`🎯 Enviando ${cardTransactions.length} transações para SimpleDiff`);

        // ✅ SEMPRE ENVIAR PARA O SIMPLEDIFF (não importa se existe duplicata)
        const result = await onCardTransactionsImported(cardTransactions);

        // O SimpleDiff vai lidar com tudo agora
        console.log('✅ Arquivo processado, aguardando decisão do usuário no SimpleDiff');
        onClose();

      } else if (selectedBank === 'Inter') {
        // ===== PROCESSAR INTER =====
        const importedTransactions: Transaction[] = [];
        const usedIds = new Set<string>(); // ✅ Verificação local de IDs duplicados

        if (lines.length < 7) {
          alert('⚠️ Arquivo deve ter pelo menos 7 linhas (5 para pular + cabeçalho + dados)');
          return;
        }

        const sampleLine = lines[6] || lines[5] || '';
        const separator = sampleLine.includes(';') ? ';' : ',';

        for (let i = 6; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
              cols.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current.trim().replace(/^"|"$/g, ''));

          if (cols.length >= 3) {
            const data = cols[0].trim();
            const descricao_origem = cols[1].trim();
            const valorStr = cols[2].trim();

            if (!data || !descricao_origem ||
                data === 'Data' || descricao_origem === 'Descrição' ||
                !data.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              continue;
            }

            const valor = parseValorBR(valorStr);
            const saldoConta = cols[3]?.trim() || ''; // Coluna D - Saldo da conta

            const id = generateUniqueID('INT', data, descricao_origem, valor, saldoConta);

            // ✅ Verificar se já existe localmente no arquivo
            if (usedIds.has(id)) {
              console.warn(`⚠️ ID duplicado detectado localmente: ${id} para transação: ${descricao_origem}`);
              continue; // Pular duplicata local
            }
            usedIds.add(id);

            const mes = generateMonth(data);
            const dataFormatted = convertDateFormat(data);

            const transaction: Transaction = {
              id,
              mes,
              data: dataFormatted,
              descricao_origem,
              subtipo_id: '',
              descricao: descricao_origem,
              valor,
              origem: 'Inter',
              cc: 'Inter',
              realizado: 'p',
            };

            importedTransactions.push(transaction);
          }
        }

        if (importedTransactions.length === 0) {
          alert(`⚠️ Nenhuma transação válida encontrada no arquivo do ${selectedBank}`);
          return;
        }

        const result = await onTransactionsImported(importedTransactions);

        let message = '';
        if (result?.success && result?.stats) {
          const { total = 0, added = 0, duplicates = 0 } = result.stats;

          message = `✅ Importação ${selectedBank} concluída!\n\n`;
          message += `📊 ${total} transações processadas\n`;
          message += `➕ ${added} novas transações adicionadas\n`;

          if (duplicates > 0) {
            message += `🔄 ${duplicates} duplicatas ignoradas\n`;
          }
        } else {
          message = `✅ ${importedTransactions.length} transações processadas!`;
        }

        alert(message);
        onClose();

      } else if (selectedBank === 'BB') {
        // ===== PROCESSAR BB =====
        const importedTransactions: Transaction[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cols.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current.trim());

          if (cols.length >= 5) {
            const data = cols[0].replace(/^"|"$/g, '').trim();
            const lancamento = cols[1].replace(/^"|"$/g, '').trim();
            const detalhes = cols[2].replace(/^"|"$/g, '').trim();
            const valorStr = cols[4].replace(/^"|"$/g, '').trim();

            const descricao_origem = `${lancamento}${detalhes ? ' - ' + detalhes : ''}`.trim();

            const lancamentosIgnorados = [
              'SALDO ANTERIOR', 'S A L D O', 'SALDO', 'SALDO ATUAL', 'SALDO FINAL'
            ];

            const shouldIgnore = lancamentosIgnorados.some(termo =>
              lancamento.toUpperCase().includes(termo) ||
              descricao_origem.toUpperCase().includes(termo)
            );

            if (shouldIgnore || !data.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) || !descricao_origem || descricao_origem === ' - ') {
              continue;
            }

            const valor = parseBBValue(valorStr);
            const nroDocumento = cols[3]?.replace(/^"|"$/g, '').trim() || ''; // Coluna D - Nº documento

            const id = generateUniqueID('BB', data, descricao_origem, valor, nroDocumento);
            const mes = generateMonth(data);
            const dataFormatted = convertDateFormat(data);

            const transaction: Transaction = {
              id,
              mes,
              data: dataFormatted,
              descricao_origem,
              subtipo_id: '',
              descricao: descricao_origem,
              valor,
              origem: 'BB',
              cc: 'BB',
              realizado: 'p',
            };

            importedTransactions.push(transaction);
          }
        }

        if (importedTransactions.length === 0) {
          alert(`⚠️ Nenhuma transação válida encontrada no arquivo do ${selectedBank}`);
          return;
        }

        const result = await onTransactionsImported(importedTransactions);

        let message = '';
        if (result?.success && result?.stats) {
          const { total = 0, added = 0, duplicates = 0 } = result.stats;

          message = `✅ Importação ${selectedBank} concluída!\n\n`;
          message += `📊 ${total} transações processadas\n`;
          message += `➕ ${added} novas transações adicionadas\n`;

          if (duplicates > 0) {
            message += `🔄 ${duplicates} duplicatas ignoradas\n`;
          }
        } else {
          message = `✅ ${importedTransactions.length} transações processadas!`;
        }

        alert(message);
        onClose();

      } else if (selectedBank === 'TON') {
        // ===== PROCESSAR TON (EXCEL) =====
        const importedTransactions: Transaction[] = [];
        const usedIds = new Set<string>(); // ✅ Verificação local de IDs duplicados

        try {
          // Ler arquivo Excel
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Converter para JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          console.log('📊 TON Excel - Total de linhas:', jsonData.length);
          console.log('📊 TON Excel - Primeiras 3 linhas:', jsonData.slice(0, 3));
          console.log('📊 TON Excel - Últimas 3 linhas:', jsonData.slice(-3));

          // Processar cada linha (assumindo primeira linha é cabeçalho)
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];

            console.log(`🔍 TON Linha ${i}:`, row);

            if (!row || row.length < 6) {
              console.log(`❌ TON Linha ${i} - Rejeitada: row=${!!row}, length=${row?.length || 0}`);
              continue;
            }

            // Estrutura TON: [Data, Valor, Tipo, Status, Identificador, Descrição]
            const dataCell = row[0];     // Coluna 0: Data
            const valorCell = row[1];    // Coluna 1: Valor
            const descricaoCell = row[5]; // Coluna 5: Descrição

            if (!dataCell || !descricaoCell || valorCell === undefined) {
              console.log(`❌ TON Linha ${i} - Células obrigatórias vazias: data=${!!dataCell}, desc=${!!descricaoCell}, valor=${valorCell !== undefined}`);
              continue;
            }

            // Converter data TON (formato: "25-08-2025")
            let dataStr = String(dataCell).trim();

            // Converter de DD-MM-YYYY para DD/MM/YYYY
            if (dataStr.includes('-')) {
              const [day, month, year] = dataStr.split('-');
              dataStr = `${day}/${month}/${year}`;
            }

            const descricao_origem = String(descricaoCell).trim();
            const valor = typeof valorCell === 'number' ? valorCell : parseValorBR(String(valorCell));

            console.log(`🔍 TON Linha ${i} - Processando: data='${dataStr}', desc='${descricao_origem}', valor=${valor}`);

            // Validações básicas
            if (!dataStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) || !descricao_origem) {
              console.log(`❌ TON Linha ${i} - Validação falhou: dataRegex=${dataStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)}, hasDesc=${!!descricao_origem}`);
              continue;
            }

            // Gerar ID determinístico usando identificador único
            const identificador = row[4] ? String(row[4]).trim() : ''; // Coluna 4 - Identificador único
            const id = generateUniqueID('TON', dataStr, descricao_origem, valor, identificador);

            // ✅ Verificar duplicatas locais
            if (usedIds.has(id)) {
              console.warn(`⚠️ TON Linha ${i} - ID duplicado detectado localmente: ${id} para transação: ${descricao_origem}`);
              continue;
            }
            usedIds.add(id);

            const mes = generateMonth(dataStr);
            const dataFormatted = convertDateFormat(dataStr);

            const transaction: Transaction = {
              id,
              mes,
              data: dataFormatted,
              descricao_origem,
              subtipo_id: '', // ✅ NOVA ESTRUTURA: Vai para não classificadas
              descricao: descricao_origem,
              valor,
              origem: 'Stone', // ✅ No banco TON aparece como Stone
              cc: 'Stone', // ✅ No banco TON aparece como Stone
              realizado: 'p', // ✅ Provisionado (não realizado ainda)
            };

            console.log(`✅ TON Linha ${i} - Transação criada: ID=${id}, Data=${dataFormatted}, Valor=${valor}`);
            importedTransactions.push(transaction);
          }

        } catch (excelError) {
          console.error('Erro ao processar Excel TON:', excelError);
          throw new Error(`Erro ao ler arquivo Excel: ${(excelError as Error).message}`);
        }

        if (importedTransactions.length === 0) {
          alert(`⚠️ Nenhuma transação válida encontrada no arquivo Excel da TON`);
          return;
        }

        console.log(`🎯 TON - ${importedTransactions.length} transações processadas`);

        // ✅ ABRIR MODAL DE REVISÃO ao invés de importar direto
        setTonPendingTransactions(importedTransactions);
        setShowTonReview(true);
        setIsProcessing(false);
        return;
      }

    } catch (error) {
      console.error(`Error importing ${selectedBank} file:`, error);
      alert(`⚠️ Erro ao importar arquivo do ${selectedBank}: ` + (error as Error).message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  const isCardTransaction = ['Nubank', 'VISA', 'MasterCard'].includes(selectedBank);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              🏦 Importar Extrato/Fatura
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Selecione o Banco/Cartão:</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value as BankType)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                disabled={isProcessing}
              >
                <option value="Inter">🟠 Inter (Extrato)</option>
                <option value="BB">🟡 Banco do Brasil (Extrato)</option>
                <option value="TON">🟢 Ton (Extrato)</option>
                <option value="Nubank">🟣 Nubank (Fatura Cartão)</option>
                <option value="VISA">🔵 VISA (Fatura Cartão)</option>
                <option value="MasterCard">🔴 MasterCard (Fatura Cartão)</option>
              </select>
            </div>

            {isCardTransaction && (
              <>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Mês de Referência da Fatura *</label>
                  <input
                    type="text"
                    value={referenceMes}
                    onChange={(e) => setReferenceMes(e.target.value)}
                    placeholder="Ex: 2412 (Dez/2024)"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                    maxLength={4}
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-gray-500 mt-1">Formato AAMM: 2412 = dezembro/2024</p>
                </div>

                {/* ✅ NOVO: Seletor de método de entrada para cartões */}
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Método de Entrada:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMethod('file')}
                      disabled={isProcessing}
                      className={`flex-1 p-2 rounded-lg transition-colors ${
                        inputMethod === 'file'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      📁 Arquivo CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMethod('paste')}
                      disabled={isProcessing}
                      className={`flex-1 p-2 rounded-lg transition-colors ${
                        inputMethod === 'paste'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      📋 Colar Dados
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Informação importante sobre o novo fluxo */}
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
              <p className="text-blue-100 text-sm font-medium mb-1">🔄 Novo Fluxo de Importação</p>
              <p className="text-blue-200 text-xs">
                Todas as importações passarão por uma tela de revisão onde você pode
                selecionar exatamente quais transações deseja salvar na base de dados.
              </p>
            </div>

            {/* ✅ INTERFACE CONDICIONAL BASEADA NO MÉTODO */}
            {((!isCardTransaction && selectedBank !== 'Inter' && selectedBank !== 'BB') || inputMethod === 'file') && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
                    isProcessing
                      ? 'border-gray-600 bg-gray-800 cursor-not-allowed'
                      : 'border-blue-500 hover:border-blue-400 bg-blue-900/20'
                  }`}
                >
                  <div className="text-center">
                    {isProcessing ? (
                      <>
                        <div className="w-8 h-8 mx-auto mb-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-blue-100 font-medium">Processando...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                        <p className="text-blue-100 font-medium">
                          Selecionar Arquivo {selectedBank === 'TON' ? 'Excel' : 'CSV'}
                        </p>
                        <p className="text-blue-300 text-sm mt-1">
                          {isCardTransaction ? `Fatura do ${selectedBank}` : `Extrato do ${selectedBank}`}
                        </p>
                      </>
                    )}
                  </div>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={selectedBank === 'TON' ? '.xlsx,.xls' : '.csv'}
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing}
                />
              </>
            )}

            {/* ✅ NOVA INTERFACE: Colar dados para cartões e bancos */}
            {(isCardTransaction || selectedBank === 'Inter' || selectedBank === 'BB') && inputMethod === 'paste' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">
                    Cole as linhas das transações (sem cabeçalho):
                  </label>
                  <textarea
                    value={pastedData}
                    onChange={(e) => setPastedData(e.target.value)}
                    disabled={isProcessing}
                    placeholder={selectedBank === 'Inter'
                      ? `Exemplo formato Inter:\nData Lançamento;Histórico;Descrição;Valor;Saldo\n17/09/2025;Crédito domicílio cartão;Cartão De Crédito - Inter Pag;602,59;35.594,62\n16/09/2025;Pix enviado ;Regina Helena Carvalho Magalhaes;-113,74;34.430,88\n16/09/2025;Pix recebido;Luiz Roberto Bettoni;990,00;33.544,62`
                      : selectedBank === 'BB'
                      ? `Exemplo formato BB (com ou sem cabeçalho):\n"01/08/2025","Pix - Recebido","01/08 13:43 00036901705832 KELVIA ROSA","11343035112562","2.081,39","Entrada"\n"01/08/2025","Pix - Enviado","01/08 09:53 Pagaleve Instituicao De Pa","80102","-61,10","Saída"\n"01/08/2025","Pagamento de Boleto","COMPANHIA ENERGIA","80103","-125,40","Saída"`
                      : `Exemplo formato ${selectedBank}:\n05/12/2024,NETFLIX,29.90\n10/12/2024,SPOTIFY,19.90\n15/12/2024,ESTORNO UBER,-15.50`}
                    className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 font-mono text-sm resize-vertical"
                    rows={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedBank === 'Inter'
                      ? 'Formato: Data Lançamento;Histórico;Descrição;Valor;Saldo (uma transação por linha, com cabeçalho)'
                      : selectedBank === 'BB'
                      ? 'Formato: "data","lançamento","detalhes","nº doc","valor","tipo" (CSV com aspas, com ou sem cabeçalho, uma transação por linha)'
                      : 'Formato: data,descrição,valor (uma transação por linha, sem cabeçalho)'
                    }
                  </p>
                </div>

                <div className="flex gap-3">
                  {/* Botão Limpar Dados */}
                  <button
                    onClick={() => setPastedData('')}
                    disabled={isProcessing || !pastedData.trim()}
                    className={`px-4 py-3 rounded-lg transition-colors font-medium ${
                      isProcessing || !pastedData.trim()
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                    title="Limpar dados colados"
                  >
                    🗑️ Limpar
                  </button>

                  {/* Botão Processar */}
                  <button
                    onClick={handlePasteProcess}
                    disabled={isProcessing || !pastedData.trim()}
                    className={`flex-1 p-4 rounded-lg transition-colors font-medium ${
                      isProcessing || !pastedData.trim()
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processando...
                      </div>
                    ) : (
                      (() => {
                        const { count, total } = calculatePastedDataSummary();
                        return `🚀 Processar ${count} Transações | R$ ${formatCurrency(Math.abs(total))}`;
                      })()
                    )}
                  </button>
                </div>

                {/* ✅ NOVA SEÇÃO: Prévia do saldo do banco (só para bancos, não cartões) */}
                {!isCardTransaction && pastedData.trim() && (
                  (() => {
                    const { count, total } = calculatePastedDataSummary();
                    if (count === 0) return null;

                    const bankCode = getBankCode(selectedBank);
                    const saldoAtual = getSaldoAtualBanco(bankCode);
                    const saldoFinal = saldoAtual + total;

                    return (
                      <div className="mt-4 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                        <h4 className="text-blue-100 font-medium mb-3 flex items-center gap-2">
                          📊 Prévia do Saldo - {selectedBank}
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-200">Saldo Atual:</span>
                            <span className={`font-mono font-bold ${saldoAtual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {saldoAtual < 0 ? '-' : ''}R$ {formatCurrency(Math.abs(saldoAtual))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-blue-200">Lote a importar:</span>
                            <span className={`font-mono font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {total >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(total))}
                            </span>
                          </div>
                          <div className="border-t border-blue-600 pt-2 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-100 font-medium">Saldo Final:</span>
                              <span className={`font-mono font-bold text-lg ${saldoFinal >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                {saldoFinal < 0 ? '-' : ''}R$ {formatCurrency(Math.abs(saldoFinal))}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-blue-300 mt-2 opacity-75">
                            💡 Baseado em transações realizadas (s) + previstas (p)
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE REVISÃO TON */}
      {showTonReview && (
        <TonUploadReview
          isOpen={showTonReview}
          onClose={() => {
            setShowTonReview(false);
            setTonPendingTransactions([]);
          }}
          transactions={tonPendingTransactions}
          onConfirm={handleTonConfirm}
          currentBalance={getSaldoAtualBanco('Stone')}
        />
      )}
    </div>
  );
}

export default BankUpload;