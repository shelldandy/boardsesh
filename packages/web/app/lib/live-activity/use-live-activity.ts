'use client';

import { useEffect, useRef } from 'react';
import { isNativeApp, getPlatform } from '../ble/capacitor-utils';
import {
  startLiveActivitySession,
  endLiveActivitySession,
  updateLiveActivity,
  isLiveActivityAvailable,
} from './live-activity-plugin';
import type { ClimbQueueItem } from '@/app/components/queue-control/types';
import type { BoardDetails } from '../types';

interface UseLiveActivityOptions {
  queue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
  boardDetails: BoardDetails | null;
  sessionId: string | null;
  isSessionActive: boolean;
}

export function useLiveActivity({
  queue,
  currentClimbQueueItem,
  boardDetails,
  sessionId,
  isSessionActive,
}: UseLiveActivityOptions): void {
  const isActiveRef = useRef(false);
  const availableRef = useRef<boolean | null>(null);

  // Check availability once
  useEffect(() => {
    if (!isNativeApp() || getPlatform() !== 'ios') return;
    isLiveActivityAvailable().then((available) => {
      availableRef.current = available;
    });
  }, []);

  // Start/end session
  useEffect(() => {
    if (availableRef.current === false) return;
    if (!isNativeApp() || getPlatform() !== 'ios') return;

    const hasContent = queue.length > 0 || currentClimbQueueItem !== null;
    const shouldBeActive = hasContent && boardDetails !== null;

    if (shouldBeActive && !isActiveRef.current) {
      const serverUrl = typeof window !== 'undefined' ? window.location.origin : '';

      startLiveActivitySession({
        sessionId: sessionId ?? `local-${Date.now()}`,
        serverUrl,
        boardName: boardDetails.board_name,
        layoutId: boardDetails.layout_id,
        sizeId: boardDetails.size_id,
        setIds: boardDetails.set_ids.join(','),
      });
      isActiveRef.current = true;
    } else if (!shouldBeActive && isActiveRef.current) {
      endLiveActivitySession();
      isActiveRef.current = false;
    }

    return () => {
      if (isActiveRef.current) {
        endLiveActivitySession();
        isActiveRef.current = false;
      }
    };
  }, [queue.length, currentClimbQueueItem, boardDetails, isSessionActive, sessionId]);

  // Update on climb changes (local queue mode only; party mode uses WebSocket updates)
  useEffect(() => {
    if (!isActiveRef.current || !currentClimbQueueItem || !boardDetails) return;
    if (isSessionActive && sessionId) return;

    const currentIndex = queue.findIndex((q) => q.uuid === currentClimbQueueItem.uuid);
    if (currentIndex === -1) return;

    updateLiveActivity({
      climbName: currentClimbQueueItem.climb.name,
      climbDifficulty: currentClimbQueueItem.climb.difficulty,
      angle: currentClimbQueueItem.climb.angle,
      currentIndex,
      totalClimbs: queue.length,
      hasNext: currentIndex < queue.length - 1,
      hasPrevious: currentIndex > 0,
      climbUuid: currentClimbQueueItem.climb.uuid,
      frames: currentClimbQueueItem.climb.frames,
      queue: queue.map((q) => ({
        uuid: q.uuid,
        climbUuid: q.climb.uuid,
        climbName: q.climb.name,
        difficulty: q.climb.difficulty,
        angle: q.climb.angle,
        frames: q.climb.frames,
        setterUsername: q.climb.setter_username,
      })),
    });
  }, [currentClimbQueueItem?.uuid, queue, boardDetails, isSessionActive, sessionId, currentClimbQueueItem]);
}
