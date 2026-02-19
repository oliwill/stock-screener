# A股涨停回踩筛选器 / A-Share Limit-Up Pullback Screener

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9+-green.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18+-brightgreen.svg)](https://nodejs.org/)

一个基于 FastAPI + Next.js 的A股股票筛选工具，帮助找出经历过连续涨停后出现回踩的股票。

A stock screening tool based on FastAPI + Next.js, designed to find A-share stocks that have experienced consecutive limit-ups followed by pullbacks.

## 功能特点 / Features

- 🎯 **智能筛选** - 自动筛选连续涨停后回踩的股票
- 📊 **可视化图表** - 交互式股价走势图，标记涨停日
- 🔄 **批量处理** - 支持全市场4000+只股票自动分批筛选
- ⏸️ **暂停/继续** - 筛选过程可随时暂停和恢复
- 📜 **历史记录** - 保存所有筛选任务，随时查看历史结果
- 🌍 **双语界面** - 支持中文/英文切换
- 📱 **响应式设计** - 适配桌面和移动设备

## 快速开始 / Quick Start

### 方法一：Docker (推荐 / Recommended)

```bash
# 克隆项目
git clone https://github.com/oliwill/stock-screener.git
cd stock-screener

# 复制环境变量文件（可选）
cp .env.example .env

# 启动服务
docker-compose up -d

# 访问
# 前端: http://localhost:3000
# 后端API: http://localhost:8000/docs
```

### 方法二：本地开发 / Local Development

#### 后端 / Backend

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（可选）
cp ../.env.example .env

# 启动后端
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 前端 / Frontend

```bash
cd frontend

# 安装依赖
npm install

# 配置环境变量
cp ../.env.example .env.local

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
npm start
```

#### 一键启动 / Quick Start

```bash
# 使用项目自带的启动脚本
./start.sh
```

## 环境依赖 / Dependencies

### 后端 / Backend

| 依赖 | 版本 | 说明 |
|------|------|------|
| Python | 3.9+ | 运行环境 |
| FastAPI | 0.115+ | Web 框架 |
| AkShare | 1.18+ | 主要数据源（免费） |
| Pandas | 2.2+ | 数据处理 |
| SQLite | 3 | 数据库（内置） |

### 前端 / Frontend

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 18+ | 运行环境 |
| React | 19 | UI 框架 |
| Next.js | 16 | SSR 框架 |
| TypeScript | 5+ | 类型系统 |
| Tailwind CSS | - | 样式框架 |

## 使用说明 / Usage Guide

### 筛选模式 / Screening Modes

1. **普通模式** - 筛选指定数量股票（200-500只）
2. **全市场模式** - 自动分批筛选全部A股（约4000+只）

### 筛选条件 / Screening Criteria

- **回溯天数** - 查找连续涨停的时间范围（60-365天）
- **最小连板** - 连续涨停次数（2-10次）
- **筛选数量** - 每次筛选的股票数量（50-500只）

### 历史任务 / Task History

点击右上角"历史"按钮查看过往筛选任务，可以：
- 查看任务详情和结果
- 重新加载历史结果到主界面
- 删除不需要的任务记录

## 项目结构 / Project Structure

```
stock-screener/
├── backend/
│   ├── app/
│   │   ├── api/          # API路由
│   │   ├── core/         # 核心逻辑
│   │   ├── database.py   # 数据库模块
│   │   └── main.py       # FastAPI入口
│   ├── data/             # SQLite数据库（自动创建）
│   └── requirements.txt  # Python依赖
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js页面
│   │   ├── components/   # React组件
│   │   └── lib/          # 工具函数
│   └── package.json      # Node依赖
├── docker-compose.yml    # Docker编排
├── Dockerfile            # Docker镜像
└── README.md
```

## API文档 / API Documentation

启动后端服务后访问：`http://localhost:8000/docs`

主要接口 / Main Endpoints:

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/screen/start` | 启动筛选任务 |
| POST | `/api/screen/pause` | 暂停任务 |
| POST | `/api/screen/resume` | 继续任务 |
| POST | `/api/screen/cancel` | 取消任务 |
| GET | `/api/screen/progress` | 获取进度 |
| GET | `/api/screen/results` | 获取结果 |
| GET | `/api/tasks` | 获取历史任务列表 |
| GET | `/api/tasks/{task_id}/results` | 获取历史任务结果 |
| GET | `/api/tasks/stats` | 获取任务统计 |
| DELETE | `/api/tasks/{task_id}` | 删除任务记录 |

## 数据源 / Data Sources

- **AkShare** (主要 / Primary) - 免费，无需注册
- **Tushare** (备用 / Fallback) - 需要 Token，用于数据验证

## 注意事项 / Notes

- 免费账户建议每次筛选 200-500 只股票
- 全市场筛选约需要 20-40 分钟（取决于网络速度）
- 数据仅供参考，不构成投资建议

## 常见问题 / FAQ

**Q: 为什么使用 AkShare 而不是 Tushare？**
A: AkShare 完全免费且无需注册，更适合个人使用。Tushare 免费版有调用次数限制。

**Q: 全市场筛选需要多长时间？**
A: 约 20-40 分钟，取决于网络速度和 AkShare 的响应速度。

**Q: 可以暂停后继续吗？**
A: 可以，点击暂停按钮后，随时点击继续恢复筛选。

**Q: 历史任务存储在哪里？**
A: 存储在后端的 SQLite 数据库中（`backend/data/tasks.db`）。

## 许可证 / License

MIT License

## 贡献 / Contributing

欢迎提交 Issue 和 Pull Request！

---

**免责声明 / Disclaimer**: 本工具仅供学习参考，不构成任何投资建议。股市有风险，投资需谨慎。
