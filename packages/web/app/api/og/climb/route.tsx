import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getClimb } from '@/app/lib/data/queries';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { parseBoardRouteParamsWithSlugs } from '@/app/lib/url-utils.server';
import {
  ensureWasmInitialized,
  renderOverlayRgba,
  buildRenderConfig,
  compositeWithBackgrounds,
} from '@/app/lib/wasm-board-renderer';

// Node.js runtime for reliable WASM loading via filesystem
export const runtime = 'nodejs';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
// Board image area on the left
const BOARD_AREA_WIDTH = 560;
const BOARD_AREA_HEIGHT = OG_HEIGHT;
// Text area on the right
const TEXT_AREA_LEFT = BOARD_AREA_WIDTH;
const TEXT_AREA_WIDTH = OG_WIDTH - BOARD_AREA_WIDTH;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + '\u2026';
}

/**
 * Build an SVG string for the text overlay on the right side of the OG image.
 */
function buildTextSvg(opts: {
  climbName: string;
  grade: string;
  setter: string;
  boardName: string;
  angle: number;
}): Buffer {
  const name = escapeXml(truncateText(opts.climbName, 32));
  const grade = escapeXml(opts.grade);
  const setter = escapeXml(truncateText(opts.setter, 28));
  const boardLabel = escapeXml(
    opts.boardName.charAt(0).toUpperCase() + opts.boardName.slice(1),
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TEXT_AREA_WIDTH}" height="${OG_HEIGHT}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="60" y="200" font-family="sans-serif" font-size="44" font-weight="bold" fill="#1a1a1a">${name}</text>
  <text x="60" y="268" font-family="sans-serif" font-size="36" font-weight="bold" fill="#555">${grade}</text>
  <text x="60" y="340" font-family="sans-serif" font-size="26" fill="#777">
    <tspan x="60" dy="0">@${opts.angle}\u00B0</tspan>
  </text>
  <text x="60" y="400" font-family="sans-serif" font-size="24" fill="#888">
    <tspan font-weight="600" fill="#555">Setter: </tspan><tspan>${setter}</tspan>
  </text>
  <text x="60" y="448" font-family="sans-serif" font-size="24" fill="#888">
    <tspan font-weight="600" fill="#555">Board: </tspan><tspan>${boardLabel}</tspan>
  </text>
  <text x="${TEXT_AREA_WIDTH - 40}" y="${OG_HEIGHT - 30}" font-family="sans-serif" font-size="18" fill="#ccc" text-anchor="end" font-weight="600">boardsesh.com</text>
</svg>`;

  return Buffer.from(svg);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const board_name = searchParams.get('board_name');
    const layout_id = searchParams.get('layout_id');
    const size_id = searchParams.get('size_id');
    const set_ids = searchParams.get('set_ids');
    const angle = searchParams.get('angle');
    const climb_uuid = searchParams.get('climb_uuid');

    if (!board_name || !layout_id || !size_id || !set_ids || !angle || !climb_uuid) {
      return new Response('Missing required parameters', { status: 400 });
    }

    // Use slug-aware parsing to handle both numeric and string identifiers
    const parsedParams = await parseBoardRouteParamsWithSlugs({
      board_name,
      layout_id,
      size_id,
      set_ids,
      angle,
      climb_uuid,
    });

    const [boardDetails, currentClimb] = await Promise.all([
      getBoardDetailsForBoard(parsedParams),
      getClimb(parsedParams),
    ]);

    if (!currentClimb) {
      return new Response('Climb not found', { status: 404 });
    }

    // --- Render board image via WASM + sharp ---
    await ensureWasmInitialized();

    const config = buildRenderConfig({
      boardName: parsedParams.board_name,
      boardWidth: boardDetails.boardWidth,
      boardHeight: boardDetails.boardHeight,
      outputWidth: boardDetails.boardWidth,
      frames: currentClimb.frames,
      thumbnail: false,
      holdsData: boardDetails.holdsData,
    });

    const overlay = renderOverlayRgba(JSON.stringify(config));

    // Composite board with backgrounds → PNG buffer
    const { buffer: boardPng } = await compositeWithBackgrounds({
      overlay,
      boardDetails,
      isThumbnail: false,
      format: 'png',
    });

    // --- Resize board image to fit left area, maintaining aspect ratio ---
    const boardImage = await sharp(boardPng)
      .resize(BOARD_AREA_WIDTH, BOARD_AREA_HEIGHT, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();

    // --- Build text SVG for right side ---
    const textSvg = buildTextSvg({
      climbName: currentClimb.name || 'Untitled Climb',
      grade: currentClimb.difficulty || 'Unknown',
      setter: currentClimb.setter_username || 'Unknown',
      boardName: parsedParams.board_name,
      angle: parsedParams.angle,
    });

    // --- Composite final 1200x630 image ---
    const finalPng = await sharp({
      create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([
        { input: boardImage, left: 0, top: 0 },
        { input: textSvg, left: TEXT_AREA_LEFT, top: 0 },
      ])
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(finalPng), {
      headers: {
        'Content-Type': 'image/png',
        // Climbs are immutable — cache forever
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating image: ${message}`, { status: 500 });
  }
}
