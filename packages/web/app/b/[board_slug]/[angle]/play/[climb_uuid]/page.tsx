import React from 'react';
import { notFound } from 'next/navigation';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';

import PlayViewClient from '@/app/[board_name]/[layout_id]/[size_id]/[set_ids]/[angle]/play/[climb_uuid]/play-view-client';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';
import { extractUuidFromSlug } from '@/app/lib/url-utils';

interface BoardSlugPlayPageProps {
  params: Promise<{ board_slug: string; angle: string; climb_uuid: string }>;
}

export default async function BoardSlugPlayPage(props: BoardSlugPlayPageProps) {
  const params = await props.params;

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const parsedParams = {
    ...boardToRouteParams(board, Number(params.angle)),
    climb_uuid: extractUuidFromSlug(params.climb_uuid),
  };

  const boardDetails = getBoardDetailsForBoard(parsedParams);

  let initialClimb = null;
  try {
    const climb = await getClimb(parsedParams);
    if (climb) {
      initialClimb = climb;
    }
  } catch {
    // Climb will be loaded from queue context on client
  }

  if (initialClimb) {
    scheduleOverlayWarming({ boardDetails, climbs: [initialClimb], variant: 'full' });
  }

  return (
    <PlayViewClient
      boardDetails={boardDetails}
      initialClimb={initialClimb}
      angle={parsedParams.angle}
    />
  );
}
