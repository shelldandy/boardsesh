import { JSDOM } from 'jsdom';

// Set up jsdom globals before any other imports
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
globalThis.document = dom.window.document;
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLDivElement = dom.window.HTMLDivElement;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.getComputedStyle = dom.window.getComputedStyle;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    expect(screen.getByText('My Kilter')).toBeDefined();
    expect(screen.getByText('Kilter · The Gym')).toBeDefined();
  });

  it('shows fallback icon initially (before IntersectionObserver fires)', () => {
    const onClick = vi.fn();
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    // BoardRenderer should NOT be present before intersection
    expect(screen.queryByTestId('board-renderer')).toBeNull();
  });

  it('renders BoardRenderer after IntersectionObserver reports intersection', () => {
    const onClick = vi.fn();
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    triggerIntersection(true);

    expect(screen.getByTestId('board-renderer')).toBeDefined();
  });

  it('observer disconnects after first intersection (one-shot)', () => {
    const onClick = vi.fn();
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    // disconnect is not called before intersection
    const disconnectCountBefore = mockDisconnect.mock.calls.length;

    triggerIntersection(true);

    // disconnect should have been called once by the one-shot logic
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
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} disabled />);

    // The outermost div is the card wrapper; click it
    const nameEl = screen.getByText('My Kilter');
    const cardRoot = nameEl.parentElement!;
    cardRoot.click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows disabledText when disabled', () => {
    const onClick = vi.fn();
    render(
      <BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} disabled disabledText="Not available" />,
    );

    expect(screen.getByText('Not available')).toBeDefined();
    // The normal meta should be replaced
    expect(screen.queryByText('Kilter · The Gym')).toBeNull();
  });

  it('selected card has selected class', () => {
    const onClick = vi.fn();
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} selected />);

    // The square div should include the selected class
    const nameEl = screen.getByText('My Kilter');
    const cardRoot = nameEl.parentElement!;
    // The card square is the first child of the card root
    const cardSquare = cardRoot.querySelector('.cardSquareSelected');
    expect(cardSquare).not.toBeNull();
  });

  it('small size variant applies correct class', () => {
    const onClick = vi.fn();
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} size="small" />);

    const nameEl = screen.getByText('My Kilter');
    const cardRoot = nameEl.parentElement!;
    expect(cardRoot.className).toContain('cardScrollSmall');
  });

  it('does not render BoardRenderer when boardDetails is null', () => {
    const onClick = vi.fn();
    // Render without userBoard or storedConfig so boardDetails is null
    render(<BoardScrollCard onClick={onClick} />);

    triggerIntersection(true);

    expect(screen.queryByTestId('board-renderer')).toBeNull();
  });

  it('does not render BoardRenderer when visible but not intersecting', () => {
    const onClick = vi.fn();
    render(<BoardScrollCard userBoard={makeUserBoard()} onClick={onClick} />);

    triggerIntersection(false);

    expect(screen.queryByTestId('board-renderer')).toBeNull();
  });
});
