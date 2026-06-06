import { useRef, useState, useCallback, useEffect } from 'react';
import { float32ToPcm } from '../utils/audio';

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
      // ★ 在异步 getUserMedia 之前将 isRecordingRef 设为 true，
      //   这样 .then 回调中的双重检查才能正确判断 "停止" 状态。
      isRecordingRef.current = true;
      setIsRecording(true);

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
          // ★ 双重检查：异步期间可能已被 stopRecording 调用，
          //   若被 stop，流已被清理，应当丢弃该流
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
            const pcmBuffer = float32ToPcm(downsampled);
            callbacksRef.current.onAudioChunk(pcmBuffer);
          };

          source.connect(processor);
          // 处理器输出为静音（未写入 outputBuffer），无需连接 destination
          // 回声播放由 usePlayer 的独立 AudioContext 负责
        })
        .catch((err) => {
          console.error('[Recorder] getUserMedia error:', err);
          // ★ 异步失败后恢复 isRecording 状态
          isRecordingRef.current = false;
          setIsRecording(false);
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
