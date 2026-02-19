# A股涨停回踩筛选器 - PowerShell启动脚本
# 需要PowerShell 5.1+

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "A股涨停回踩筛选器" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 切换到脚本目录
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptPath

# 检查Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] 未找到Python，请先安装Python 3.9+" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 检查Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] 未找到Node.js，请先安装Node.js 18+" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "[1/2] 启动后端服务..." -ForegroundColor Yellow

# 后端目录
$backendDir = Join-Path $ScriptPath "backend"
Set-Location $backendDir

# 创建虚拟环境（如果不存在）
if (-not (Test-Path "venv")) {
    Write-Host "创建虚拟环境..." -ForegroundColor Gray
    python -m venv venv
}

# 激活虚拟环境
& ".\venv\Scripts\Activate.ps1"

# 检查依赖
$depsInstalled = pip show fastapi 2>$null
if (-not $depsInstalled) {
    Write-Host "安装后端依赖..." -ForegroundColor Gray
    pip install -r requirements.txt
}

# 启动后端
$backendProcess = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" -PassThru -WindowStyle Minimized
Write-Host "[OK] 后端PID: $($backendProcess.Id)" -ForegroundColor Green

Write-Host "[2/2] 启动前端服务..." -ForegroundColor Yellow

# 前端目录
$frontendDir = Join-Path $ScriptPath "frontend"
Set-Location $frontendDir

# 检查依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "安装前端依赖..." -ForegroundColor Gray
    npm install
}

# 启动前端
$frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Minimized
Write-Host "[OK] 前端PID: $($frontendProcess.Id)" -ForegroundColor Green

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "服务启动完成！" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host "后端API: http://localhost:8000" -ForegroundColor White
Write-Host "前端界面: http://localhost:3000" -ForegroundColor White
Write-Host "API文档: http://localhost:8000/docs" -ForegroundColor White
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按Ctrl+C停止所有服务" -ForegroundColor Yellow

# 等待用户中断
try {
    Wait-Process -Id $backendProcess.Id, $frontendProcess.Id
} finally {
    Write-Host ""
    Write-Host "停止服务..." -ForegroundColor Yellow
    Stop-Process -Id $backendProcess.Id, $frontendProcess.Id -Force
    Write-Host "服务已停止" -ForegroundColor Green
}
