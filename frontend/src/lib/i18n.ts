export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

export interface Translations {
  title: string;
  description: string;
  filterConditions: string;
  filterDescription: string;
  lookbackDays: string;
  days: string;
  minConsecutive: string;
  times: string;
  startScreen: string;
  screening: string;
  screenResults: string;
  matchingStocks: string;
  avgDropRatio: string;
  maxDropRatio: string;
  maxLimitUp: string;
  stockList: string;
  stockListDescription: string;
  code: string;
  name: string;
  startPrice: string;
  currentPrice: string;
  dropRatio: string;
  limitUpCount: string;
  startDate: string;
  noResults: string;
  noResultsDesc: string;
  tokenUsage: string;
  userId: string;
  userName: string;
  memberType: string;
  expiredDate: string;
  score: string;
  refreshToken: string;
  unknown: string;
  language: string;
}

export const translations: Record<Locale, Translations> = {
  zh: {
    title: 'A股涨停回踩筛选器',
    description: '筛选半年内有过连续涨停且回落至启动价下方的股票',
    filterConditions: '筛选条件',
    filterDescription: '设置筛选条件，点击"开始筛选"查找符合条件的股票',
    lookbackDays: '回溯天数',
    days: '天',
    minConsecutive: '最小连续涨停',
    times: '次',
    startScreen: '开始筛选',
    screening: '筛选中...',
    screenResults: '筛选结果',
    matchingStocks: '符合条件股票',
    avgDropRatio: '平均回落幅度',
    maxDropRatio: '最大回落幅度',
    maxLimitUp: '最多连续涨停',
    stockList: '股票列表',
    stockListDescription: '点击表格行查看K线图和涨停详情',
    code: '代码',
    name: '名称',
    startPrice: '启动价',
    currentPrice: '现价',
    dropRatio: '回落幅度',
    limitUpCount: '连续涨停',
    startDate: '启动日期',
    noResults: '未找到符合条件的股票',
    noResultsDesc: '请调整筛选条件后重试',
    tokenUsage: 'Token 使用情况',
    userId: '用户ID',
    userName: '用户名',
    memberType: '会员类型',
    expiredDate: '过期日期',
    score: '积分',
    refreshToken: '刷新',
    unknown: '未知',
    language: '语言',
  },
  en: {
    title: 'A-Share Limit-Up Pullback Screener',
    description: 'Screen stocks that had consecutive limit-ups and pulled back below the start price within 6 months',
    filterConditions: 'Filter Conditions',
    filterDescription: 'Set filter criteria and click "Start Screening" to find matching stocks',
    lookbackDays: 'Lookback Days',
    days: 'days',
    minConsecutive: 'Min Consecutive Limit-Ups',
    times: 'times',
    startScreen: 'Start Screening',
    screening: 'Screening...',
    screenResults: 'Screen Results',
    matchingStocks: 'Matching Stocks',
    avgDropRatio: 'Avg Drop Ratio',
    maxDropRatio: 'Max Drop Ratio',
    maxLimitUp: 'Max Limit-Ups',
    stockList: 'Stock List',
    stockListDescription: 'Click a row to view chart and limit-up details',
    code: 'Code',
    name: 'Name',
    startPrice: 'Start Price',
    currentPrice: 'Current Price',
    dropRatio: 'Drop Ratio',
    limitUpCount: 'Limit-Ups',
    startDate: 'Start Date',
    noResults: 'No matching stocks found',
    noResultsDesc: 'Please adjust filter criteria and try again',
    tokenUsage: 'Token Usage',
    userId: 'User ID',
    userName: 'User Name',
    memberType: 'Member Type',
    expiredDate: 'Expired Date',
    score: 'Score',
    refreshToken: 'Refresh',
    unknown: 'Unknown',
    language: 'Language',
  },
};

export function getT(locale: Locale): Translations {
  return translations[locale];
}
