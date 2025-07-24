import React, { useState } from 'react';
import { BarChart } from 'lucide-react';
import { Transaction } from '@/types';
import { categoriesPJ, categoriesPF, categoriesCONC } from '@/lib/categories';

interface AnalyticsTabProps {
  transactions: Transaction[];
}

export function AnalyticsTab({ transactions }: AnalyticsTabProps) {
  const [selectedAccount, setSelectedAccount] = useState('PJ');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubtype, setSelectedSubtype] = useState('all');

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatMonth = (mes: string) => {
    if (!mes || mes === 'todos') return 'Todos os meses';
    const year = '20' + mes.substring(0, 2);
    const month = mes.substring(2, 4);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return monthNames[parseInt(month) - 1] + ' ' + year;
  };

  const getCategoriesForAccount = (account: string) => {
    switch(account) {
      case 'PJ': return categoriesPJ;
      case 'PF': return categoriesPF;
      case 'CONC': return categoriesCONC;
      default: return {};
    }
  };

  const getLast6Months = () => {
    const months = [...new Set(transactions.map(t => t.mes))].filter(m => m).sort().reverse().slice(0, 6).reverse();
    return months;
  };

  const getHistoryData = () => {
    const months = getLast6Months();
    let filtered = transactions.filter(t => t.conta === selectedAccount && t.realizado !== 'p');
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.categoria === selectedCategory);
    }
    
    if (selectedSubtype !== 'all') {
      filtered = filtered.filter(t => t.subtipo === selectedSubtype);
    }
    
    return months.map(month => {
      const monthTransactions = filtered.filter(t => t.mes === month);
      const total = monthTransactions.reduce((sum, t) => sum + t.valor, 0);
      return {
        month: formatMonth(month),
        value: total
      };
    });
  };

  const months = getLast6Months();
  const historyData = getHistoryData();

  return (
    <>
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 mb-4">
        <h3 className="font-semibold mb-3 text-gray-100">🔍 Filtros</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Conta:</label>
            <select
              value={selectedAccount}
              onChange={(e) => {
                setSelectedAccount(e.target.value);
                setSelectedCategory('all');
                setSelectedSubtype('all');
              }}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
            >
              <option value="PJ">PJ - Pessoa Jurídica</option>
              <option value="PF">PF - Pessoa Física</option>
              <option value="CONC">CONC - Conciliação</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Categoria:</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubtype('all');
              }}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
            >
              <option value="all">Todas as categorias</option>
              {Object.keys(getCategoriesForAccount(selectedAccount)).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Subtipo:</label>
            <select
              value={selectedSubtype}
              onChange={(e) => setSelectedSubtype(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
              disabled={selectedCategory === 'all'}
            >
              <option value="all">Todos os subtipos</option>
              {selectedCategory !== 'all' && 
               getCategoriesForAccount(selectedAccount)[selectedCategory]?.subtipos.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {months.length > 0 && (
        <>
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 mb-4">
            <h3 className="font-semibold mb-3 text-gray-100">
              📊 Histórico - Últimos 6 meses
              <span className="text-sm font-normal text-gray-400 ml-2">
                ({selectedAccount}
                {selectedCategory !== 'all' && ` > ${selectedCategory}`}
                {selectedSubtype !== 'all' && ` > ${selectedSubtype}`})
              </span>
            </h3>
            <div className="space-y-2">
              {historyData.map((data, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-700 rounded">
                  <span className="text-sm font-medium text-gray-300">{data.month}</span>
                  <span className={`font-bold text-sm ${data.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    R$ {formatCurrency(data.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 mb-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-100">
              <BarChart className="w-5 h-5" />
              Gráfico de Evolução
              <span className="text-sm font-normal text-gray-400">
                ({selectedAccount}
                {selectedCategory !== 'all' && ` > ${selectedCategory}`}
                {selectedSubtype !== 'all' && ` > ${selectedSubtype}`})
              </span>
            </h3>
            <div className="relative h-80 bg-gray-900 rounded-lg p-4">
              {(() => {
                const data = historyData;
                if (data.length === 0) return <div className="text-gray-400 text-center p-8">Sem dados para exibir</div>;
                
                const values = data.map(d => d.value);
                const maxValue = Math.max(...values.map(Math.abs));
                const minValue = Math.min(...values);
                const hasNegative = values.some(v => v < 0);
                const hasPositive = values.some(v => v > 0);
                
                if (maxValue === 0) return <div className="text-gray-400 text-center p-8">Todos os valores são zero</div>;
                
                const chartHeight = 240;
                const padding = 20;
                const actualHeight = chartHeight - (padding * 2);
                
                let scale, zeroLine;
                if (hasNegative && hasPositive) {
                  scale = actualHeight / (2 * maxValue);
                  zeroLine = actualHeight / 2 + padding;
                } else if (hasNegative) {
                  scale = actualHeight / Math.abs(minValue);
                  zeroLine = chartHeight - padding;
                } else {
                  scale = actualHeight / maxValue;
                  zeroLine = chartHeight - padding;
                }
                
                return (
                  <>
                    <div className="absolute inset-4">
                      {[0.25, 0.5, 0.75].map(ratio => (
                        <div 
                          key={ratio}
                          className="absolute w-full border-t border-gray-700 opacity-50"
                          style={{ top: `${ratio * 100}%` }}
                        />
                      ))}
                    </div>
                    
                    {hasNegative && hasPositive && (
                      <div 
                        className="absolute w-full border-t-2 border-gray-500"
                        style={{ top: `${zeroLine}px`, left: '16px', right: '16px' }}
                      >
                        <span className="absolute -left-12 -top-2 text-xs text-gray-400 bg-gray-900 px-1">R$ 0</span>
                      </div>
                    )}
                    
                    <div className="absolute left-0 top-4 bottom-4 w-12 flex flex-col justify-between text-xs text-gray-400">
                      <span>R$ {formatCurrency(maxValue)}</span>
                      {hasNegative && <span>R$ {formatCurrency(minValue)}</span>}
                    </div>
                    
                    <div className="absolute inset-4 left-16 flex items-end justify-around">
                      {data.map((item, idx) => {
                        const value = item.value;
                        const barHeight = Math.abs(value) * scale;
                        const isPositive = value >= 0;
                        
                        let barBottom;
                        if (hasNegative && hasPositive) {
                          barBottom = isPositive ? zeroLine - barHeight : zeroLine;
                        } else if (hasNegative) {
                          barBottom = zeroLine - barHeight;
                        } else {
                          barBottom = zeroLine - barHeight;
                        }
                        
                        return (
                          <div key={idx} className="flex-1 flex justify-center relative" style={{ maxWidth: '60px' }}>
                            <div className="relative w-8">
                              <div 
                                className={`w-full rounded-sm transition-all duration-300 shadow-lg ${
                                  isPositive 
                                    ? 'bg-gradient-to-t from-green-600 to-green-400' 
                                    : 'bg-gradient-to-b from-red-600 to-red-400'
                                }`}
                                style={{ 
                                  height: `${Math.max(barHeight, 4)}px`,
                                  position: 'absolute',
                                  bottom: `${barBottom}px`
                                }}
                              />
                              
                              <span 
                                className="absolute text-xs font-medium text-gray-200 whitespace-nowrap transform -translate-x-1/2 left-1/2"
                                style={{ 
                                  bottom: `${barBottom + Math.max(barHeight, 4) + 8}px`
                                }}
                              >
                                {value >= 0 ? '+' : ''}R$ {Math.round(value / 1000)}k
                              </span>
                              
                              <span 
                                className="absolute text-xs text-gray-400 whitespace-nowrap transform -translate-x-1/2 left-1/2"
                                style={{ bottom: '-24px' }}
                              >
                                {item.month.split(' ')[0]}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
            <h3 className="font-semibold mb-3 text-gray-100">📈 Estatísticas do Período</h3>
            {(() => {
              const data = historyData;
              const values = data.map(d => d.value);
              const average = values.reduce((sum, v) => sum + v, 0) / values.length;
              const min = Math.min(...values);
              const max = Math.max(...values);
              const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length;
              const stdDev = Math.sqrt(variance);
              const trend = values.length > 1 ? ((values[values.length - 1] - values[0]) / Math.abs(values[0])) * 100 : 0;
              
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-blue-400">📊</span>
                      <span className="text-xs text-gray-400">Média Mensal</span>
                    </div>
                    <div className={`text-lg font-bold ${average >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      R$ {formatCurrency(Math.abs(average))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {average >= 0 ? 'Superávit' : 'Déficit'} médio
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trend >= 0 ? '📈' : '📉'}
                      </span>
                      <span className="text-xs text-gray-400">Tendência</span>
                    </div>
                    <div className={`text-lg font-bold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trend >= 0 ? '+' : ''}{isFinite(trend) ? trend.toFixed(1) : '0.0'}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      vs. primeiro mês
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-400">📉</span>
                      <span className="text-xs text-gray-400">Menor Valor</span>
                    </div>
                    <div className={`text-lg font-bold ${min >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      R$ {formatCurrency(Math.abs(min))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {min >= 0 ? 'Menor ganho' : 'Maior perda'}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-400">📈</span>
                      <span className="text-xs text-gray-400">Maior Valor</span>
                    </div>
                    <div className={`text-lg font-bold ${max >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      R$ {formatCurrency(Math.abs(max))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {max >= 0 ? 'Maior ganho' : 'Menor perda'}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 p-3 rounded-lg col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400">⚡</span>
                      <span className="text-xs text-gray-400">Volatilidade (Desvio Padrão)</span>
                    </div>
                    <div className="text-lg font-bold text-purple-400">
                      R$ {formatCurrency(stdDev)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stdDev < Math.abs(average) * 0.3 ? 'Baixa variação' : 
                       stdDev < Math.abs(average) * 0.7 ? 'Variação moderada' : 'Alta variação'}
                    </div>
                    
                    <div className="mt-2 bg-gray-600 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300"
                        style={{ 
                          width: `${Math.min((stdDev / Math.abs(average || 1)) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {months.length === 0 && (
        <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center">
          <p className="text-gray-400">Não há dados suficientes para análise.</p>
          <p className="text-gray-500 text-sm mt-2">Importe um arquivo CSV com transações para ver as análises.</p>
        </div>
      )}
    </>
  );
}