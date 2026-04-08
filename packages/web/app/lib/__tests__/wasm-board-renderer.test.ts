// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WASM module
const mockRenderOverlay = vi.fn((_config: string) => {
  // 2x2 pixel image: 8 bytes header + 16 bytes RGBA data
  const buf = new Uint8Array(8 + 16);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 2, true); // width = 2
  view.setUint32(4, 2, true); // height = 2
  for (let i = 8; i < 24; i += 4) {
    buf[i] = 255; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 128;
  }
  return buf;
});
vi.mock('@boardsesh/board-renderer-wasm', () => ({
  default: vi.fn(),
  initSync: vi.fn(),
  render_overlay: (config: string) => mockRenderOverlay(config),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(() => Promise.resolve(new Uint8Array([0]))),
}));
const mockExistsSync = vi.fn<(path: string) => boolean>(() => true);
vi.mock('fs', () => ({
  existsSync: (path: string) => mockExistsSync(path),
}));

// Mock sharp
const mockComposite = vi.fn();
const mockResize = vi.fn();
const mockWebpOptions = vi.fn();
const mockPngOptions = vi.fn();
const mockSharpInstance = () => {
  const instance: Record<string, ReturnType<typeof vi.fn>> = {
    composite: vi.fn((...args: unknown[]) => {
      mockComposite(...args);
      return instance;
    }),
    resize: vi.fn((...args: unknown[]) => {
      mockResize(...args);
      return { toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0xB0]))) };
    }),
    webp: vi.fn((opts: unknown) => {
      mockWebpOptions(opts);
      return { toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0x52, 0x49, 0x46, 0x46]))) };
    }),
    png: vi.fn((opts?: unknown) => {
      mockPngOptions(opts);
      return { toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0x89, 0x50, 0x4E, 0x47]))) };
    }),
  };
  return instance;
};
vi.mock('sharp', () => ({
  default: vi.fn((_input?: unknown, _options?: unknown) => mockSharpInstance()),
}));

vi.mock('@/app/components/board-renderer/types', () => ({
  THUMBNAIL_WIDTH: 200,
  HOLD_STATE_MAP: {
    kilter: {
      42: { name: 'STARTING', color: '#00FF00' },
      43: { name: 'HAND', color: '#00FFFF' },
      44: { name: 'FINISH', color: '#FF00FF' },
      45: { name: 'FOOT', color: '#FFAA00' },
    },
    tension: {
      1: { name: 'STARTING', color: '#00FF00' },
      2: { name: 'HAND', color: '#0000FF' },
    },
    moonboard: {
      42: { name: 'STARTING', color: '#00FF00' },
      43: { name: 'HAND', color: '#0000FF' },
      44: { name: 'FINISH', color: '#FF0000' },
    },
  },
}));

import {
  findWasmPath,
  ensureWasmInitialized,
  renderOverlayRgba,
  buildRenderConfig,
  findPublicImagePath,
  toWebpPath,
  getBackgroundRelPaths,
  compositeWithBackgrounds,
} from '../wasm-board-renderer';
import type { BoardName } from '@/app/lib/types';

