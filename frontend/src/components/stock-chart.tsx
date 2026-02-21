"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Scatter,
  ScatterProps,
  Cell,
} from "recharts";

interface StockChartProps {
  dailyData: Array<{
    trade_date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    pct_chg: number;
  }>;
  limitUpDays: string[];
  startPrice?: number;
}

export function StockChart({ dailyData, limitUpDays, startPrice }: StockChartProps) {
  const chartData = useMemo(() => {
    return dailyData
      .map((d) => ({
        date: formatDate(d.trade_date),
        close: d.close,
        isLimitUp: limitUpDays.includes(d.trade_date),
      }))
      .reverse();
  }, [dailyData, limitUpDays]);

  const limitUpPoints = useMemo(() => {
    return chartData
      .filter((d) => d.isLimitUp)
      .map((d) => ({ x: d.date, y: d.close }));
  }, [chartData]);

  const minPrice = Math.min(...chartData.map((d) => d.close)) * 0.98;
  const maxPrice = Math.max(...chartData.map((d) => d.close)) * 1.02;

  function formatDate(dateStr: string) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${month}-${day}`;
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="font-medium text-slate-900 dark:text-slate-100">{payload[0].payload.date}</p>
          <p className="text-slate-700 dark:text-slate-300">收盘价: ¥{payload[0].value.toFixed(2)}</p>
          {payload[0].payload.isLimitUp && (
            <p className="text-red-600 font-medium">涨停日</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeWidth={1} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={{ stroke: "#e2e8f0" }}
            axisLine={{ stroke: "#e2e8f0" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={{ stroke: "#e2e8f0" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickFormatter={(value) => `¥${value.toFixed(2)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {startPrice && (
            <ReferenceLine
              y={startPrice}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `启动价 ¥${startPrice.toFixed(2)}`,
                position: "right",
                fill: "#ef4444",
                fontSize: 12,
              }}
            />
          )}
          <Scatter data={limitUpPoints} fill="#ef4444" shape="circle">
            {limitUpPoints.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#ef4444" />
            ))}
          </Scatter>
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-blue-500 rounded"></div>
          <span className="text-slate-600 dark:text-slate-400">收盘价</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-slate-600 dark:text-slate-400">涨停日</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 border-t-2 border-red-500 border-dashed"></div>
          <span className="text-slate-600 dark:text-slate-400">启动价</span>
        </div>
      </div>
    </div>
  );
}
