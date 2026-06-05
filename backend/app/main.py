from fastapi import FastAPI
from app.api.websocket.chat_ws import chat_endpoint

app = FastAPI(
    title="AI English Coach",
    version="0.1.0"
)

@app.get("/health")
async def health():
    """
    健康检查端点，可扩展检查数据库、Redis 连接
    """
    return {"status": "ok"}

# 注册 WebSocket 路由
app.add_websocket_route("/ws/chat", chat_endpoint)