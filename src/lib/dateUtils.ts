// utils/dateUtils.ts - VERSÃO CORRIGIDA COM DETECÇÃO AUTOMÁTICA DE FORMATO

/**
 * Detecta o formato de uma string de data
 * Prioriza formato brasileiro DD/MM/YYYY sobre americano MM/DD/YYYY
 */
export const detectDateFormat = (dateStr: string): 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'ISO' | 'UNKNOWN' => {
  if (!dateStr || typeof dateStr !== 'string') return 'UNKNOWN';
  
  const cleanStr = dateStr.trim();
  
  // Formato ISO completo (com T e timezone)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleanStr)) {
    return 'ISO';
  }
  
  // Formato YYYY-MM-DD simples
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return 'YYYY-MM-DD';
  }
  
  // Formatos DD/MM/YYYY ou MM/DD/YYYY
  const slashMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    
    // Se o primeiro número é > 12, definitivamente é DD/MM/YYYY
    if (firstNum > 12) {
      return 'DD/MM/YYYY';
    }
    
    // Se o segundo número é > 12, definitivamente é MM/DD/YYYY
    if (secondNum > 12) {
      return 'MM/DD/YYYY';
    }
    
    // Ambos <= 12: ambíguo, mas assumimos DD/MM/YYYY (padrão brasileiro)
    return 'DD/MM/YYYY';
  }
  
  return 'UNKNOWN';
};

/**
 * Converte string de data para formato YYYY-MM-DD
 * Detecta automaticamente o formato e prioriza padrão brasileiro
 */
export const parseToISODate = (dateStr: string): string | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const cleanStr = dateStr.trim();
  const format = detectDateFormat(cleanStr);
  
  
  try {
    switch (format) {
      case 'YYYY-MM-DD':
        // Já está no formato correto, apenas validar
        const [year, month, day] = cleanStr.split('-').map(n => parseInt(n, 10));
        if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return cleanStr;
        }
        return null;
        
      case 'ISO':
        // Extrair apenas a parte da data
        const dateOnly = cleanStr.split('T')[0];
        return parseToISODate(dateOnly); // Recursão para validar
        
      case 'DD/MM/YYYY':
        const slashMatchDD = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (slashMatchDD) {
          const [, dayStr, monthStr, yearStr] = slashMatchDD;
          const day_dd = parseInt(dayStr, 10);
          const month_dd = parseInt(monthStr, 10);
          const year_dd = parseInt(yearStr, 10);
          
          if (year_dd >= 1900 && month_dd >= 1 && month_dd <= 12 && day_dd >= 1 && day_dd <= 31) {
            return `${year_dd}-${month_dd.toString().padStart(2, '0')}-${day_dd.toString().padStart(2, '0')}`;
          }
        }
        return null;
        
      case 'MM/DD/YYYY':
        const slashMatchMM = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (slashMatchMM) {
          const [, monthStr, dayStr, yearStr] = slashMatchMM;
          const day_mm = parseInt(dayStr, 10);
          const month_mm = parseInt(monthStr, 10);
          const year_mm = parseInt(yearStr, 10);
          
          if (year_mm >= 1900 && month_mm >= 1 && month_mm <= 12 && day_mm >= 1 && day_mm <= 31) {
            return `${year_mm}-${month_mm.toString().padStart(2, '0')}-${day_mm.toString().padStart(2, '0')}`;
          }
        }
        return null;
        
      default:
        console.warn(`⚠️ Formato de data não reconhecido: "${cleanStr}"`);
        return null;
    }
  } catch (error) {
    console.error(`❌ Erro ao processar data "${cleanStr}":`, error);
    return null;
  }
};

/**
 * Função segura para converter data para formato YYYY-MM-DD
 * Evita problemas de timezone que causam diferença de 1 dia
 */
export const formatDateToLocal = (dateInput: string | Date): string => {
  try {
    
    if (!dateInput || dateInput === '' || dateInput === 'undefined') {
      console.warn('⚠️ Data inválida recebida:', dateInput);
      return 'Data inválida';
    }

    let date: Date;
    
    // Se é string, tentar converter usando nova função de parsing
    if (typeof dateInput === 'string') {
      // Se já está no formato YYYY-MM-DD, retorna direto
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        // ✅ Data já está no formato correto
        return dateInput;
      }
      
      // Tentar parsing inteligente primeiro
      const parsedDate = parseToISODate(dateInput);
      if (parsedDate) {
        return parsedDate;
      }
      
      // Fallback: tentar Date constructor
      if (dateInput.includes('T') || dateInput.includes(' ')) {
        date = new Date(dateInput);
      } else {
        // Para datas sem horário, criar Date sem timezone issues
        const parts = dateInput.split(/[-\/]/);
        if (parts.length === 3) {
          // Detectar formato e ajustar
          const format = detectDateFormat(dateInput);
          if (format === 'DD/MM/YYYY') {
            date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          } else {
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        } else {
          date = new Date(dateInput);
        }
      }
    } else {
      date = dateInput;
    }

    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }

    // 🔧 CORREÇÃO PRINCIPAL: Usar métodos locais em vez de UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const result = `${year}-${month}-${day}`;
    
    return result;
  } catch (error) {
    return 'Data inválida';
  }
};

