// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mock WASM board renderer module ---
const mockRenderOverlayRgba = vi.fn<(config: string) => { width: number; height: number; rgbaBuffer: Buffer }>(() => ({
  width: 100,
  height: 125,
  rgbaBuffer: Buffer.alloc(100 * 125 * 4),
}));
const mockCompositeWithBackgrounds = vi.fn<(opts: unknown) => Promise<{ buffer: Buffer; bgMs: number }>>(async () => ({
  buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  bgMs: 3.2,
}));
vi.mock('@/app/lib/wasm-board-renderer', () => ({
  ensureWasmInitialized: vi.fn(async () => {}),
  renderOverlayRgba: (config: string) => mockRenderOverlayRgba(config),
  buildRenderConfig: vi.fn((opts: Record<string, unknown>) => ({
    board_name: opts.boardName,
    board_width: opts.boardWidth,
    board_height: opts.boardHeight,
    output_width: opts.outputWidth,
    frames: opts.frames,
    mirrored: false,
    thumbnail: opts.thumbnail,
    holds: [],
    hold_state_map: {},
  })),
  compositeWithBackgrounds: (opts: unknown) => mockCompositeWithBackgrounds(opts),
}));

// --- Mock sharp ---
const mockComposite = vi.fn();
const mockPngToBuffer = vi.fn(() => Promise.resolve(Buffer.from([0x89, 0x50, 0x4E, 0x47])));
const mockSharpInstance = () => {
  const instance: Record<string, ReturnType<typeof vi.fn>> = {
    composite: vi.fn((...args: unknown[]) => {
      mockComposite(...args);
      return instance;
    }),
    resize: vi.fn(() => ({
      png: vi.fn(() => ({ toBuffer: mockPngToBuffer })),
      toBuffer: vi.fn(() => Promise.resolve(Buffer.from([0xB0]))),
    })),
    png: vi.fn(() => ({
      toBuffer: mockPngToBuffer,
    })),
  };
  return instance;
};
vi.mock('sharp', () => ({
  default: (_input?: unknown, _options?: unknown) => mockSharpInstance(),
}));

// --- Mock data layer ---
const mockClimbData = {
  uuid: 'test-uuid-123',
  name: 'Mega Jug Haul',
  setter_username: 'TestSetter',
  frames: 'p1073r42p1090r43',
  angle: 40,
  difficulty: 'V4',
  quality_average: '3.5',
  ascensionist_count: 42,
  stars: 3,
  difficulty_error: '0.2',
  benchmark_difficulty: null,
};
const mockGetClimb = vi.fn<(params: unknown) => Promise<typeof mockClimbData | null>>(async () => mockClimbData);
vi.mock('@/app/lib/data/queries', () => ({
  getClimb: (params: unknown) => mockGetClimb(params),
}));

vi.mock('@/app/lib/board-utils', () => ({
  getBoardDetailsForBoard: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 1,
    size_id: 7,
    set_ids: [1, 20],
    boardWidth: 1080,
    boardHeight: 1350,
    holdsData: [
      { id: 1073, mirroredHoldId: null, cx: 200, cy: 300, r: 20 },
      { id: 1090, mirroredHoldId: null, cx: 500, cy: 600, r: 20 },
    ],
    images_to_holds: { 'test.png': [] },
    edge_left: 0,
    edge_right: 144,
    edge_bottom: 0,
    edge_top: 180,
  })),
}));

vi.mock('@/app/lib/url-utils.server', () => ({
  parseBoardRouteParamsWithSlugs: vi.fn(async (params: Record<string, string>) => ({
    board_name: params.board_name,
    layout_id: Number(params.layout_id),
    size_id: Number(params.size_id),
    set_ids: params.set_ids.split(',').map(Number),
    angle: Number(params.angle),
    climb_uuid: params.climb_uuid,
  })),
}));

import { GET } from '../route';

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/og/climb');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

const validParams = {
  board_name: 'kilter',
  layout_id: '1',
  size_id: '7',
  set_ids: '1,20',
  angle: '40',
  climb_uuid: 'test-uuid-123',
};

