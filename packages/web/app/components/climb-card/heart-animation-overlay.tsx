'use client';

import React from 'react';
import Favorite from '@mui/icons-material/Favorite';
import styles from './heart-animation-overlay.module.css';

interface HeartAnimationOverlayProps {
  visible: boolean;
  onAnimationEnd: () => void;
}

export default function HeartAnimationOverlay({ visible, onAnimationEnd }: HeartAnimationOverlayProps) {
  if (!visible) return null;

  return (
    <div className={styles.overlay} data-testid="heart-animation-overlay">
      <Favorite
        className={styles.heart}
        onAnimationEnd={onAnimationEnd}
        sx={{ fontSize: 80, color: 'white' }}
      />
    </div>
  );
}
