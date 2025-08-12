import React from 'react';
import { Transaction } from '@/types';


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

  // Calcular saldo por banco (todas as transações realizadas)
  const getSaldoPorBanco = (banco: string) => {
    return transactions
      .filter(t => t.cc === banco && t.realizado === 's')
      .reduce((sum, t) => sum + t.valor, 0);
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

  // Calcular saldos
  const saldos = bancos.map(banco => ({
    ...banco,
    saldo: getSaldoPorBanco(banco.codigo),
    transacoes: transactions.filter(t => t.cc === banco.codigo && t.realizado === 's').length
  }));

  // Saldo total
  const saldoTotal = saldos.reduce((sum, banco) => sum + banco.saldo, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold text-gray-100 text-center mb-2">🏦 Saldos por Conta</h2>
        <p className="text-gray-400 text-center text-sm">Posição atual de todas as contas</p>
      </div>

      {/* Grid de Bancos 3x3 */}
      <div className="grid grid-cols-3 gap-4">
        {saldos.map((banco, index) => (
          <div
            key={banco.codigo}
            className={`bg-gradient-to-br ${banco.cor} p-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer`}
          >
            <div className="flex flex-col items-center text-center h-full">
              {/* Ícone do banco */}
              <div className="text-3xl mb-2">
                {banco.icone}
              </div>
              
              {/* Nome do banco */}
              <h3 className={`font-semibold ${banco.corTexto} mb-1 leading-tight whitespace-nowrap overflow-hidden text-ellipsis`}
                  style={{
                    fontSize: banco.nome.length > 12 ? '0.75rem' : '0.875rem'
                  }}>
                {banco.nome}
              </h3>
              
              {/* Saldo */}
              <div className={`${banco.corTexto} font-bold mb-1 whitespace-nowrap overflow-hidden text-ellipsis`}
                   style={{
                     fontSize: banco.saldo.toString().length > 8 ? '0.875rem' : '1.125rem'
                   }}>
                R$ {formatCurrency(Math.abs(banco.saldo))}
              </div>
              
              {/* Indicador de positivo/negativo */}
              <div className="flex items-center gap-1">
                <span className="text-xs opacity-90">
                  {banco.saldo >= 0 ? '📈' : '📉'}
                </span>
                <span className={`text-xs opacity-90 ${banco.corTexto}`}>
                  {banco.transacoes} transações
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Card vazio (9º slot) - pode ser usado para resumo */}
        <div className="bg-gray-800 border-2 border-dashed border-gray-600 p-4 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2">➕</div>
            <div className="text-xs">Espaço para</div>
            <div className="text-xs">nova conta</div>
          </div>
        </div>
      </div>

      {/* Resumo Total */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-lg shadow-lg">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-2">💎 Patrimônio Total</h3>
          <div className="text-4xl font-bold mb-2">
            R$ {formatCurrency(Math.abs(saldoTotal))}
          </div>
          <div className="flex items-center justify-center gap-2 text-lg">
            <span>{saldoTotal >= 0 ? '📈' : '📉'}</span>
            <span>{saldoTotal >= 0 ? 'Patrimônio Positivo' : 'Saldo Negativo'}</span>
          </div>
          <div className="text-sm opacity-90 mt-2">
            Baseado em {transactions.filter(t => t.realizado === 's').length} transações realizadas
          </div>
        </div>
      </div>

      {/* Detalhamento por tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
            🏦 Contas Correntes
          </h4>
          <div className="space-y-1 text-sm">
            {saldos.filter(b => !b.nome.includes('Investimento')).map(banco => (
              <div key={banco.codigo} className="flex justify-between text-gray-300">
                <span>{banco.nome}:</span>
                <span className={banco.saldo >= 0 ? 'text-green-400' : 'text-red-400'}>
                  R$ {formatCurrency(Math.abs(banco.saldo))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
            💰 Investimentos
          </h4>
          <div className="space-y-1 text-sm">
            {saldos.filter(b => b.nome.includes('Investimento')).map(banco => (
              <div key={banco.codigo} className="flex justify-between text-gray-300">
                <span>{banco.nome.replace('Investimento ', '')}:</span>
                <span className={banco.saldo >= 0 ? 'text-green-400' : 'text-red-400'}>
                  R$ {formatCurrency(Math.abs(banco.saldo))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
            📊 Estatísticas
          </h4>
          <div className="space-y-1 text-sm text-gray-300">
            <div className="flex justify-between">
              <span>Contas ativas:</span>
              <span>{saldos.filter(b => b.transacoes > 0).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Maior saldo:</span>
              <span className="text-green-400">
                R$ {formatCurrency(Math.max(...saldos.map(b => b.saldo)))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total transações:</span>
              <span>{transactions.filter(t => t.realizado === 's').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}