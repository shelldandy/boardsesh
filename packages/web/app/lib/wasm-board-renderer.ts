import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { HOLD_STATE_MAP } from '@/app/components/board-renderer/types';
import type { BoardName } from '@/app/lib/types';
import type { HoldRenderData } from '@/app/components/board-renderer/types';

// ---------------------------------------------------------------------------
// WASM initialization (singleton with thundering-herd prevention)
// ---------------------------------------------------------------------------

let renderOverlayFn: ((configJson: string) => Uint8Array) | null = null;
let wasmInitPromise: Promise<void> | null = null;

export function findWasmPath(): string {
  const wasmFilename = 'board_renderer_wasm_bg.wasm';
  const candidates = [
    // Monorepo dev: cwd is packages/web, workspace deps hoisted to root
    join(process.cwd(), '..', '..', 'node_modules/@boardsesh/board-renderer-wasm/pkg', wasmFilename),
    // Vercel standalone: cwd is /var/task, node_modules at root
    join(process.cwd(), 'node_modules/@boardsesh/board-renderer-wasm/pkg', wasmFilename),
    // Vercel standalone: nested under packages/web
    join(process.cwd(), 'packages/web/node_modules/@boardsesh/board-renderer-wasm/pkg', wasmFilename),
    // Relative to __dirname (works if file tracing copies it alongside the route)
    join(process.cwd(), '.next/server', wasmFilename),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Log all searched paths to help debug Vercel deployment issues
  console.error(`WASM file not found. cwd=${process.cwd()}, searched:`, candidates);
  return candidates[0];
}

export async function ensureWasmInitialized() {
  if (renderOverlayFn) return;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const wasmModule = await import('@boardsesh/board-renderer-wasm');
      const wasmPath = findWasmPath();
      const wasmBytes = await readFile(wasmPath);
      wasmModule.initSync({ module: wasmBytes });
      renderOverlayFn = wasmModule.render_overlay;
    })();
  }
  await wasmInitPromise;
}

// ---------------------------------------------------------------------------
// Overlay rendering
// ---------------------------------------------------------------------------

export interface OverlayResult {
  width: number;
  height: number;
  rgbaBuffer: Buffer;
}

/**
 * Render a hold overlay via WASM and parse the dimension header.
 * Returns the raw RGBA buffer and dimensions.
 */
export function renderOverlayRgba(configJson: string): OverlayResult {
  if (!renderOverlayFn) {
    throw new Error('WASM renderer not initialized — call ensureWasmInitialized() first');
  }
  const rawBytes = renderOverlayFn(configJson);
  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const rgbaData = rawBytes.subarray(8);
  return {
    width,
    height,
    rgbaBuffer: Buffer.from(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength),
  };
}

/**
 * Build the WASM render config JSON from board details and frames.
 */
export function buildRenderConfig(opts: {
  boardName: BoardName;
  boardWidth: number;
  boardHeight: number;
  outputWidth: number;
  frames: string;
  thumbnail: boolean;
  holdsData: HoldRenderData[];
}) {
  const holdStateMap: Record<number, { color: string }> = {};
  const boardStates = HOLD_STATE_MAP[opts.boardName];
  for (const [code, info] of Object.entries(boardStates)) {
    holdStateMap[Number(code)] = { color: info.color };
  }

  return {
    board_name: opts.boardName,
    board_width: opts.boardWidth,
    board_height: opts.boardHeight,
    output_width: opts.outputWidth,
    frames: opts.frames,
    mirrored: false,
    thumbnail: opts.thumbnail,
    holds: opts.holdsData.map((h) => ({
      id: h.id,
      mirroredHoldId: h.mirroredHoldId,
      cx: h.cx,
      cy: h.cy,
      r: h.r,
    })),
    hold_state_map: holdStateMap,
  };
}

// ---------------------------------------------------------------------------
// Background image helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a public/-relative path to an absolute filesystem path.
 * Tries multiple candidate directories to work across dev, monorepo root,
 * and Vercel standalone builds.
 */
