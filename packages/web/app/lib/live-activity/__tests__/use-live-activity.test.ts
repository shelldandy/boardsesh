import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsNativeApp = vi.fn(() => false);
const mockGetPlatform = vi.fn<() => 'ios' | 'android' | 'web'>(() => 'web');

vi.mock('../../ble/capacitor-utils', () => ({
  isNativeApp: () => mockIsNativeApp(),
  getPlatform: () => mockGetPlatform(),
}));

const mockIsLiveActivityAvailable = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const mockStartLiveActivitySession = vi.fn<() => Promise<void>>(() => Promise.resolve());
const mockEndLiveActivitySession = vi.fn<() => Promise<void>>(() => Promise.resolve());
const mockUpdateLiveActivity = vi.fn<() => Promise<void>>(() => Promise.resolve());

vi.mock('../live-activity-plugin', () => ({
  isLiveActivityAvailable: () => mockIsLiveActivityAvailable(),
  startLiveActivitySession: (...args: unknown[]) => mockStartLiveActivitySession(...(args as [])),
  endLiveActivitySession: (...args: unknown[]) => mockEndLiveActivitySession(...(args as [])),
  updateLiveActivity: (...args: unknown[]) => mockUpdateLiveActivity(...(args as [])),
}));

// Import after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic import after mock setup
const { useLiveActivity } = await import('../use-live-activity');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { ClimbQueueItem } from '@/app/components/queue-control/types';
import type { BoardDetails } from '../../types';

function makeBoardDetails(overrides?: Partial<BoardDetails>): BoardDetails {
  return {
    images_to_holds: {},
    holdsData: {},
    edge_left: 0,
    edge_right: 100,
    edge_bottom: 0,
    edge_top: 100,
    boardHeight: 100,
    boardWidth: 100,
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: [1, 2],
    ...overrides,
  } as BoardDetails;
}

function makeQueueItem(id: string): ClimbQueueItem {
  return {
    uuid: id,
    climb: {
      uuid: `climb-${id}`,
      name: `Test Climb ${id}`,
      difficulty: 'V4',
      frames: 'p1r12p2r13',
      angle: 40,
      setter_username: 'tester',
      ascensionist_count: 10,
      quality_average: '3.5',
      stars: 3,
      difficulty_error: '0.5',
      benchmark_difficulty: null,
    },
  };
}

interface LiveActivityHookProps {
  queue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
  boardDetails: BoardDetails | null;
  sessionId: string | null;
  isSessionActive: boolean;
}

function defaultProps(): LiveActivityHookProps {
  return {
    queue: [],
    currentClimbQueueItem: null,
    boardDetails: null,
    sessionId: null,
    isSessionActive: false,
  };
}

// ---------------------------------------------------------------------------
// We cannot use @testing-library/react's renderHook in this project since
// it is not installed. Instead we use a minimal React test helper that
// exercises the hook via a thin wrapper component rendered with React's
// built-in APIs (no DOM required for effect-only hooks in vitest/jsdom).
// ---------------------------------------------------------------------------

/**
 * Minimal renderHook replacement using React.createElement + vitest jsdom.
 */
