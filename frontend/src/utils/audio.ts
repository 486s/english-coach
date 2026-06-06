/**
 * Int16 PCM ArrayBuffer → Float32Array（-1.0 ~ 1.0）
 *
 * @param pcmBuffer 16-bit 小端序 PCM ArrayBuffer
 * @returns 归一化的 Float32Array
 */
export function pcmToFloat32(pcmBuffer: ArrayBuffer): Float32Array {
  const int16Array = new Int16Array(pcmBuffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

/**
 * Float32Array（-1.0 ~ 1.0）→ Int16 PCM ArrayBuffer（小端序）
 *
 * 使用 Math.round 做对称量化，避免截断精度损失。
 *
 * @param float32Array 归一化的 Float32Array
 * @returns 16-bit 小端序 PCM ArrayBuffer
 */
export function float32ToPcm(float32Array: Float32Array): ArrayBuffer {
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
