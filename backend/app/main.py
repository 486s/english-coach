from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.websocket.chat_ws import router as chat_ws_router
from app.api.routes.scenarios import router as scenarios_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动/关闭时管理资源"""
    yield


app = FastAPI(
    title="AI English Coach",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 中间件：允许前端 dev server 跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "ok"}


# 注册路由
app.include_router(chat_ws_router)
app.include_router(scenarios_router, prefix="/api/v1")
