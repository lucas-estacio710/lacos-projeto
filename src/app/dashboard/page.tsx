'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Transaction } from '@/types';
import BankUpload from '@/components/BankUpload';
import { useTransactions } from '@/hooks/useTransactions';
import { OverviewTab } from '@/components/OverviewTab';
import { AnalyticsTab } from '@/components/AnalyticsTab';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { ContasTab } from '@/components/ContasTab';

// Dados de exemplo para demonstração
const sampleData: Transaction[] = [
  {
    id: 'TRX001',
    mes: '2507',
    data: '01/07/2025',
    descricao_origem: 'Recebimento Cliente A',
    subtipo: 'P_INDIVIDUAL',
    categoria: 'Receita de Planos',
    descricao: 'Pagamento plano individual',
    valor: 2500.00,
    origem: 'PIX',
    cc: 'CC001',
    realizado: 's',
    conta: 'PJ'
  },
  {
    id: 'TRX002',
    mes: '2507',
    data: '02/07/2025',
    descricao_origem: 'Aluguel Escritório',
    subtipo: 'ALUGUEL RIP',
    categoria: 'Contas Fixas PJ',
    descricao: 'Aluguel mensal escritório',
    valor: -1200.00,
    origem: 'Boleto',
    cc: 'CC002',
    realizado: 's',
    conta: 'PJ'
  },
  {
    id: 'TRX003',
    mes: '2507',
    data: '03/07/2025',
    descricao_origem: 'Supermercado XYZ',
    subtipo: 'SUPERMERCADOS',
    categoria: 'Contas Necessárias',
    descricao: 'Compras mensais',
    valor: -450.00,
    origem: 'Cartão',
    cc: 'CC003',
    realizado: 's',
    conta: 'PF'
  },
  {
    id: 'TRX004',
    mes: '2507',
    data: '04/07/2025',
    descricao_origem: 'Transferência Interna',
    subtipo: 'ENTRECONTAS',
    categoria: 'Entrecontas',
    descricao: 'Transferência entre contas',
    valor: 500.00,
    origem: 'Transferência',
    cc: 'CC004',
    realizado: 's',
    conta: 'CONC'
  },
  {
    id: 'TRX005',
    mes: '2507',
    data: '05/07/2025',
    descricao_origem: 'Transação pendente',
    subtipo: '',
    categoria: '',
    descricao: '',
    valor: -300.00,
    origem: 'Débito',
    cc: 'CC005',
    realizado: 'p',
    conta: ''
  }
];

export default function DashboardPage() {
  const { transactions, addTransactions, updateTransaction } = useTransactions();
  const [activeTab, setActiveTab] = useState('todos');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showBankUpload, setShowBankUpload] = useState(false);

  const loadSampleData = () => {
    addTransactions(sampleData);
    alert(`✅ ${sampleData.length} transações de exemplo carregadas!`);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleSaveTransaction = (updatedTransaction: Transaction) => {
    updateTransaction(updatedTransaction);
    setEditingTransaction(null);
  };

  const handleTransactionsImported = async (importedTransactions: Transaction[]) => {
    try {
      const result = await addTransactions(importedTransactions);
      return result; // Retorna as estatísticas para o BankUpload
    } catch (error) {
      console.error('Erro ao importar transações:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg mb-4 shadow-lg relative">
          <h1 className="text-xl font-bold text-center" style={{ fontFamily: 'monospace, Courier New' }}>
            LAÇOS 2.0 - AI Version
          </h1>
          <button
            onClick={() => setShowBankUpload(true)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            title="Importar dados bancários"
          >
            <span className="text-2xl leading-none mb-1">+</span>
          </button>
        </div>

        {/* Área de importação inicial */}
        {transactions.length === 0 && (
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 mb-4">
            <h3 className="font-semibold mb-3 text-gray-100">📊 Importar Dados</h3>
            <button
              onClick={() => setShowBankUpload(true)}
              className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors mb-3"
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-400">Importar Extrato Bancário</p>
            </button>
            <button
              onClick={loadSampleData}
              className="w-full p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              📋 Carregar Dados de Exemplo
            </button>
          </div>
        )}

        {/* Navegação e conteúdo principal */}
        {transactions.length > 0 && (
          <>
            {/* Tabs de navegação */}
            <div className="space-y-2">
              <div className="flex mb-2 bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-700">
                <button
                  onClick={() => setActiveTab('todos')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'todos' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📊 Visão Geral
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'analytics' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📈 Análise
                </button>
                <button
                  onClick={() => setActiveTab('contas')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'contas' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  🏦 Contas
                </button>
              </div>
              
              <div className="flex mb-4 bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-700">
                <button
                  onClick={() => setActiveTab('cartoes')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'cartoes' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  💳 Cartões
                </button>
                <button
                  onClick={() => setActiveTab('receitas')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'receitas' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📅 Receitas
                </button>
                <button
                  onClick={() => setActiveTab('investimentos')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                    activeTab === 'investimentos' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📊 Invest.
                </button>
              </div>
            </div>

            {/* Conteúdo das abas */}
            {activeTab === 'todos' && (
              <OverviewTab 
                transactions={transactions} 
                onEditTransaction={handleEditTransaction}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab transactions={transactions} />
            )}

            {activeTab === 'contas' && (
              <ContasTab transactions={transactions} />
            )}

            {['cartoes', 'receitas', 'investimentos'].includes(activeTab) && (
              <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-xl font-semibold text-gray-100 mb-2">Em Construção</h3>
                <p className="text-gray-400">Esta funcionalidade estará disponível em breve!</p>
              </div>
            )}

            {/* Botão para importar novo arquivo */}
            <div className="mt-4">
              <button
                onClick={() => setShowBankUpload(true)}
                className="w-full p-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
              >
                🔄 Importar Novo Arquivo
              </button>
            </div>
          </>
        )}

        {/* Modal de upload bancário */}
        <BankUpload
          isOpen={showBankUpload}
          onClose={() => setShowBankUpload(false)}
          onTransactionsImported={handleTransactionsImported}
        />

        {/* Modal de edição */}
        <EditTransactionModal
          transaction={editingTransaction}
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleSaveTransaction}
        />
      </div>
    </div>
  );
}