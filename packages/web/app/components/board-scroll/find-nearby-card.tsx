'use client';

import React, { useMemo } from 'react';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { getBoardDetails } from '@/app/lib/__generated__/product-sizes-data';
import BoardRenderer from '../board-renderer/board-renderer';
import styles from './board-scroll.module.css';

interface FindNearbyCardProps {
  onClick: () => void;
  loading?: boolean;
  size?: 'default' | 'small';
}

export default function FindNearbyCard({ onClick, loading = false, size = 'default' }: FindNearbyCardProps) {
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

  return (
    <div className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''}`} onClick={onClick}>
      <div className={styles.cardSquare}>
        <div className={styles.findNearbyBoard}>
          <BoardRenderer
            litUpHoldsMap={{}}
            mirrored={false}
            boardDetails={boardDetails}
            thumbnail
            fillHeight
          />
        </div>
        <div className={styles.findNearbyOverlay}>
          {loading ? (
            <CircularProgress size={iconSize} sx={{ color: 'var(--color-primary)' }} />
          ) : (
            <LocationOnOutlined sx={{ fontSize: iconSize, color: 'var(--color-primary)' }} />
          )}
        </div>
      </div>
      <div className={styles.cardName}>Find nearby</div>
    </div>
  );
}
