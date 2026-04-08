import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';
import { constructBoardSlugViewUrl } from '@/app/lib/url-utils';

import PlayViewClient from '@/app/[board_name]/[layout_id]/[size_id]/[set_ids]/[angle]/play/[climb_uuid]/play-view-client';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';

interface BoardSlugPlayPageProps {
  params: Promise<{ board_slug: string; angle: string; climb_uuid: string }>;
}

export async function generateMetadata(props: BoardSlugPlayPageProps): Promise<Metadata> {
  try {
    const params = await props.params;
    const board = await resolveBoardBySlug(params.board_slug);
    if (!board) {
      return { title: 'Play | Boardsesh', robots: { index: false, follow: true } };
    }

    const parsedParams = {
      ...boardToRouteParams(board, Number(params.angle)),
      climb_uuid: params.climb_uuid,
    };

    const currentClimb = await getClimb(parsedParams);
    if (!currentClimb) {
      return { title: 'Play | Boardsesh', robots: { index: false, follow: true } };
    }

    const boardLabel = parsedParams.board_name.charAt(0).toUpperCase() + parsedParams.board_name.slice(1);
    const climbName = currentClimb.name || `${boardLabel} Climb`;
    const climbGrade = currentClimb.difficulty || 'Unknown Grade';
    const setter = currentClimb.setter_username || 'Unknown Setter';
    const description = `${climbName} - ${climbGrade} by ${setter}. Quality: ${currentClimb.quality_average || 0}/5. Ascents: ${currentClimb.ascensionist_count || 0}`;

    const viewUrl = constructBoardSlugViewUrl(
      board.slug,
      parsedParams.angle,
      parsedParams.climb_uuid,
      currentClimb.name,
    );

    const ogImageUrl = new URL('/api/og/climb', 'https://boardsesh.com');
    ogImageUrl.searchParams.set('board_name', parsedParams.board_name);
    ogImageUrl.searchParams.set('layout_id', parsedParams.layout_id.toString());
    ogImageUrl.searchParams.set('size_id', parsedParams.size_id.toString());
    ogImageUrl.searchParams.set('set_ids', parsedParams.set_ids.join(','));
    ogImageUrl.searchParams.set('angle', parsedParams.angle.toString());
    ogImageUrl.searchParams.set('climb_uuid', parsedParams.climb_uuid);

    return {
      title: `${climbName} - ${climbGrade} | Play Mode | Boardsesh`,
      description,
      robots: { index: false, follow: true },
      alternates: {
        canonical: viewUrl,
      },
      openGraph: {
        title: `${climbName} - ${climbGrade}`,
        description,
        type: 'website',
        url: viewUrl,
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: `${climbName} - ${climbGrade} on ${boardLabel} board`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${climbName} - ${climbGrade}`,
        description,
        images: [ogImageUrl.toString()],
      },
    };
  } catch {
    return {
      title: 'Play Mode | Boardsesh',
      description: 'Play climbs on your board',
      robots: { index: false, follow: true },
    };
  }
}

export default async function BoardSlugPlayPage(props: BoardSlugPlayPageProps) {
  const params = await props.params;

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const parsedParams = {
    ...boardToRouteParams(board, Number(params.angle)),
    climb_uuid: params.climb_uuid,
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
