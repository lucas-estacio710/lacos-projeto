import { Categories } from '@/types';

// Categorias PJ - ATUALIZADAS com seus dados reais
export const categoriesPJ: Categories = {
  'Receita Nova': {
    subtipos: ['REC. N. C. COL.','REC. N. C. IND.','REC. N. P. COL.','REC. N. P. IND.'],
    icon: '💵',
    color: 'green'
  },
  'Receita Antiga': {
    subtipos: ['REC. A. C. COL.','REC. A. C. IND.','REC. A. P. COL.','REC. A. P. IND.'],
    icon: '💵',
    color: 'green'
  },
  'Custos Operacionais': {
    subtipos: ['INDIVIDUAL', 'COLETIVA', 'URNAS', 'ACESSÓRIOS', 'IMPOSTO RIP', 'IMPOSTOS CMVE', 'CARRO RIP', 'MATERIAIS OPER', 'OUTROS ABSORVIDOS', 'FREELANCERS OPER', 'ALIMENTAÇÃO'],
    icon: '⚙️',
    color: 'red'
  },
  'Contas Fixas PJ': {
    subtipos: ['ALUGUEL RIP', 'CONTAS CONSUMO RIP', 'CONTADOR', 'SEGUROS RIP'],
    icon: '🏠',
    color: 'red'
  },
  'Marketing': {
    subtipos: ['FREELANCERS CMCL', 'GOOGLE', 'GRATIFICAÇÕES', 'MATERIAIS MKT'],
    icon: '📢',
    color: 'red'
  },
  'Estrutura': {
    subtipos: ['ESTRUTURA RIP'],
    icon: '🏢',
    color: 'red'
  }
};

// Categorias PF - ATUALIZADAS com seus dados reais
export const categoriesPF: Categories = {
  'Contas Fixas': {
    subtipos: ['MORADIA PESSOAL', 'CONTAS CONSUMO', 'ESCOLA OLI', 'DIARISTA', 'ASSINATURAS'],
    icon: '🏠',
    color: 'red'
  },
  'Contas Necessárias': {
    subtipos: ['SUPERMERCADOS', 'CARRO PESSOAL', 'FARMÁCIAS', 'SAÚDE', 'EXTRAS OLI'],
    icon: '🛒',
    color: 'red'
  },
  'Aquisições': {
    subtipos: ['AQUISIÇÕES PESSOAIS'],
    icon: '🛍️',
    color: 'red'
  },
  'Imprevistos': {
    subtipos: ['IMPREVISTOS'],
    icon: '⚠️',
    color: 'red'
  },
  'Contas Supérfluas': {
    subtipos: ['RESTAURANTES', 'ESTÉTICA PESSOAL', 'PRESENTES', 'OUTROS LAZER', 'EVENTOS', 'VIAGENS'],
    icon: '🎉',
    color: 'red'
  }
};

// Categorias CONC - ATUALIZADAS com seus dados reais
export const categoriesCONC: Categories = {
  'Entrecontas': {
    subtipos: ['ENTRECONTAS'],
    icon: '🔄',
    color: 'blue'
  },
  'Gastos Mamu': {
    subtipos: ['GASTO MAMU'],
    icon: '💸',
    color: 'red'
  },
  'Mov. Financeira Pessoal': {
    subtipos: ['MOV. FIN. PESSOAL'],
    icon: '👤',
    color: 'blue'
  },
  'Mov. Financeira PJ': {
    subtipos: ['MOV. FIN. PJ'],
    icon: '🏢',
    color: 'blue'
  },
  'Receita Legada PF': {
    subtipos: ['RECEITA LEGADA'],
    icon: '📜',
    color: 'green'
  },
  'Receitas Mamu': {
    subtipos: ['RECEITA MAMU'],
    icon: '💰',
    color: 'green'
  }
};

// Função helper para obter categorias por tipo de conta
export const getCategoriesForAccount = (account: string): Categories => {
  switch(account) {
    case 'PJ': return categoriesPJ;
    case 'PF': return categoriesPF;
    case 'CONC.': return categoriesCONC;
    default: return {};
  }
};

// Lista de todos os tipos de conta
export const accountTypes = ['PF', 'PJ', 'CONC.'] as const;

// Lista de todos os status de realização
export const realizadoTypes = ['s', 'p'] as const;