// contexts/ConfigContext.tsx - Contexto limpo sem categorias legadas

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Tipos para contas personalizadas
interface CustomAccount {
  id: string;
  name: string;
  icon: string;
  description?: string;
  created_at: string;
}

interface ConfigContextType {
  // Origens
  origins: string[];
  updateOrigins: (newOrigins: string[]) => void;
  
  // Bancos/CC
  banks: string[];
  updateBanks: (newBanks: string[]) => void;
  
  // Contas personalizadas
  customAccounts: CustomAccount[];
  addCustomAccount: (account: Omit<CustomAccount, 'id' | 'created_at'>) => void;
  updateCustomAccount: (id: string, updates: Partial<CustomAccount>) => void;
  deleteCustomAccount: (id: string) => void;
  
  // Tipos de conta disponíveis
  getAllAccountTypes: () => string[];
  
  // Utilitários
  resetToDefaults: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// Valores padrão com origens históricas
const DEFAULT_ORIGINS = [
  'Inter', 'BB', 'Santander', 'Stone', 'Nubank', 
  'VISA', 'MasterCard', 'TON',
  'Investimento Inter', 'Investimento Keka', 'Dinheiro'
];

const DEFAULT_BANKS = [
  'Inter', 'BB', 'Santander', 'Stone', 'Nubank', 
  'VISA', 'MasterCard', 'TON',
  'Investimento Inter', 'Investimento Keka', 'Dinheiro'
];

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [origins, setOrigins] = useState<string[]>(DEFAULT_ORIGINS);
  const [banks, setBanks] = useState<string[]>(DEFAULT_BANKS);
  const [customAccounts, setCustomAccounts] = useState<CustomAccount[]>([]);

  // Carregar dados salvos no localStorage na inicialização
  useEffect(() => {
    const savedOrigins = localStorage.getItem('financial-config-origins');
    const savedBanks = localStorage.getItem('financial-config-banks');
    const savedCustomAccounts = localStorage.getItem('financial-config-custom-accounts');

    if (savedOrigins) {
      try {
        setOrigins(JSON.parse(savedOrigins));
      } catch (e) {
        console.warn('Erro ao carregar origens salvas:', e);
      }
    }

    if (savedBanks) {
      try {
        setBanks(JSON.parse(savedBanks));
      } catch (e) {
        console.warn('Erro ao carregar bancos salvos:', e);
      }
    }

    if (savedCustomAccounts) {
      try {
        setCustomAccounts(JSON.parse(savedCustomAccounts));
      } catch (e) {
        console.warn('Erro ao carregar contas personalizadas:', e);
      }
    }
  }, []);

  // Salvar automaticamente quando dados mudarem
  useEffect(() => {
    localStorage.setItem('financial-config-origins', JSON.stringify(origins));
  }, [origins]);

  useEffect(() => {
    localStorage.setItem('financial-config-banks', JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem('financial-config-custom-accounts', JSON.stringify(customAccounts));
  }, [customAccounts]);

  const updateOrigins = (newOrigins: string[]) => {
    setOrigins(newOrigins);
  };

  const updateBanks = (newBanks: string[]) => {
    setBanks(newBanks);
  };

  const addCustomAccount = (account: Omit<CustomAccount, 'id' | 'created_at'>) => {
    const newAccount: CustomAccount = {
      ...account,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
    };
    setCustomAccounts(prev => [...prev, newAccount]);
  };

  const updateCustomAccount = (id: string, updates: Partial<CustomAccount>) => {
    setCustomAccounts(prev =>
      prev.map(account =>
        account.id === id ? { ...account, ...updates } : account
      )
    );
  };

  const deleteCustomAccount = (id: string) => {
    setCustomAccounts(prev => prev.filter(account => account.id !== id));
  };

  const getAllAccountTypes = (): string[] => {
    // TODO: Migrar para usar hierarquia dinâmica das contas
    const customTypes = customAccounts.map(acc => acc.id);
    return [...customTypes];
  };

  const resetToDefaults = () => {
    setOrigins(DEFAULT_ORIGINS);
    setBanks(DEFAULT_BANKS);
    setCustomAccounts([]);
  };

  const contextValue: ConfigContextType = {
    origins,
    updateOrigins,
    banks,
    updateBanks,
    customAccounts,
    addCustomAccount,
    updateCustomAccount,
    deleteCustomAccount,
    getAllAccountTypes,
    resetToDefaults
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

// Hook para usar o contexto
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig deve ser usado dentro de um ConfigProvider');
  }
  return context;
};

// Hook para obter apenas origens
export const useOrigins = () => {
  const { origins, updateOrigins } = useConfig();
  return { origins, updateOrigins };
};

// Hook para obter apenas bancos
export const useBanks = () => {
  const { banks, updateBanks } = useConfig();
  return { banks, updateBanks };
};