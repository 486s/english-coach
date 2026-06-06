import { useRef, useCallback } from 'react';

/**
 * 极简 PCM 播放器 Hook（回声测试用）
 *
 * 每收到一个二进制帧就立即播放，不做缓冲队列。
 * 可接受重叠/卡顿，PR 2.3 会替换为带队列的播放器。
 *
 * 使用说明：
 * ```tsx
 * const { playPcm } = useSimplePlayer();
 *
 * // 在 WebSocket 二进制消息回调中：
 * ws.onmessage = (event) => {
 *   if (event.data instanceof ArrayBuffer) {
 *     playPcm(event.data);
 *   }
 * };
 * ```
 */
export const useSimplePlayer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // 惰性创建 AudioContext（首次播放时创建，确保在用户手势上下文中）
  const getContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext(); // 使用浏览器默认采样率
    }
    return audioContextRef.current;
  }, []);

  /**
   * 播放一段 16kHz 16-bit PCM ArrayBuffer
   * @param pcmBuffer 16-bit 小端序 PCM 数据（ArrayBuffer）
   */
  const playPcm = useCallback(
    async (pcmBuffer: ArrayBuffer) => {
      if (pcmBuffer.byteLength === 0) return; // 空帧跳过

      const ctx = getContext();

      // ★ 浏览器自动播放策略：确保 AudioContext 处于 running 状态
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 16-bit PCM → Float32（-1.0 ~ 1.0）
      const int16Array = new Int16Array(pcmBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // 创建 AudioBuffer（指定数据原始采样率为 16kHz，AudioContext 会自动重采样）
      const audioBuffer = ctx.createBuffer(
        1,
        float32Array.length,
        16000, // 数据原始采样率
      );
      audioBuffer.copyToChannel(float32Array, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    },
    [getContext],
  );

  return { playPcm };
};
