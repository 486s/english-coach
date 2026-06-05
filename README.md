# AI English Coach

AI 驱动的英语口语陪练工具，支持场景选择、实时语音对话、发音评测、语法纠错与课后总结。

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Python FastAPI
- AI：流式 ASR (Whisper)、LLM (GPT-4o mini)、TTS (Edge-TTS)
- 基础设施：PostgreSQL、Redis、Docker

## 快速开始

1. 启动基础服务：
   ```cmd
   docker compose up -d db redis
   ```
2. 启动后端服务：
   ```cmd
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
3. 启动前端服务：
   ```cmd
   cd frontend
   npm install
   npm run dev
   ```