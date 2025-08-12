import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Transaction, BankType, FutureTransaction } from '@/types';
import { formatMonth } from '@/lib/utils';
import { generateSubscriptionFingerprint, generateReconciliationGroupId } from '@/lib/reconciliationService';
import * as XLSX from 'xlsx';

interface BankUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionsImported: (transactions: Transaction[]) => Promise<{ success: boolean; stats?: { total: number; added: number; duplicates: number } } | void>;
  onFutureTransactionsImported?: (futureTransactions: FutureTransaction[], referenceMes: string) => Promise<{ success: boolean; stats?: { total: number; added: number; duplicates: number } } | void>;
}

export function BankUpload({ isOpen, onClose, onTransactionsImported, onFutureTransactionsImported }: BankUploadProps) {
  const [selectedBank, setSelectedBank] = useState<BankType>('Inter');
  const [referenceMes, setReferenceMes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Gerador de ID único DETERMINÍSTICO
  const generateUniqueID = (banco: string, dataLancamento: string, descricao: string, valor: number, parcela: number = 1, aparicao: number = 1): string => {
    const dataFormatada = dataLancamento.replace(/-/g, '').slice(-6);
    const valorHash = Math.abs(Math.round(valor * 100)).toString(36).slice(-3);
    const descHash = simpleHash(descricao).slice(0, 4);
    const parcelaStr = parcela.toString().padStart(2, '0');
    const aparicaoStr = aparicao.toString().padStart(2, '0');
    
    return `${banco}${dataFormatada}${descHash}${valorHash}${parcelaStr}${aparicaoStr}`;
  };

  // Converter formato de data brasileiro para ISO
  const convertDateFormat = (brDate: string): string => {
    if (!brDate || !brDate.includes('/')) return brDate;
    
    const [day, month, year] = brDate.split('/');
    if (!day || !month || !year) return brDate;
    
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

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

  const generateID = (banco: string, data: string, descricao: string, valor: number): string => {
    const dateStr = data.replace(/\D/g, '');
    const descHash = simpleHash(descricao);
    const valorInt = Math.abs(Math.round(valor * 100));
    return `${banco}${dateStr}${descHash}${valorInt.toString().padStart(6, '0')}`;
  };

  const generateMonth = (dateStr: string): string => {
    const dateParts = dateStr.split('/');
    if (dateParts.length === 3) {
      const month = dateParts[1].padStart(2, '0');
      const year = dateParts[2];
      const yearShort = year.slice(-2);
      return `${yearShort}${month}`;
    }
    return '';
  };

  // Função para processar parcelas do Nubank
  const parseParcelaInfo = (titulo: string): { estabelecimento: string; parcelaAtual: number; parcelaTotal: number; temParcela: boolean } => {
    const parcelaRegex = /(.+?)\s*-\s*Parcela\s+(\d+)\/(\d+)$/i;
    const match = titulo.match(parcelaRegex);
    
    if (match) {
      return {
        estabelecimento: match[1].trim(),
        parcelaAtual: parseInt(match[2]),
        parcelaTotal: parseInt(match[3]),
        temParcela: true
      };
    }
    
    return {
      estabelecimento: titulo,
      parcelaAtual: 1,
      parcelaTotal: 1,
      temParcela: false
    };
  };

  // Função para adicionar meses a uma data no formato AAMM
  const addMonthsToMes = (mesBase: string, mesesAdicionar: number): string => {
    const ano = parseInt('20' + mesBase.substring(0, 2));
    const mes = parseInt(mesBase.substring(2, 4));
    
    console.log(`📅 Calculando: ${mesBase} + ${mesesAdicionar} meses | Ano: ${ano}, Mês: ${mes}`);
    
    const novaData = new Date(ano, mes - 1 + mesesAdicionar, 1);
    const novoAno = novaData.getFullYear().toString().slice(-2);
    const novoMes = (novaData.getMonth() + 1).toString().padStart(2, '0');
    
    const resultado = `${novoAno}${novoMes}`;
    console.log(`📅 Resultado: ${resultado} (${formatMonth(resultado)})`);
    
    return resultado;
  };

  // Função para gerar data de vencimento baseada no mês de referência
  const generateVencimentoDateFromOriginal = (dataOriginal: string, mesReferencia: string): string => {
    const [year, month, day] = dataOriginal.split('-');
    const ano = parseInt('20' + mesReferencia.substring(0, 2));
    const mes = parseInt(mesReferencia.substring(2, 4));
    return `${ano}-${mes.toString().padStart(2, '0')}-${day}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validação específica para Nubank
    if (selectedBank === 'Nubank' && !referenceMes) {
      alert('❌ Por favor, informe o mês de referência da fatura (formato AAMM, ex: 2507 para Jul/2025)');
      return;
    }
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      console.log(`=== IMPORTAÇÃO ${selectedBank.toUpperCase()} ===`);
      console.log('Total de linhas no arquivo:', lines.length);
      
      if (selectedBank === 'Nubank') {
        // ===== PROCESSAR NUBANK (FUTURES) =====
        const futureTransactions: FutureTransaction[] = [];
        const allParcelas: FutureTransaction[] = [];
        let processedLines = 0;
        
        // Gerar reconciliation_group para esta fatura
        const reconciliationGroup = generateReconciliationGroupId(selectedBank, referenceMes);
        console.log('🔗 Grupo de reconciliação:', reconciliationGroup);
        
        const transactionCounts = new Map<string, number>();
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          processedLines++;
          const cols = line.split(',');
          
          if (cols.length >= 3) {
            const dataCompra = cols[0].trim();
            const titulo = cols[1].trim();
            const valorStr = cols[2].trim();
            
            if (!dataCompra || !titulo || titulo === 'title') continue;
            
            const valor = parseFloat(valorStr) || 0;
            if (valor <= 0) continue;
            
            const parcelaInfo = parseParcelaInfo(titulo);
            
            const transactionKey = `${dataCompra}_${titulo}_${valor}`;
            const currentCount = (transactionCounts.get(transactionKey) || 0) + 1;
            transactionCounts.set(transactionKey, currentCount);
            
            const id = generateUniqueID('NUB', dataCompra, titulo, valor, parcelaInfo.parcelaAtual, currentCount);
            
            // Gerar subscription fingerprint
            const subscriptionFingerprint = generateSubscriptionFingerprint({
              id: id,
              descricao_origem: titulo,
              valor: -valor,
              mes: referenceMes,
              data: dataCompra,
              subtipo: '',
              categoria: '',
              descricao: titulo,
              origem: 'Nubank',
              cc: 'Nubank',
              realizado: 'p',
              conta: ''
            });
            
            console.log(`🔑 ID: ${id} | Fingerprint: ${subscriptionFingerprint}`);
            
            // Transação principal
            const futureTransaction: FutureTransaction = {
              id,
              mes_vencimento: referenceMes,
              data_vencimento: dataCompra,
              descricao_origem: titulo,
              categoria: '',
              subtipo: '',
              descricao: titulo,
              valor: -valor,
              origem: 'Nubank',
              cc: 'Nubank',
              parcela_atual: parcelaInfo.parcelaAtual,
              parcela_total: parcelaInfo.parcelaTotal,
              estabelecimento: parcelaInfo.estabelecimento,
              status: 'projected',
              // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
              subscription_fingerprint: subscriptionFingerprint,
              reconciliation_group: reconciliationGroup,
              is_reconciled: false,
              valor_original: -valor
            };
            
            futureTransactions.push(futureTransaction);
            
            // Gerar parcelas futuras se necessário
            if (parcelaInfo.temParcela && parcelaInfo.parcelaTotal > 1) {
              console.log(`🔄 Gerando parcelas para: ${parcelaInfo.estabelecimento} (${parcelaInfo.parcelaAtual}/${parcelaInfo.parcelaTotal})`);
              
              for (let parcela = parcelaInfo.parcelaAtual + 1; parcela <= parcelaInfo.parcelaTotal; parcela++) {
                const mesVencimentoParcela = addMonthsToMes(referenceMes, parcela - parcelaInfo.parcelaAtual);
                const parcelaDescricao = parcelaInfo.estabelecimento;
                const parcelaId = generateUniqueID('NUB', dataCompra, parcelaDescricao, valor, parcela, currentCount);
                const dataVencimentoParcela = generateVencimentoDateFromOriginal(dataCompra, mesVencimentoParcela);
                
                const parcelaTransaction: FutureTransaction = {
                  id: parcelaId,
                  original_transaction_id: id,
                  mes_vencimento: mesVencimentoParcela,
                  data_vencimento: dataVencimentoParcela,
                  descricao_origem: `${parcelaInfo.estabelecimento} - Parcela ${parcela}/${parcelaInfo.parcelaTotal}`,
                  categoria: '',
                  subtipo: '',
                  descricao: parcelaInfo.estabelecimento,
                  valor: -valor,
                  origem: 'Nubank',
                  cc: 'Nubank',
                  parcela_atual: parcela,
                  parcela_total: parcelaInfo.parcelaTotal,
                  estabelecimento: parcelaInfo.estabelecimento,
                  status: 'projected',
                  // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
                  subscription_fingerprint: subscriptionFingerprint,
                  original_future_id: id,
                  reconciliation_group: generateReconciliationGroupId(selectedBank, mesVencimentoParcela),
                  is_reconciled: false,
                  valor_original: -valor
                };
                
                allParcelas.push(parcelaTransaction);
              }
            }
          }
        }
        
        console.log('Total de transações da fatura:', futureTransactions.length);
        console.log('Total de parcelas futuras geradas:', allParcelas.length);
        
        if (futureTransactions.length === 0) {
          alert('❌ Nenhuma transação válida encontrada no arquivo do Nubank');
          return;
        }
        
        const todasTransacoes = [...futureTransactions, ...allParcelas];
        
        try {
          const result = await onFutureTransactionsImported?.(todasTransacoes, referenceMes);
          
          let message = '';
          if (result?.success && result?.stats) {
            const { total = 0, added = 0, duplicates = 0 } = result.stats;
            
            message = `✅ Fatura Nubank importada!\n\n`;
            message += `📊 ${futureTransactions.length} transações da fatura\n`;
            message += `🔄 ${allParcelas.length} parcelas futuras geradas\n`;
            message += `➕ ${added} novas transações adicionadas\n`;
            
            if (duplicates > 0) {
              message += `🔄 ${duplicates} duplicatas ignoradas\n`;
            }
            
            message += `\n🔗 Grupo: ${reconciliationGroup}`;
            message += `\n📅 Mês: ${referenceMes}`;
            message += `\n📁 ${processedLines} linhas processadas`;
          } else {
            message = `✅ ${futureTransactions.length} transações processadas!`;
          }
          
          alert(message);
          onClose();
        } catch (error) {
          console.error('Erro ao processar transações futuras:', error);
          alert('❌ Erro ao processar fatura. Verifique o console para mais detalhes.');
        }
        
        return;
      }
      
      // ===== PROCESSAR BANCOS (TRANSACTIONS) =====
      const importedTransactions: Transaction[] = [];
      let processedLines = 0;
      
      if (selectedBank === 'TON') {
        // Processar arquivo Excel da TON
        try {
          const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          console.log(`=== IMPORTAÇÃO TON ===`);
          console.log('Total de linhas no arquivo:', data.length);
          
          for (let i = 1; i < data.length; i++) {
            const row = data[i] as any[];
            if (!row || row.length < 6) continue;
            
            processedLines++;
            
            const dataStr = (row as any[])[0] as string;
            const valorStr = (row as any[])[1] as string;
            const tipoStr = (row as any[])[2] as string;
            const identificador = (row as any[])[4] as string;
            const descricao = (row as any[])[5] as string;
            
            if (!dataStr || !valorStr || !descricao) continue;
            
            const [day, month, year] = dataStr.split('-');
            const dataBR = `${day}/${month}/${year}`;
            
            const valor = parseValorBR(valorStr);
            if (isNaN(valor)) continue;
            
            const id = generateID('TON', dataBR, descricao, valor);
            const mes = generateMonth(dataBR);
            const dataFormatted = convertDateFormat(dataBR);
            
            const transaction: Transaction = {
              id,
              mes,
              data: dataFormatted,
              descricao_origem: descricao,
              subtipo: '',
              categoria: '',
              descricao: descricao,
              valor,
              origem: 'TON',
              cc: 'TON',
              realizado: 'p',
              conta: '',
              // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
              linked_future_group: undefined,
              is_from_reconciliation: false,
              future_subscription_id: undefined,
              reconciliation_metadata: undefined
            };
            
            importedTransactions.push(transaction);
          }
        } catch (tonError) {
          console.error('Erro ao processar TON:', tonError);
          alert('❌ Erro ao processar arquivo da TON. Verifique se é um arquivo Excel válido.');
          return;
        }
      } 
      else if (selectedBank === 'Inter') {
        // Processar arquivo do Inter
        if (lines.length < 7) {
          alert('❌ Arquivo deve ter pelo menos 7 linhas (5 para pular + cabeçalho + dados)');
          return;
        }
        
        const sampleLine = lines[6] || lines[5] || '';
        const separator = sampleLine.includes(';') ? ';' : ',';
        
        for (let i = 6; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          processedLines++;
          
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
            if (isNaN(valor)) continue;
            
            const id = generateID('INT', data, descricao_origem, valor);
            const mes = generateMonth(data);
            const dataFormatted = convertDateFormat(data);
            
            const transaction: Transaction = {
              id,
              mes,
              data: dataFormatted,
              descricao_origem,
              subtipo: '',
              categoria: '',
              descricao: descricao_origem,
              valor,
              origem: 'Inter',
              cc: 'Inter',
              realizado: 'p',
              conta: '',
              // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
              linked_future_group: undefined,
              is_from_reconciliation: false,
              future_subscription_id: undefined,
              reconciliation_metadata: undefined
            };
            
            importedTransactions.push(transaction);
          }
        }
      } 
      else if (selectedBank === 'BB') {
        // Processar arquivo do Banco do Brasil
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          processedLines++;
          
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
            if (isNaN(valor)) continue;
            
            const id = generateID('BB', data, descricao_origem, valor);
            const mes = generateMonth(data);
            const dataFormatted = convertDateFormat(data);
            
            const transaction: Transaction = {
              id,
              mes,
              data: dataFormatted,
              descricao_origem,
              subtipo: '',
              categoria: '',
              descricao: descricao_origem,
              valor,
              origem: 'BB',
              cc: 'BB',
              realizado: 'p',
              conta: '',
              // ===== NOVOS CAMPOS PARA RECONCILIAÇÃO =====
              linked_future_group: undefined,
              is_from_reconciliation: false,
              future_subscription_id: undefined,
              reconciliation_metadata: undefined
            };
            
            importedTransactions.push(transaction);
          }
        }
      }

      console.log('Total de linhas processadas:', processedLines);
      console.log('Total de transações importadas:', importedTransactions.length);

      if (importedTransactions.length === 0) {
        alert(`❌ Nenhuma transação válida encontrada no arquivo do ${selectedBank}`);
        return;
      }

      try {
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
          
          message += `\n📁 ${processedLines} linhas lidas do arquivo`;
          message += `\n🔗 Pronto para reconciliação!`;
        } else {
          message = `✅ ${importedTransactions.length} transações processadas!`;
        }
        
        alert(message);
        onClose();
      } catch (error) {
        console.error('Erro ao processar transações:', error);
        alert('❌ Erro ao processar transações. Verifique o console para mais detalhes.');
      }
      
    } catch (error) {
      console.error(`Error importing ${selectedBank} file:`, error);
      alert(`❌ Erro ao importar arquivo do ${selectedBank}: ` + (error as Error).message);
    }
  };

  if (!isOpen) return null;

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
              >
                <option value="Inter">🟠Inter</option>
                <option value="BB">🟡Banco do Brasil</option>
                <option value="Nubank">🟣Nubank (Fatura)</option>
                <option value="TON">🟢Ton</option>
              </select>
            </div>

            {selectedBank === 'Nubank' && (
              <div>
                <label className="text-sm text-gray-400 block mb-2">Mês de Referência da Fatura *</label>
                <input
                  type="text"
                  value={referenceMes}
                  onChange={(e) => setReferenceMes(e.target.value)}
                  placeholder="Ex: 2507 (Jul/2025)"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  maxLength={4}
                />
                <p className="text-xs text-gray-500 mt-1">Formato AAMM: 2507 = julho/2025</p>
              </div>
            )}

            {/* Informações específicas por banco */}
            {selectedBank === 'Inter' && (
              <div className="bg-orange-900 p-3 rounded-lg border border-orange-700">
                <h4 className="font-medium text-orange-100 mb-2">📋 Formato Inter</h4>
                <ul className="text-sm text-orange-200 space-y-1">
                  <li>• 5 primeiras linhas ignoradas</li>
                  <li>• 6ª linha: cabeçalhos</li>
                  <li>• Colunas: Data, Descrição, Valor, Saldo</li>
                  <li>• Separador: ; (ponto e vírgula)</li>
                </ul>
              </div>
            )}

            {selectedBank === 'BB' && (
              <div className="bg-yellow-900 p-3 rounded-lg border border-yellow-700">
                <h4 className="font-medium text-yellow-100 mb-2">📋 Formato Banco do Brasil</h4>
                <ul className="text-sm text-yellow-200 space-y-1">
                  <li>• 1ª linha: cabeçalho</li>
                  <li>• Colunas: Data, Lançamento, Detalhes, N° Doc, Valor, Tipo</li>
                  <li>• Separador: , (vírgula)</li>
                  <li>• Conteúdo entre aspas</li>
                </ul>
              </div>
            )}

            {selectedBank === 'Nubank' && (
              <div className="bg-purple-900 p-3 rounded-lg border border-purple-700">
                <h4 className="font-medium text-purple-100 mb-2">📋 Formato Nubank</h4>
                <ul className="text-sm text-purple-200 space-y-1">
                  <li>• CSV da fatura em aberto</li>
                  <li>• Colunas: date, title, amount</li>
                  <li>• Detecta parcelas automaticamente</li>
                  <li>• Gera parcelas futuras quando aplicável</li>
                  <li>• Cria grupo de reconciliação automaticamente</li>
                </ul>
              </div>
            )}
            
            {selectedBank === 'TON' && (
              <div className="bg-green-900 p-3 rounded-lg border border-green-700">
                <h4 className="font-medium text-green-100 mb-2">📋 Formato TON</h4>
                <ul className="text-sm text-green-200 space-y-1">
                  <li>• Arquivo Excel (.xlsx)</li>
                  <li>• Colunas: Data, Valor, Tipo, Status, Identificador, Descrição</li>
                  <li>• Data: DD-MM-YYYY</li>
                  <li>• Valor: R$ formato brasileiro</li>
                </ul>
              </div>
            )}

            {/* Sistema de Reconciliação */}
            <div className="bg-blue-900 p-3 rounded-lg border border-blue-700">
              <h4 className="font-medium text-blue-100 mb-2">🔒 Sistema de Reconciliação</h4>
              <ul className="text-sm text-blue-200 space-y-1">
                <li>• ✅ IDs únicos com hash da descrição</li>
                <li>• ✅ Evita duplicatas automaticamente</li>
                <li>• ✅ Extratos sobrepostos são mesclados</li>
                <li>• ✅ Grupos de reconciliação automáticos</li>
                <li>• ✅ Subscription fingerprints para assinaturas</li>
                {selectedBank === 'Nubank' && (
                  <li>• ✅ Gera parcelas futuras automaticamente</li>
                )}
              </ul>
            </div>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-blue-500 rounded-lg hover:border-blue-400 transition-colors bg-blue-900/20"
            >
              <div className="text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                <p className="text-blue-100 font-medium">
                  Selecionar Arquivo {selectedBank === 'TON' ? 'Excel' : 'CSV'}
                </p>
                <p className="text-blue-300 text-sm mt-1">
                  {selectedBank === 'Nubank' ? 'Fatura do Nubank' : `Extrato do ${selectedBank}`}
                </p>
              </div>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept={selectedBank === 'TON' ? '.xlsx,.xls' : '.csv'}
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BankUpload;