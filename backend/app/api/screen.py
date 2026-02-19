from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
import threading

from ..core.tushare_client import (
    tushare_client,
    set_cancel_state,
    set_pause_state,
    get_cancel_state,
    reset_control_flags
)
from ..models import StockInfo

router = APIRouter(prefix="/api", tags=["screen"])
executor = ThreadPoolExecutor(max_workers=1)

# 全局进度状态
_progress_state = {
    "current": 0,
    "total": 0,
    "found": 0,
    "status": "idle",
    "is_paused": False,
    "lock": threading.Lock()
}

_progress_results = []


def _progress_callback(current: int, total: int, found: int, status: str):
    """进度回调函数"""
    with _progress_state["lock"]:
        _progress_state["current"] = current
        _progress_state["total"] = total
        _progress_state["found"] = found
        _progress_state["status"] = status


def _run_screen_task(lookback_days: int, max_stocks: int):
    """后台筛选任务"""
    global _progress_results
    try:
        results = tushare_client.screen_stocks_progressive(
            lookback_days=lookback_days,
            max_stocks=max_stocks,
            progress_callback=_progress_callback
        )
        with _progress_state["lock"]:
            _progress_results = results
            if _progress_state["status"] != "已取消":
                _progress_state["status"] = "完成"
    except Exception as e:
        with _progress_state["lock"]:
            _progress_state["status"] = f"错误: {str(e)}"


@router.get("/screen", response_model=list[StockInfo])
async def screen_stocks(
    lookback_days: int = 180,
    min_consecutive: int = 3,
    max_stocks: int = 200
):
    """
    筛选股票（同步版本，用于兼容）
    - lookback_days: 回溯天数（默认180天）
    - min_consecutive: 最小连续涨停次数（默认3次）
    - max_stocks: 最多处理股票数（默认200）
    """
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            executor,
            lambda: tushare_client.screen_stocks(lookback_days=lookback_days, max_stocks=max_stocks)
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/screen/start")
async def start_screen(
    lookback_days: int = 180,
    max_stocks: int = 200,
    background_tasks: BackgroundTasks = None
):
    """启动筛选任务"""
    with _progress_state["lock"]:
        if _progress_state["status"] == "running":
            return {"message": "筛选任务已在运行中"}

        _progress_state["status"] = "running"
        _progress_state["current"] = 0
        _progress_state["found"] = 0

    reset_control_flags()

    # 在后台线程中运行筛选任务
    thread = threading.Thread(
        target=_run_screen_task,
        args=(lookback_days, max_stocks)
    )
    thread.daemon = True
    thread.start()

    return {"message": "筛选任务已启动"}


@router.post("/screen/pause")
async def pause_screen():
    """暂停筛选任务"""
    set_pause_state(True)
    with _progress_state["lock"]:
        _progress_state["is_paused"] = True
        _progress_state["status"] = "已暂停"
    return {"message": "已暂停"}


@router.post("/screen/resume")
async def resume_screen():
    """继续筛选任务"""
    set_pause_state(False)
    with _progress_state["lock"]:
        _progress_state["is_paused"] = False
        _progress_state["status"] = "running"
    return {"message": "已继续"}


@router.post("/screen/cancel")
async def cancel_screen():
    """取消筛选任务"""
    set_cancel_state(True)
    set_pause_state(False)  # 先解除暂停
    return {"message": "正在取消..."}


@router.get("/screen/progress")
async def get_screen_progress():
    """获取筛选进度"""
    with _progress_state["lock"]:
        return {
            "current": _progress_state["current"],
            "total": _progress_state["total"],
            "found": _progress_state["found"],
            "status": _progress_state["status"],
            "is_paused": _progress_state["is_paused"],
            "progress": round(_progress_state["current"] / _progress_state["total"] * 100, 1) if _progress_state["total"] > 0 else 0
        }


@router.get("/screen/results", response_model=list[StockInfo])
async def get_screen_results():
    """获取筛选结果"""
    global _progress_results
    return _progress_results


@router.get("/stock/{ts_code}")
async def get_stock_detail(ts_code: str, lookback_days: int = 180):
    """获取单只股票的详细信息"""
    from datetime import datetime, timedelta

    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y%m%d")

    try:
        loop = asyncio.get_event_loop()

        # 获取日线数据
        daily_data = await loop.run_in_executor(
            executor,
            lambda: tushare_client.get_daily_data(ts_code, start_date, end_date)
        )

        if daily_data.empty:
            raise HTTPException(status_code=404, detail="Stock not found")

        # 查找涨停日
        limit_up_periods = await loop.run_in_executor(
            executor,
            lambda: tushare_client.find_consecutive_limit_up(daily_data)
        )

        # 获取股票基本信息
        stock_list = await loop.run_in_executor(
            executor,
            lambda: tushare_client.get_stock_list()
        )
        stock_info = stock_list[stock_list['ts_code'] == ts_code]

        return {
            "ts_code": ts_code,
            "name": stock_info.iloc[0]['name'] if not stock_info.empty else "",
            "daily_data": daily_data.to_dict('records'),
            "limit_up_periods": limit_up_periods
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify-token")
async def verify_token():
    """验证 Tushare Token 是否有效"""
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            lambda: tushare_client.verify_token()
        )
        return result
    except Exception as e:
        return {"valid": False, "message": str(e), "last_trade_date": ""}


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok"}
