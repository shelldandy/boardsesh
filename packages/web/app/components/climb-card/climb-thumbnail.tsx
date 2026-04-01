import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BoardDetails, Climb } from '@/app/lib/types';
import BoardRenderer from '@/app/components/board-renderer/board-renderer';
import BoardImageLayers from '@/app/components/board-renderer/board-image-layers';
import BoardCanvasRenderer from '@/app/components/board-renderer/board-canvas-renderer';
import { useFeatureFlag } from '@/app/components/providers/feature-flags-provider';
import { useCanvasRendererReady } from '@/app/lib/board-render-worker/worker-manager';
import { convertLitUpHoldsStringToMap } from '@/app/components/board-renderer/util';
import { getContextAwareClimbViewUrl } from '@/app/lib/url-utils';

type ClimbThumbnailProps = {
  currentClimb: Climb | null;
  boardDetails: BoardDetails;
  enableNavigation?: boolean;
  onNavigate?: () => void;
  maxHeight?: string;
};

const ClimbThumbnail = ({ boardDetails, currentClimb, enableNavigation = false, onNavigate, maxHeight }: ClimbThumbnailProps) => {
  const pathname = usePathname();
  const isRustRendererEnabled = useFeatureFlag('rust-svg-rendering');
  const canvasReady = useCanvasRendererReady(!!isRustRendererEnabled);
  const litUpHoldsMap = useMemo(
    () => currentClimb && !isRustRendererEnabled
      ? convertLitUpHoldsStringToMap(currentClimb.frames, boardDetails.board_name)[0]
      : undefined,
    [currentClimb?.frames, boardDetails.board_name, isRustRendererEnabled],
  );

  const rustStyle: React.CSSProperties = {
    aspectRatio: `${boardDetails.boardWidth} / ${boardDetails.boardHeight}`,
    maxHeight: maxHeight ?? '10vh',
  };

  let renderContent: React.ReactNode = null;
  if (currentClimb) {
    if (canvasReady) {
      renderContent = (
        <BoardCanvasRenderer
          boardDetails={boardDetails}
          frames={currentClimb.frames}
          mirrored={!!currentClimb.mirrored}
          thumbnail
          style={rustStyle}
        />
      );
    } else if (isRustRendererEnabled) {
      renderContent = (
        <BoardImageLayers
          boardDetails={boardDetails}
          frames={currentClimb.frames}
          mirrored={!!currentClimb.mirrored}
          thumbnail
          style={rustStyle}
        />
      );
    } else {
      renderContent = (
        <BoardRenderer boardDetails={boardDetails} litUpHoldsMap={litUpHoldsMap} mirrored={!!currentClimb.mirrored} />
      );
    }
  }

  if (enableNavigation && currentClimb) {
    const climbViewUrl = getContextAwareClimbViewUrl(
      pathname,
      boardDetails,
      currentClimb.angle,
      currentClimb.uuid,
      currentClimb.name,
    );

    return (
      <div>
        <Link href={climbViewUrl} prefetch={false} onClick={() => onNavigate?.()} data-testid="climb-thumbnail-link">
          {renderContent}
        </Link>
      </div>
    );
  }

  return <div>{renderContent}</div>;
};

export default ClimbThumbnail;
