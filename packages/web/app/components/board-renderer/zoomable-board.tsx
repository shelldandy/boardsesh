'use client';

import React, { useEffect, useRef, memo } from 'react';
import IconButton from '@mui/material/IconButton';
import CropFreeOutlined from '@mui/icons-material/CropFreeOutlined';
import { useZoomPan } from '@/app/lib/hooks/use-zoom-pan';
import styles from './swipe-board-carousel.module.css';

interface ZoomableBoardProps {
  children: React.ReactNode;
  onZoomChange: (isZoomed: boolean) => void;
  resetKey: string;
}

const ZoomableBoard = memo(function ZoomableBoard({ children, onZoomChange, resetKey }: ZoomableBoardProps) {
  const { containerRef, contentRef, isZoomed, resetZoom } = useZoomPan();
  const prevResetKeyRef = useRef(resetKey);

  // Notify parent of zoom state changes
  useEffect(() => {
    onZoomChange(isZoomed);
  }, [isZoomed, onZoomChange]);

  // Reset zoom when climb changes
  useEffect(() => {
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      resetZoom();
    }
  }, [resetKey, resetZoom]);

  return (
    <div
      ref={containerRef}
      className={styles.zoomContainer}
      style={{ touchAction: isZoomed ? 'none' : 'pan-y' }}
    >
      <div ref={contentRef} className={styles.zoomContent}>
        {children}
      </div>
      <IconButton
        className={`${styles.zoomResetButton} ${isZoomed ? styles.zoomResetButtonVisible : ''}`}
        onClick={resetZoom}
        aria-label="Reset zoom"
        size="small"
        tabIndex={isZoomed ? 0 : -1}
      >
        <CropFreeOutlined fontSize="small" />
      </IconButton>
    </div>
  );
});

export default ZoomableBoard;