describe('OG climb image route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with PNG content-type for valid request', async () => {
    const response = await GET(makeRequest(validParams));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns immutable cache headers', async () => {
    const response = await GET(makeRequest(validParams));
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=31536000, max-age=31536000, immutable',
    );
  });

  it('returns 400 when board_name is missing', async () => {
    const { board_name: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
  });

  it('returns 400 when climb_uuid is missing', async () => {
    const { climb_uuid: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
  });

  it('returns 400 when angle is missing', async () => {
    const { angle: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
  });

  it('returns 400 when layout_id is missing', async () => {
    const { layout_id: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
  });

  it('returns 400 when size_id is missing', async () => {
    const { size_id: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
  });

  it('returns 400 when set_ids is missing', async () => {
    const { set_ids: _, ...params } = validParams;
    const response = await GET(makeRequest(params));
    expect(response.status).toBe(400);
  });

  it('calls WASM renderer with climb frames', async () => {
    await GET(makeRequest(validParams));
    expect(mockRenderOverlayRgba).toHaveBeenCalled();
    const configJson = mockRenderOverlayRgba.mock.calls[0]?.[0] as string;
    const config = JSON.parse(configJson);
    expect(config.frames).toBe('p1073r42p1090r43');
  });

  it('composites background images with overlay', async () => {
    await GET(makeRequest(validParams));
    expect(mockCompositeWithBackgrounds).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'png',
        isThumbnail: false,
      }),
    );
  });

  it('creates final composite with board image and text SVG', async () => {
    await GET(makeRequest(validParams));
    // The final sharp composite should be called with board image and text SVG
    expect(mockComposite).toHaveBeenCalled();
    const compositeArgs = mockComposite.mock.calls[0][0];
    expect(compositeArgs).toHaveLength(2); // board image + text SVG
    expect(compositeArgs[0]).toHaveProperty('left', 0);
    expect(compositeArgs[0]).toHaveProperty('top', 0);
  });

  it('returns 500 when WASM render throws', async () => {
    mockRenderOverlayRgba.mockImplementationOnce(() => {
      throw new Error('WASM exploded');
    });
    const response = await GET(makeRequest(validParams));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toContain('WASM exploded');
  });

  it('returns 500 when climb not found', async () => {
    mockGetClimb.mockResolvedValueOnce(null as never);
    const response = await GET(makeRequest(validParams));
    // Should return 404 for missing climb
    expect(response.status).toBe(404);
  });

  it('handles climb with missing optional fields', async () => {
    mockGetClimb.mockResolvedValueOnce({
      uuid: 'test-uuid-123',
      name: '',
      setter_username: '',
      frames: 'p1r42',
      angle: 40,
      difficulty: '',
      quality_average: '0',
      ascensionist_count: 0,
      stars: 0,
      difficulty_error: '0',
      benchmark_difficulty: null,
    });
    const response = await GET(makeRequest(validParams));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('works with moonboard board_name', async () => {
    const { getBoardDetailsForBoard } = await import('@/app/lib/board-utils');
    vi.mocked(getBoardDetailsForBoard).mockReturnValueOnce({
      board_name: 'moonboard',
      layout_id: 1,
      size_id: 1,
      set_ids: [1],
      boardWidth: 500,
      boardHeight: 800,
      holdsData: [{ id: 1, mirroredHoldId: null, cx: 100, cy: 200, r: 15 }],
      images_to_holds: {},
      layoutFolder: 'MoonBoard2016',
      holdSetImages: ['A.png'],
      edge_left: 0,
      edge_right: 50,
      edge_bottom: 0,
      edge_top: 80,
    } as unknown as ReturnType<typeof getBoardDetailsForBoard>);

    const response = await GET(
      makeRequest({ ...validParams, board_name: 'moonboard' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('produces response body that is a valid buffer', async () => {
    const response = await GET(makeRequest(validParams));
    const body = await response.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });
});
