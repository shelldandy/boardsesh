import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- Mocks ---

const mockAdapter = {
  isAvailable: vi.fn(),
  requestAndConnect: vi.fn(),
  disconnect: vi.fn(),
  write: vi.fn(),
  onDisconnect: vi.fn(() => vi.fn()),
};

vi.mock('@/app/lib/ble/adapter-factory', () => ({
  createBluetoothAdapter: vi.fn(() => Promise.resolve(mockAdapter)),
}));

vi.mock('../bluetooth', () => ({
  getBluetoothPacket: vi.fn(() => new Uint8Array([1, 2, 3])),
}));

vi.mock('../use-wake-lock', () => ({
  useWakeLock: vi.fn(),
}));

const mockShowMessage = vi.fn();
vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: mockShowMessage }),
}));

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

import { useBoardBluetooth } from '../use-board-bluetooth';

const mockBoardDetails = {
  board_name: 'kilter',
  layout_id: 1,
  size_id: 10,
  set_ids: '1,2',
  layout_name: 'Original',
  size_name: '12x12',
  size_description: 'Full',
  set_names: ['Standard'],
  supportsMirroring: true,
} as unknown as Parameters<typeof useBoardBluetooth>[0]['boardDetails'];

describe('useBoardBluetooth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.isAvailable.mockResolvedValue(true);
    mockAdapter.requestAndConnect.mockResolvedValue({
      deviceId: 'test-device',
      deviceName: 'Test Board',
    });
    mockAdapter.disconnect.mockResolvedValue(undefined);
    mockAdapter.write.mockResolvedValue(undefined);
    mockAdapter.onDisconnect.mockReturnValue(vi.fn());
  });

  it('initial state: not connected, not loading', () => {
    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails }),
    );

    expect(result.current.isConnected).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('shows error when bluetooth not available', async () => {
    mockAdapter.isAvailable.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails }),
    );

    let connectResult: boolean | undefined;
    await act(async () => {
      connectResult = await result.current.connect();
    });

    expect(connectResult).toBe(false);
    expect(mockShowMessage).toHaveBeenCalledWith(
      'Bluetooth is not available on this device.',
      'error',
    );
  });

  it('returns false when no boardDetails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: undefined }),
    );

    let connectResult: boolean | undefined;
    await act(async () => {
      connectResult = await result.current.connect();
    });

    expect(connectResult).toBe(false);
    errorSpy.mockRestore();
  });

  it('sets loading during connect', async () => {
    let resolveConnect: (value: unknown) => void;
    const connectPromise = new Promise((resolve) => {
      resolveConnect = resolve;
    });
    mockAdapter.requestAndConnect.mockReturnValue(connectPromise);

    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails }),
    );

    // Start connection
    let hookConnectPromise: Promise<boolean>;
    act(() => {
      hookConnectPromise = result.current.connect();
    });

    // Should be loading
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveConnect!({ deviceId: 'test', deviceName: 'Board' });
      await hookConnectPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('sets isConnected on successful connection', async () => {
    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('handles connect failure', async () => {
    mockAdapter.requestAndConnect.mockRejectedValue(new Error('Connection failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails }),
    );

    let connectResult: boolean | undefined;
    await act(async () => {
      connectResult = await result.current.connect();
    });

    expect(connectResult).toBe(false);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.loading).toBe(false);
    errorSpy.mockRestore();
  });

  it('disconnect calls adapter.disconnect', async () => {
    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(mockAdapter.disconnect).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });

  it('calls onConnectionChange callback', async () => {
    const onConnectionChange = vi.fn();

    const { result } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails, onConnectionChange }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(onConnectionChange).toHaveBeenCalledWith(true);

    act(() => {
      result.current.disconnect();
    });

    expect(onConnectionChange).toHaveBeenCalledWith(false);
  });

  it('cleans up adapter on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useBoardBluetooth({ boardDetails: mockBoardDetails }),
    );

    await act(async () => {
      await result.current.connect();
    });

    unmount();

    expect(mockAdapter.disconnect).toHaveBeenCalled();
  });
});
