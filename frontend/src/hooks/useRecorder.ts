import { useRef, useState, useCallback, useEffect } from 'react';

export interface RecorderCallbacks {
  /** 每 ~85ms 产生一个音频块（16kHz 16-bit PCM ArrayBuffer） */
  onAudioChunk: (chunk: ArrayBuffer) => void;
  /** 录音结束后回调 */
  onEnd?: () => void;
  /** getUserMedia 失败时回调 */
  onError?: (error: Error) => void;
}

/** 采样率常数 */
const TARGET_SAMPLE_RATE = 16000;
const INPUT_SAMPLE_RATE = 48000;

/**
 * Float32 → 16-bit PCM ArrayBuffer（小端序）
 * 使用 Math.round 做对称量化，避免截断精度损失
 */
function float32ToInt16Pcm(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    const intSample = Math.round(clamped * 32767);
    view.setInt16(
      i * 2,
      Math.max(-32768, Math.min(32767, intSample)),
      true, // little-endian
    );
  }
  return buffer;
}

/**
 * 线性插值降采样：从 inputSampleRate 降至 outputSampleRate
 * 典型场景：48kHz → 16kHz（比例 3:1）
 */
function downsample(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (inputSampleRate === outputSampleRate) return input;
  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const lowIndex = Math.floor(origIndex);
    const highIndex = Math.min(lowIndex + 1, input.length - 1);
    const frac = origIndex - lowIndex;
    result[i] = input[lowIndex] * (1 - frac) + input[highIndex] * frac;
  }
  return result;
}

/**
 * 录音 Hook
 *
 * 采集麦克风音频，重采样为 16kHz 单声道 PCM，
 * 通过 onAudioChunk 回调输出 16-bit 小端序 ArrayBuffer。
 *
 * 使用说明：
 * ```tsx
 * const { isRecording, startRecording, stopRecording } = useRecorder();
 *
 * const handleStart = () => {
 *   startRecording({
 *     onAudioChunk: (chunk) => ws.send(chunk),
 *     onEnd: () => ws.sendAudioEnd(),
 *     onError: (err) => console.error(err),
 *   });
 * };
 *
 * const handleStop = () => stopRecording();
 * ```
 */
export const useRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  // ★ 用 ref 同步 state，避免 onaudioprocess 闭包陷阱
  const isRecordingRef = useRef(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // ★ 回调通过 ref 持有，onaudioprocess 中读取最新引用
  const callbacksRef = useRef<RecorderCallbacks>({ onAudioChunk: () => {} });

  // ── 清理所有音频资源 ──
  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // ── 开始录音 ──
  const startRecording = useCallback(
    (callbacks: RecorderCallbacks) => {
      if (isRecordingRef.current) return;

      // ★ 保存回调引用（用于 onaudioprocess 中读取最新版本）
      callbacksRef.current = callbacks;

      navigator.mediaDevices
        .getUserMedia({
          audio: {
            sampleRate: INPUT_SAMPLE_RATE,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        .then((stream) => {
          // 双重检查：异步期间可能已被 stopRecording 调用
          if (!isRecordingRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          mediaStreamRef.current = stream;

          const audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(stream);
          sourceRef.current = source;

          // bufferSize=4096 @48kHz → 约85ms/帧，降采样后 ~1365 samples
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (event) => {
            // ★ 通过 ref 读取最新状态，避免闭包陷阱
            if (!isRecordingRef.current) return;

            const inputData = event.inputBuffer.getChannelData(0); // Float32, 48kHz
            const downsampled = downsample(
              inputData,
              audioContext.sampleRate,
              TARGET_SAMPLE_RATE,
            );
            const pcmBuffer = float32ToInt16Pcm(downsampled);
            callbacksRef.current.onAudioChunk(pcmBuffer);
          };

          source.connect(processor);
          processor.connect(audioContext.destination); // 可选，监听扬声器（回声测试用）

          isRecordingRef.current = true;
          setIsRecording(true);
        })
        .catch((err) => {
          console.error('[Recorder] getUserMedia error:', err);
          callbacks.onError?.(
            err instanceof Error ? err : new Error(String(err)),
          );
        });
    },
    [], // 基于 ref 实现，无需依赖
  );

  // ── 停止录音 ──
  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return; // ★ 幂等守卫

    isRecordingRef.current = false;
    setIsRecording(false);

    cleanup();

    // 通知上层录音结束
    callbacksRef.current.onEnd?.();
  }, [cleanup]);

  // ── 组件卸载时自动清理 ──
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { isRecording, startRecording, stopRecording };
};