describe('wasm-board-renderer shared module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  describe('findWasmPath', () => {
    it('returns first existing candidate', () => {
      const result = findWasmPath();
      expect(result).toContain('board_renderer_wasm_bg.wasm');
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it('returns fallback and logs error when no file exists', () => {
      mockExistsSync.mockReturnValue(false);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = findWasmPath();
      expect(result).toContain('board_renderer_wasm_bg.wasm');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WASM file not found'),
        expect.any(Array),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('ensureWasmInitialized', () => {
    it('initializes WASM module', async () => {
      await ensureWasmInitialized();
      // If it doesn't throw, initialization succeeded
    });
  });

  describe('renderOverlayRgba', () => {
    it('parses dimension header and returns RGBA buffer', async () => {
      await ensureWasmInitialized();
      const result = renderOverlayRgba('{}');
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
      expect(result.rgbaBuffer).toBeInstanceOf(Buffer);
      expect(result.rgbaBuffer.length).toBe(16); // 2x2x4 RGBA
    });

    it('passes config to WASM render_overlay', async () => {
      await ensureWasmInitialized();
      const config = JSON.stringify({ board_name: 'kilter' });
      renderOverlayRgba(config);
      expect(mockRenderOverlay).toHaveBeenCalledWith(config);
    });
  });

  describe('buildRenderConfig', () => {
    it('builds correct config with hold state map', () => {
      const config = buildRenderConfig({
        boardName: 'kilter' as BoardName,
        boardWidth: 1080,
        boardHeight: 1350,
        outputWidth: 1080,
        frames: 'p1073r42p1090r43',
        thumbnail: false,
        holdsData: [
          { id: 1073, mirroredHoldId: null, cx: 200, cy: 300, r: 20 },
          { id: 1090, mirroredHoldId: null, cx: 500, cy: 600, r: 20 },
        ],
      });

      expect(config.board_name).toBe('kilter');
      expect(config.board_width).toBe(1080);
      expect(config.board_height).toBe(1350);
      expect(config.output_width).toBe(1080);
      expect(config.frames).toBe('p1073r42p1090r43');
      expect(config.mirrored).toBe(false);
      expect(config.thumbnail).toBe(false);
      expect(config.holds).toHaveLength(2);
      expect(config.hold_state_map[42]).toEqual({ color: '#00FF00' });
      expect(config.hold_state_map[43]).toEqual({ color: '#00FFFF' });
    });

    it('uses board-specific hold state map', () => {
      const config = buildRenderConfig({
        boardName: 'moonboard' as BoardName,
        boardWidth: 500,
        boardHeight: 800,
        outputWidth: 500,
        frames: 'p1r42',
        thumbnail: false,
        holdsData: [{ id: 1, mirroredHoldId: null, cx: 100, cy: 200, r: 15 }],
      });

      expect(config.hold_state_map[42]).toEqual({ color: '#00FF00' });
      expect(config.hold_state_map[43]).toEqual({ color: '#0000FF' });
      expect(config.hold_state_map[44]).toEqual({ color: '#FF0000' });
    });

    it('sets thumbnail output width when thumbnail is true', () => {
      const config = buildRenderConfig({
        boardName: 'kilter' as BoardName,
        boardWidth: 1080,
        boardHeight: 1350,
        outputWidth: 200,
        frames: 'p1r42',
        thumbnail: true,
        holdsData: [],
      });

      expect(config.output_width).toBe(200);
      expect(config.thumbnail).toBe(true);
    });
  });

  describe('toWebpPath', () => {
    it('converts .png to .webp', () => {
      expect(toWebpPath('images/kilter', 'board.png', false)).toBe('images/kilter/board.webp');
    });

    it('inserts /thumbs/ for thumbnails', () => {
      expect(toWebpPath('images/kilter', 'board.png', true)).toBe('images/kilter/thumbs/board.webp');
    });

    it('handles nested paths with thumbnail', () => {
      expect(toWebpPath('images/kilter', 'sub/board.png', true)).toBe(
        'images/kilter/sub/thumbs/board.webp',
      );
    });

    it('preserves non-png extensions', () => {
      expect(toWebpPath('images/kilter', 'board.jpg', false)).toBe('images/kilter/board.jpg');
    });
  });

  describe('findPublicImagePath', () => {
    it('returns first existing candidate', () => {
      mockExistsSync.mockReturnValue(true);
      const result = findPublicImagePath('images/test.webp');
      expect(result).toContain('images/test.webp');
    });

    it('returns null when no candidate exists', () => {
      mockExistsSync.mockReturnValue(false);
      const result = findPublicImagePath('images/missing.webp');
      expect(result).toBeNull();
    });
  });

  describe('getBackgroundRelPaths', () => {
    it('returns Aurora board paths from images_to_holds keys', () => {
      const paths = getBackgroundRelPaths(
        {
          board_name: 'kilter',
          images_to_holds: { 'product_sizes_layouts_sets/36-1.png': [] },
        },
        false,
      );
      expect(paths).toEqual(['images/kilter/product_sizes_layouts_sets/36-1.webp']);
    });

    it('returns MoonBoard paths from layoutFolder + holdSetImages', () => {
      const paths = getBackgroundRelPaths(
        {
          board_name: 'moonboard',
          images_to_holds: {},
          layoutFolder: 'MoonBoard2016',
          holdSetImages: ['A.png', 'B.png'],
        },
        false,
      );
      expect(paths).toEqual([
        'images/moonboard/moonboard-bg.webp',
        'images/moonboard/MoonBoard2016/A.webp',
        'images/moonboard/MoonBoard2016/B.webp',
      ]);
    });

    it('returns thumbnail paths when isThumbnail is true', () => {
      const paths = getBackgroundRelPaths(
        {
          board_name: 'kilter',
          images_to_holds: { 'test.png': [] },
        },
        true,
      );
      expect(paths).toEqual(['images/kilter/thumbs/test.webp']);
    });

    it('returns empty array when no images configured', () => {
      const paths = getBackgroundRelPaths(
        { board_name: 'kilter', images_to_holds: {} },
        false,
      );
      expect(paths).toEqual([]);
    });
  });

  describe('compositeWithBackgrounds', () => {
    const makeOverlay = () => ({
      width: 2,
      height: 2,
      rgbaBuffer: Buffer.from(new Uint8Array(16)),
    });

    it('composites backgrounds and outputs webp', async () => {
      const result = await compositeWithBackgrounds({
        overlay: makeOverlay(),
        boardDetails: {
          board_name: 'kilter',
          images_to_holds: { 'test.png': [] },
        },
        isThumbnail: false,
        format: 'webp',
      });
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(mockComposite).toHaveBeenCalled();
      expect(mockWebpOptions).toHaveBeenCalledWith({ quality: 80 });
    });

    it('composites backgrounds and outputs png', async () => {
      const result = await compositeWithBackgrounds({
        overlay: makeOverlay(),
        boardDetails: {
          board_name: 'kilter',
          images_to_holds: { 'test.png': [] },
        },
        isThumbnail: false,
        format: 'png',
      });
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(mockComposite).toHaveBeenCalled();
      expect(mockPngOptions).toHaveBeenCalled();
    });

    it('falls back to overlay-only when no backgrounds found', async () => {
      mockExistsSync.mockImplementation((path) => {
        if (typeof path === 'string') return path.includes('.wasm');
        return false;
      });
      const result = await compositeWithBackgrounds({
        overlay: makeOverlay(),
        boardDetails: {
          board_name: 'kilter',
          images_to_holds: { 'test.png': [] },
        },
        isThumbnail: false,
        format: 'webp',
      });
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(mockComposite).not.toHaveBeenCalled();
    });

    it('falls back when board has no images configured', async () => {
      const result = await compositeWithBackgrounds({
        overlay: makeOverlay(),
        boardDetails: {
          board_name: 'kilter',
          images_to_holds: {},
        },
        isThumbnail: false,
        format: 'webp',
      });
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(mockComposite).not.toHaveBeenCalled();
    });
  });
});
