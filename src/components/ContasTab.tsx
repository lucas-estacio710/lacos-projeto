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

  // ✅ NOVA FUNÇÃO: Contar transações por banco e tipo
  const getTransactionCounts = (banco: string) => {
    const bankTransactions = transactions.filter(t => t.cc === banco);
    
    return {
      balance: bankTransactions.filter(t => countsInBalance(t.realizado)).length,
      reconciled: bankTransactions.filter(t => t.realizado === 'r').length,
      pending: bankTransactions.filter(t => t.realizado === 'p').length,
      total: bankTransactions.length
    };
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

  // Calcular saldos e dados estendidos
  const saldos = bancos.map(banco => {
    const saldo = getSaldoPorBanco(banco.codigo);
    const reconciledValue = getReconciledByBanco(banco.codigo);
    const counts = getTransactionCounts(banco.codigo);
    
    return {
      ...banco,
      saldo,
      reconciledValue,
      transacoes: counts.balance,
      reconciledCount: counts.reconciled,
      pendingCount: counts.pending,
      totalCount: counts.total
    };
  });

  // ✅ SALDO TOTAL CORRIGIDO: Só contar transações que impactam saldo
  const saldoTotal = saldos.reduce((sum, banco) => sum + banco.saldo, 0);
  const totalReconciled = saldos.reduce((sum, banco) => sum + banco.reconciledValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold text-gray-100 text-center mb-2">🏦 Saldos por Conta</h2>
        <p className="text-gray-400 text-center text-sm">Posição atual de todas as contas</p>
        
        {/* ✅ NOVO: Explicação sobre reconciliação */}
        {totalReconciled !== 0 && (
          <div className="mt-3 bg-blue-900/30 border border-blue-700 rounded p-2">
            <p className="text-blue-300 text-xs text-center">
              💡 Pagamentos reconciliados (R$ {formatCurrency(Math.abs(totalReconciled))}) não contam nos saldos
            </p>
          </div>
        )}
      </div>

      {/* Grid de Bancos 3x3 */}
      <div className="grid grid-cols-3 gap-4">
        {saldos.map((banco, index) => (
          <div
            key={banco.codigo}
            className={`bg-gradient-to-br ${banco.cor} p-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer relative`}
          >
            {/* ✅ NOVO: Badge de reconciliação se houver */}
            {banco.reconciledCount > 0 && (
              <div className="absolute top-2 right-2">
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded-full text-xs font-bold">
                  🔗 {banco.reconciledCount}
                </span>
              </div>
            )}
            
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
              
              {/* ✅ INFORMAÇÕES ESTENDIDAS */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs opacity-90">
                  {banco.saldo >= 0 ? '📈' : '📉'}
                </span>
                <span className={`text-xs opacity-90 ${banco.corTexto}`}>
                  {banco.transacoes} ativas
                </span>
              </div>

              {/* ✅ NOVO: Info de reconciliação se houver */}
              {banco.reconciledCount > 0 && (
                <div className={`text-xs opacity-75 ${banco.corTexto}`}>
                  🔗 R$ {formatCurrency(Math.abs(banco.reconciledValue))} reconciliado
                </div>
              )}

              {/* ✅ NOVO: Info de pendentes se houver */}
              {banco.pendingCount > 0 && (
                <div className={`text-xs opacity-75 ${banco.corTexto}`}>
                  ⏳ {banco.pendingCount} pendentes
                </div>
              )}
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
            Baseado em {transactions.filter(t => countsInBalance(t.realizado)).length} transações realizadas
          </div>
          
          {/* ✅ NOVO: Resumo de reconciliação */}
          {totalReconciled !== 0 && (
            <div className="mt-3 pt-3 border-t border-white/30">
              <div className="text-sm opacity-90">
                💡 R$ {formatCurrency(Math.abs(totalReconciled))} em pagamentos reconciliados (não contabilizados)
              </div>
              <div className="text-xs opacity-75 mt-1">
                {transactions.filter(t => t.realizado === 'r').length} transações reconciliadas
              </div>
            </div>
          )}
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
                <span className="flex items-center gap-1">
                  {banco.nome}:
                  {banco.reconciledCount > 0 && (
                    <span className="text-xs text-blue-400">🔗{banco.reconciledCount}</span>
                  )}
                </span>
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
                <span className="flex items-center gap-1">
                  {banco.nome.replace('Investimento ', '')}:
                  {banco.reconciledCount > 0 && (
                    <span className="text-xs text-blue-400">🔗{banco.reconciledCount}</span>
                  )}
                </span>
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
              <span>{transactions.filter(t => countsInBalance(t.realizado)).length}</span>
            </div>
            {/* ✅ NOVA ESTATÍSTICA */}
            <div className="flex justify-between">
              <span>Reconciliadas:</span>
              <span className="text-blue-400">{transactions.filter(t => t.realizado === 'r').length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ NOVA SEÇÃO: Detalhes de Reconciliação */}
      {totalReconciled !== 0 && (
        <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
          <h4 className="font-medium text-blue-100 mb-3 flex items-center gap-2">
            🔗 Pagamentos Reconciliados
          </h4>
          <div className="text-blue-200 text-sm space-y-2">
            <p>
              📊 <strong>Total reconciliado:</strong> R$ {formatCurrency(Math.abs(totalReconciled))}
            </p>
            <p>
              📋 <strong>Transações:</strong> {transactions.filter(t => t.realizado === 'r').length} pagamentos marcados como reconciliados
            </p>
            <p className="text-blue-300 text-xs">
              💡 Pagamentos reconciliados não contam nos saldos para evitar duplicação com os gastos de cartão.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}