/**
 * Função segura para formatar data para exibição (DD/MM/AAAA)
 */
export const formatDateForDisplay = (dateInput: string | Date): string => {
  try {
    const dateStr = formatDateToLocal(dateInput);
    
    if (dateStr === 'Data inválida') {
      return 'Data inválida';
    }
    
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch (error) {
    return 'Data inválida';
  }
};

/**
 * Função para verificar se duas datas são do mesmo dia
 */
export const isSameDay = (date1: string | Date, date2: string | Date): boolean => {
  try {
    const dateStr1 = formatDateToLocal(date1);
    const dateStr2 = formatDateToLocal(date2);
    
    const result = dateStr1 === dateStr2 && dateStr1 !== 'Data inválida';
    console.log('🔍 isSameDay:', { date1, date2, dateStr1, dateStr2, result });
    
    return result;
  } catch (error) {

    return false;
  }
};

/**
 * Função para extrair data de transação de forma segura
 * APRIMORADA: Melhor detecção de formatos
 */
export const extractTransactionDate = (transaction: any): string => {
  try {
    console.log('📅 extractTransactionDate input:', {
      id: transaction.id,
      data: transaction.data,
      data_transacao: transaction.data_transacao
    });
    
    let dateStr: string = '';
    
    // Priorizar data_transacao se existir (card transactions)
    if ('data_transacao' in transaction && transaction.data_transacao) {
      dateStr = transaction.data_transacao;
    }
    // Senão usar data comum
    else if (transaction.data) {
      dateStr = transaction.data;
    }
    
    if (!dateStr || dateStr === '' || dateStr === 'undefined') {
      return '';
    }
    
    const result = formatDateToLocal(dateStr);
    
    return result === 'Data inválida' ? '' : result;
  } catch (error) {
    return '';
  }
};

/**
 * Função para extrair data de entrada da planilha
 * APRIMORADA: Melhor detecção de formatos brasileiros
 */
export const extractSheetEntryDate = (entry: any): string => {
  try {
    console.log('📊 extractSheetEntryDate input:', {
      id: entry.id,
      dataHora: entry.dataHora,
      detected_format: entry.dataHora ? detectDateFormat(entry.dataHora) : 'N/A'
    });
    
    if (!entry.dataHora || entry.dataHora === '' || entry.dataHora === 'undefined') {
      return '';
    }
    
    // Primeiro, tentar detectar e converter usando parsing inteligente
    const parsedDate = parseToISODate(entry.dataHora);
    if (parsedDate) {
      return parsedDate;
    }
    
    // Fallback: usar função antiga
    const result = formatDateToLocal(entry.dataHora);
    console.log('✅ extractSheetEntryDate result (fallback):', result);
    
    return result === 'Data inválida' ? '' : result;
  } catch (error) {
    console.error('❌ Erro em extractSheetEntryDate:', error);
    return '';
  }
};

/**
 * Função para obter data atual no formato local
 */
export const getCurrentDateLocal = (): string => {
  const now = new Date();
  return formatDateToLocal(now);
};

/**
 * Função para debug de datas - APRIMORADA com detecção de formato
 */
export const debugDate = (label: string, dateInput: any): void => {
  console.group(`🔍 DEBUG DATE: ${label}`);
  console.log('Input:', dateInput);
  console.log('Type:', typeof dateInput);
  
  if (dateInput && typeof dateInput === 'string') {
    const detectedFormat = detectDateFormat(dateInput);
    console.log('🎯 Formato detectado:', detectedFormat);
    
    const parsedISO = parseToISODate(dateInput);
    console.log('📅 Parse inteligente:', parsedISO);
  }
  
  if (dateInput) {
    try {
      const asDate = new Date(dateInput);
      console.log('As Date object:', asDate);
      console.log('getTime():', asDate.getTime());
      console.log('toISOString():', asDate.toISOString());
      console.log('toLocaleDateString():', asDate.toLocaleDateString());
      console.log('formatDateToLocal():', formatDateToLocal(dateInput));
      console.log('formatDateForDisplay():', formatDateForDisplay(dateInput));
    } catch (error) {
      console.error('Erro ao processar:', error);
    }
  }
  
  console.groupEnd();
};

/**
 * Função específica para parsing de datas brasileiras da planilha
 * Assume formato DD/MM/YYYY quando ambíguo
 */
export const parseBrazilianDate = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  
  console.log('🇧🇷 parseBrazilianDate input:', dateStr);
  
  // Forçar interpretação como DD/MM/YYYY para dados da planilha
  const slashMatch = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, dayStr, monthStr, yearStr] = slashMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const result = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      console.log('✅ parseBrazilianDate result:', result);
      return result;
    }
  }
  
  // Fallback para outros formatos
  return formatDateToLocal(dateStr);
};

/**
 * Função de validação de data
 */
export const isValidDate = (dateStr: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  const parsed = parseToISODate(dateStr);
  return parsed !== null;
};

/**
 * Função para comparar datas (útil para ordenação)
 */
export const compareDates = (date1: string | Date, date2: string | Date): number => {
  const str1 = formatDateToLocal(date1);
  const str2 = formatDateToLocal(date2);
  
  if (str1 === 'Data inválida' || str2 === 'Data inválida') {
    return 0;
  }
  
  return str1.localeCompare(str2);
};