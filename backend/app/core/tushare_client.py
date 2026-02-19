import tushare as ts
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Callable, Generator
import threading
from .config import settings

# 尝试导入 AkShare
try:
    import akshare as ak
    AKSHARE_AVAILABLE = True
except ImportError:
    AKSHARE_AVAILABLE = False

# 全局取消标志
_cancel_flag = threading.Event()
_pause_flag = threading.Event()

def get_cancel_state() -> tuple[bool, bool]:
    """获取当前的取消和暂停状态"""
    return _cancel_flag.is_set(), _pause_flag.is_set()

def set_cancel_state(cancel: bool = True):
    """设置取消状态"""
    if cancel:
        _cancel_flag.set()
    else:
        _cancel_flag.clear()

def set_pause_state(paused: bool = True):
    """设置暂停状态"""
    if paused:
        _pause_flag.set()
    else:
        _pause_flag.clear()

def reset_control_flags():
    """重置所有控制标志"""
    _cancel_flag.clear()
    _pause_flag.clear()


class DataClient:
    """数据客户端 - 支持 Tushare 和 AkShare 双数据源"""

    def __init__(self):
        self.ts: Optional[ts.TushareAPI] = None

    def connect(self):
        if not self.ts:
            self.ts = ts.pro_api(settings.tushare_token)
        return self.ts

    def verify_token(self) -> dict:
        """
        验证 Tushare Token 是否有效
        使用 trade_cal 接口（低消耗）来验证
        """
        try:
            pro = self.connect()
            # 获取最近的交易日历，这个接口消耗很低
            today = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=7)).strftime("%Y%m%d")

            cal_data = pro.trade_cal(exchange='SSE', start_date=start_date, end_date=today, fields='cal_date,is_open')

            if cal_data is not None and not cal_data.empty:
                return {
                    "valid": True,
                    "message": "Token 有效",
                    "last_trade_date": cal_data[cal_data['is_open'] == 1]['cal_date'].max() if not cal_data.empty else ""
                }
        except Exception as e:
            return {
                "valid": False,
                "message": f"Token 无效: {str(e)}",
                "last_trade_date": ""
            }

        return {
            "valid": False,
            "message": "无法获取交易日历",
            "last_trade_date": ""
        }

    def get_stock_list(self, exclude_st: bool = True, min_list_days: int = 180) -> pd.DataFrame:
        """获取股票列表，优先使用 AkShare（Tushare免费账户受限）"""

        # 方法1: 使用 AkShare
        if AKSHARE_AVAILABLE:
            try:
                # 获取A股实时行情数据
                df = ak.stock_zh_a_spot_em()

                # 转换列名 - AkShare 的列名是中文
                df = df.rename(columns={
                    '代码': 'ts_code',
                    '名称': 'name',
                    '最新价': 'price',
                    '涨跌幅': 'pct_chg',
                    '总市值': 'market_cap'
                })

                # 格式化股票代码 (000001.SZ 格式)
                def format_code(code):
                    if code.startswith('6') or code.startswith('5'):
                        return f"{code}.SH"
                    elif code.startswith('8') or code.startswith('4'):
                        return f"{code}.BJ"
                    else:
                        return f"{code}.SZ"

                df['ts_code'] = df['ts_code'].apply(format_code)

                # 排除ST股票
                if exclude_st:
                    df = df[~df['name'].str.contains('ST', na=False)]

                # 排除北交所
                df = df[~df['ts_code'].str.endswith('.BJ')]

                # 添加默认行业
                df['industry'] = ''

                print(f"AkShare 获取到 {len(df)} 只股票")
                return df[['ts_code', 'name', 'industry']]
            except Exception as e:
                print(f"AkShare 获取股票列表失败: {e}")

        # 方法2: 使用 Tushare
        try:
            pro = self.connect()

            # 使用更通用的接口
            df = pro.stock_basic(exchange='', list_status='L',
                                fields='ts_code,name,area,industry,list_date,market')

            if df is not None and not df.empty:
                # 排除ST股票
                if exclude_st:
                    df = df[~df['name'].str.contains('ST', na=False)]

                # 排除上市不足半年的股票
                df['list_date_dt'] = pd.to_datetime(df['list_date'], format='%Y%m%d', errors='coerce')
                min_date = datetime.now() - timedelta(days=min_list_days)
                df = df[df['list_date_dt'] <= min_date]

                # 排除北交所（B开头的股票）
                df = df[~df['ts_code'].str.startswith('BJ')]

                print(f"Tushare 获取到 {len(df)} 只股票")
                return df[['ts_code', 'name', 'industry']]
        except Exception as e:
            print(f"Tushare 获取股票列表失败: {e}")

        return pd.DataFrame()

    def get_daily_data(self, ts_code: str, start_date: str, end_date: str) -> pd.DataFrame:
        """获取股票日线数据，优先使用 AkShare"""

        # 方法1: 使用 AkShare
        if AKSHARE_AVAILABLE:
            try:
                # 转换代码格式 (000001.SZ -> 000001)
                ak_code = ts_code.split('.')[0]

                # 获取历史数据（不复权）
                df = ak.stock_zh_a_hist(symbol=ak_code, period="daily",
                                       start_date=start_date.replace('-', ''),
                                       end_date=end_date.replace('-', ''),
                                       adjust="")

                if df is None or df.empty:
                    return pd.DataFrame()

                # 转换列名 - AkShare 的列名是中文
                df = df.rename(columns={
                    '日期': 'trade_date',
                    '股票代码': 'code',
                    '开盘': 'open',
                    '收盘': 'close',
                    '最高': 'high',
                    '最低': 'low',
                    '成交量': 'vol',
                    '成交额': 'amount',
                    '涨跌幅': 'pct_chg',
                    '涨跌额': 'change',
                    '换手率': 'turnover'
                })

                # 添加 ts_code 列
                df['ts_code'] = ts_code

                # 计算前收盘价
                df = df.sort_values('trade_date').reset_index(drop=True)
                df['pre_close'] = df['close'].shift(1)

                # 格式化日期为 YYYYMMDD
                df['trade_date'] = pd.to_datetime(df['trade_date']).dt.strftime('%Y%m%d')

                # 返回需要的列
                return df[['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'pct_chg', 'vol', 'amount']]
            except Exception as e:
                print(f"AkShare 获取 {ts_code} 数据失败: {e}")

        # 方法2: 使用 Tushare
        try:
            pro = self.connect()
            df = pro.daily(ts_code=ts_code, start_date=start_date,
                          end_date=end_date,
                          fields='ts_code,trade_date,open,high,low,close,pre_close,pct_chg,vol,amount')

            if df is not None and not df.empty:
                df = df.sort_values('trade_date').reset_index(drop=True)
                return df
        except Exception as e:
            print(f"Tushare 获取 {ts_code} 数据失败: {e}")

        return pd.DataFrame()

    def find_consecutive_limit_up(self, df: pd.DataFrame, threshold: float = 9.5) -> list[dict]:
        """
        查找连续涨停

        返回符合条件的涨停区间列表：
        [{
            'start_date': str,  # 第一次涨停日期
            'start_price': float,  # 第一次涨停收盘价
            'count': int,  # 连续涨停次数
            'limit_up_days': list[str]  # 涨停日期列表
        }]
        """
        if df.empty:
            return []

        # 标记涨停日（涨幅 >= threshold%）
        df['is_limit_up'] = df['pct_chg'] >= threshold

        result = []
        current_streak = []

        for idx, row in df.iterrows():
            if row['is_limit_up']:
                current_streak.append({
                    'date': row['trade_date'],
                    'close': row['close'],
                    'pct_chg': row['pct_chg']
                })
            else:
                # 检查连续涨停是否满足条件（3次及以上）
                if len(current_streak) >= 3:
                    result.append({
                        'start_date': current_streak[0]['date'],
                        'start_price': current_streak[0]['close'],
                        'count': len(current_streak),
                        'limit_up_days': [x['date'] for x in current_streak]
                    })
                current_streak = []

        # 检查最后一段
        if len(current_streak) >= 3:
            result.append({
                'start_date': current_streak[0]['date'],
                'start_price': current_streak[0]['close'],
                'count': len(current_streak),
                'limit_up_days': [x['date'] for x in current_streak]
            })

        return result

    def screen_stocks_progressive(
        self,
        lookback_days: int = 180,
        max_stocks: int = 200,
        progress_callback: Optional[Callable] = None,
        start_offset: int = 0,
        reset_flags: bool = False
    ) -> list:
        """
        筛选股票（带进度回调，支持暂停/取消）

        Args:
            lookback_days: 回溯天数
            max_stocks: 最多处理的股票数量（免费账户建议100-200）
            progress_callback: 进度回调函数，参数 (current, total, found)
            start_offset: 从第几只股票开始（用于分批筛选）
            reset_flags: 是否重置控制标志（分批筛选时仅第一批重置）

        Returns:
            符合条件的股票列表
        """
        if reset_flags:
            reset_control_flags()  # 仅在第一批时重置控制标志

        end_date_obj = datetime.now()
        start_date_obj = end_date_obj - timedelta(days=lookback_days)

        # AkShare 使用日期格式 YYYYMMDD
        start_date = start_date_obj.strftime("%Y%m%d")
        end_date = end_date_obj.strftime("%Y%m%d")

        # 获取股票列表
        stock_list = self.get_stock_list()
        if stock_list.empty:
            if progress_callback:
                progress_callback(start_offset, start_offset, 0, "未获取到股票列表")
            return []

        # 使用 offset 和 limit 处理分批
        stock_list = stock_list.iloc[start_offset:start_offset + max_stocks]
        batch_total = len(stock_list)
        end_offset = start_offset + batch_total

        if progress_callback:
            progress_callback(start_offset, end_offset, 0, f"开始筛选 {batch_total} 只股票...")

        results = []

        for idx, stock in stock_list.iterrows():
            # 检查取消标志
            if _cancel_flag.is_set():
                if progress_callback:
                    progress_callback(start_offset + idx, end_offset, len(results), "已取消")
                break

            # 检查暂停标志
            while _pause_flag.is_set():
                if _cancel_flag.is_set():
                    break
                import time
                time.sleep(0.1)

            if _cancel_flag.is_set():
                break

            ts_code = stock['ts_code']
            name = stock['name']
            industry = stock.get('industry', '')

            # 获取日线数据
            daily_data = self.get_daily_data(ts_code, start_date, end_date)
            if daily_data.empty:
                continue

            # 查找连续涨停
            limit_up_periods = self.find_consecutive_limit_up(daily_data)

            # 检查是否满足条件
            current_price = daily_data.iloc[-1]['close']

            for period in limit_up_periods:
                if current_price < period['start_price']:
                    drop_ratio = (period['start_price'] - current_price) / period['start_price'] * 100
                    results.append({
                        'ts_code': ts_code,
                        'name': name,
                        'industry': industry,
                        'start_date': period['start_date'],
                        'start_price': float(period['start_price']),
                        'current_price': float(current_price),
                        'limit_up_count': period['count'],
                        'drop_ratio': float(drop_ratio),
                        'limit_up_days': period['limit_up_days']
                    })
                    break  # 只取第一个符合条件的

            # 进度回调 - 使用全局索引
            global_idx = start_offset + idx
            if progress_callback and (global_idx + 1) % 10 == 0:
                status = f"正在处理: {ts_code} {name}"
                progress_callback(global_idx + 1, end_offset, len(results), status)

        # 按回落幅度排序
        results.sort(key=lambda x: x['drop_ratio'], reverse=True)

        if progress_callback:
            if _cancel_flag.is_set():
                progress_callback(end_offset, end_offset, len(results), "已取消")
            else:
                progress_callback(end_offset, end_offset, len(results), "筛选完成")

        return results

    def screen_stocks(self, lookback_days: int = 180, max_stocks: int = 200) -> list:
        """
        筛选股票（简化版，不带进度回调）

        免费账户建议：
        - 每分钟限制 120 次调用
        - 每天限制 2000 次调用
        - 建议每次筛选不超过 200 只股票
        """
        return self.screen_stocks_progressive(
            lookback_days=lookback_days,
            max_stocks=max_stocks,
            progress_callback=None
        )


# 全局实例
data_client = DataClient()

# 兼容旧代码
tushare_client = data_client