export function findPublicImagePath(relPath: string): string | null {
  const candidates = [
    join(process.cwd(), 'public', relPath),
    join(process.cwd(), 'packages/web/public', relPath),
    join(process.cwd(), relPath),
    join(process.cwd(), '..', '..', 'packages/web/public', relPath),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Convert a raw image filename to its WebP equivalent, optionally as a thumbnail. */
export function toWebpPath(dir: string, filename: string, isThumbnail: boolean): string {
  const webpName = filename.replace(/\.png$/, '.webp');
  if (isThumbnail) {
    const lastSlash = webpName.lastIndexOf('/');
    if (lastSlash >= 0) {
      return `${dir}/${webpName.substring(0, lastSlash)}/thumbs${webpName.substring(lastSlash)}`;
    }
    return `${dir}/thumbs/${webpName}`;
  }
  return `${dir}/${webpName}`;
}

export interface BoardDetailsForBg {
  board_name: string;
  images_to_holds: Record<string, unknown>;
  layoutFolder?: string;
  holdSetImages?: string[];
}

/**
 * Build the ordered list of public/-relative paths for background images.
 * Kilter/Tension use images_to_holds keys; MoonBoard uses layoutFolder + holdSetImages.
 */
export function getBackgroundRelPaths(boardDetails: BoardDetailsForBg, isThumbnail: boolean): string[] {
  const paths: string[] = [];
  const imageKeys = Object.keys(boardDetails.images_to_holds);

  if (imageKeys.length > 0) {
    // Aurora boards (Kilter, Tension): keys like "product_sizes_layouts_sets/36-1.png"
    for (const key of imageKeys) {
      paths.push(toWebpPath(`images/${boardDetails.board_name}`, key, isThumbnail));
    }
  } else if (boardDetails.layoutFolder && boardDetails.holdSetImages) {
    // MoonBoard: board background + hold set layers
    const bgFile = 'moonboard-bg.png';
    paths.push(toWebpPath('images/moonboard', bgFile, isThumbnail));
    for (const holdSetImage of boardDetails.holdSetImages) {
      paths.push(toWebpPath(`images/moonboard/${boardDetails.layoutFolder}`, holdSetImage, isThumbnail));
    }
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Compositing pipeline
// ---------------------------------------------------------------------------

export interface CompositeResult {
  buffer: Buffer;
  bgMs: number;
}

/**
 * Composite background images with overlay, returning the encoded buffer.
 * Reusable across board-render (WebP) and OG image (PNG) endpoints.
 */
export async function compositeWithBackgrounds(opts: {
  overlay: OverlayResult;
  boardDetails: BoardDetailsForBg;
  isThumbnail: boolean;
  format: 'webp' | 'png';
}): Promise<CompositeResult> {
  const { overlay, boardDetails, isThumbnail, format } = opts;
  const { width, height, rgbaBuffer } = overlay;

  const bgT0 = performance.now();
  const bgRelPaths = getBackgroundRelPaths(boardDetails, isThumbnail);
  const bgFsPaths = bgRelPaths
    .map((rp) => findPublicImagePath(rp))
    .filter((p): p is string => p !== null);
  const bgMs = performance.now() - bgT0;

  const encode = (s: sharp.Sharp) =>
    format === 'webp'
      ? s.webp({ quality: 80 }).toBuffer()
      : s.png().toBuffer();

  const encodeFallback = (s: sharp.Sharp) =>
    format === 'webp'
      ? s.webp({ lossless: true }).toBuffer()
      : s.png().toBuffer();

  if (bgFsPaths.length > 0) {
    // Load and resize background images, skipping any that fail
    const results = await Promise.allSettled(
      bgFsPaths.map((fsPath) =>
        sharp(fsPath).resize(width, height, { fit: 'fill' }).toBuffer(),
      ),
    );
    const resizedBuffers = results
      .filter((r): r is PromiseFulfilledResult<Buffer> => r.status === 'fulfilled')
      .map((r) => r.value);

    const [firstBg, ...restBgs] = resizedBuffers;

    if (firstBg) {
      const buffer = await encode(
        sharp(firstBg).composite([
          ...restBgs.map((buf) => ({ input: buf, blend: 'over' as const })),
          {
            input: rgbaBuffer,
            raw: { width, height, channels: 4 as const },
            blend: 'over' as const,
          },
        ]),
      );
      return { buffer, bgMs };
    }
  }

  // No backgrounds or all loads failed — overlay only
  const buffer = await encodeFallback(
    sharp(rgbaBuffer, { raw: { width, height, channels: 4 } }),
  );
  return { buffer, bgMs };
}
