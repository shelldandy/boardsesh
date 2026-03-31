import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock BoardRenderer
vi.mock('../../board-renderer/board-renderer', () => ({
  default: () => <div data-testid="board-renderer" />,
}));

// Mock getBoardDetails
vi.mock('@/app/lib/__generated__/product-sizes-data', () => ({
  getBoardDetails: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 1,
    size_id: 10,
    set_ids: [1, 20],
    images_to_holds: { 'test.png': [] },
    holdsData: [],
    edge_left: 0,
    edge_right: 144,
    edge_bottom: 0,
    edge_top: 156,
    boardWidth: 1080,
    boardHeight: 1920,
    supportsMirroring: false,
  })),
}));

// Mock CSS modules
vi.mock('../board-scroll.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}));

import FindNearbyCard from '../find-nearby-card';

describe('FindNearbyCard', () => {
  it('renders idle state with "Find nearby" text and location icon', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} />);

    expect(getByText('Find nearby')).toBeDefined();
    expect(container.querySelector('[data-testid="LocationOnOutlinedIcon"]')).toBeDefined();
  });

  it('renders loading state with "Finding boards…" text and spinner', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} loading />);

    expect(getByText('Finding boards…')).toBeDefined();
    expect(container.querySelector('[role="progressbar"]')).toBeDefined();
  });

  it('renders error state with "Location unavailable" text and error icon', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} error />);

    const label = getByText('Location unavailable');
    expect(label).toBeDefined();
    expect(label.className).toContain('cardNameError');
    expect(container.querySelector('[data-testid="LocationOffOutlinedIcon"]')).toBeDefined();
  });

  it('error state applies disabled styling to card square', () => {
    const onClick = vi.fn();
    const { getByText } = render(<FindNearbyCard onClick={onClick} error />);

    const label = getByText('Location unavailable');
    const cardRoot = label.parentElement!;
    const cardSquare = cardRoot.querySelector('.cardSquareDisabled');
    expect(cardSquare).not.toBeNull();
  });

  it('calls onClick in idle state', () => {
    const onClick = vi.fn();
    const { getByText } = render(<FindNearbyCard onClick={onClick} />);

    const label = getByText('Find nearby');
    label.parentElement!.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick in error state', () => {
    const onClick = vi.fn();
    const { getByText } = render(<FindNearbyCard onClick={onClick} error />);

    const label = getByText('Location unavailable');
    label.parentElement!.click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders BoardRenderer for greyed-out board preview', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(<FindNearbyCard onClick={onClick} />);

    expect(getByTestId('board-renderer')).toBeDefined();
  });

  it('small size variant applies correct class', () => {
    const onClick = vi.fn();
    const { getByText } = render(<FindNearbyCard onClick={onClick} size="small" />);

    const label = getByText('Find nearby');
    const cardRoot = label.parentElement!;
    expect(cardRoot.className).toContain('cardScrollSmall');
  });
});
