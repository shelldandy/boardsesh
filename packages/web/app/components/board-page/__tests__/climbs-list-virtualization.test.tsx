// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Climb, BoardDetails } from '@/app/lib/types';

// --- Mocks ---

vi.mock('next/navigation', () => ({
  usePathname: () => '/kilter/original/12x12/default/40/list',
}));

vi.mock('@/app/hooks/use-is-dark-mode', () => ({
  useIsDarkMode: () => false,
}));

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('../../climb-card/climb-list-item', () => ({
  default: ({ climb }: { climb: Climb }) => (
    <div data-testid="climb-list-item" data-uuid={climb.uuid}>
      {climb.name}
    </div>
  ),
}));

vi.mock('../../climb-card/climb-card', () => ({
  default: ({ climb }: { climb: Climb }) => (
    <div data-testid="climb-card" data-uuid={climb.uuid}>
      {climb.name}
    </div>
  ),
}));

vi.mock('../../climb-card/drawer-climb-header', () => ({
  default: () => <div data-testid="drawer-climb-header" />,
}));

vi.mock('../../climb-actions', () => ({
  ClimbActions: () => <div data-testid="climb-actions" />,
}));

vi.mock('../../climb-actions/playlist-selection-content', () => ({
  default: () => <div data-testid="playlist-selection-content" />,
}));

vi.mock('../../error-boundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../board-page-skeleton', () => ({
  ClimbCardSkeleton: () => <div data-testid="climb-card-skeleton" />,
  ClimbListItemSkeleton: () => <div data-testid="climb-list-item-skeleton" />,
}));

vi.mock('@/app/lib/user-preferences-db', () => ({
  getPreference: vi.fn(() => Promise.resolve('list')),
  setPreference: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/app/hooks/use-infinite-scroll', () => ({
  useInfiniteScroll: () => ({ sentinelRef: { current: null } }),
}));

vi.mock('@/app/lib/rendering-metrics', () => ({
  trackListBatchRender: vi.fn(),
  trackRenderComplete: vi.fn(),
  trackRenderError: vi.fn(),
}));

vi.mock('../climb-list-utils', () => ({
  classifyClimbListChange: () => 'replace',
}));

vi.mock('@/app/lib/climb-action-utils', () => ({
  getExcludedClimbActions: () => [],
}));

vi.mock('../selected-climb-store', () => ({
  SelectionStoreContext: React.createContext(null),
  useSelectionStore: () => ({
    getSnapshot: () => null,
    subscribe: () => () => {},
    setUuid: vi.fn(),
  }),
  useIsClimbSelected: () => false,
}));

vi.mock('../climbs-list.module.css', () => ({
  default: { gridItem: 'gridItem', listItem: 'listItem' },
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 16: 64 },
    colors: { error: '#B8524C', primary: '#8C4A52', success: '#6B9080' },
    neutral: { 200: '#E5E7EB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563' },
    typography: {
      fontSize: { xs: 12, sm: 14, base: 16, xl: 20, '2xl': 24 },
      fontWeight: { normal: 400, semibold: 600, bold: 700 },
    },
    layout: { bottomNavSpacer: 80 },
  },
}));

// Track calls to useWindowVirtualizer
let lastVirtualizerOpts: { count: number } | null = null;

// Configurable visible range (without overscan) for testing infinite scroll.
// Tests can override this to simulate different viewport sizes.
let mockVisibleEndIndex = 6; // ~mobile viewport (7 items visible at 102px in 700px)

vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: (opts: { count: number; estimateSize: () => number; overscan: number; getItemKey: (i: number) => string | number }) => {
    lastVirtualizerOpts = opts;
    // Render items up to overscan limit (simulates what getVirtualItems returns)
    const itemCount = Math.min(opts.overscan + mockVisibleEndIndex + 1, opts.count);
    const estimatedSize = opts.estimateSize();
    const items = Array.from({ length: itemCount }, (_, i) => ({
      index: i,
      key: opts.getItemKey ? opts.getItemKey(i) : `item-${i}`,
      start: i * estimatedSize,
      size: estimatedSize,
      end: (i + 1) * estimatedSize,
      lane: 0,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => opts.count * estimatedSize,
      measureElement: vi.fn(),
      scrollToIndex: vi.fn(),
      scrollOffset: 0,
      // range gives visible items WITHOUT overscan
      range: opts.count > 0
        ? { startIndex: 0, endIndex: Math.min(mockVisibleEndIndex, opts.count - 1) }
        : null,
    };
  },
}));

import ClimbsList from '../climbs-list';

// --- Helpers ---

