import { renderHook, act } from '@testing-library/react';
import { useRecorder } from '../hooks/useRecorder';

// ── Types ──

interface MockProcessor {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockContext {
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createScriptProcessor: ReturnType<typeof vi.fn>;
  sampleRate: number;
  close: ReturnType<typeof vi.fn>;
  destination: object;
}

// ── Shared mock state ──

let mockProcessor: MockProcessor;
let mockContext: MockContext;
let onAudioProcessCallback:
  | ((event: {
      inputBuffer: { getChannelData: (ch: number) => Float32Array };
    }) => void)
  | null;

beforeEach(() => {
  onAudioProcessCallback = null;

  mockProcessor = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as MockProcessor;

  Object.defineProperty(mockProcessor, 'onaudioprocess', {
    get() {
      return null;
    },
    set(fn) {
      onAudioProcessCallback = fn;
    },
    configurable: true,
  });

  mockContext = {
    createMediaStreamSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createScriptProcessor: vi.fn(() => mockProcessor),
    sampleRate: 48000,
    close: vi.fn(() => Promise.resolve()),
    destination: {},
  };

  vi.stubGlobal('AudioContext', vi.fn(() => mockContext));

  // Mock getUserMedia
  const mockTrack = {
    stop: vi.fn(),
  };
  const mockStream = {
    getTracks: vi.fn(() => [mockTrack]),
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helper: trigger an audio chunk ──

function triggerAudioChunk() {
  if (onAudioProcessCallback) {
    const data = new Float32Array(4096);
    onAudioProcessCallback({
      inputBuffer: {
        getChannelData: (ch: number) => data,
      },
    });
  }
}

// ── Tests ──

describe('useRecorder', () => {
  it('returns the expected interface', () => {
    const { result } = renderHook(() => useRecorder());

    expect(result.current).toHaveProperty('isRecording');
    expect(result.current).toHaveProperty('startRecording');
    expect(result.current).toHaveProperty('stopRecording');
    expect(typeof result.current.isRecording).toBe('boolean');
    expect(typeof result.current.startRecording).toBe('function');
    expect(typeof result.current.stopRecording).toBe('function');
  });

  it('initial state has isRecording=false', () => {
    const { result } = renderHook(() => useRecorder());

    expect(result.current.isRecording).toBe(false);
  });

  it('startRecording sets isRecording to true', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      result.current.startRecording({
        onAudioChunk: vi.fn(),
      });
    });

    expect(result.current.isRecording).toBe(true);
  });

  it('startRecording calls getUserMedia with correct constraints', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      result.current.startRecording({
        onAudioChunk: vi.fn(),
      });
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  });

  it('calls onAudioChunk with PCM data when audio processes', async () => {
    const onAudioChunk = vi.fn();
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      result.current.startRecording({ onAudioChunk });
    });

    // Trigger a few audio chunks
    act(() => {
      triggerAudioChunk();
      triggerAudioChunk();
    });

    expect(onAudioChunk).toHaveBeenCalledTimes(2);
    expect(onAudioChunk).toHaveBeenCalledWith(expect.any(ArrayBuffer));
  });

  it('stopRecording sets isRecording to false and stops stream', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      result.current.startRecording({
        onAudioChunk: vi.fn(),
      });
    });

    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);

    // Processor should have been disconnected
    expect(mockProcessor.disconnect).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();
  });

  it('stopRecording is idempotent', () => {
    const { result } = renderHook(() => useRecorder());

    // Calling stop before start should do nothing
    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it('startRecording is idempotent (ignores second call)', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      result.current.startRecording({ onAudioChunk: vi.fn() });
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    // Second call should be ignored
    await act(async () => {
      result.current.startRecording({ onAudioChunk: vi.fn() });
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('calls onError when getUserMedia fails', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useRecorder());

    const permissionError = new Error('Permission denied');
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      permissionError,
    );

    await act(async () => {
      result.current.startRecording({ onAudioChunk: vi.fn(), onError });
    });

    expect(onError).toHaveBeenCalledWith(permissionError);
    expect(result.current.isRecording).toBe(false);
  });

  it('calls onEnd callback when stopRecording is called', async () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      result.current.startRecording({ onAudioChunk: vi.fn(), onEnd });
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('cleans up resources on unmount', async () => {
    const { result, unmount } = renderHook(() => useRecorder());

    await act(async () => {
      result.current.startRecording({ onAudioChunk: vi.fn() });
    });

    unmount();

    expect(mockContext.close).toHaveBeenCalled();
  });
});
