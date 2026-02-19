# A股涨停回踩筛选器

筛选半年内有过连续涨停且回落至启动价下方的股票。

## 功能特点

- 自动筛选符合"连续涨停后回落"条件的A股股票
- 可调节回溯天数和最小连续涨停次数
- 交互式图表展示股价走势和涨停点
- 实时数据更新（使用 AkShare 数据源）
- **暂停/继续筛选**：支持暂停和取消正在进行的筛选任务
- **进度条显示**：实时显示筛选进度和已找到的股票数量
- **多语言支持**：简体中文/英文切换
- **批量筛选**：可设置每次筛选的股票数量（免费账户建议 200）

## 界面预览

- 右上角：语言切换按钮
- 筛选条件卡片：显示回溯天数、连续涨停次数、筛选数量滑块
- 筛选中显示进度条和暂停/取消按钮
- 暂停后显示继续/取消按钮

## 筛选条件

- 排除 ST 股票和新股（上市不足半年）
- 连续涨停 >= 3 次（可调整）
- 当前价格 < 第一次涨停收盘价

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 前端
cd ../frontend
npm install
```

### 2. 配置 Token（可选）

编辑 `backend/.env` 文件，设置你的 Tushare Token（主要使用 AkShare，此项可选）：

```
TUSHARE_TOKEN=your_token_here
```

### 3. 启动服务

使用启动脚本（同时启动前后端）：
```bash
./start.sh
```

或分别启动：
```bash
# 终端1 - 启动后端
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 终端2 - 启动前端
cd frontend
npm run dev
```

### 4. 访问应用

- 前端界面: http://localhost:3000
- API 文档: http://localhost:8000/docs

## 数据来源

- **主要数据源**: AkShare (免费，无需注册)

## API 端点

| 端点 | 说明 |
|------|------|
| `POST /api/screen/start` | 启动筛选任务 |
| `POST /api/screen/pause` | 暂停筛选 |
| `POST /api/screen/resume` | 继续筛选 |
| `POST /api/screen/cancel` | 取消筛选 |
| `GET /api/screen/progress` | 获取筛选进度 |
| `GET /api/screen/results` | 获取筛选结果 |
| `GET /api/stock/{code}` | 获取股票详情 |
| `GET /api/health` | 健康检查 |

## 使用说明

1. 设置筛选条件（回溯天数、连续涨停次数、筛选数量）
2. 点击"开始筛选"
3. 筛选过程中可以：
   - 查看进度条和已找到的股票数量
   - 点击"暂停"暂停筛选
   - 点击"继续"恢复筛选
   - 点击"取消"放弃当前筛选
4. 筛选完成后查看股票列表和走势图

## 免责声明

本工具仅供学习研究使用，不构成任何投资建议。股市有风险，投资需谨慎。
