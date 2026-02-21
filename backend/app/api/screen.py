"""Stock screening API with task history and batch processing."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from typing import Optional, List
import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
import threading
from datetime import datetime

from ..core.tushare_client import (
    tushare_client,
    set_cancel_state,
    set_pause_state,
    get_cancel_state,
    reset_control_flags
)
from ..models import StockInfo
from ..database import (
    create_task,
    update_task_progress,
    complete_task,
    save_task_results,
    get_tasks,
    get_task,
    get_task_results,
    delete_task,
    get_task_stats
)

router = APIRouter(prefix="/api", tags=["screen"])
executor = ThreadPoolExecutor(max_workers=1)

# 全局进度状态
_progress_state = {
    "current": 0,
    "total": 0,
    "found": 0,
    "status": "idle",
    "is_paused": False,
    "current_batch": 0,
    "total_batches": 0,
    "task_id": None,
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

        # Update database with progress
        if _progress_state.get("task_id"):
            update_task_progress(
                _progress_state["task_id"],
                current,
                found,
                status if status in ["running", "已暂停"] else None
            )


def _run_batch_screen_task(
    task_id: str,
    lookback_days: int,
    max_stocks: int,
    screen_all: bool = False,
    batch_size: int = 500,
    sector: str = ""
):
    """后台批量筛选任务"""
    global _progress_results

    try:
        # Get stock list first to determine batches
        stock_list = tushare_client.get_stock_list(sector=sector if sector else None)

        if stock_list.empty:
            with _progress_state["lock"]:
                _progress_state["status"] = "完成"
                _progress_state["error"] = "未获取到股票列表"
            complete_task(task_id, "完成", found_count=0)
            return

        if screen_all:
            total_stocks = len(stock_list)
            batches = (total_stocks + batch_size - 1) // batch_size
        else:
            total_stocks = min(max_stocks, len(stock_list))
            batches = 1

        all_results = []
        current_batch = 0

        with _progress_state["lock"]:
            _progress_state["total_batches"] = batches
            _progress_state["total"] = total_stocks
            _progress_state["current_batch"] = 0

        for batch_idx in range(batches):
            # Check for cancellation
            if get_cancel_state():
                with _progress_state["lock"]:
                    _progress_state["status"] = "已取消"
                complete_task(task_id, "已取消", found_count=len(all_results))
                return

            # Handle pause
            while get_cancel_state() == False and _progress_state.get("is_paused", False):
                threading.Event().wait(0.1)

            if get_cancel_state():
                complete_task(task_id, "已取消", found_count=len(all_results))
                return

            current_batch = batch_idx + 1
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, total_stocks)

            with _progress_state["lock"]:
                _progress_state["current_batch"] = current_batch

            # Process this batch - only reset flags on first batch
            batch_results = tushare_client.screen_stocks_progressive(
                lookback_days=lookback_days,
                max_stocks=end_idx - start_idx,
                progress_callback=lambda c, t, f, s: _progress_callback(
                    c, total_stocks, len(all_results) + f, s
                ),
                start_offset=start_idx,
                reset_flags=(batch_idx == 0)  # 仅第一批重置标志
            )

            all_results.extend(batch_results)

            # Update progress
            with _progress_state["lock"]:
                _progress_results = all_results
                _progress_state["found"] = len(all_results)

            # Save intermediate results
            save_task_results(task_id, all_results)
            update_task_progress(task_id, end_idx, len(all_results))

        # All batches complete
        with _progress_state["lock"]:
            _progress_results = all_results
            _progress_state["status"] = "完成"
            _progress_state["found"] = len(all_results)

        save_task_results(task_id, all_results)
        complete_task(task_id, "完成", found_count=len(all_results))

    except Exception as e:
        with _progress_state["lock"]:
            _progress_state["status"] = f"错误: {str(e)}"
        complete_task(_progress_state.get("task_id", ""), f"错误: {str(e)}")


@router.post("/screen/start")
async def start_screen(
    lookback_days: int = Query(180, description="回溯天数"),
    max_stocks: int = Query(200, description="最多处理股票数"),
    screen_all: bool = Query(False, description="是否筛选全部股票"),
    batch_size: int = Query(500, description="分批筛选时每批数量"),
    sector: str = Query("", description="板块名称")
):
    """启动筛选任务

    Args:
        lookback_days: 回溯天数（默认180天）
        max_stocks: 最多处理股票数（默认200），screen_all=True时忽略
        screen_all: 是否筛选全部A股（约4000+只）
        batch_size: 分批筛选时每批数量（默认500）
        sector: 板块名称（可选）
    """
    with _progress_state["lock"]:
        if _progress_state["status"] == "running":
            return {"message": "筛选任务已在运行中", "task_id": _progress_state.get("task_id")}

        # Generate new task ID
        task_id = f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        _progress_state["task_id"] = task_id
        _progress_state["status"] = "running"
        _progress_state["current"] = 0
        _progress_state["found"] = 0
        _progress_state["current_batch"] = 0
        _progress_state["total_batches"] = 0

    reset_control_flags()

    # Create task record
    total_stocks = 999999 if screen_all else max_stocks
    create_task(task_id, lookback_days, max_stocks, total_stocks)

    # Start background thread
    thread = threading.Thread(
        target=_run_batch_screen_task,
        args=(task_id, lookback_days, max_stocks, screen_all, batch_size, sector)
    )
    thread.daemon = True
    thread.start()

    return {
        "message": "筛选任务已启动",
        "task_id": task_id,
        "screen_all": screen_all,
        "batches": _progress_state.get("total_batches", 1)
    }


@router.post("/screen/pause")
async def pause_screen():
    """暂停筛选任务"""
    set_pause_state(True)
    with _progress_state["lock"]:
        _progress_state["is_paused"] = True
        _progress_state["status"] = "已暂停"
        if _progress_state.get("task_id"):
            update_task_progress(
                _progress_state["task_id"],
                _progress_state["current"],
                _progress_state["found"],
                "已暂停"
            )
    return {"message": "已暂停"}


@router.post("/screen/resume")
async def resume_screen():
    """继续筛选任务"""
    set_pause_state(False)
    with _progress_state["lock"]:
        _progress_state["is_paused"] = False
        _progress_state["status"] = "running"
        if _progress_state.get("task_id"):
            update_task_progress(
                _progress_state["task_id"],
                _progress_state["current"],
                _progress_state["found"],
                "running"
            )
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
        batch_info = ""
        if _progress_state.get("total_batches", 0) > 1:
            batch_info = f" (批次 {_progress_state['current_batch']}/{_progress_state['total_batches']})"

        return {
            "current": _progress_state["current"],
            "total": _progress_state["total"],
            "found": _progress_state["found"],
            "status": f"{_progress_state['status']}{batch_info}",
            "is_paused": _progress_state["is_paused"],
            "current_batch": _progress_state.get("current_batch", 0),
            "total_batches": _progress_state.get("total_batches", 0),
            "task_id": _progress_state.get("task_id"),
            "progress": round(_progress_state["current"] / _progress_state["total"] * 100, 1)
                if _progress_state["total"] > 0 else 0
        }


@router.get("/screen/results", response_model=list[StockInfo])
async def get_screen_results():
    """获取当前筛选结果"""
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


# ==================== Task History APIs ====================

@router.get("/tasks")
async def list_tasks(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """获取任务历史列表"""
    tasks = get_tasks(limit, offset)
    return {"tasks": tasks}


@router.get("/tasks/stats")
async def get_statistics():
    """获取任务统计信息"""
    return get_task_stats()


@router.get("/tasks/{task_id}")
async def get_task_detail(task_id: str):
    """获取单个任务详情"""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/tasks/{task_id}/results")
async def get_task_result_stocks(task_id: str):
    """获取任务筛选结果"""
    results = get_task_results(task_id)
    return results


@router.delete("/tasks/{task_id}")
async def delete_task_record(task_id: str):
    """删除任务记录"""
    success = delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}


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


@router.get("/sectors")
async def get_sectors():
    """获取板块列表"""
    try:
        loop = asyncio.get_event_loop()
        sectors = await loop.run_in_executor(
            executor,
            lambda: tushare_client.get_sector_list()
        )
        return {"sectors": sectors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok"}
