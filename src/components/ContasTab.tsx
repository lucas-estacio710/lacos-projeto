import React from 'react';
import { Transaction, countsInBalance } from '@/types';

interface ContasTabProps {
  transactions: Transaction[];
}

export function ContasTab({ transactions }: ContasTabProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // ✅ FUNÇÃO CORRIGIDA: Calcular saldo por banco excluindo reconciliados
  const getSaldoPorBanco = (banco: string) => {
    return transactions
      .filter(t => 
        t.cc === banco && 
        countsInBalance(t.realizado) // ✅ Só realizado = 's' conta no saldo
      )
      .reduce((sum, t) => sum + t.valor, 0);
  };

  // ✅ NOVA FUNÇÃO: Obter transações reconciliadas por banco
  const getReconciledByBanco = (banco: string) => {
    return transactions
      .filter(t => t.cc === banco && t.realizado === 'r')
      .reduce((sum, t) => sum + t.valor, 0);
  };

  // ✅ NOVA FUNÇÃO: Obter última transação por banco
  const getLastTransactionDate = (banco: string) => {
    const bankTransactions = transactions
      .filter(t => t.cc === banco)
      .sort((a, b) => b.data.localeCompare(a.data));
    
    return bankTransactions.length > 0 ? bankTransactions[0].data : null;
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  // Definir bancos e suas configurações
  const bancos = [
    {
      nome: 'Inter',
      codigo: 'Inter',
      icone: '🟠',
      cor: 'from-orange-500 to-orange-600',
      corTexto: 'text-orange-100'
    },
    {
      nome: 'Santander',
      codigo: 'Santander',
      icone: '🔴',
      cor: 'from-red-500 to-red-600',
      corTexto: 'text-red-100'
    },
    {
      nome: 'Banco do Brasil',
      codigo: 'BB',
      icone: '🟡',
      cor: 'from-yellow-500 to-yellow-600',
      corTexto: 'text-yellow-100'
    },
    {
      nome: 'Stone',
      codigo: 'Stone',
      icone: '🟢',
      cor: 'from-green-500 to-green-600',
      corTexto: 'text-green-100'
    },
    {
      nome: 'Invest. Inter',
      codigo: 'Investimento Inter',
      icone: '💰',
      cor: 'from-orange-300 to-orange-400',
      corTexto: 'text-orange-800'
    },
    {
      nome: 'Invest. Santander',
      codigo: 'Tesouro + RF Santander',
      icone: '💰',
      cor: 'from-red-300 to-red-400',
      corTexto: 'text-red-800'
    },
    {
      nome: 'Invest. Sttd Kel',
      codigo: 'Investimento Sttd Kel',
      icone: '💰',
      cor: 'from-red-700 to-red-800',
      corTexto: 'text-red-100'
    },
    {
      nome: 'Dinheiro',
      codigo: 'Dinheiro',
      icone: '💵',
      cor: 'from-gray-500 to-gray-600',
      corTexto: 'text-gray-100'
    }
  ];

  // Calcular saldos e dados
  const saldos = bancos.map(banco => {
    const saldo = getSaldoPorBanco(banco.codigo);
    const lastTransactionDate = getLastTransactionDate(banco.codigo);
    
    return {
      ...banco,
      saldo,
      lastTransactionDate
    };
  });

  // ✅ SALDO TOTAL CORRIGIDO: Só contar transações que impactam saldo
  const saldoTotal = saldos.reduce((sum, banco) => sum + banco.saldo, 0);

  return (
    <div className="space-y-4">
      {/* Patrimônio Total - Horizontal e Maior */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base sm:text-2xl font-bold truncate">Patrimônio Total</h3>
          </div>
          <div className="text-xl sm:text-4xl font-bold flex-shrink-0">
            {saldoTotal < 0 ? '-' : ''}R$ {formatCurrency(Math.abs(saldoTotal))}
          </div>
        </div>
      </div>

      {/* Saldos em Formato Horizontal */}
      <div className="space-y-3">
        {saldos.map((banco, index) => (
          <div
            key={banco.codigo}
            className={`bg-gradient-to-r ${banco.cor} p-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300`}
          >
            <div className="flex items-center justify-between">
              {/* Lado Esquerdo: Ícone + Nome */}
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {banco.icone}
                </div>
                <h3 className={`font-semibold ${banco.corTexto} text-sm`}>
                  {banco.nome}
                </h3>
              </div>
              
              {/* Lado Direito: Data + Saldo */}
              <div className="flex items-center gap-4 text-right">
                {/* Data */}
                <div className={`text-xs ${banco.corTexto} opacity-75`}>
                  {banco.lastTransactionDate ? (
                    <>{formatDate(banco.lastTransactionDate)}</>
                  ) : (
                    <>Sem movimentação</>
                  )}
                </div>
                
                {/* Saldo */}
                <div className={`${banco.corTexto} font-bold text-lg min-w-[100px]`}>
                  R$ {formatCurrency(Math.abs(banco.saldo))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}