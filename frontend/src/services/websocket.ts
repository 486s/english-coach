// ── 消息类型定义 ──
export interface PingMessage {
  type: 'ping';
}

export interface PongMessage {
  type: 'pong';
}

export interface UserTextMessage {
  type: 'user_text';
  content: string;
}

export interface AssistantTextMessage {
  type: 'assistant_text';
  content: string;
}

export interface ErrorMessage {
  type: 'error';
  content: string;
}

export interface AudioEndAckMessage {
  type: 'audio_end_ack';
}

export type WebSocketMessage =
  | PingMessage
  | PongMessage
  | UserTextMessage
  | AssistantTextMessage
  | ErrorMessage
  | AudioEndAckMessage;

// ── 心跳配置 ──
const HEARTBEAT_INTERVAL = 30_000; // 30 秒
const PONG_TIMEOUT = 10_000;       // 10 秒无 pong 则断开
const MAX_BUFFERED_AMOUNT = 65536; // 二进制发送缓冲区上限 64KB

/** 连接状态 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * 构建 WebSocket URL：
 *   1. 优先使用显式设置的 VITE_WS_URL
 *   2. 否则从 VITE_API_URL 推导（http → ws）
 */
export function buildWsUrl(scenarioId: string | number): string {
  const explicitWs = import.meta.env.VITE_WS_URL;
  if (explicitWs) {
    return `${explicitWs}/ws/chat/${scenarioId}`;
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const wsBase = apiUrl.replace(/^http/, 'ws');
  return `${wsBase}/ws/chat/${scenarioId}`;
}

export interface UseChatWebSocketOptions {
  scenarioId: string | number;
  onMessage: (msg: WebSocketMessage | ArrayBuffer) => void;
  onStatusChange?: (status: ConnectionStatus, detail?: string) => void;
}

export interface UseChatWebSocketReturn {
  sendUserText: (content: string) => void;
  sendBinary: (data: ArrayBuffer) => void;
  sendAudioEnd: () => void;
  close: () => void;
}

/**
 * 创建 WebSocket 连接（工厂函数，在 useEffect 中调用）
 *
 * 生命周期与调用方绑定，返回的 close() 用于组件 cleanup。
 * 内置 ping/pong 心跳和 pong 超时检测。
 */
export function createChatWebSocket(options: UseChatWebSocketOptions): UseChatWebSocketReturn {
  const { scenarioId, onMessage, onStatusChange } = options;
  const url = buildWsUrl(scenarioId);

  let ws: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let isCleanedUp = false;

  // ── 清理所有定时器 ──
  function clearTimers() {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pongTimeoutTimer !== null) {
      clearTimeout(pongTimeoutTimer);
      pongTimeoutTimer = null;
    }
  }

  // ── 启动心跳 ──
  function startHeartbeat() {
    clearTimers();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        pongTimeoutTimer = setTimeout(() => {
          console.warn('[WS] Pong timeout — closing');
          ws?.close();
        }, PONG_TIMEOUT);
      }
    }, HEARTBEAT_INTERVAL);
  }

  // ── 建立连接 ──
  function connect() {
    if (isCleanedUp) return;

    onStatusChange?.('connecting');

    // new WebSocket() 可能对非法 URL 抛 SyntaxError
    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer'; // ★ 关键：二进制帧以 ArrayBuffer 而非 Blob 到达
    } catch (err) {
      console.error('[WS] Invalid URL:', url, err);
      onStatusChange?.('error', '无效的 WebSocket 地址');
      return;
    }

    ws.onopen = () => {
      // StrictMode 下 cleanup 可能已执行，此时直接关闭
      if (isCleanedUp) {
        ws?.close();
        return;
      }
      console.log(`[WS] Connected: ${url}`);
      onStatusChange?.('connected');
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      // ★ 二进制音频帧直接透传
      if (event.data instanceof ArrayBuffer) {
        onMessage(event.data);
        return;
      }

      // 文本消息
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);
        if (msg.type === 'pong') {
          if (pongTimeoutTimer !== null) {
            clearTimeout(pongTimeoutTimer);
            pongTimeoutTimer = null;
          }
          return; // pong 不通知上层
        }
        onMessage(msg);
      } catch {
        console.warn('[WS] Failed to parse message:', event.data);
      }
    };

    ws.onerror = () => {
      console.error('[WS] Connection error');
      onStatusChange?.('error', 'WebSocket 连接失败，请检查后端服务是否启动');
    };

    ws.onclose = (event) => {
      console.log(`[WS] Closed: code=${event.code}, reason=${event.reason}`);
      clearTimers();

      if (!isCleanedUp) {
        // 根据关闭码提供具体错误信息
        const detail =
          event.code === 4004
            ? '该场景不存在或已被禁用'
            : event.code === 1006
              ? '连接异常中断，后端服务可能已停止'
              : `连接已关闭 (code: ${event.code})`;
        onStatusChange?.('disconnected', detail);
      }
    };
  }

  // ── 公开方法 ──
  function sendUserText(content: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'user_text', content }));
    }
  }

  function sendBinary(data: ArrayBuffer) {
    if (ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < MAX_BUFFERED_AMOUNT) {
      ws.send(data);
    }
  }

  function sendAudioEnd() {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'audio_end' }));
    }
  }

  function close() {
    isCleanedUp = true;
    clearTimers();
    ws?.close(1000, 'Client navigating away');
    ws = null;
  }

  connect();

  return { sendUserText, sendBinary, sendAudioEnd, close };
}
