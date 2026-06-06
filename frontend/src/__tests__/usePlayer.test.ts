import { renderHook, act } from '@testing-library/react';
import { usePlayer } from '../hooks/usePlayer';

// ── Mock AudioContext ──

let mockSource: {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
};

let mockContext: {
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  destination: object;
  state: string;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null,
  };

  mockContext = {
    createBuffer: vi.fn(
      (channels: number, length: number, sampleRate: number) =>
        ({
          getChannelData: vi.fn(() => new Float32Array(length)),
          copyToChannel: vi.fn(),
          length,
          sampleRate,
          numberOfChannels: channels,
        }) as unknown as AudioBuffer,
    ),
    createBufferSource: vi.fn(() => mockSource),
    destination: {},
    state: 'running',
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };

  // jsdom does not provide AudioContext
  vi.stubGlobal('AudioContext', vi.fn(() => mockContext));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helper: simulate playback completion ──

function simulatePlaybackEnd() {
  if (mockSource.onended) {
    mockSource.onended();
  }
}

// ── Tests ──

describe('usePlayer', () => {
  it('returns the expected interface', () => {
    const { result } = renderHook(() => usePlayer());

    expect(result.current).toHaveProperty('enqueue');
    expect(result.current).toHaveProperty('clearQueue');
    expect(result.current).toHaveProperty('queueLength');
    expect(result.current).toHaveProperty('isPlaying');
    expect(typeof result.current.enqueue).toBe('function');
    expect(typeof result.current.clearQueue).toBe('function');
    expect(typeof result.current.queueLength).toBe('number');
    expect(typeof result.current.isPlaying).toBe('boolean');
  });

  it('initial state has queueLength=0 and isPlaying=false', () => {
    const { result } = renderHook(() => usePlayer());

    expect(result.current.queueLength).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('enqueue with empty buffer returns resolved promise immediately', async () => {
    const { result } = renderHook(() => usePlayer());

    const promise = result.current.enqueue(new ArrayBuffer(0));
    await expect(promise).resolves.toBeUndefined();

    // AudioContext should NOT have been created
    expect(result.current.queueLength).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('creates AudioContext lazily on first non-empty enqueue', async () => {
    const { result } = renderHook(() => usePlayer());
    const pcmData = new Int16Array([100, 200, 300]).buffer;

    let promise: Promise<void>;
    act(() => {
      promise = result.current.enqueue(pcmData);
    });

    expect(AudioContext).toHaveBeenCalledTimes(1);
    // AudioContext.createBufferSource confirms playNext ran
    expect(mockContext.createBufferSource).toHaveBeenCalledTimes(1);
    expect(mockSource.start).toHaveBeenCalledTimes(1);

    act(() => { simulatePlaybackEnd(); });
    await expect(promise!).resolves.toBeUndefined();
  });

  it('processes PCM data via createBuffer and createBufferSource', async () => {
    const { result } = renderHook(() => usePlayer());
    const pcmData = new Int16Array([100, 200, 300]).buffer;

    let promise: Promise<void>;
    act(() => {
      promise = result.current.enqueue(pcmData);
    });

    expect(mockContext.createBufferSource).toHaveBeenCalledTimes(1);
    expect(mockContext.createBuffer).toHaveBeenCalledWith(1, 3, 16000);

    act(() => { simulatePlaybackEnd(); });
    await expect(promise!).resolves.toBeUndefined();
  });

  it('updates queueLength and isPlaying reactively', async () => {
    const { result } = renderHook(() => usePlayer());

    // Queue first item
    let promise: Promise<void>;
    act(() => {
      promise = result.current.enqueue(new Int16Array([1, 2, 3]).buffer);
    });

    // Verify mock calls confirm playback started
    expect(mockSource.start).toHaveBeenCalledTimes(1);

    // Queue a second item (already playing, so just adds to queue)
    let promise2: Promise<void>;
    act(() => {
      promise2 = result.current.enqueue(new Int16Array([4, 5, 6]).buffer);
    });

    // Finish first item
    act(() => { simulatePlaybackEnd(); });
    await expect(promise!).resolves.toBeUndefined();

    // Finish second item
    act(() => { simulatePlaybackEnd(); });
    await expect(promise2!).resolves.toBeUndefined();
  });

  it('resolves enqueue promise when playback completes', async () => {
    const { result } = renderHook(() => usePlayer());
    const pcmData = new Int16Array([100, 200, 300]).buffer;

    let playPromise: Promise<void>;
    act(() => {
      playPromise = result.current.enqueue(pcmData);
    });

    act(() => {
      simulatePlaybackEnd();
    });
    await expect(playPromise!).resolves.toBeUndefined();
  });

  it('clearQueue stops current source', () => {
    const { result } = renderHook(() => usePlayer());
    act(() => {
      result.current.enqueue(new Int16Array([1, 2, 3]).buffer);
    });

    act(() => {
      result.current.clearQueue();
    });

    expect(mockSource.stop).toHaveBeenCalled();
  });

  it('clearQueue rejects all pending promises', async () => {
    const { result } = renderHook(() => usePlayer());

    // First enqueue: starts playing immediately (shifted off queue)
    await act(async () => {
      result.current.enqueue(new Int16Array([1, 2, 3]).buffer);
      await Promise.resolve();
    });

    // Second enqueue: stays in queue (already playing)
    let promise2: Promise<void>;
    await act(async () => {
      promise2 = result.current.enqueue(new Int16Array([4, 5, 6]).buffer);
      await Promise.resolve();
    });

    // Third enqueue: also stays in queue
    let promise3: Promise<void>;
    await act(async () => {
      promise3 = result.current.enqueue(new Int16Array([7, 8, 9]).buffer);
      await Promise.resolve();
    });

    act(() => {
      result.current.clearQueue();
    });

    // Items still in queue should be rejected
    await expect(promise2!).rejects.toThrow('Queue cleared');
    await expect(promise3!).rejects.toThrow('Queue cleared');
  });

  it('respects maxQueueSize overflow protection', async () => {
    const { result } = renderHook(() => usePlayer({ maxQueueSize: 2 }));

    // First enqueue: starts playing, shifted off queue
    act(() => {
      result.current.enqueue(new Int16Array([1]).buffer);
    });
    await vi.waitFor(() => {
      expect(result.current.queueLength).toBe(0);
    });
    expect(result.current.isPlaying).toBe(true);

    // Enqueue 2 items, fills queue to maxQueueSize=2
    let p2: Promise<void>;
    let p3: Promise<void>;
    act(() => {
      p2 = result.current.enqueue(new Int16Array([2]).buffer);
      p3 = result.current.enqueue(new Int16Array([3]).buffer);
    });

    // Enqueue another item - should overflow, dropping oldest (p2)
    act(() => {
      result.current.enqueue(new Int16Array([4]).buffer);
    });

    // p2 should have been rejected with overflow error
    await expect(p2!).rejects.toThrow('Queue overflow');
    // p3 stays in queue and p4 is also in queue - both pending
    await vi.waitFor(() => {
      expect(result.current.queueLength).toBe(2);
    });
  });

  it('calls onError callback when playback fails', async () => {
    const onError = vi.fn();

    // Fail AudioBufferSourceNode creation
    mockContext.createBufferSource = vi.fn(() => {
      throw new Error('Source creation failed');
    });

    const { result } = renderHook(() => usePlayer({ onError }));

    const pcmData = new Int16Array([100, 200, 300]).buffer;
    const promise = result.current.enqueue(pcmData);

    await expect(promise).rejects.toThrow('Source creation failed');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('cleans up on unmount: closes AudioContext and clears queue', () => {
    const { result, unmount } = renderHook(() => usePlayer());
    result.current.enqueue(new Int16Array([1, 2, 3]).buffer);

    unmount();

    expect(mockContext.close).toHaveBeenCalled();
    expect(mockSource.stop).toHaveBeenCalled();
  });
});
