// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import type { BoardDetails } from '@/app/lib/types';

vi.mock('../util', () => ({
  getImageUrl: (imageUrl: string, board: string) => `/images/${board}/${imageUrl}`,
  buildOverlayUrl: vi.fn(
    (_bd: BoardDetails, frames: string, thumbnail?: boolean) =>
      `/api/internal/board-render?frames=${frames}${thumbnail ? '&thumbnail=1' : ''}&include_background=1`,
  ),
}));

import BoardImageLayers from '../board-image-layers';
import { buildOverlayUrl } from '../util';

const mockBoardDetails: BoardDetails = {
  board_name: 'kilter',
  layout_id: 1,
  size_id: 7,
  set_ids: [1, 20],
  images_to_holds: { 'product_sizes_layouts_sets/36-1.png': [] },
  holdsData: [],
  edge_left: 0,
  edge_right: 144,
  edge_bottom: 0,
  edge_top: 180,
  boardWidth: 1080,
  boardHeight: 1350,
};

describe('BoardImageLayers', () => {
  it('renders background and overlay images when frames are provided', () => {
    const { container } = render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
      />,
    );

    const images = container.querySelectorAll('img');
    // Background image + overlay image rendered separately
    expect(images).toHaveLength(2);
    expect(images[1].getAttribute('src')).toContain('frames=p1r42p2r43');
  });

  it('renders background images when no frames are provided', () => {
    const { container } = render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        mirrored={false}
      />,
    );

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('/images/kilter/product_sizes_layouts_sets/36-1.png');
  });

  it('renders multiple background images when no frames and board has multiple sets', () => {
    const multiSetBoard: BoardDetails = {
      ...mockBoardDetails,
      images_to_holds: {
        'product_sizes_layouts_sets/36-1.png': [],
        'product_sizes_layouts_sets/37-1.png': [],
      },
    };

    const { container } = render(
      <BoardImageLayers
        boardDetails={multiSetBoard}
        mirrored={false}
      />,
    );

    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('renders background images plus overlay with multiple background sets', () => {
    const multiSetBoard: BoardDetails = {
      ...mockBoardDetails,
      images_to_holds: {
        'product_sizes_layouts_sets/36-1.png': [],
        'product_sizes_layouts_sets/37-1.png': [],
      },
    };

    const { container } = render(
      <BoardImageLayers
        boardDetails={multiSetBoard}
        frames="p1r42"
        mirrored={false}
      />,
    );

    // 2 background images + 1 overlay
    expect(container.querySelectorAll('img')).toHaveLength(3);
  });

  it('applies scaleX(-1) transform when mirrored', () => {
    const { container } = render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        frames="p1r42"
        mirrored={true}
        style={{ width: '100%' }}
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.transform).toBe('scaleX(-1)');
  });

  it('does not apply transform when not mirrored', () => {
    const { container } = render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        frames="p1r42"
        mirrored={false}
        style={{ width: '100%' }}
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.transform).toBeFalsy();
  });

  it('passes thumbnail flag to buildOverlayUrl', () => {
    render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        frames="p1r42"
        mirrored={false}
        thumbnail
      />,
    );

    expect(buildOverlayUrl).toHaveBeenCalledWith(mockBoardDetails, 'p1r42', true);
  });

  it('uses object-fit contain when contain prop is set', () => {
    const { container } = render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        frames="p1r42"
        mirrored={false}
        contain
      />,
    );

    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.style.objectFit).toBe('contain');
    });
  });

  it('sets loading="lazy" on the overlay image', () => {
    const { container } = render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
      />,
    );

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    // Overlay is the second image
    expect(images[1].getAttribute('loading')).toBe('lazy');
  });

  it('does not set loading="lazy" on thumbnail overlay images', () => {
    const { container } = render(
      <BoardImageLayers
        boardDetails={mockBoardDetails}
        frames="p1r42p2r43"
        mirrored={false}
        thumbnail
      />,
    );

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    // Overlay is the second image
    expect(images[1].getAttribute('loading')).toBeNull();
  });
});
