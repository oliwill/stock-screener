"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { StockTable } from "@/components/stock-table";
import { StockChart } from "@/components/stock-chart";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, TrendingUp, Pause, X, Play, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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

interface StockDetail {
  ts_code: string;
  name: string;
  daily_data: Array<{
    trade_date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    pct_chg: number;
  }>;
  limit_up_periods: Array<{
    start_date: string;
    start_price: number;
    count: number;
    limit_up_days: string[];
  }>;
}

interface ProgressState {
  current: number;
  total: number;
  found: number;
  status: string;
  is_paused: boolean;
  progress: number;
  current_batch: number;
  total_batches: number;
  task_id: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const { t, locale } = useLanguage();
  const [screeningState, setScreeningState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockDetail | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total: 0,
    found: 0,
    status: 'idle',
    is_paused: false,
    progress: 0,
    current_batch: 0,
    total_batches: 0,
    task_id: null
  });
  const [lookbackDays, setLookbackDays] = useState([180]);
  const [minConsecutive, setMinConsecutive] = useState([3]);
  const [maxStocks, setMaxStocks] = useState(200);
  const [screenAll, setScreenAll] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentTaskResults, setCurrentTaskResults] = useState<StockInfo[]>([]);
  const [sectors, setSectors] = useState<{name: string, code: string, type: string}[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("");

  // 获取所有板块
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sectors`);
        if (res.ok) {
          const data = await res.json();
          setSectors(data.sectors);
        }
      } catch (err) {
        console.error('Failed to fetch sectors:', err);
      }
    };

    fetchSectors();
  }, []);

  // 轮询进度
  useEffect(() => {
    if (screeningState === 'idle') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/screen/progress`);
        if (res.ok) {
          const data = await res.json();
          setProgress(data);

          // 更新状态
          if (data.status.includes('running')) {
            setScreeningState('running');
          } else if (data.status.includes('已暂停')) {
            setScreeningState('paused');
          } else if (data.status.includes('完成') || data.status.includes('已取消') || data.status.includes('错误')) {
            setScreeningState('idle');
            // 获取结果
            const resultsRes = await fetch(`${API_BASE}/api/screen/results`);
            if (resultsRes.ok) {
              const results = await resultsRes.json();
              setStocks(results);
              setCurrentTaskResults(results);
              if (results.length === 0) {
                setError(t.noResultsDesc);
              } else {
                setError("");
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [screeningState, t.noResultsDesc]);

  const handleStart = async () => {
    setError("");
    setStocks([]);
    setSelectedStock(null);
    setCurrentTaskResults([]);

    try {
      const url = new URL(`${API_BASE}/api/screen/start`);
      url.searchParams.append('lookback_days', String(lookbackDays[0]));
      url.searchParams.append('max_stocks', String(maxStocks));
      url.searchParams.append('screen_all', String(screenAll));
      url.searchParams.append('batch_size', '500');
      if (selectedSector) {
        url.searchParams.append('sector', selectedSector);
      }

      const res = await fetch(url.toString(), { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setScreeningState('running');
        setProgress(prev => ({ ...prev, task_id: data.task_id, total_batches: data.batches || 1 }));
      } else {
        setError(`API Error: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.unknown);
    }
  };

  const handlePause = async () => {
    await fetch(`${API_BASE}/api/screen/pause`, { method: 'POST' });
    setScreeningState('paused');
  };

  const handleResume = async () => {
    await fetch(`${API_BASE}/api/screen/resume`, { method: 'POST' });
    setScreeningState('running');
  };

  const handleCancel = async () => {
    await fetch(`${API_BASE}/api/screen/cancel`, { method: 'POST' });
    setScreeningState('idle');
  };

  const handleSelectStock = async (tsCode: string, name: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/stock/${tsCode}?lookback_days=${lookbackDays[0]}`);

      if (!response.ok) {
        throw new Error("Failed to fetch stock details");
      }

      const data = await response.json();
      setSelectedStock(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.unknown);
    }
  };

  const handleLoadHistoryResults = (results: StockInfo[]) => {
    setStocks(results);
    setCurrentTaskResults(results);
    setSelectedStock(null);
    setShowHistory(false);
  };

  // 计算统计数据
  const stats = useMemo(() => {
    if (stocks.length === 0) return null;
    return {
      totalCount: stocks.length,
      avgDrop: stocks.reduce((sum, s) => sum + s.drop_ratio, 0) / stocks.length,
      maxDrop: Math.max(...stocks.map(s => s.drop_ratio)),
      maxLimitUp: Math.max(...stocks.map(s => s.limit_up_count)),
    };
  }, [stocks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {t.title}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 数据源指示 */}
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              AkShare
            </div>
            <HistoryButton
              isOpen={showHistory}
              onOpenChange={setShowHistory}
              onLoadResults={handleLoadHistoryResults}
            />
            <LanguageSwitcher />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Filter Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  {t.filterConditions}
                </CardTitle>
                <CardDescription>{t.filterDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="lookback">{t.lookbackDays}: {lookbackDays[0]}{t.days}</Label>
                    <Slider
                      id="lookback"
                      min={60}
                      max={365}
                      step={30}
                      value={lookbackDays}
                      onValueChange={setLookbackDays}
                      className="py-4"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="consecutive">{t.minConsecutive}: {minConsecutive[0]}{t.times}</Label>
                    <Slider
                      id="consecutive"
                      min={2}
                      max={10}
                      step={1}
                      value={minConsecutive}
                      onValueChange={setMinConsecutive}
                      className="py-4"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="maxStocks">
                      {locale === 'zh' ? '筛选数量' : 'Stocks'}: {screenAll ? (locale === 'zh' ? '全部' : 'All') : maxStocks}
                    </Label>
                    <Slider
                      id="maxStocks"
                      min={50}
                      max={500}
                      step={50}
                      value={[maxStocks]}
                      onValueChange={(v) => setMaxStocks(v[0])}
                      className="py-4"
                      disabled={screenAll}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="sector">{locale === 'zh' ? '板块选择' : 'Sector'}: {selectedSector || (locale === 'zh' ? '全部' : 'All')}</Label>
                    <select
                      id="sector"
                      value={selectedSector}
                      onChange={(e) => setSelectedSector(e.target.value)}
                      className="w-full py-3 px-3 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{locale === 'zh' ? '全部' : 'All'}</option>
                      {sectors.map((sector) => (
                        <option key={sector.name} value={sector.name}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 全市场筛选开关 */}
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {locale === 'zh' ? '全市场筛选' : 'Screen All Stocks'}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {locale === 'zh'
                          ? '筛选全部A股约4000+只股票（自动分批处理）'
                          : 'Screen all ~4000+ A-share stocks (auto batch processing)'}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={screenAll}
                    onCheckedChange={setScreenAll}
                  />
                </div>

                {/* 进度条 */}
                {screeningState !== 'idle' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        {progress.status}
                        {progress.total_batches > 1 && (
                          <span className="ml-2 text-blue-600 font-medium">
                            ({locale === 'zh' ? '批次' : 'Batch'} {progress.current_batch}/{progress.total_batches})
                          </span>
                        )}
                        <span className="ml-2">({progress.current}/{progress.total})</span>
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {locale === 'zh' ? '找到' : 'Found'}: {progress.found}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progress.progress, 100)}%` }}
                      />
                    </div>
                    {progress.total_batches > 1 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {locale === 'zh' ? '总进度' : 'Total progress'}: {progress.progress}%
                      </div>
                    )}
                  </div>
                )}

                {/* 控制按钮 */}
                <div className="flex gap-3">
                  {screeningState === 'idle' && (
                    <Button
                      onClick={handleStart}
                      size="lg"
                      className="w-full md:w-auto"
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      {t.startScreen}
                      {screenAll && (
                        <span className="ml-2 text-sm opacity-70">
                          ({locale === 'zh' ? '全市场' : 'All'})
                        </span>
                      )}
                    </Button>
                  )}

                  {screeningState === 'running' && (
                    <>
                      <Button
                        onClick={handlePause}
                        variant="outline"
                        size="lg"
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        {locale === 'zh' ? '暂停' : 'Pause'}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="destructive"
                        size="lg"
                      >
                        <X className="mr-2 h-4 w-4" />
                        {locale === 'zh' ? '取消' : 'Cancel'}
                      </Button>
                    </>
                  )}

                  {screeningState === 'paused' && (
                    <>
                      <Button
                        onClick={handleResume}
                        size="lg"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {locale === 'zh' ? '继续' : 'Resume'}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="destructive"
                        size="lg"
                      >
                        <X className="mr-2 h-4 w-4" />
                        {locale === 'zh' ? '取消' : 'Cancel'}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* No Results Alert */}
            {error && (
              <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      {locale === 'zh' ? '未找到符合条件的股票' : 'No matching stocks found'}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      {locale === 'zh' ? `已筛选 ${progress.current} 只股票` : `Screened ${progress.current} stocks`} ·
                      {locale === 'zh' ? ' 条件：' : ' Criteria: '}
                      {locale === 'zh' ? `${lookbackDays[0]}天内` : `${lookbackDays[0]} days`} ·
                      {locale === 'zh' ? `≥${minConsecutive[0]}次连续涨停` : `≥${minConsecutive[0]} limit-ups`}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      {locale === 'zh' ? '💡 建议调整：' : '💡 Suggestions: '}
                      {minConsecutive[0] >= 3 && (locale === 'zh' ? '降低连续涨停次数 ' : 'reduce limit-up count ')}
                      {lookbackDays[0] < 240 && (locale === 'zh' ? '· 增加回溯天数 ' : '· increase lookback days ')}
                      {!screenAll && maxStocks < 500 && (locale === 'zh' ? '· 使用全市场筛选' : '· use all stocks mode')}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Results Summary */}
            {stats && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>{t.screenResults}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalCount}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{t.matchingStocks}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.avgDrop.toFixed(1)}%
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{t.avgDropRatio}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {stats.maxDrop.toFixed(1)}%
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{t.maxDropRatio}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {stats.maxLimitUp}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{t.maxLimitUp}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stock Table */}
            {stocks.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>{t.stockList}</CardTitle>
                  <CardDescription>{t.stockListDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <StockTable stocks={stocks} onSelect={handleSelectStock} selectedCode={selectedStock?.ts_code} />
                </CardContent>
              </Card>
            )}

            {/* Chart */}
            {selectedStock && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{selectedStock.name} ({selectedStock.ts_code})</span>
                  </CardTitle>
                  <CardDescription>
                    {locale === 'zh' ? '股价走势图（红色标记为涨停日）' : 'Price chart (red dots = limit-up days)'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StockChart
                    dailyData={selectedStock.daily_data}
                    limitUpDays={selectedStock.limit_up_periods.flatMap(p => p.limit_up_days)}
                    startPrice={stocks.find(s => s.ts_code === selectedStock.ts_code)?.start_price}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* 状态说明 */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-sm">{locale === 'zh' ? '使用说明' : 'Usage'}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <p>• {locale === 'zh' ? '普通模式：建议每次筛选 200-500 只股票' : 'Normal: 200-500 stocks/batch'}</p>
                <p>• {locale === 'zh' ? '全市场模式：自动分批筛选全部A股' : 'All stocks: Auto batch all A-shares'}</p>
                <p>• {locale === 'zh' ? '可暂停/继续筛选过程' : 'Pause/resume supported'}</p>
                <p>• {locale === 'zh' ? '点击历史按钮查看过往任务' : 'Click history for past tasks'}</p>
                <p>• {locale === 'zh' ? '数据来源: AkShare' : 'Data: AkShare'}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} onLoadResults={handleLoadHistoryResults} />}
    </div>
  );
}

// History Panel Component
interface HistoryPanelProps {
  onClose: () => void;
  onLoadResults: (results: StockInfo[]) => void;
}

interface TaskRecord {
  id: number;
  task_id: string;
  status: string;
  lookback_days: number;
  max_stocks: number;
  total_stocks: number;
  processed_stocks: number;
  found_count: number;
  start_time: string;
  end_time: string | null;
  created_at: string;
}

function HistoryPanel({ onClose, onLoadResults }: HistoryPanelProps) {
  const { locale } = useLanguage();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<StockInfo[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskResults = async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/results`);
      if (res.ok) {
        const results = await res.json();
        setTaskResults(results);
        setSelectedTask(taskId);
      }
    } catch (err) {
      console.error('Failed to fetch task results:', err);
    }
  };

  const handleDelete = async (taskId: string) => {
    setDeleting(taskId);
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.task_id !== taskId));
      if (selectedTask === taskId) {
        setSelectedTask(null);
        setTaskResults([]);
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === '完成') return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">完成</span>;
    if (status === '已取消') return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">已取消</span>;
    if (status === 'running') return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">运行中</span>;
    if (status.startsWith('错误')) return <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">错误</span>;
    return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">{status}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-xl font-bold">{locale === 'zh' ? '历史任务' : 'Task History'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(80vh-60px)]">
          {/* Task List */}
          <div className="w-1/2 border-r dark:border-slate-700 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                {locale === 'zh' ? '暂无历史任务' : 'No history tasks'}
              </div>
            ) : (
              <div className="divide-y dark:divide-slate-700">
                {tasks.map((task) => (
                  <div
                    key={task.task_id}
                    className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                      selectedTask === task.task_id ? 'bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                    onClick={() => fetchTaskResults(task.task_id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                        {task.task_id}
                      </span>
                      {getStatusBadge(task.status)}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {new Date(task.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {task.processed_stocks}/{task.total_stocks} {locale === 'zh' ? '只股票' : 'stocks'}
                      {task.found_count > 0 && (
                        <span className="ml-2 text-green-600">
                          {locale === 'zh' ? '找到' : 'Found'}: {task.found_count}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task Detail */}
          <div className="w-1/2 overflow-y-auto p-4">
            {selectedTask ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">{locale === 'zh' ? '筛选结果' : 'Results'}</h3>
                  <div className="flex gap-2">
                    {taskResults.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onLoadResults(taskResults)}
                      >
                        {locale === 'zh' ? '加载到主界面' : 'Load'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(selectedTask)}
                      disabled={deleting === selectedTask}
                    >
                      {deleting === selectedTask ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {taskResults.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    {locale === 'zh' ? '该任务无结果' : 'No results for this task'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {taskResults.map((stock, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => onLoadResults(taskResults)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{stock.name} ({stock.ts_code})</div>
                            <div className="text-xs text-slate-500">{stock.start_date}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-600 font-medium">{stock.drop_ratio.toFixed(1)}%</div>
                            <div className="text-xs text-slate-500">{stock.limit_up_count} {locale === 'zh' ? '连板' : 'up'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-slate-500 text-center py-8">
                {locale === 'zh' ? '选择一个任务查看详情' : 'Select a task to view details'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple History Button Component
interface HistoryButtonProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadResults: (results: StockInfo[]) => void;
}

function HistoryButton({ isOpen, onOpenChange, onLoadResults }: HistoryButtonProps) {
  const { locale } = useLanguage();
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/tasks/stats`)
      .then(res => res.json())
      .then(data => setTaskCount(data.total_tasks || 0))
      .catch(() => {});
  }, [isOpen]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onOpenChange(!isOpen)}
      className="relative"
    >
      <Database className="h-4 w-4 mr-2" />
      {locale === 'zh' ? '历史' : 'History'}
      {taskCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {taskCount}
        </span>
      )}
    </Button>
  );
}
