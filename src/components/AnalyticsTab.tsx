import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  BarChart3, 
  Calendar,
  AlertTriangle,
  Target,
  Zap,
  Eye
} from 'lucide-react';
import { Transaction, countsInBalance } from '@/types';
import { useHierarchy } from '@/hooks/useHierarchy';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';

interface AnalyticsTabProps {
  transactions: Transaction[];
}

interface MonthlyData {
  month: string;
  monthKey: string;
  receitas: number;
  despesas: number;
  saldo: number;
  transactionCount: number;
  // PJ e PF separados
  pjReceitas: number;
  pjDespesas: number;
  pjSaldo: number;
  pfReceitas: number;
  pfDespesas: number;
  pfSaldo: number;
  pjCount: number;
  pfCount: number;
}

interface CategoryAnalysis {
  categoria: string;
  conta: string;
  total: number;
  percentage: number;
  transactionCount: number;
  avgTransaction: number;
  icon: string;
  trend: number;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16', '#EC4899'];

export function AnalyticsTab({ transactions }: AnalyticsTabProps) {
  const { contas, categorias, subtipos, carregarTudo } = useHierarchy();
  const [selectedPeriod, setSelectedPeriod] = useState(12); // Last N months
  const [viewType, setViewType] = useState<'overview' | 'deep'>('overview');
  const [selectedAccount, setSelectedAccount] = useState<'PJ' | 'PF'>('PJ');

  // Load hierarchy data
  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Helper para obter dados da hierarquia das transações
  const getTransactionAccount = (transaction: Transaction): string => {
    if (transaction.hierarchy?.conta_codigo) {
      return transaction.hierarchy.conta_codigo;
    }
    return transaction.conta || 'OUTRAS';
  };

  const getTransactionCategory = (transaction: Transaction): string => {
    if (transaction.hierarchy?.categoria_nome) {
      return transaction.hierarchy.categoria_nome;
    }
    return transaction.categoria || 'Sem categoria';
  };

  const getCategoryIcon = (contaCodigo: string, categoriaNome: string): string => {
    const conta = contas.find(c => c.codigo === contaCodigo);
    const categoria = categorias.find(c => 
      c.conta_id === conta?.id && c.nome === categoriaNome
    );
    return categoria?.icone || '📁';
  };

  // Filtrar transações que contam no saldo - FILTRADO PELA CONTA SELECIONADA
  const balanceTransactions = useMemo(() => 
    transactions.filter(t => 
      countsInBalance(t.realizado) && 
      t.mes && 
      getTransactionAccount(t) === selectedAccount
    ),
    [transactions, selectedAccount]
  );

  // Transações já estão filtradas pela conta selecionada
  const filteredTransactions = balanceTransactions;

  // Dados mensais agregados - CONTA SELECIONADA APENAS
  const monthlyData = useMemo((): MonthlyData[] => {
    const monthsMap = new Map<string, MonthlyData>();
    
    // Inicializar últimos N meses
    const now = new Date();
    for (let i = selectedPeriod - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.getFullYear().toString().slice(-2) + 
        (date.getMonth() + 1).toString().padStart(2, '0');
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      monthsMap.set(monthKey, {
        month: monthName,
        monthKey,
        receitas: 0,
        despesas: 0,
        saldo: 0,
        transactionCount: 0,
        pjReceitas: 0,
        pjDespesas: 0,
        pjSaldo: 0,
        pfReceitas: 0,
        pfDespesas: 0,
        pfSaldo: 0,
        pjCount: 0,
        pfCount: 0
      });
    }

    // Agregar transações da conta selecionada
    filteredTransactions.forEach(transaction => {
      if (!monthsMap.has(transaction.mes)) return;
      
      const monthData = monthsMap.get(transaction.mes)!;
      const valor = transaction.valor;
      const valorAbs = Math.abs(valor);
      
      // Totais
      monthData.transactionCount++;
      if (valor > 0) {
        monthData.receitas += valor;
      } else {
        monthData.despesas += valorAbs;
      }
      monthData.saldo = monthData.receitas - monthData.despesas;
      
      // Manter compatibilidade com estrutura existente
      if (selectedAccount === 'PJ') {
        monthData.pjCount++;
        if (valor > 0) {
          monthData.pjReceitas += valor;
        } else {
          monthData.pjDespesas += valorAbs;
        }
        monthData.pjSaldo = monthData.pjReceitas - monthData.pjDespesas;
      } else {
        monthData.pfCount++;
        if (valor > 0) {
          monthData.pfReceitas += valor;
        } else {
          monthData.pfDespesas += valorAbs;
        }
        monthData.pfSaldo = monthData.pfReceitas - monthData.pfDespesas;
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredTransactions, selectedPeriod, selectedAccount]);

  // Análise por categorias - CONTA SELECIONADA
  const categoryAnalysis = useMemo((): CategoryAnalysis[] => {
    const categoryMap = new Map<string, {
      categoria: string;
      conta: string;
      total: number;
      transactionCount: number;
      icon: string;
      monthlyTotals: number[];
    }>();

    const recentMonths = monthlyData.slice(-3).map(m => m.monthKey);
    
    filteredTransactions.forEach(transaction => {
      const key = `${selectedAccount}_${getTransactionCategory(transaction)}`;
      const categoria = getTransactionCategory(transaction);
      
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          categoria,
          conta: selectedAccount,
          total: 0,
          transactionCount: 0,
          icon: getCategoryIcon(selectedAccount, categoria),
          monthlyTotals: []
        });
      }

      const categoryData = categoryMap.get(key)!;
      categoryData.total += Math.abs(transaction.valor);
      categoryData.transactionCount++;
      
      // Para cálculo de trend
      if (recentMonths.includes(transaction.mes)) {
        categoryData.monthlyTotals.push(Math.abs(transaction.valor));
      }
    });

    const totalGeral = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.total, 0);

    return Array.from(categoryMap.values())
      .map(cat => {
        const trend = cat.monthlyTotals.length > 1 ? 
          ((cat.monthlyTotals[cat.monthlyTotals.length - 1] - cat.monthlyTotals[0]) / cat.monthlyTotals[0]) * 100 : 0;
        
        return {
          categoria: cat.categoria,
          conta: cat.conta,
          total: cat.total,
          percentage: (cat.total / totalGeral) * 100,
          transactionCount: cat.transactionCount,
          avgTransaction: cat.total / cat.transactionCount,
          icon: cat.icon,
          trend: isFinite(trend) ? trend : 0
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredTransactions, monthlyData, contas, categorias, selectedAccount]);

  // Indicadores principais - CONTA SELECIONADA
  const indicators = useMemo(() => {
    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    const last6Months = monthlyData.slice(-6);
    const last3Months = monthlyData.slice(-3);
    
    // Totais da conta selecionada
    const totalReceitas = monthlyData.reduce((sum, m) => sum + m.receitas, 0);
    const totalDespesas = monthlyData.reduce((sum, m) => sum + m.despesas, 0);
    const saldoTotal = totalReceitas - totalDespesas;
    
    // Médias mensais
    const avgReceitas = totalReceitas / monthlyData.length;
    const avgDespesas = totalDespesas / monthlyData.length;
    
    // Variações MoM
    const receitasMoM = currentMonth && previousMonth && previousMonth.receitas > 0 ? 
      ((currentMonth.receitas - previousMonth.receitas) / previousMonth.receitas) * 100 : 0;
    
    const despesasMoM = currentMonth && previousMonth && previousMonth.despesas > 0 ? 
      ((currentMonth.despesas - previousMonth.despesas) / previousMonth.despesas) * 100 : 0;

    // Volatilidade (desvio padrão do saldo)
    const avgSaldo = monthlyData.reduce((sum, m) => sum + m.saldo, 0) / monthlyData.length;
    const variance = monthlyData.reduce((sum, m) => sum + Math.pow(m.saldo - avgSaldo, 2), 0) / monthlyData.length;
    const volatility = Math.sqrt(variance);

    // Alertas inteligentes
    const alerts = [];
    
    // Alerta: Despesas crescendo consistentemente
    if (last3Months.length >= 3) {
      const despesasTrend = last3Months.every((month, index) => 
        index === 0 || month.despesas > last3Months[index - 1].despesas
      );
      if (despesasTrend) {
        alerts.push({
          type: 'warning',
          title: 'Despesas em crescimento',
          message: 'Suas despesas vêm crescendo por 3 meses consecutivos',
          icon: '📈'
        });
      }
    }

    // Alerta: Saldo negativo recorrente
    const saldosNegativos = last3Months.filter(m => m.saldo < 0).length;
    if (saldosNegativos >= 2) {
      alerts.push({
        type: 'danger',
        title: 'Déficit recorrente',
        message: `${saldosNegativos} dos últimos 3 meses tiveram saldo negativo`,
        icon: '⚠️'
      });
    }

    // Alerta: Receitas abaixo da média
    if (currentMonth && currentMonth.receitas < avgReceitas * 0.8) {
      alerts.push({
        type: 'info',
        title: 'Receitas baixas',
        message: 'Receitas do mês atual estão 20% abaixo da média',
        icon: '📉'
      });
    }

    // Alerta: Alta volatilidade
    if (volatility > avgSaldo * 0.5) {
      alerts.push({
        type: 'warning',
        title: 'Alta volatilidade',
        message: 'Seus saldos têm variado muito entre os meses',
        icon: '🎢'
      });
    }

    // Insight: Mês excepcional
    if (currentMonth && currentMonth.saldo > avgSaldo * 1.5) {
      alerts.push({
        type: 'success',
        title: 'Mês excepcional!',
        message: 'Este mês teve um saldo 50% acima da média',
        icon: '🎉'
      });
    }

    return {
      // Dados da conta selecionada
      totalReceitas,
      totalDespesas,
      saldoTotal,
      avgReceitas,
      avgDespesas,
      receitasMoM: isFinite(receitasMoM) ? receitasMoM : 0,
      despesasMoM: isFinite(despesasMoM) ? despesasMoM : 0,
      volatility,
      burnRate: avgDespesas,
      runway: saldoTotal > 0 ? saldoTotal / avgDespesas : 0,
      alerts,
      selectedAccount
    };
  }, [monthlyData]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-600 shadow-lg">
          <p className="text-gray-300 font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: R$ {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header Controls - Mobile Optimized */}
      <div className="bg-gray-800 p-3 sm:p-4 rounded-lg shadow-lg border border-gray-700">
        <div className="space-y-3">
          {/* Title */}
          <div className="text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-bold text-gray-100 flex items-center justify-center sm:justify-start gap-2">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              Análise Financeira
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Inteligência completa sobre seus dados financeiros
            </p>
          </div>
          
          {/* Controls - Stacked on Mobile */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Seleção de Conta PJ/PF */}
            <div className="flex bg-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setSelectedAccount('PJ')}
                className={`flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                  selectedAccount === 'PJ' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                🏢 PJ
              </button>
              <button
                onClick={() => setSelectedAccount('PF')}
                className={`flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                  selectedAccount === 'PF' 
                    ? 'bg-green-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                👤 PF
              </button>
            </div>

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(Number(e.target.value))}
              className="w-full sm:w-auto px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
            >
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Último ano</option>
              <option value={24}>Últimos 2 anos</option>
            </select>
            
            <div className="flex bg-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewType('overview')}
                className={`flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                  viewType === 'overview' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                <span className="hidden sm:inline">Visão Geral</span>
                <span className="sm:hidden">Geral</span>
              </button>
              <button
                onClick={() => setViewType('deep')}
                className={`flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                  viewType === 'deep' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                <span className="hidden sm:inline">Análise Profunda</span>
                <span className="sm:hidden">Profunda</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewType === 'overview' ? (
        <>
          {/* KPIs da Conta Selecionada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Receitas */}
            <div className={`bg-gradient-to-br p-3 sm:p-4 rounded-lg shadow-lg ${
              selectedAccount === 'PJ' 
                ? 'from-blue-600 to-blue-700' 
                : 'from-green-600 to-green-700'
            }`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-2xl sm:text-3xl">{selectedAccount === 'PJ' ? '🏢' : '👤'}</div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs sm:text-sm font-medium ${
                    selectedAccount === 'PJ' ? 'text-blue-100' : 'text-green-100'
                  }`}>{selectedAccount} Receitas</p>
                  <p className="text-white text-sm sm:text-lg font-bold truncate">R$ {formatCurrency(indicators.totalReceitas)}</p>
                  <p className={`text-xs ${
                    selectedAccount === 'PJ' ? 'text-blue-200' : 'text-green-200'
                  }`}>
                    {formatPercent(indicators.receitasMoM)} MoM
                  </p>
                </div>
              </div>
            </div>

            {/* Despesas */}
            <div className="bg-gradient-to-br from-red-600 to-red-700 p-3 sm:p-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-2 sm:gap-3">
                <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-white opacity-90 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-red-100 text-xs sm:text-sm font-medium">{selectedAccount} Despesas</p>
                  <p className="text-white text-sm sm:text-lg font-bold truncate">R$ {formatCurrency(indicators.totalDespesas)}</p>
                  <p className="text-red-200 text-xs">
                    {formatPercent(indicators.despesasMoM)} MoM
                  </p>
                </div>
              </div>
            </div>

            {/* Saldo */}
            <div className={`bg-gradient-to-br p-3 sm:p-4 rounded-lg shadow-lg ${
              indicators.saldoTotal >= 0 
                ? 'from-emerald-600 to-emerald-700' 
                : 'from-orange-600 to-orange-700'
            }`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-white opacity-90 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white opacity-90 text-xs sm:text-sm font-medium">Saldo {selectedAccount}</p>
                  <p className="text-white text-sm sm:text-lg font-bold truncate">
                    R$ {formatCurrency(Math.abs(indicators.saldoTotal))}
                  </p>
                  <p className="text-white opacity-75 text-xs">
                    {indicators.saldoTotal >= 0 ? 'Positivo' : 'Negativo'}
                  </p>
                </div>
              </div>
            </div>

            {/* Média Mensal */}
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-3 sm:p-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-2 sm:gap-3">
                <Target className="w-6 h-6 sm:w-8 sm:h-8 text-white opacity-90 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-purple-100 text-xs sm:text-sm font-medium">Média Mensal</p>
                  <p className="text-white text-sm sm:text-lg font-bold truncate">
                    R$ {formatCurrency(Math.abs(indicators.avgReceitas - indicators.avgDespesas))}
                  </p>
                  <p className="text-purple-200 text-xs">
                    {selectedAccount} - {selectedPeriod}m
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Indicadores Mensais da Conta Selecionada */}
          <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              Indicadores {selectedAccount} - Últimos {selectedPeriod} Meses
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <div className={`text-lg sm:text-2xl font-bold ${
                  selectedAccount === 'PJ' ? 'text-blue-400' : 'text-green-400'
                }`}>
                  R$ {formatCurrency(indicators.avgReceitas)}
                </div>
                <div className="text-xs sm:text-sm text-gray-300 mt-1">Média Receitas</div>
              </div>
              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <div className="text-red-400 text-lg sm:text-2xl font-bold">
                  R$ {formatCurrency(indicators.avgDespesas)}
                </div>
                <div className="text-xs sm:text-sm text-gray-300 mt-1">Média Despesas</div>
              </div>
              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <div className={`text-lg sm:text-2xl font-bold ${
                  indicators.receitasMoM >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatPercent(indicators.receitasMoM)}
                </div>
                <div className="text-xs sm:text-sm text-gray-300 mt-1">Receitas MoM</div>
              </div>
              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <div className={`text-lg sm:text-2xl font-bold ${
                  indicators.despesasMoM <= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatPercent(indicators.despesasMoM)}
                </div>
                <div className="text-xs sm:text-sm text-gray-300 mt-1">Despesas MoM</div>
              </div>
            </div>
          </div>

          {/* Gráfico de Evolução da Conta Selecionada - Mobile Optimized */}
          <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <span className="hidden sm:inline">Evolução Mensal {selectedAccount} - Últimos {selectedPeriod} Meses</span>
              <span className="sm:hidden">Evolução {selectedAccount}</span>
            </h3>
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#9CA3AF" 
                    fontSize={10}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    tickFormatter={(value) => `${formatCurrency(value / 1000)}k`}
                    fontSize={10}
                    tick={{ fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="receitas" 
                    fill={selectedAccount === 'PJ' ? '#2563EB' : '#10B981'} 
                    name={`${selectedAccount} Receitas`} 
                  />
                  <Bar 
                    dataKey="despesas" 
                    fill="#DC2626" 
                    name={`${selectedAccount} Despesas`} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke="#06B6D4" 
                    strokeWidth={3}
                    name={`Saldo ${selectedAccount}`}
                    dot={{ fill: '#06B6D4', strokeWidth: 1, r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráficos Duplos - Despesas e Distribuição por Categoria */}
          <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Gráfico de Despesas da Conta Selecionada */}
            <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                <span className="hidden sm:inline">Evolução Despesas {selectedAccount}</span>
                <span className="sm:hidden">Despesas {selectedAccount}</span>
              </h3>
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#9CA3AF" 
                      fontSize={9}
                      tick={{ fontSize: 9 }}
                    />
                    <YAxis 
                      stroke="#9CA3AF" 
                      tickFormatter={(value) => `${formatCurrency(value / 1000)}k`}
                      fontSize={9}
                      tick={{ fontSize: 9 }}
                      width={35}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="despesas"
                      stroke="#DC2626"
                      fill="#DC2626"
                      fillOpacity={0.6}
                      name={`${selectedAccount} Despesas`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Receitas vs Despesas */}
            <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                <span className="hidden sm:inline">Receitas vs Despesas {selectedAccount}</span>
                <span className="sm:hidden">R vs D {selectedAccount}</span>
              </h3>
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      dataKey="value"
                      data={[
                        { 
                          name: 'Receitas', 
                          value: indicators.totalReceitas, 
                          fill: selectedAccount === 'PJ' ? '#2563EB' : '#10B981' 
                        },
                        { 
                          name: 'Despesas', 
                          value: indicators.totalDespesas, 
                          fill: '#DC2626' 
                        }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(1) : '0.0'}%`}
                    >
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`R$ ${formatCurrency(value)}`, 'Total']} 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Alertas Inteligentes - Mobile Optimized */}
          {indicators.alerts && indicators.alerts.length > 0 && (
            <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                Insights Inteligentes
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {indicators.alerts.map((alert: any, index: number) => (
                  <div 
                    key={index}
                    className={`p-3 sm:p-4 rounded-lg border-l-4 ${
                      alert.type === 'danger' ? 'bg-red-900/20 border-red-500' :
                      alert.type === 'warning' ? 'bg-yellow-900/20 border-yellow-500' :
                      alert.type === 'success' ? 'bg-green-900/20 border-green-500' :
                      'bg-blue-900/20 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl flex-shrink-0">{alert.icon}</span>
                      <div className="min-w-0 flex-1">
                        <h4 className={`font-medium mb-1 text-sm sm:text-base ${
                          alert.type === 'danger' ? 'text-red-400' :
                          alert.type === 'warning' ? 'text-yellow-400' :
                          alert.type === 'success' ? 'text-green-400' :
                          'text-blue-400'
                        }`}>
                          {alert.title}
                        </h4>
                        <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Análise Detalhada por Categorias da Conta Selecionada */}
          <div className="space-y-4">
            {/* Top Categorias da Conta Selecionada */}
            <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <div className="text-xl sm:text-2xl">{selectedAccount === 'PJ' ? '🏢' : '👤'}</div>
                <span className="hidden sm:inline">Top Categorias {selectedAccount} - Últimos {selectedPeriod} meses</span>
                <span className="sm:hidden">Top Categorias {selectedAccount}</span>
              </h3>
              <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto">
                {categoryAnalysis.slice(0, 8).map((category, index) => (
                  <div key={`${category.conta}_${category.categoria}`} className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border-l-4 touch-manipulation ${
                    selectedAccount === 'PJ' 
                      ? 'bg-blue-900/20 border-blue-500' 
                      : 'bg-green-900/20 border-green-500'
                  }`}>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <span className="text-base sm:text-xl">{category.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs sm:text-sm font-medium truncate ${
                          selectedAccount === 'PJ' ? 'text-blue-100' : 'text-green-100'
                        }`}>
                          {category.categoria}
                        </p>
                        <p className={`text-xs truncate ${
                          selectedAccount === 'PJ' ? 'text-blue-300' : 'text-green-300'
                        }`}>
                          {category.transactionCount}x • {formatPercent(category.percentage)} do total {selectedAccount}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs sm:text-sm font-bold ${
                        selectedAccount === 'PJ' ? 'text-blue-100' : 'text-green-100'
                      }`}>
                        R$ {formatCurrency(category.total)}
                      </p>
                      <p className={`text-xs ${category.trend >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatPercent(category.trend)} MoM
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico das Top Categorias da Conta Selecionada */}
            <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                <span className="hidden sm:inline">Top 6 Categorias {selectedAccount} por Valor</span>
                <span className="sm:hidden">Top 6 {selectedAccount}</span>
              </h3>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryAnalysis.slice(0, 6)} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="categoria" 
                      stroke="#9CA3AF" 
                      fontSize={9}
                      tick={{ fontSize: 9 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#9CA3AF" 
                      tickFormatter={(value) => `${formatCurrency(value / 1000)}k`}
                      fontSize={9}
                      tick={{ fontSize: 9 }}
                      width={35}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="total" 
                      fill={selectedAccount === 'PJ' ? '#2563EB' : '#10B981'} 
                      name={`Total ${selectedAccount}`}
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparações Mês a Mês da Conta Selecionada */}
            <div className="bg-gray-800 p-3 sm:p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                <span className="hidden sm:inline">Comparações Mensais {selectedAccount}</span>
                <span className="sm:hidden">Comparações {selectedAccount}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {monthlyData.slice(-6).map((month, index) => {
                  const previousMonth = index > 0 ? monthlyData.slice(-6)[index - 1] : null;
                  const receitasMoM = previousMonth && previousMonth.receitas > 0 
                    ? ((month.receitas - previousMonth.receitas) / previousMonth.receitas) * 100 
                    : 0;
                  const despesasMoM = previousMonth && previousMonth.despesas > 0 
                    ? ((month.despesas - previousMonth.despesas) / previousMonth.despesas) * 100 
                    : 0;
                  const saldoMoM = previousMonth && Math.abs(previousMonth.saldo) > 0 
                    ? ((month.saldo - previousMonth.saldo) / Math.abs(previousMonth.saldo)) * 100 
                    : 0;
                  
                  return (
                    <div key={month.monthKey} className={`p-3 sm:p-4 rounded-lg border-l-4 ${ 
                      selectedAccount === 'PJ' 
                        ? 'bg-blue-900/10 border-blue-500' 
                        : 'bg-green-900/10 border-green-500'
                    }`}>
                      <div className="text-center mb-2">
                        <h4 className="text-sm font-semibold text-gray-100">{month.month}</h4>
                        <p className={`text-xs ${
                          selectedAccount === 'PJ' ? 'text-blue-300' : 'text-green-300'
                        }`}>{selectedAccount}</p>
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Receitas:</span>
                          <span className="text-gray-100 font-medium">R$ {formatCurrency(month.receitas)}</span>
                        </div>
                        {index > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">vs anterior:</span>
                            <span className={`font-medium ${receitasMoM >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatPercent(receitasMoM)}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between mt-2">
                          <span className="text-gray-400">Despesas:</span>
                          <span className="text-red-300 font-medium">R$ {formatCurrency(month.despesas)}</span>
                        </div>
                        {index > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">vs anterior:</span>
                            <span className={`font-medium ${despesasMoM <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatPercent(despesasMoM)}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between mt-2 pt-1 border-t border-gray-600">
                          <span className="text-gray-400">Saldo:</span>
                          <span className={`font-bold ${month.saldo >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                            R$ {formatCurrency(Math.abs(month.saldo))}
                          </span>
                        </div>
                        {index > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">vs anterior:</span>
                            <span className={`font-medium ${
                              month.saldo >= 0 && saldoMoM >= 0 ? 'text-green-400' : 
                              month.saldo < 0 && saldoMoM < 0 ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {isFinite(saldoMoM) ? formatPercent(saldoMoM) : '∞'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-800 p-4 sm:p-8 rounded-lg shadow-lg border border-gray-700 text-center">
          <Zap className="w-12 h-12 sm:w-16 sm:h-16 text-purple-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-100 mb-2">Análise Profunda</h3>
          <p className="text-gray-400 text-sm sm:text-base mb-4">
            Funcionalidades avançadas em desenvolvimento
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-lg sm:text-xl mb-1">🤖</div>
              Previsões com IA
            </div>
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-lg sm:text-xl mb-1">🔍</div>
              Detecção de Anomalias
            </div>
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-lg sm:text-xl mb-1">📊</div>
              Análise de Padrões
            </div>
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-lg sm:text-xl mb-1">📈</div>
              Benchmarking
            </div>
          </div>
        </div>
      )}
    </div>
  );
}