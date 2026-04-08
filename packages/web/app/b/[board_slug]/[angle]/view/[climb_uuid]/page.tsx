import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { resolveBoardBySlug, boardToRouteParams } from '@/app/lib/board-slug-utils';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getClimb } from '@/app/lib/data/queries';
import { constructBoardSlugViewUrl } from '@/app/lib/url-utils';

import ClimbDetailPageServer from '@/app/components/climb-detail/climb-detail-page.server';
import { fetchClimbDetailData } from '@/app/lib/data/climb-detail-data.server';
import { scheduleOverlayWarming } from '@/app/lib/warm-overlay-cache';

interface BoardSlugViewPageProps {
  params: Promise<{ board_slug: string; angle: string; climb_uuid: string }>;
}

export async function generateMetadata(props: BoardSlugViewPageProps): Promise<Metadata> {
  try {
    const params = await props.params;
    const board = await resolveBoardBySlug(params.board_slug);
    if (!board) {
      return { title: 'Climb | Boardsesh' };
    }

    const parsedParams = {
      ...boardToRouteParams(board, Number(params.angle)),
      climb_uuid: params.climb_uuid,
    };

    const currentClimb = await getClimb(parsedParams);
    if (!currentClimb) {
      return { title: 'Climb | Boardsesh' };
    }

    const boardLabel = parsedParams.board_name.charAt(0).toUpperCase() + parsedParams.board_name.slice(1);
    const climbName = currentClimb.name || `${boardLabel} Climb`;
    const climbGrade = currentClimb.difficulty || 'Unknown Grade';
    const setter = currentClimb.setter_username || 'Unknown Setter';
    const description = `${climbName} - ${climbGrade} by ${setter}. Quality: ${currentClimb.quality_average || 0}/5. Ascents: ${currentClimb.ascensionist_count || 0}`;

    const climbUrl = constructBoardSlugViewUrl(
      board.slug,
      parsedParams.angle,
      parsedParams.climb_uuid,
      currentClimb.name,
    );

    const ogParams = new URLSearchParams({
      board_name: parsedParams.board_name,
      layout_id: parsedParams.layout_id.toString(),
      size_id: parsedParams.size_id.toString(),
      set_ids: parsedParams.set_ids.join(','),
      angle: parsedParams.angle.toString(),
      climb_uuid: parsedParams.climb_uuid,
    });
    const ogImageUrl = `/api/og/climb?${ogParams.toString()}`;

    return {
      title: `${climbName} - ${climbGrade} | Boardsesh`,
      description,
      alternates: {
        canonical: climbUrl,
      },
      openGraph: {
        title: `${climbName} - ${climbGrade}`,
        description,
        type: 'website',
        url: climbUrl,
        images: [
          {
            url: ogImageUrl,
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
        images: [ogImageUrl],
      },
    };
  } catch (error) {
    console.error('Error generating climb view metadata:', error);
    return {
      title: 'Climb View | Boardsesh',
      description: 'View climb details and beta videos',
    };
  }
}

export default async function BoardSlugViewPage(props: BoardSlugViewPageProps) {
  const params = await props.params;

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const parsedParams = {
    ...boardToRouteParams(board, Number(params.angle)),
    climb_uuid: params.climb_uuid,
  };

  try {
    const [boardDetails, currentClimb, detailData] = await Promise.all([
      getBoardDetailsForBoard(parsedParams),
      getClimb(parsedParams),
      fetchClimbDetailData({
        boardName: parsedParams.board_name,
        climbUuid: parsedParams.climb_uuid,
        angle: parsedParams.angle,
      }),
    ]);

    if (!currentClimb) {
      notFound();
    }

    scheduleOverlayWarming({ boardDetails, climbs: [currentClimb], variant: 'full' });

    const climbWithProcessedData = {
      ...currentClimb,
      communityGrade: detailData.communityGrade,
    };

    return (
      <ClimbDetailPageServer
        climb={climbWithProcessedData}
        boardDetails={boardDetails}
        betaLinks={detailData.betaLinks}
        climbUuid={parsedParams.climb_uuid}
        boardType={parsedParams.board_name}
        angle={parsedParams.angle}
        currentClimbDifficulty={currentClimb.difficulty ?? undefined}
        boardName={parsedParams.board_name}
      />
    );
  } catch (error) {
    console.error('Error fetching climb view:', error);
    notFound();
  }
}
