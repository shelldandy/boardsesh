'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardDetails } from '@/app/lib/types';
import { renderBoard } from '@/app/lib/board-render-worker/worker-manager';
import { trackRenderComplete, trackRenderError, type RenderContext } from '@/app/lib/rendering-metrics';
import BoardImageLayers from './board-image-layers';

export interface BoardCanvasRendererProps {
  boardDetails: BoardDetails;
  frames: string;
  mirrored: boolean;
  thumbnail?: boolean;
  /** Use object-fit: contain (for swipe carousel where container controls sizing) */
  contain?: boolean;
  /** Additional styles for the canvas element */
  style?: React.CSSProperties;
}

/**
 * Renders a board as a single <canvas> element using a Web Worker + WASM.
 * The worker composites background images + hold overlay off the main thread,
 * returning an ImageBitmap that is drawn directly onto the canvas.
 * Falls back to BoardImageLayers if the worker render fails.
 */
const BoardCanvasRenderer = React.memo(function BoardCanvasRenderer({
  boardDetails,
  frames,
  mirrored,
  thumbnail,
  contain,
  style,
}: BoardCanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountTime = useRef(performance.now());
  const hasFired = useRef(false);
  const [failed, setFailed] = useState(false);
  const renderContext: RenderContext = thumbnail ? 'thumbnail' : contain ? 'full-board' : 'card';

  // Stable reference to track metrics only once
  const trackSuccess = useCallback(() => {
    if (hasFired.current) return;
    hasFired.current = true;
    trackRenderComplete(performance.now() - mountTime.current, renderContext, 'rust-wasm');
  }, [renderContext]);

  const trackError = useCallback(() => {
    trackRenderError(renderContext, 'rust-wasm');
  }, [renderContext]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    renderBoard({ boardDetails, frames, mirrored, thumbnail })
      .then((bitmap) => {
        if (cancelled) {
          return;
        }
        // Set canvas dimensions to match bitmap
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
        }
        trackSuccess();
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Board canvas render failed:', err);
          setFailed(true);
          trackError();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardDetails, frames, mirrored, thumbnail, trackSuccess, trackError]);

  // Fall back to server-rendered image layers if the worker render fails
  if (failed) {
    return (
      <BoardImageLayers
        boardDetails={boardDetails}
        frames={frames}
        mirrored={mirrored}
        thumbnail={thumbnail}
        contain={contain}
        style={style}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: contain ? 'contain' : undefined,
        ...style,
      }}
    />
  );
});

export default BoardCanvasRenderer;
