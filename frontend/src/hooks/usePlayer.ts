import { useRef, useCallback, useEffect, useState } from 'react';
import { pcmToFloat32 } from '../utils/audio';

// ── 类型 ──

interface AudioQueueItem {
  pcmData: ArrayBuffer;
  resolve: () => void;
  reject: (reason: Error) => void;
}

export interface UsePlayerOptions {
  /** 音频采样率（默认 16000） */
  sampleRate?: number;
  /** 播放错误回调（可选） */
  onError?: (error: Error) => void;
  /** 队列最大长度，超出时丢弃最旧块（默认 50，约 5 秒音频） */
  maxQueueSize?: number;
}

export interface UsePlayerReturn {
  /**
   * 将 PCM 数据入队播放。
   * 返回的 Promise 在该 chunk 播放完毕后 resolve，
   * 队列被清空时会被 reject，调用方应处理 rejection。
   */
  enqueue: (pcmData: ArrayBuffer) => Promise<void>;
  /** 清空队列并停止当前播放 */
  clearQueue: () => void;
  /** 当前队列长度（响应式，调试/UI 用） */
  queueLength: number;
  /** 是否正在播放（响应式，调试/UI 用） */
  isPlaying: boolean;
}

/**
 * 带 FIFO 缓冲队列的 PCM 播放器 Hook
 *
 * ## 特性
 * - **顺序播放**：前一个音频块播放完毕后才播放下一个
 * - **溢出保护**：超过 maxQueueSize 时丢弃最旧的块
 * - **惰性创建 AudioContext**：首次播放时创建，确保在用户手势上下文中
 * - **自动 resume**：浏览器暂停 AudioContext 时自动恢复
 *
 * ## 注意
 * - 本 Hook 创建独立的 AudioContext 实例，与 useRecorder 的 AudioContext 互不影响。
 *   未来移动端优化时可以考虑共享 AudioContext。
 * - enqueue 返回的 Promise 可能因队列清空而被 reject，调用方应处理。
 *
 * ## 使用示例
 * ```tsx
 * const { enqueue, clearQueue, isPlaying } = usePlayer({
 *   sampleRate: 16000,
 *   onError: (err) => console.error('Playback error:', err),
 * });
 *
 * // 在 WebSocket 二进制消息回调中：
 * enqueue(pcmData);
 *
 * // 组件卸载时清空：
 * useEffect(() => () => clearQueue(), [clearQueue]);
 * ```
 */
export const usePlayer = (options: UsePlayerOptions = {}): UsePlayerReturn => {
  const { sampleRate = 16000, maxQueueSize = 50 } = options;

  // ★ 通过 ref 持有 onError，避免依赖链重建
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioQueueItem[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentRejectRef = useRef<((reason: Error) => void) | null>(null);

  const [queueLength, setQueueLength] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── 惰性创建 AudioContext ──
  const getContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      // ★ 不指定 sampleRate，由 createBuffer 的第三个参数告知采样率
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // ── 同步状态到 React state（调试/UI 用） ──
  const updateState = useCallback(() => {
    setQueueLength(queueRef.current.length);
    setIsPlaying(isPlayingRef.current);
  }, []);

  // ── PCM → AudioBuffer（同步操作） ──
  const pcmToAudioBuffer = useCallback(
    (pcmBuffer: ArrayBuffer): AudioBuffer => {
      const ctx = getContext();
      const float32Array = pcmToFloat32(pcmBuffer);
      const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);
      return audioBuffer;
    },
    [getContext, sampleRate],
  );

  // ── 播放队列中的下一个 ──
  const playNext = useCallback(async () => {
    // ★ 使用 getContext() 确保首次播放时初始化 AudioContext
    const ctx = getContext();
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      updateState();
      return;
    }

    isPlayingRef.current = true;
    updateState();

    const item = queueRef.current.shift()!;
    updateState();

    try {
      const audioBuffer = pcmToAudioBuffer(item.pcmData);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        source.disconnect();
        currentSourceRef.current = null;
        currentRejectRef.current = null;
        isPlayingRef.current = false;
        updateState();
        item.resolve();
        // ★ 事件驱动递归播放下一个，无栈溢出风险
        playNext();
      };

      currentSourceRef.current = source;
      currentRejectRef.current = item.reject;

      // ★ 确保 AudioContext 处于 running 状态
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      source.start();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[usePlayer] Error playing audio chunk:', error);
      onErrorRef.current?.(error);
      item.reject(error);
      currentRejectRef.current = null;
      isPlayingRef.current = false;
      updateState();
      // 出错继续播放下一个
      playNext();
    }
  }, [pcmToAudioBuffer, updateState]);

  // ── 入队 ──
  const enqueue = useCallback(
    (pcmData: ArrayBuffer): Promise<void> => {
      if (pcmData.byteLength === 0) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve, reject) => {
        // ★ 溢出保护：丢弃最旧的块
        while (queueRef.current.length >= maxQueueSize) {
          const dropped = queueRef.current.shift()!;
          dropped.reject(
            new Error(`Queue overflow (max=${maxQueueSize}), oldest chunk dropped`),
          );
          console.warn('[usePlayer] Queue overflow, dropped oldest chunk');
        }

        queueRef.current.push({ pcmData, resolve, reject });
        updateState();

        // 如果当前没有在播放，立即开始
        if (!isPlayingRef.current) {
          playNext();
        }
      });
    },
    [maxQueueSize, playNext, updateState],
  );

  // ── 清空队列 ──
  const clearQueue = useCallback(() => {
    // ★ reject 当前正在播放的 chunk
    const error = new Error('Queue cleared');
    currentRejectRef.current?.(error);
    currentRejectRef.current = null;

    // 停止当前播放
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // stop() 可能因 already stopped 抛 InvalidStateError，忽略
      }
      currentSourceRef.current.disconnect();
      currentSourceRef.current = null;
    }

    // ★ reject 所有挂起的 Promise，防止内存泄漏
    queueRef.current.forEach((item) => item.reject(error));
    queueRef.current = [];

    isPlayingRef.current = false;
    updateState();
  }, [updateState]);

  // ── 生命周期：挂载初始化 & 卸载清理 ──
  useEffect(() => {
    // AudioContext 在 getContext() 中惰性创建
    return () => {
      clearQueue();
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
    // clearQueue 是基于 ref 的稳定引用，不需要作为 effect 依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { enqueue, clearQueue, queueLength, isPlaying };
};
