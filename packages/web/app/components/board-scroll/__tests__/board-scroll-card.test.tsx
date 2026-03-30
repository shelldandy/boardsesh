import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import type { UserBoard } from '@boardsesh/shared-schema';

// Mock BoardRenderer
vi.mock('../../board-renderer/board-renderer', () => ({
  default: () => <div data-testid="board-renderer" />,
}));

// Mock getBoardDetails
vi.mock('@/app/lib/__generated__/product-sizes-data', () => ({
  getBoardDetails: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 8,
    size_id: 25,
    set_ids: [26, 27],
    images_to_holds: { 'test.png': [] },
    holdsData: [],
    edge_left: 0,
    edge_right: 100,
    edge_bottom: 0,
    edge_top: 100,
    boardWidth: 1080,
    boardHeight: 1920,
    supportsMirroring: false,
  })),
}));

// Mock getMoonBoardDetails
vi.mock('@/app/lib/moonboard-config', () => ({
  getMoonBoardDetails: vi.fn(() => null),
}));

// Mock CSS modules - return identity proxy so class names are the key themselves
vi.mock('../board-scroll.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}));

import BoardScrollCard from '../board-scroll-card';

// IntersectionObserver mock state
let observerCallback: IntersectionObserverCallback;
let mockObserve: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockObserve = vi.fn();
  mockDisconnect = vi.fn();

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
      observerCallback = callback;
    }
    observe = mockObserve;
    disconnect = mockDisconnect;
    unobserve = vi.fn();
  }

  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

function triggerIntersection(isIntersecting: boolean) {
  act(() => {
    observerCallback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

function makeUserBoard(overrides?: Partial<UserBoard>): UserBoard {
  return {
    uuid: 'board-1',
    slug: 'my-kilter',
    ownerId: 'user-1',
    boardType: 'kilter',
    layoutId: 8,
    sizeId: 25,
    setIds: '26,27',
    angle: 40,
    name: 'My Kilter',
    locationName: 'The Gym',
    isPublic: true,
    isOwned: true,
    isAngleAdjustable: false,
    createdAt: '2024-01-01T00:00:00Z',
    totalAscents: 0,
    uniqueClimbers: 0,
    followerCount: 0,
    commentCount: 0,
    isFollowedByMe: false,
    ...overrides,
  };
}

describe('BoardScrollCard', () => {
  it('renders card with name and meta text from userBoard', () => {
    const onClick = vi.fn();
    const { getByText } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    expect(getByText('My Kilter')).toBeDefined();
    expect(getByText('Kilter · The Gym')).toBeDefined();
  });

  it('shows fallback icon initially (before IntersectionObserver fires)', () => {
    const onClick = vi.fn();
    const { queryByTestId } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    // BoardRenderer should NOT be present before intersection
    expect(queryByTestId('board-renderer')).toBeNull();
  });

  it('renders BoardRenderer after IntersectionObserver reports intersection', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    triggerIntersection(true);

    expect(getByTestId('board-renderer')).toBeDefined();
  });

  it('observer disconnects after first intersection (one-shot)', () => {
    const onClick = vi.fn();
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    const disconnectCountBefore = mockDisconnect.mock.calls.length;

    triggerIntersection(true);

    // disconnect should have been called by the one-shot logic
    expect(mockDisconnect.mock.calls.length).toBeGreaterThan(disconnectCountBefore);
  });

  it('observer disconnects on unmount (cleanup)', () => {
    const onClick = vi.fn();
    const { unmount } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    mockDisconnect.mockClear();
    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('disabled card does not trigger onClick', () => {
    const onClick = vi.fn();
    const { getByText } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} disabled />);

    const nameEl = getByText('My Kilter');
    const cardRoot = nameEl.parentElement!;
    cardRoot.click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows disabledText when disabled', () => {
    const onClick = vi.fn();
    const { getByText, queryByText } = render(
      <BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} disabled disabledText="Not available" />,
    );

    expect(getByText('Not available')).toBeDefined();
    // The normal meta should be replaced
    expect(queryByText('Kilter · The Gym')).toBeNull();
  });

  it('selected card has selected class', () => {
    const onClick = vi.fn();
    const { getByText } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} selected />);

    const nameEl = getByText('My Kilter');
    const cardRoot = nameEl.parentElement!;
    const cardSquare = cardRoot.querySelector('.cardSquareSelected');
    expect(cardSquare).not.toBeNull();
  });

  it('small size variant applies correct class', () => {
    const onClick = vi.fn();
    const { getByText } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} size="small" />);

    const nameEl = getByText('My Kilter');
    const cardRoot = nameEl.parentElement!;
    expect(cardRoot.className).toContain('cardScrollSmall');
  });

  it('does not render BoardRenderer when boardDetails is null', () => {
    const onClick = vi.fn();
    const { queryByTestId } = render(<BoardScrollCard onClick={onClick} />);

    triggerIntersection(true);

    expect(queryByTestId('board-renderer')).toBeNull();
  });

  it('does not render BoardRenderer when visible but not intersecting', () => {
    const onClick = vi.fn();
    const { queryByTestId } = render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    triggerIntersection(false);

    expect(queryByTestId('board-renderer')).toBeNull();
  });
});
