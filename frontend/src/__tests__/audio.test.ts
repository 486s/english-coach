import { pcmToFloat32, float32ToPcm } from '../utils/audio';

// ── pcmToFloat32 ──

describe('pcmToFloat32', () => {
  it('converts Int16 PCM ArrayBuffer to Float32Array', () => {
    const pcmBuffer = new Int16Array([0, 16384, -16384, 32767, -32768]).buffer;
    const result = pcmToFloat32(pcmBuffer);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0.5, 5);
    expect(result[2]).toBeCloseTo(-0.5, 5);
    expect(result[3]).toBeCloseTo(32767 / 32768, 5);
    expect(result[4]).toBeCloseTo(-1.0, 5);
  });

  it('returns Float32Array of same length as input', () => {
    const input = new Int16Array([100, 200, 300]);
    const result = pcmToFloat32(input.buffer);
    expect(result).toHaveLength(3);
  });

  it('handles all-zero buffer', () => {
    const input = new Int16Array([0, 0, 0, 0]);
    const result = pcmToFloat32(input.buffer);
    result.forEach((v) => expect(v).toBe(0));
  });

  it('handles max positive value 32767', () => {
    const input = new Int16Array([32767]);
    const result = pcmToFloat32(input.buffer);
    expect(result[0]).toBeCloseTo(0.999969482421875, 5);
  });

  it('handles max negative value -32768', () => {
    const input = new Int16Array([-32768]);
    const result = pcmToFloat32(input.buffer);
    expect(result[0]).toBeCloseTo(-1.0, 5);
  });

  it('handles empty ArrayBuffer', () => {
    const input = new Int16Array([]);
    const result = pcmToFloat32(input.buffer);
    expect(result).toHaveLength(0);
  });
});

// ── float32ToPcm ──

describe('float32ToPcm', () => {
  it('converts Float32Array to Int16 PCM ArrayBuffer', () => {
    const input = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
    const result = float32ToPcm(input);
    const int16 = new Int16Array(result);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(int16[0]).toBe(0);
    // Math.round(0.5 * 32767) = Math.round(16383.5) = 16384
    expect(int16[1]).toBe(16384);
    // Math.round(-0.5 * 32767) = Math.round(-16383.5) = -16383 (rounds toward +Infinity)
    expect(int16[2]).toBe(-16383);
    expect(int16[3]).toBe(32767);
    // Math.round(-1 * 32767) = -32767 (then clamped to [-32768, 32767])
    expect(int16[4]).toBe(-32767);
  });

  it('returns ArrayBuffer of correct byte length', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    const result = float32ToPcm(input);
    expect(result.byteLength).toBe(input.length * 2);
  });

  it('handles all-zero input', () => {
    const input = new Float32Array([0, 0, 0]);
    const result = float32ToPcm(input);
    const int16 = new Int16Array(result);
    int16.forEach((v) => expect(v).toBe(0));
  });

  it('clamps values above 1.0 to 32767', () => {
    const input = new Float32Array([1.5, 2.0, 100]);
    const result = float32ToPcm(input);
    const int16 = new Int16Array(result);
    int16.forEach((v) => expect(v).toBe(32767));
  });

  it('clamps values below -1.0 to -32767', () => {
    const input = new Float32Array([-1.5, -2.0, -100]);
    const result = float32ToPcm(input);
    const int16 = new Int16Array(result);
    // clamped = -1.0, then Math.round(-32767) = -32767
    int16.forEach((v) => expect(v).toBe(-32767));
  });

  it('round-trip preserves values within quantization error', () => {
    const original = new Float32Array([0.1, 0.2, -0.3, 0.5, -0.8, 1.0, -1.0]);
    const pcm = float32ToPcm(original);
    const roundTrip = pcmToFloat32(pcm);
    for (let i = 0; i < original.length; i++) {
      // Float32 -> Int16 -> Float32 has ~1/32768 quantization error
      expect(roundTrip[i]).toBeCloseTo(original[i], 4);
    }
  });

  it('handles empty Float32Array', () => {
    const input = new Float32Array([]);
    const result = float32ToPcm(input);
    expect(result.byteLength).toBe(0);
  });
});
