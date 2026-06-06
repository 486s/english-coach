from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.api.websocket.chat_ws import chat_endpoint
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


@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "ok"}


# 注册路由
app.add_websocket_route("/ws/chat", chat_endpoint)
app.include_router(scenarios_router, prefix="/api/v1")
