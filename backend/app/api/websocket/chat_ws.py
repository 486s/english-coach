from fastapi import WebSocket, WebSocketDisconnect

async def chat_endpoint(websocket: WebSocket):
    """
    基础 WebSocket 端点：接收文本，回显
    后续将升级为支持音频二进制帧与 JSON 控制消息
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        pass