function makeClimb(index: number): Climb {
  return {
    uuid: `climb-${index}`,
    name: `Test Boulder ${index}`,
    setter_username: 'setter',
    description: '',
    frames: `p${index}r14`,
    angle: 40,
    ascensionist_count: 5,
    difficulty: 'V4',
    quality_average: '3.0',
    stars: 0,
    difficulty_error: '0.5',
    benchmark_difficulty: null,
  };
}

function makeBoardDetails(): BoardDetails {
  return {
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: [1],
    images_to_holds: {},
    holdsData: [],
    edge_left: 0,
    edge_right: 100,
    edge_bottom: 0,
    edge_top: 100,
    boardHeight: 100,
    boardWidth: 100,
  } as BoardDetails;
}

const allClimbs = Array.from({ length: 100 }, (_, i) => makeClimb(i));

describe('ClimbsList virtualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastVirtualizerOpts = null;
    mockVisibleEndIndex = 6; // Default to mobile-like viewport
  });

  it('renders only virtual items in list mode (not all 100)', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('climb-list-item');
    // Mock renders visible items + overscan (6 + 25 + 1 = 32), far fewer than all 100
    expect(items.length).toBeLessThan(allClimbs.length);
    expect(items.length).toBeGreaterThan(0);
  });

  it('virtual items map to correct climb data', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('climb-list-item');
    expect(items[0].getAttribute('data-uuid')).toBe('climb-0');
    expect(items[0].textContent).toBe('Test Boulder 0');
  });

  it('passes correct count to the virtualizer', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    // The virtualizer should receive the full climb count
    expect(lastVirtualizerOpts).not.toBeNull();
    expect(lastVirtualizerOpts!.count).toBe(100);
  });

  it('renders skeleton when fetching with no climbs', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={[]}
        isFetching={true}
        hasMore={true}
        onLoadMore={vi.fn()}
      />,
    );

    const skeletons = screen.getAllByTestId('climb-list-item-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('with small climb list, renders all items', () => {
    const fiveClimbs = allClimbs.slice(0, 5);

    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={fiveClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('climb-list-item');
    expect(items).toHaveLength(5);
  });
});

describe('ClimbsList infinite scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastVirtualizerOpts = null;
    mockVisibleEndIndex = 6;
  });

  it('calls onLoadMore when visible end + buffer reaches total items', () => {
    // 20 items, visible end at index 6: 6 + 18 = 24 >= 20 → should load
    const onLoadMore = vi.fn();
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 20)}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('does NOT call onLoadMore when visible end + buffer is below total items', () => {
    // 40 items, visible end at index 6: 6 + 18 = 24 < 40 → should NOT load
    const onLoadMore = vi.fn();
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 40)}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does NOT call onLoadMore when isFetching is true', () => {
    const onLoadMore = vi.fn();
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 20)}
        isFetching={true}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does NOT call onLoadMore when hasMore is false', () => {
    const onLoadMore = vi.fn();
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 20)}
        isFetching={false}
        hasMore={false}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('with desktop-sized viewport, does NOT cascade to page 3 after loading 40 items', () => {
    // Simulate desktop: 14 visible items (1440px / 102px)
    mockVisibleEndIndex = 13;
    const onLoadMore = vi.fn();

    // 40 items, desktop visible end at 13: 13 + 18 = 31 < 40 → should NOT load
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 40)}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('with desktop-sized viewport, eagerly loads page 2 from initial 20 items', () => {
    // Simulate desktop: 14 visible items
    mockVisibleEndIndex = 13;
    const onLoadMore = vi.fn();

    // 20 items, desktop visible end at 13: 13 + 18 = 31 >= 20 → should load
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 20)}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('with mobile viewport, eagerly loads page 2 from initial 20 items', () => {
    // Simulate mobile: 7 visible items (700px / 102px)
    mockVisibleEndIndex = 6;
    const onLoadMore = vi.fn();

    // 20 items, mobile visible end at 6: 6 + 18 = 24 >= 20 → should load
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 20)}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('with mobile viewport, does NOT cascade to page 3 after loading 40 items', () => {
    mockVisibleEndIndex = 6;
    const onLoadMore = vi.fn();

    // 40 items, mobile visible end at 6: 6 + 18 = 24 < 40 → should NOT load
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 40)}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('with 4K-sized viewport, does NOT cascade to page 3 after loading 40 items', () => {
    // Simulate 4K display: ~21 visible items (2160px / 102px)
    mockVisibleEndIndex = 20;
    const onLoadMore = vi.fn();

    // 40 items, 4K visible end at 20: 20 + 18 = 38 < 40 → should NOT load
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs.slice(0, 40)}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does NOT call onLoadMore with empty climb list', () => {
    const onLoadMore = vi.fn();
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={[]}
        isFetching={false}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
