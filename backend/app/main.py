from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.api.screen import router as screen_router

# 创建 FastAPI 应用
app = FastAPI(
    title="A股股票筛选器",
    description="筛选半年内有过连续涨停且回落至启动价下方的股票",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(screen_router)

# 前端静态文件服务
frontend_path = Path(__file__).parent.parent / "frontend" / "out"
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")


@app.get("/")
async def root():
    """返回前端页面"""
    frontend_index = Path(__file__).parent.parent / "frontend" / "out" / "index.html"
    if frontend_index.exists():
        return FileResponse(str(frontend_index))
    return {"message": "A股股票筛选器 API", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
