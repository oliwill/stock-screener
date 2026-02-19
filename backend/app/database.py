"""SQLite database for task history storage."""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import threading

DB_PATH = Path(__file__).parent.parent / "data" / "tasks.db"
_db_lock = threading.Lock()


def _init_db():
    """Initialize database and create tables if not exist."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Tasks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            lookback_days INTEGER,
            max_stocks INTEGER,
            total_stocks INTEGER DEFAULT 0,
            processed_stocks INTEGER DEFAULT 0,
            found_count INTEGER DEFAULT 0,
            start_time TEXT,
            end_time TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Task results table (stores stock results separately for efficiency)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            ts_code TEXT NOT NULL,
            name TEXT,
            start_date TEXT,
            start_price REAL,
            current_price REAL,
            limit_up_count INTEGER,
            drop_ratio REAL,
            industry TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks (task_id)
        )
    """)

    conn.commit()
    conn.close()


def create_task(
    task_id: str,
    lookback_days: int,
    max_stocks: int,
    total_stocks: int = 0
) -> int:
    """Create a new task record."""
    with _db_lock:
        _init_db()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        now = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO tasks
            (task_id, status, lookback_days, max_stocks, total_stocks, start_time, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (task_id, "running", lookback_days, max_stocks, total_stocks, now, now))

        task_db_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return task_db_id


def update_task_progress(
    task_id: str,
    processed_stocks: int,
    found_count: int,
    status: Optional[str] = None
):
    """Update task progress."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        if status:
            cursor.execute("""
                UPDATE tasks
                SET processed_stocks = ?, found_count = ?, status = ?
                WHERE task_id = ?
            """, (processed_stocks, found_count, status, task_id))
        else:
            cursor.execute("""
                UPDATE tasks
                SET processed_stocks = ?, found_count = ?
                WHERE task_id = ?
            """, (processed_stocks, found_count, task_id))

        conn.commit()
        conn.close()


def complete_task(
    task_id: str,
    status: str,
    found_count: int = None,
    error_message: str = None
):
    """Mark task as completed."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        end_time = datetime.now().isoformat()

        if found_count is not None:
            cursor.execute("""
                UPDATE tasks
                SET status = ?, end_time = ?, found_count = ?, error_message = ?
                WHERE task_id = ?
            """, (status, end_time, found_count, error_message, task_id))
        else:
            cursor.execute("""
                UPDATE tasks
                SET status = ?, end_time = ?, error_message = ?
                WHERE task_id = ?
            """, (status, end_time, error_message, task_id))

        conn.commit()
        conn.close()


def save_task_results(task_id: str, results: List[Dict[str, Any]]):
    """Save screening results for a task."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Clear existing results for this task
        cursor.execute("DELETE FROM task_results WHERE task_id = ?", (task_id,))

        # Insert new results
        for r in results:
            cursor.execute("""
                INSERT INTO task_results
                (task_id, ts_code, name, start_date, start_price, current_price,
                 limit_up_count, drop_ratio, industry)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task_id,
                r.get("ts_code"),
                r.get("name"),
                r.get("start_date"),
                r.get("start_price"),
                r.get("current_price"),
                r.get("limit_up_count"),
                r.get("drop_ratio"),
                r.get("industry", "")
            ))

        conn.commit()
        conn.close()


def get_tasks(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """Get list of tasks."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM tasks
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    """Get a single task by task_id."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM tasks WHERE task_id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()

        return dict(row) if row else None


def get_task_results(task_id: str) -> List[Dict[str, Any]]:
    """Get results for a specific task."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT ts_code, name, start_date, start_price, current_price,
                   limit_up_count, drop_ratio, industry
            FROM task_results
            WHERE task_id = ?
            ORDER BY drop_ratio DESC
        """, (task_id,))

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]


def delete_task(task_id: str) -> bool:
    """Delete a task and its results."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("DELETE FROM task_results WHERE task_id = ?", (task_id,))
        cursor.execute("DELETE FROM tasks WHERE task_id = ?", (task_id,))

        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()

        return deleted


def get_task_stats() -> Dict[str, Any]:
    """Get overall statistics."""
    with _db_lock:
        _init_db()  # Ensure tables exist
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Total tasks
        cursor.execute("SELECT COUNT(*) FROM tasks")
        total = cursor.fetchone()[0]

        # Completed tasks
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = '完成'")
        completed = cursor.fetchone()[0]

        # Running tasks
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = 'running'")
        running = cursor.fetchone()[0]

        # Failed tasks
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE status LIKE '错误%'")
        failed = cursor.fetchone()[0]

        # Total stocks found across all tasks
        cursor.execute("SELECT SUM(found_count) FROM tasks WHERE found_count IS NOT NULL")
        total_found = cursor.fetchone()[0] or 0

        conn.close()

        return {
            "total_tasks": total,
            "completed_tasks": completed,
            "running_tasks": running,
            "failed_tasks": failed,
            "total_stocks_found": total_found
        }
