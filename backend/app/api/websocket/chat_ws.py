import json
import random
import logging
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.scenario import Scenario

logger = logging.getLogger(__name__)

router = APIRouter()

# ── 模拟回复库 ──
MOCK_REPLIES = [
    "That's interesting! Tell me more about it.",
    "I see. Could you elaborate on that point?",
    "Thanks for sharing. Let's continue our conversation.",
    "Good point! What else would you like to add?",
    "I understand. How does that relate to your experience?",
    "Great! Let's explore that further.",
    "That sounds reasonable. What happened next?",
    "Nice. Is there anything specific you'd like to practice?",
]

# ── 场景特定的开场白 ──
SCENARIO_GREETINGS = {
    "面试": "Hello! Welcome to the interview. Please introduce yourself briefly.",
    "点餐": "Welcome to our restaurant! Here's the menu. What would you like to order?",
    "日常会议": "Good morning everyone! Let's start our daily stand-up. What did you work on yesterday?",
}


async def _validate_scenario(scenario_id: int) -> Optional[Scenario]:
    """验证场景是否存在且活跃"""
    async with async_session_factory() as session:
        result = await session.execute(
            select(Scenario).where(
                Scenario.id == scenario_id,
                Scenario.is_active == True,
            )
        )
        return result.scalar_one_or_none()


@router.websocket("/ws/chat/{scenario_id}")
async def chat_endpoint(websocket: WebSocket, scenario_id: int):
    """
    WebSocket 对话端点
    路径: /ws/chat/{scenario_id}
    支持的消息类型:
      - ping / pong: 心跳
      - user_text: 用户文本消息，回复 assistant_text
      - audio_end: 音频流结束标记（文本），回复 audio_end_ack
      - 二进制帧: 16kHz 16-bit PCM 音频数据，原样回传（回声测试）
    """
    # 1. 验证场景存在
    scenario = await _validate_scenario(scenario_id)
    if scenario is None:
        await websocket.close(code=4004, reason="Scenario not found or inactive")
        return

    await websocket.accept()
    logger.info(f"WebSocket connected: scenario_id={scenario_id}, name={scenario.name}")

    # 2. 发送开场白
    greeting = SCENARIO_GREETINGS.get(
        scenario.name, "Welcome! Let's practice some English conversation."
    )
    await websocket.send_text(json.dumps({
        "type": "assistant_text",
        "content": greeting,
    }))

    try:
        while True:
            # 改用 receive() 以同时支持文本和二进制消息
            message = await websocket.receive()

            # 手动检测断连
            if message["type"] == "websocket.disconnect":
                raise WebSocketDisconnect(message.get("code", 1000))

            # ── 文本消息 ──
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "content": "Invalid JSON format",
                    }))
                    continue

                msg_type = data.get("type")

                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type == "user_text":
                    user_content = data.get("content", "").strip()
                    if not user_content:
                        continue
                    reply = random.choice(MOCK_REPLIES)
                    await websocket.send_text(json.dumps({
                        "type": "assistant_text",
                        "content": reply,
                    }))

                elif msg_type == "audio_end":
                    logger.info(f"Audio stream ended: scenario_id={scenario_id}")
                    await websocket.send_text(json.dumps({
                        "type": "audio_end_ack",
                    }))

                else:
                    logger.debug(f"Unknown message type: {msg_type}")

            # ── 二进制消息（音频帧）→ 原样回传 ──
            elif "bytes" in message:
                await websocket.send_bytes(message["bytes"])

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: scenario_id={scenario_id}")
    except Exception as e:
        logger.error(f"WebSocket error: scenario_id={scenario_id}, error={e}")
