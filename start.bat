@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ================================
echo A股涨停回踩筛选器
echo ================================
echo.

cd /d "%~dp0"

:: 检查Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.9+
    pause
    exit /b 1
)

:: 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Node.js，请先安装Node.js 18+
    pause
    exit /b 1
)

echo [1/2] 启动后端服务...
cd backend
if not exist venv (
    echo 创建虚拟环境...
    python -m venv venv
)

call venv\Scripts\activate.bat

:: 检查是否需要安装依赖
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo 安装后端依赖...
    pip install -r requirements.txt
)

start "Stock Screener Backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] 启动前端服务...
cd ..\frontend

:: 检查是否需要安装依赖
if not exist node_modules (
    echo 安装前端依赖...
    call npm install
)

start "Stock Screener Frontend" cmd /k "npm run dev"

echo.
echo ================================
echo 服务启动完成！
echo ================================
echo 后端API: http://localhost:8000
echo 前端界面: http://localhost:3000
echo API文档: http://localhost:8000/docs
echo ================================
echo.
echo 按任意键关闭此窗口（服务将继续运行）
pause >nul
