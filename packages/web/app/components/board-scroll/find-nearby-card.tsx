'use client';

import React, { useMemo } from 'react';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import LocationOffOutlined from '@mui/icons-material/LocationOffOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { getBoardDetails } from '@/app/lib/__generated__/product-sizes-data';
import BoardRenderer from '../board-renderer/board-renderer';
import styles from './board-scroll.module.css';

interface FindNearbyCardProps {
  onClick: () => void;
  loading?: boolean;
  error?: boolean;
  size?: 'default' | 'small';
}

export default function FindNearbyCard({ onClick, loading = false, error = false, size = 'default' }: FindNearbyCardProps) {
  const isSmall = size === 'small';
  const iconSize = isSmall ? 28 : 36;

  const boardDetails = useMemo(
    () =>
      getBoardDetails({
        board_name: 'kilter',
        layout_id: 1,
        size_id: 10,
        set_ids: [1, 20],
      }),
    [],
  );

  let icon: React.ReactNode;
  let label: string;
  if (error) {
    icon = <LocationOffOutlined className={styles.findNearbyIconError} />;
    label = 'Location unavailable';
  } else if (loading) {
    icon = <CircularProgress size={iconSize} className={styles.findNearbyIconPrimary} />;
    label = 'Finding boards…';
  } else {
    icon = <LocationOnOutlined className={styles.findNearbyIconPrimary} />;
    label = 'Find nearby';
  }

  return (
    <div className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''}`} onClick={error ? undefined : onClick}>
      <div className={`${styles.cardSquare} ${error ? styles.cardSquareDisabled : ''}`}>
        <div className={styles.findNearbyBoard}>
          <BoardRenderer
            mirrored={false}
            boardDetails={boardDetails}
            thumbnail
            fillHeight
          />
        </div>
        <div className={styles.findNearbyOverlay}>
          {icon}
        </div>
      </div>
      <div className={`${styles.cardName} ${error ? styles.cardNameError : ''}`}>{label}</div>
    </div>
  );
}
