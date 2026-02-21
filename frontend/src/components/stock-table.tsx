"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

interface StockInfo {
  ts_code: string;
  name: string;
  start_date: string;
  start_price: number;
  current_price: number;
  limit_up_count: number;
  drop_ratio: number;
  industry: string;
}

interface StockTableProps {
  stocks: StockInfo[];
  onSelect: (tsCode: string, name: string) => void;
  selectedCode?: string;
}

export function StockTable({ stocks, onSelect, selectedCode }: StockTableProps) {
  const formatDate = (dateStr: string) => {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-3 px-2 font-medium text-slate-700 dark:text-slate-300">代码</th>
            <th className="text-left py-3 px-2 font-medium text-slate-700 dark:text-slate-300">名称</th>
            <th className="text-left py-3 px-2 font-medium text-slate-700 dark:text-slate-300">板块</th>
            <th className="text-right py-3 px-2 font-medium text-slate-700 dark:text-slate-300">启动价</th>
            <th className="text-right py-3 px-2 font-medium text-slate-700 dark:text-slate-300">现价</th>
            <th className="text-right py-3 px-2 font-medium text-slate-700 dark:text-slate-300">回落幅度</th>
            <th className="text-center py-3 px-2 font-medium text-slate-700 dark:text-slate-300">连续涨停</th>
            <th className="text-center py-3 px-2 font-medium text-slate-700 dark:text-slate-300">启动日期</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock, index) => (
            <tr
              key={stock.ts_code + index}
              onClick={() => onSelect(stock.ts_code, stock.name)}
              className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                selectedCode === stock.ts_code ? "bg-blue-50 dark:bg-blue-900/20" : ""
              }`}
            >
              <td className="py-3 px-2 font-mono text-slate-600 dark:text-slate-400">{stock.ts_code}</td>
              <td className="py-3 px-2 font-medium text-slate-900 dark:text-slate-100">{stock.name}</td>
              <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{stock.industry || '-'}</td>
              <td className="py-3 px-2 text-right text-slate-700 dark:text-slate-300">
                ¥{stock.start_price.toFixed(2)}
              </td>
              <td className="py-3 px-2 text-right text-slate-700 dark:text-slate-300">
                ¥{stock.current_price.toFixed(2)}
              </td>
              <td className="py-3 px-2 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <TrendingDown className="h-3 w-3" />
                  {stock.drop_ratio.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-2 text-center">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <TrendingUp className="h-3 w-3" />
                  {stock.limit_up_count}板
                </span>
              </td>
              <td className="py-3 px-2 text-center text-slate-600 dark:text-slate-400">
                {formatDate(stock.start_date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
