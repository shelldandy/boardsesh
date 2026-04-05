'use client';

import { useEffect, useRef } from 'react';
import { useLiveActivity } from './use-live-activity';
import { isNativeApp, getPlatform } from '../ble/capacitor-utils';
import type { ClimbQueueItem } from '@/app/components/queue-control/types';
import type { BoardDetails } from '../types';

interface LiveActivityBridgeProps {
  queue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
  boardDetails: BoardDetails | null;
  sessionId: string | null;
  isSessionActive: boolean;
  onSetCurrentClimb?: (item: ClimbQueueItem) => void;
}

export default function LiveActivityBridge({
  onSetCurrentClimb,
  ...props
}: LiveActivityBridgeProps) {
  useLiveActivity(props);

  // Listen for widget next/previous button taps and navigate the queue.
  const queueRef = useRef(props.queue);
  queueRef.current = props.queue;
  const onSetCurrentClimbRef = useRef(onSetCurrentClimb);
  onSetCurrentClimbRef.current = onSetCurrentClimb;

  useEffect(() => {
    if (!isNativeApp() || getPlatform() !== 'ios') return;
    const plugin = window.Capacitor?.Plugins?.LiveActivity;
    if (!plugin?.addListener) return;

    let removeHandle: (() => void) | null = null;

    plugin.addListener('queueNavigate', (data: Record<string, unknown>) => {
      const currentIndex = data.currentIndex as number;
      const queue = queueRef.current;
      const callback = onSetCurrentClimbRef.current;
      if (!callback || currentIndex < 0 || currentIndex >= queue.length) return;
      callback(queue[currentIndex]);
    }).then((handle) => {
      removeHandle = handle.remove;
    });

    return () => {
      removeHandle?.();
    };
  }, []);

  return null;
}
