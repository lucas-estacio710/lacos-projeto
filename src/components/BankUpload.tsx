// components/BankUpload.tsx - VERSÃO CORRIGIDA COM UUID

import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Transaction, BankType } from '@/types';
import { CardTransaction } from '@/hooks/useCardTransactions';
import { formatMonth } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface BankUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionsImported: (transactions: Transaction[]) => Promise<{ success: boolean; stats?: { total: number; added: number; duplicates: number } } | void>;
  onCardTransactionsImported?: (transactions: CardTransaction[]) => Promise<any>;
}

export function BankUpload({ 
  isOpen, 
  onClose, 
  onTransactionsImported,
  onCardTransactionsImported 
}: BankUploadProps) {
  const [selectedBank, setSelectedBank] = useState<BankType>('Inter');
  const [referenceMes, setReferenceMes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
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

  // Gerador de UUID v4 válido
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Gerador de ID único DETERMINÍSTICO (para outros bancos)
  const generateUniqueID = (banco: string, data: string, descricao: string, valor: number): string => {
    const dataFormatada = data.replace(/\D/g, '').slice(-6);
    const valorHash = Math.abs(Math.round(valor * 100)).toString(36).slice(-4);
    const descHash = simpleHash(descricao).slice(0, 4);
    
    return `${banco}${dataFormatada}${descHash}${valorHash}`;
  };

  // Converter formato de data brasileiro para ISO
  const convertDateFormat = (brDate: string): string => {
    if (!brDate || !brDate.includes('/')) return brDate;
    
    const [day, month, year] = brDate.split('/');
    if (!day || !month || !year) return brDate;
    
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

  // Gerar mês a partir da data
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validação específica para Nubank
    if (selectedBank === 'Nubank' && !referenceMes) {
      alert('❌ Por favor, informe o mês de referência da fatura (formato AAMM, ex: 2412 para Dez/2024)');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      console.log(`=== IMPORTAÇÃO ${selectedBank.toUpperCase()} ===`);
      console.log('Total de linhas no arquivo:', lines.length);
      
      if (selectedBank === 'Nubank') {
        // ===== PROCESSAR NUBANK (CARD_TRANSACTIONS) =====
        if (!onCardTransactionsImported) {
          alert('❌ Função de importação de cartões não configurada');
          return;
        }

        const cardTransactions: CardTransaction[] = [];
        const faturaId = `NUBANK_${referenceMes}`;
        let processedLines = 0;
        
        console.log('🔗 ID da Fatura:', faturaId);
        
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
            
            // Gerar fingerprint determinístico para detecção de duplicatas
            const fingerprint = generateUniqueID('NUB', dataCompra, titulo, valor);
            
            // Criar transação de cartão com UUID válido e fingerprint
            const cardTransaction: CardTransaction = {
              id: generateUUID(), // UUID válido para o Supabase
              fingerprint: fingerprint, // ID determinístico para deduplicação
              fatura_id: faturaId,
              data_transacao: dataCompra, // Já vem no formato ISO do Nubank
              descricao_origem: titulo,
              valor: -valor, // Negativo pois é gasto
              categoria: null,
              subtipo: null,
              descricao_classificada: null,
              status: 'pending',
              origem: 'Nubank',
              cc: 'Nubank'
            };
            
            cardTransactions.push(cardTransaction);
            
            console.log(`✅ Processada: ${titulo} | R$ ${valor}`);
          }
        }
        
        console.log('📊 Total de transações processadas:', cardTransactions.length);
        
        if (cardTransactions.length === 0) {
          alert('❌ Nenhuma transação válida encontrada no arquivo do Nubank');
          return;
        }
        
        // Chamar callback para importar
        const result = await onCardTransactionsImported(cardTransactions);
        
        // Se retornou matches, significa que detectou duplicata
        if (result?.matches && result.matches.length > 0) {
          console.log('⚠️ Fatura duplicada detectada, aguardando decisão do usuário...');
          // O componente pai vai lidar com o modal de matching
        } else if (result?.success) {
          // Importação normal concluída
          let message = `✅ Fatura Nubank importada!\n\n`;
          message += `📊 ${cardTransactions.length} transações processadas\n`;
          
          if (result?.stats) {
            message += `➕ ${result.stats.added} adicionadas\n`;
            if (result.stats.duplicates > 0) {
              message += `🔄 ${result.stats.duplicates} duplicatas ignoradas\n`;
            }
          }
          
          message += `\n🆔 Fatura: ${faturaId}`;
          message += `\n📅 Mês: ${formatMonth(referenceMes)}`;
          
          alert(message);
          onClose();
        } else {
          alert('❌ Erro ao importar fatura do Nubank');
        }
        
      } else if (selectedBank === 'Inter') {
        // ===== PROCESSAR INTER =====
        const importedTransactions: Transaction[] = [];
        
        if (lines.length < 7) {
          alert('❌ Arquivo deve ter pelo menos 7 linhas (5 para pular + cabeçalho + dados)');
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
            if (isNaN(valor)) continue;
            
            const id = generateUniqueID('INT', data, descricao_origem, valor);
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
              conta: ''
            };
            
            importedTransactions.push(transaction);
          }
        }
        
        if (importedTransactions.length === 0) {
          alert(`❌ Nenhuma transação válida encontrada no arquivo do ${selectedBank}`);
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
            if (isNaN(valor)) continue;
            
            const id = generateUniqueID('BB', data, descricao_origem, valor);
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
              conta: ''
            };
            
            importedTransactions.push(transaction);
          }
        }
        
        if (importedTransactions.length === 0) {
          alert(`❌ Nenhuma transação válida encontrada no arquivo do ${selectedBank}`);
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
        // Processar arquivo Excel da TON
        alert('Por favor, use arquivo Excel (.xlsx) para importar dados da TON');
      }
      
    } catch (error) {
      console.error(`Error importing ${selectedBank} file:`, error);
      alert(`❌ Erro ao importar arquivo do ${selectedBank}: ` + (error as Error).message);
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
                disabled={isProcessing}
              >
                <option value="Inter">🟠 Inter (Extrato)</option>
                <option value="BB">🟡 Banco do Brasil (Extrato)</option>
                <option value="Nubank">🟣 Nubank (Fatura Cartão)</option>
                <option value="TON">🟢 Ton (Extrato)</option>
              </select>
            </div>

            {selectedBank === 'Nubank' && (
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
            )}

            {/* Informações específicas por banco */}
            {selectedBank === 'Inter' && (
              <div className="bg-orange-900 p-3 rounded-lg border border-orange-700">
                <h4 className="font-medium text-orange-100 mb-2">📋 Formato Inter</h4>
                <ul className="text-sm text-orange-200 space-y-1">
                  <li>• Arquivo CSV do extrato</li>
                  <li>• 5 primeiras linhas ignoradas</li>
                  <li>• Colunas: Data, Descrição, Valor, Saldo</li>
                  <li>• Separador: ; (ponto e vírgula)</li>
                </ul>
              </div>
            )}

            {selectedBank === 'BB' && (
              <div className="bg-yellow-900 p-3 rounded-lg border border-yellow-700">
                <h4 className="font-medium text-yellow-100 mb-2">📋 Formato Banco do Brasil</h4>
                <ul className="text-sm text-yellow-200 space-y-1">
                  <li>• Arquivo CSV do extrato</li>
                  <li>• Colunas: Data, Lançamento, Detalhes, N° Doc, Valor</li>
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
                  <li>• ✅ Detecção de faturas duplicadas</li>
                  <li>• ✅ Sistema de matching inteligente</li>
                </ul>
              </div>
            )}
            
            {selectedBank === 'TON' && (
              <div className="bg-green-900 p-3 rounded-lg border border-green-700">
                <h4 className="font-medium text-green-100 mb-2">📋 Formato TON</h4>
                <ul className="text-sm text-green-200 space-y-1">
                  <li>• Arquivo Excel (.xlsx)</li>
                  <li>• Colunas: Data, Valor, Tipo, Status, ID, Descrição</li>
                  <li>• Data: DD-MM-YYYY</li>
                  <li>• Valor: R$ formato brasileiro</li>
                </ul>
              </div>
            )}
            
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
                      {selectedBank === 'Nubank' ? 'Fatura do Nubank' : `Extrato do ${selectedBank}`}
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
    </div>
  );
}

export default BankUpload;