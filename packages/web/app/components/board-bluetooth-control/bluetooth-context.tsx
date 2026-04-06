'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import { useBoardBluetooth } from './use-board-bluetooth';
import { useCurrentClimb } from '../graphql-queue';
import type { BoardDetails } from '@/app/lib/types';
import { isCapacitor, isCapacitorWebView, waitForCapacitor, CAPACITOR_BRIDGE_TIMEOUT_MS } from '@/app/lib/ble/capacitor-utils';

interface BluetoothContextValue {
  isConnected: boolean;
  loading: boolean;
  connect: (initialFrames?: string, mirrored?: boolean) => Promise<boolean>;
  disconnect: () => void;
  sendFramesToBoard: (frames: string, mirrored?: boolean) => Promise<boolean | undefined>;
  isBluetoothSupported: boolean;
  isIOS: boolean;
}

const BluetoothContext = createContext<BluetoothContextValue | null>(null);

/**
 * Isolated child component that subscribes to CurrentClimbContext and auto-sends
 * climb data over BLE. Only mounted when isConnected is true so BluetoothProvider
 * itself never subscribes to the climb context — preventing re-renders of the
 * entire component tree on every climb change when BT is disconnected.
 */
function BluetoothAutoSender({
  sendFramesToBoard,
  layoutName,
}: {
  sendFramesToBoard: (frames: string, mirrored?: boolean) => Promise<boolean | undefined>;
  layoutName: string;
}) {
  const { currentClimbQueueItem } = useCurrentClimb();
  const sendVersionRef = useRef(0);

  useEffect(() => {
    if (!currentClimbQueueItem) return;

    // Increment version to cancel any in-flight stale sends
    sendVersionRef.current += 1;
    const version = sendVersionRef.current;

    const sendClimb = async () => {
      try {
        const result = await sendFramesToBoard(
          currentClimbQueueItem.climb.frames,
          !!currentClimbQueueItem.climb.mirrored,
        );

        // Skip analytics if a newer send has started (rapid swiping)
        if (sendVersionRef.current !== version) return;

        if (result === true) {
          track('Climb Sent to Board Success', {
            climbUuid: currentClimbQueueItem.climb?.uuid,
            boardLayout: layoutName,
          });
        } else if (result === false) {
          track('Climb Sent to Board Failure', {
            climbUuid: currentClimbQueueItem.climb?.uuid,
            boardLayout: layoutName,
          });
        }
      } catch (error) {
        if (sendVersionRef.current !== version) return;
        console.error('Error sending climb to board:', error);
        track('Climb Sent to Board Failure', {
          climbUuid: currentClimbQueueItem.climb?.uuid,
          boardLayout: layoutName,
        });
      }
    };
    sendClimb();
  }, [currentClimbQueueItem, sendFramesToBoard, layoutName]);

  return null;
}

export function BluetoothProvider({
  boardDetails,
  children,
}: {
  boardDetails: BoardDetails;
  children: React.ReactNode;
}) {
  const { isConnected, loading, connect, disconnect, sendFramesToBoard } =
    useBoardBluetooth({ boardDetails });

  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let cancelPolling: (() => void) | undefined;

    if (isCapacitor()) {
      // Bridge already available — confirmed native environment
      setIsBluetoothSupported(true);
    } else if (typeof navigator !== 'undefined' && !!navigator.bluetooth) {
      // Web Bluetooth API present (Chrome, Edge, etc.)
      setIsBluetoothSupported(true);
    } else if (isCapacitorWebView()) {
      // UA looks like a native WebView — bridge may not be injected yet.
      // Poll for window.Capacitor; only confirm support once the bridge appears.
      let cancelled = false;
      waitForCapacitor(CAPACITOR_BRIDGE_TIMEOUT_MS).then((found) => {
        if (!cancelled && found) {
          setIsBluetoothSupported(true);
        }
      });
      cancelPolling = () => { cancelled = true; };
    }

    if (
      typeof navigator !== 'undefined' &&
      /iPhone|iPad|iPod/i.test(
        navigator.userAgent || (navigator as { vendor?: string }).vendor || '',
      )
    ) {
      setIsIOS(true);
    }

    return () => cancelPolling?.();
  }, []);

  const value = useMemo(
    () => ({
      isConnected,
      loading,
      connect,
      disconnect,
      sendFramesToBoard,
      isBluetoothSupported,
      isIOS,
    }),
    [
      isConnected,
      loading,
      connect,
      disconnect,
      sendFramesToBoard,
      isBluetoothSupported,
      isIOS,
    ],
  );

  return (
    <BluetoothContext.Provider value={value}>
      {isConnected && (
        <BluetoothAutoSender
          sendFramesToBoard={sendFramesToBoard}
          layoutName={boardDetails.layout_name ?? ''}
        />
      )}
      {children}
    </BluetoothContext.Provider>
  );
}

export function useBluetoothContext() {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error(
      'useBluetoothContext must be used within a BluetoothProvider',
    );
  }
  return context;
}

export { BluetoothContext };