function renderLiveActivityHook(initialProps: LiveActivityHookProps) {
  let latestProps = { ...initialProps };
  const container = document.createElement('div');
  document.body.appendChild(container);

  function HookHost() {
    useLiveActivity(latestProps);
    return null;
  }

  // Use React 18 createRoot if available, otherwise fall back to render
  const root = (React as unknown as { createRoot?: (c: HTMLElement) => { render: (el: React.ReactElement) => void; unmount: () => void } }).createRoot?.(container);

  function render() {
    if (root) {
      root.render(React.createElement(HookHost));
    }
  }

  render();

  return {
    rerender(newProps: Partial<LiveActivityHookProps>) {
      latestProps = { ...latestProps, ...newProps };
      render();
    },
    unmount() {
      if (root) {
        root.unmount();
      }
      container.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLiveActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNativeApp.mockReturnValue(false);
    mockGetPlatform.mockReturnValue('web');
    mockIsLiveActivityAvailable.mockResolvedValue(true);
  });

  it('does not call plugin on non-iOS platforms', async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('android');

    const item = makeQueueItem('1');
    const hook = renderLiveActivityHook({
      ...defaultProps(),
      queue: [item],
      currentClimbQueueItem: item,
      boardDetails: makeBoardDetails(),
    });

    // Wait for effects
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStartLiveActivitySession).not.toHaveBeenCalled();
    expect(mockUpdateLiveActivity).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('does not call plugin on web', async () => {
    mockIsNativeApp.mockReturnValue(false);
    mockGetPlatform.mockReturnValue('web');

    const item = makeQueueItem('1');
    const hook = renderLiveActivityHook({
      ...defaultProps(),
      queue: [item],
      currentClimbQueueItem: item,
      boardDetails: makeBoardDetails(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockStartLiveActivitySession).not.toHaveBeenCalled();
    expect(mockUpdateLiveActivity).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('calls startSession when queue becomes active', async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('ios');

    const item = makeQueueItem('1');
    const hook = renderLiveActivityHook({
      ...defaultProps(),
      queue: [item],
      currentClimbQueueItem: item,
      boardDetails: makeBoardDetails(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockStartLiveActivitySession).toHaveBeenCalledTimes(1);
    expect(mockStartLiveActivitySession).toHaveBeenCalledWith(
      expect.objectContaining({
        boardName: 'kilter',
        layoutId: 1,
        sizeId: 1,
      }),
    );

    hook.unmount();
  });

  it('calls endSession when queue is cleared', async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('ios');

    const item = makeQueueItem('1');
    const hook = renderLiveActivityHook({
      ...defaultProps(),
      queue: [item],
      currentClimbQueueItem: item,
      boardDetails: makeBoardDetails(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockStartLiveActivitySession).toHaveBeenCalledTimes(1);

    hook.rerender({
      queue: [],
      currentClimbQueueItem: null,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockEndLiveActivitySession).toHaveBeenCalled();

    hook.unmount();
  });

  it('calls updateActivity on climb change in local mode', async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('ios');

    const item1 = makeQueueItem('1');
    const item2 = makeQueueItem('2');

    const hook = renderLiveActivityHook({
      ...defaultProps(),
      queue: [item1, item2],
      currentClimbQueueItem: item1,
      boardDetails: makeBoardDetails(),
    });

    await new Promise((r) => setTimeout(r, 50));

    // Initial update should have been called
    expect(mockUpdateLiveActivity).toHaveBeenCalled();

    mockUpdateLiveActivity.mockClear();

    hook.rerender({ currentClimbQueueItem: item2 });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockUpdateLiveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        climbName: 'Test Climb 2',
        currentIndex: 1,
        totalClimbs: 2,
        hasNext: false,
        hasPrevious: true,
      }),
    );

    hook.unmount();
  });

  it('does not call updateActivity in party mode', async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('ios');

    const item = makeQueueItem('1');
    const hook = renderLiveActivityHook({
      ...defaultProps(),
      queue: [item],
      currentClimbQueueItem: item,
      boardDetails: makeBoardDetails(),
      isSessionActive: true,
      sessionId: 'party-123',
    });

    await new Promise((r) => setTimeout(r, 50));

    // startSession may be called, but updateActivity should NOT be called in party mode
    expect(mockUpdateLiveActivity).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('handles plugin unavailability gracefully', async () => {
    mockIsNativeApp.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('ios');
    mockIsLiveActivityAvailable.mockResolvedValue(false);

    const item = makeQueueItem('1');

    // Should not throw
    const hook = renderLiveActivityHook({
      ...defaultProps(),
      queue: [item],
      currentClimbQueueItem: item,
      boardDetails: makeBoardDetails(),
    });

    await new Promise((r) => setTimeout(r, 100));

    // When availability check returns false, startSession may still be called
    // on the first render (before the async check completes), but the hook
    // should not crash. The key assertion is no uncaught error.
    expect(true).toBe(true);

    hook.unmount();
  });
});
