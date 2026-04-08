import { NextRequest, NextResponse } from 'next/server';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { THUMBNAIL_WIDTH } from '@/app/components/board-renderer/types';
import type { BoardName } from '@/app/lib/types';
import {
  ensureWasmInitialized,
  renderOverlayRgba,
  buildRenderConfig,
  compositeWithBackgrounds,
} from '@/app/lib/wasm-board-renderer';
import sharp from 'sharp';

// Node.js runtime for reliable WASM loading via filesystem
export const runtime = 'nodejs';

const VALID_BOARD_NAMES = new Set(['kilter', 'tension', 'moonboard']);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const boardName = searchParams.get('board_name');
    const layoutId = searchParams.get('layout_id');
    const sizeId = searchParams.get('size_id');
    const setIds = searchParams.get('set_ids');
    const frames = searchParams.get('frames');
    const thumbnail = searchParams.get('thumbnail') === '1';
    const includeBackground = searchParams.get('include_background') === '1';
    // Mirroring is handled client-side via CSS scaleX(-1) to maximize cache hit rate

    if (!boardName || !layoutId || !sizeId || !setIds || !frames) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (!VALID_BOARD_NAMES.has(boardName)) {
      return NextResponse.json({ error: 'Invalid board_name' }, { status: 400 });
    }

    const parsedSetIds = setIds.split(',').map(Number).filter((n) => !isNaN(n));

    // Get board details (pure computation, no DB)
    const boardDetails = getBoardDetailsForBoard({
      board_name: boardName as BoardName,
      layout_id: Number(layoutId),
      size_id: Number(sizeId),
      set_ids: parsedSetIds,
    });

    const config = buildRenderConfig({
      boardName: boardName as BoardName,
      boardWidth: boardDetails.boardWidth,
      boardHeight: boardDetails.boardHeight,
      outputWidth: thumbnail ? THUMBNAIL_WIDTH : boardDetails.boardWidth,
      frames,
      thumbnail,
      holdsData: boardDetails.holdsData,
    });

    // Initialize WASM if needed and render
    await ensureWasmInitialized();
    const wasmT0 = performance.now();
    const overlay = renderOverlayRgba(JSON.stringify(config));
    const wasmMs = performance.now() - wasmT0;

    const sharpT0 = performance.now();
    let outputBuffer: Buffer;
    let bgMs = 0;

    if (includeBackground) {
      const result = await compositeWithBackgrounds({
        overlay,
        boardDetails,
        isThumbnail: thumbnail,
        format: 'webp',
      });
      outputBuffer = result.buffer;
      bgMs = result.bgMs;
    } else {
      // Default: overlay-only lossless WebP (25-30% smaller than PNG)
      outputBuffer = await sharp(overlay.rgbaBuffer, {
        raw: { width: overlay.width, height: overlay.height, channels: 4 },
      })
        .webp({ lossless: true })
        .toBuffer();
    }
    const sharpMs = performance.now() - sharpT0;

    const timingParts = [`wasm;dur=${wasmMs.toFixed(1)}`, `sharp;dur=${sharpMs.toFixed(1)}`];
    if (bgMs > 0) timingParts.push(`bg;dur=${bgMs.toFixed(1)}`);

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        // Climbs are immutable -- cache forever at both CDN (s-maxage) and browser (max-age)
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
        // Expose render timing in browser devtools Network panel
        'Server-Timing': timingParts.join(', '),
      },
    });
  } catch (error) {
    console.error('Board render error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Render failed: ${message}` }, { status: 500 });
  }
}
