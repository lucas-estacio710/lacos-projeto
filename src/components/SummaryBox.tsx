import React from 'react';
import { Transaction } from '@/types';

interface SummaryBoxProps {
  title: string;
  transactions: Transaction[];
  bgColor?: string;
}

export function SummaryBox({ title, transactions, bgColor = 'bg-gray-800' }: SummaryBoxProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const receitas = transactions.filter(t => t.valor > 0).reduce((sum, t) => sum + t.valor, 0);
  const gastos = Math.abs(transactions.filter(t => t.valor < 0).reduce((sum, t) => sum + t.valor, 0));
  const saldo = receitas - gastos;

  return (
    <div className={`${bgColor} p-4 rounded-lg mt-4 border border-gray-700`}>
      <h4 className="font-semibold text-gray-100 mb-2">{title}</h4>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-300">Receitas:</span>
          <span className="font-medium text-green-400">+R$ {formatCurrency(receitas)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-300">Gastos:</span>
          <span className="font-medium text-red-400">-R$ {formatCurrency(gastos)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-gray-600">
          <span className="font-medium text-gray-200">Saldo:</span>
          <span className={`font-bold ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            R$ {formatCurrency(saldo)}
          </span>
        </div>
      </div>
    </div>
  );
}