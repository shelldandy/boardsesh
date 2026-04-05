'use client';

import { useState, useCallback } from 'react';
import { useFavorite } from './use-favorite';

interface UseDoubleTapFavoriteOptions {
  climbUuid: string;
}

interface UseDoubleTapFavoriteReturn {
  handleDoubleTap: () => void;
  showHeart: boolean;
  dismissHeart: () => void;
  isFavorited: boolean;
  toggleFavorite: () => Promise<boolean>;
  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
}

/**
 * Manages favorite toggle + heart animation state for double-tap-to-like.
 * Instagram-style: double-tap only adds a like, never removes it.
 *
 * Returns a plain `handleDoubleTap` callback. Callers wire it to their
 * own double-tap detection (e.g. pass as `onDoubleTap` to SwipeBoardCarousel,
 * or as `onCoverDoubleClick` to ClimbCard — both already call useDoubleTap
 * internally).
 */
export function useDoubleTapFavorite({ climbUuid }: UseDoubleTapFavoriteOptions): UseDoubleTapFavoriteReturn {
  const { isFavorited, toggleFavorite, isAuthenticated } = useFavorite({ climbUuid });
  const [showHeart, setShowHeart] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleDoubleTap = useCallback(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Always show heart animation
    setShowHeart(true);

    // Only toggle if not already favorited (Instagram behavior)
    if (!isFavorited) {
      toggleFavorite();
    }
  }, [isAuthenticated, isFavorited, toggleFavorite]);

  const dismissHeart = useCallback(() => {
    setShowHeart(false);
  }, []);

  return {
    handleDoubleTap,
    showHeart,
    dismissHeart,
    isFavorited,
    toggleFavorite,
    showAuthModal,
    setShowAuthModal,
  };
}
