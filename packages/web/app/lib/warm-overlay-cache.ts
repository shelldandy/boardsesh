import { after } from 'next/server';
import { rustSvgRendering } from '@/app/flags';
import { buildOverlayUrl } from '@/app/components/board-renderer/util';
import type { BoardDetails, Climb } from '@/app/lib/types';

const BASE_URL = process.env.VERCEL_URL ? 'https://www.boardsesh.com' : 'http://localhost:3000';

/**
 * Schedule background fetches to warm the Vercel Edge CDN cache for
 * WASM-rendered board overlay images. Uses Next.js `after()` so the
 * work runs after the response is sent — zero impact on SSR latency.
 */
export function scheduleOverlayWarming(options: {
  boardDetails: BoardDetails;
  climbs: Pick<Climb, 'frames'>[];
  variant: 'thumbnail' | 'full';
  maxImages?: number;
}): void {
  try {
    after(async () => {
      try {
        const isEnabled = await rustSvgRendering();
        if (!isEnabled) return;

        const { boardDetails, climbs, variant, maxImages = 20 } = options;
        const isThumbnail = variant === 'thumbnail';
        const toWarm = climbs.slice(0, maxImages);

        await Promise.allSettled(
          toWarm.map((climb) => {
            const path = buildOverlayUrl(boardDetails, climb.frames, isThumbnail);
            return fetch(`${BASE_URL}${path}`).then((r) => r.body?.cancel());
          }),
        );
      } catch {
        // Warming failures must never propagate
      }
    });
  } catch {
    // after() may not be available outside request context (e.g., build time)
  }
}
