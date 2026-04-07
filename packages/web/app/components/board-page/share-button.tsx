'use client';

import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import Lightbulb from '@mui/icons-material/Lightbulb';
import IconButton from '@mui/material/IconButton';
import { useCurrentClimb, useSessionData } from '../graphql-queue';
import { useBluetoothContext } from '../board-bluetooth-control/bluetooth-context';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';

export const ShareBoardButton = () => {
  const { showMessage } = useSnackbar();
  const {
    hasConnected,
    isSessionActive,
    sessionId,
  } = useSessionData();
  const {
    isConnected: isBoardConnected,
    connect: btConnect,
    disconnect: btDisconnect,
    loading: btLoading,
    isBluetoothSupported,
    isIOS,
  } = useBluetoothContext();
  const { currentClimbQueueItem } = useCurrentClimb();

  const isConnecting = !!(sessionId && !hasConnected);

  const handleLightbulbClick = async () => {
    if (isBoardConnected) {
      btDisconnect();
      return;
    }
    if (!isBluetoothSupported) {
      if (isIOS) {
        showMessage('Bluetooth needs the Bluefy browser on iOS', 'warning');
      } else {
        showMessage('Bluetooth is not supported in this browser', 'warning');
      }
      return;
    }
    if (currentClimbQueueItem) {
      await btConnect(
        currentClimbQueueItem.climb.frames,
        !!currentClimbQueueItem.climb.mirrored,
      );
    } else {
      await btConnect();
    }
  };

  return (
    <IconButton
      aria-label={isBoardConnected ? 'Disconnect from board' : 'Connect to board'}
      onClick={handleLightbulbClick}
      color={isSessionActive ? 'primary' : 'default'}
    >
      {isConnecting || btLoading ? (
        <CircularProgress size={16} />
      ) : isBoardConnected ? (
        <Lightbulb sx={{
          color: '#FFD700',
          '@keyframes connectedGlow': {
            '0%': { filter: 'drop-shadow(0 0 2px rgba(255, 215, 0, 0.6))' },
            '100%': { filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 1))' },
          },
          animation: 'connectedGlow 1.5s ease-in-out infinite alternate',
        }} />
      ) : (
        <LightbulbOutlined />
      )}
    </IconButton>
  );
};
