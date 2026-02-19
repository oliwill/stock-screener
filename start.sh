#!/bin/bash
# 启动后端和前端

cd "$(dirname "$0")"

# 启动后端
echo "启动后端..."
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "后端PID: $BACKEND_PID"

# 等待后端启动
sleep 3

# 启动前端
echo "启动前端..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "前端PID: $FRONTEND_PID"

echo ""
echo "=========================================="
echo "后端地址: http://localhost:8000"
echo "前端地址: http://localhost:3000"
echo "API文档: http://localhost:8000/docs"
echo "=========================================="
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待中断信号
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

wait
