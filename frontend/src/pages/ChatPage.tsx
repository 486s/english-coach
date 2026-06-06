import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WebSocketMessage, ConnectionStatus } from '../services/websocket';
import { createChatWebSocket } from '../services/websocket';

// ── 类型 ──
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// ── 唯一 ID 生成器 ──
let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
}

export const ChatPage = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<ReturnType<typeof createChatWebSocket> | null>(null);

  // ── 场景 ID 验证（useMemo 避免重复计算） ──
  const validScenarioId = useMemo(() => {
    if (!scenarioId) return null;
    const num = Number(scenarioId);
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [scenarioId]);

  // ── 添加消息（稳定引用，不触发不必要的 effect 重跑） ──
  const addMessage = useCallback(
    (role: Message['role'], content: string) => {
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), role, content, timestamp: new Date() },
      ]);
    },
    [],
  );

  // ── 建立 WebSocket 连接 ──
  useEffect(() => {
    if (validScenarioId === null) {
      setStatus('error');
      setErrorDetail(`无效的场景 ID: ${scenarioId || '(空)'}`);
      return;
    }

    // 重置错误信息
    setErrorDetail(null);

    wsRef.current = createChatWebSocket({
      scenarioId: validScenarioId,
      onMessage: (msg: WebSocketMessage) => {
        if (msg.type === 'assistant_text') {
          addMessage('assistant', msg.content);
        } else if (msg.type === 'error') {
          addMessage('system', `⚠ ${msg.content}`);
        }
      },
      onStatusChange: (newStatus, detail) => {
        setStatus(newStatus);
        if (detail) setErrorDetail(detail);
      },
    });

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validScenarioId]);

  // ── 自动滚动到底部 ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 输入框自动聚焦（仅在连接建立后） ──
  useEffect(() => {
    if (status === 'connected') {
      inputRef.current?.focus();
    }
  }, [status]);

  // ── 发送消息 ──
  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || status !== 'connected') return;
    addMessage('user', trimmed);
    wsRef.current?.sendUserText(trimmed);
    setInput('');
  };

  // ── 键盘处理 ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ══════════════════════════════════════════════
  //  渲染：无效场景 ID
  // ══════════════════════════════════════════════
  if (validScenarioId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-semibold text-red-700 mb-2">无效的场景</h2>
          <p className="text-gray-600 mb-4">
            {errorDetail || '场景 ID 无效，请从场景列表中选择。'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← 返回场景列表
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  //  渲染：连接中
  // ══════════════════════════════════════════════
  if (status === 'connecting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">正在连接对话服务...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  //  渲染：连接错误 / 断开
  // ══════════════════════════════════════════════
  if (status === 'error' || status === 'disconnected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">
            {status === 'error' ? '⚠' : '🔌'}
          </div>
          <h2 className="text-xl font-semibold text-red-700 mb-2">
            {status === 'error' ? '连接失败' : '连接已断开'}
          </h2>
          <p className="text-gray-600 mb-6">
            {errorDetail || '请检查后端服务是否正常运行'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← 返回列表
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              重新连接
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  //  渲染：正常对话界面
  // ══════════════════════════════════════════════
  const isInputDisabled = status !== 'connected';

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 头部 */}
      <header className="bg-white border-b px-4 py-3 flex items-center shrink-0">
        <button
          onClick={() => navigate('/')}
          className="mr-3 text-gray-600 hover:text-gray-900 transition-colors p-1 rounded-lg hover:bg-gray-100"
          aria-label="返回场景列表"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-800">场景对话 #{scenarioId}</h2>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          已连接
        </span>
      </header>

      {/* 消息区域 */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full select-none">
            <p className="text-gray-400 text-sm">开始你的第一段对话吧 ✨</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === 'user'
                ? 'justify-end'
                : msg.role === 'system'
                  ? 'justify-center'
                  : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm leading-relaxed break-words ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : msg.role === 'system'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs'
                    : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* 输入区域 */}
      <footer className="bg-white border-t p-3 flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={
            isInputDisabled ? '连接中...' : '输入消息，按 Enter 发送...'
          }
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isInputDisabled}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium
                     hover:bg-blue-600 active:bg-blue-700 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          发送
        </button>
      </footer>
    </div>
  );
};
