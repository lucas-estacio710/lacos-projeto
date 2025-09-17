import React, { useState } from 'react';
import { Transaction, countsInBalance } from '@/types';
import { formatDateForDisplay } from '@/lib/dateUtils';

interface ContasTabProps {
  transactions: Transaction[];
}

export function ContasTab({ transactions }: ContasTabProps) {
  const [expandedBanco, setExpandedBanco] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // ✅ FUNÇÃO NOVA: Calcular saldo por banco incluindo previstas (s + p)
  const getSaldoCompletoPorBanco = (banco: string) => {
    return transactions
      .filter(t => 
        t.cc === banco && 
        (t.realizado === 's' || t.realizado === 'p') // s + p
      )
      .reduce((sum, t) => sum + t.valor, 0);
  };

  // ✅ FUNÇÃO ADICIONAL: Calcular saldo apenas com realizado = 's'
  const getSaldoRealizadoPorBanco = (banco: string) => {
    return transactions
      .filter(t => 
        t.cc === banco && 
        t.realizado === 's' // ✅ Só realizado = 's'
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

  // ✅ NOVA FUNÇÃO: Obter transações do último dia registrado para um banco
  const getLastDayTransactions = (banco: string) => {
    const lastDate = getLastTransactionDate(banco);
    if (!lastDate) return [];

    return transactions
      .filter(t => t.cc === banco && t.data === lastDate)
      .sort((a, b) => b.data.localeCompare(a.data));
  };

  // ✅ FUNÇÃO: Toggle expansão do banco
  const toggleBancoExpansion = (bancoCodigo: string) => {
    setExpandedBanco(expandedBanco === bancoCodigo ? null : bancoCodigo);
  };

  // Usar função centralizada para formatação de data
  const formatDate = (dateString: string) => {
    return formatDateForDisplay(dateString);
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
    const saldo = getSaldoCompletoPorBanco(banco.codigo); // s + p
    const saldoRealizado = getSaldoRealizadoPorBanco(banco.codigo); // só s
    const lastTransactionDate = getLastTransactionDate(banco.codigo);
    
    return {
      ...banco,
      saldo,
      saldoRealizado,
      lastTransactionDate
    };
  });

  // ✅ SALDO TOTAL CORRIGIDO: Só contar transações que impactam saldo
  const saldoTotal = saldos.reduce((sum, banco) => sum + banco.saldo, 0); // s + p
  const saldoTotalRealizado = saldos.reduce((sum, banco) => sum + banco.saldoRealizado, 0); // só s

  return (
    <div className="space-y-4">
      {/* Patrimônio Total - Horizontal e Maior */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base sm:text-2xl font-bold truncate">Patrimônio Total</h3>
            <p className="text-xs sm:text-sm text-purple-100 opacity-75 mt-1">
              Classificado: R$ {formatCurrency(Math.abs(saldoTotalRealizado))}
            </p>
          </div>
          <div className="text-xl sm:text-4xl font-bold flex-shrink-0">
            {saldoTotal < 0 ? '-' : ''}R$ {formatCurrency(Math.abs(saldoTotal))}
          </div>
        </div>
      </div>

      {/* Saldos em Formato Horizontal */}
      <div className="space-y-3">
        {saldos.map((banco, index) => {
          const isExpanded = expandedBanco === banco.codigo;
          const lastDayTransactions = getLastDayTransactions(banco.codigo);
          
          return (
            <div key={banco.codigo} className="space-y-2">
              {/* Box clicável do saldo */}
              <div
                onClick={() => toggleBancoExpansion(banco.codigo)}
                className={`bg-gradient-to-r ${banco.cor} p-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-[1.02]`}
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
                    {/* Indicador de expansão */}
                    <div className={`${banco.corTexto} text-lg transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </div>
                  
                  {/* Lado Direito: Data + Saldos */}
                  <div className="flex items-center gap-2 md:gap-4 text-right">
                    {/* Data */}
                    <div className={`text-xs ${banco.corTexto} opacity-75`}>
                      {banco.lastTransactionDate ? (
                        <>{formatDate(banco.lastTransactionDate)}</>
                      ) : (
                        <>Sem movimentação</>
                      )}
                    </div>
                    
                    {/* Saldos - Móvel e Desktop */}
                    <div className="flex flex-col items-end gap-1">
                      {/* Saldo Real (s+p) - Principal */}
                      <div className={`${banco.corTexto} font-bold text-base md:text-lg min-w-[80px] md:min-w-[100px]`}>
                        R$ {formatCurrency(Math.abs(banco.saldo))}
                      </div>
                      
                      {/* Saldo Classificado (s) - Menor */}
                      <div className={`${banco.corTexto} text-xs opacity-75`}>
                        Classif.: R$ {formatCurrency(Math.abs(banco.saldoRealizado))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção expandida com transações do último dia */}
              {isExpanded && (
                <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-gray-600">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    📅 Lançamentos de {banco.lastTransactionDate ? formatDate(banco.lastTransactionDate) : 'N/A'}
                    <span className="text-gray-400 text-sm">({lastDayTransactions.length} transações)</span>
                  </h4>
                  
                  {lastDayTransactions.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {lastDayTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="bg-gray-700 rounded p-3 flex items-center justify-between hover:bg-gray-600 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">
                              {transaction.descricao}
                            </div>
                            <div className="text-gray-400 text-xs mt-1 flex gap-2">
                              <span>{transaction.realizado === 's' ? '✅ Realizado' : transaction.realizado === 'p' ? '⏳ Previsto' : '🔄 Reconciliado'}</span>
                              {transaction.origem && <span>• {transaction.origem}</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-3">
                            <div className={`font-bold text-sm ${transaction.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {transaction.valor >= 0 ? '+' : ''}R$ {formatCurrency(Math.abs(transaction.valor))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm italic">
                      Nenhuma transação encontrada para este dia
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}