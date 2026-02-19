from pydantic import BaseModel
from datetime import date


class StockInfo(BaseModel):
    ts_code: str  # 股票代码
    name: str  # 股票名称
    start_date: str  # 第一个涨停日期
    start_price: float  # 启动价（第一次涨停收盘价）
    current_price: float  # 当前价格
    limit_up_count: int  # 连续涨停次数
    drop_ratio: float  # 回落幅度
    industry: str  # 所属行业


class StockDetail(BaseModel):
    ts_code: str
    name: str
    daily_data: list[dict]  # 日线数据
    limit_up_days: list[str]  # 涨停日期列表
