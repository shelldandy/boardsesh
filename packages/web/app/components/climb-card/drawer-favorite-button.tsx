'use client';

import React, { useState, useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined';
import Favorite from '@mui/icons-material/Favorite';
import { useFavorite } from '../climb-actions';
import AuthModal from '../auth/auth-modal';
import { themeTokens } from '@/app/theme/theme-config';

type DrawerFavoriteButtonProps = {
  climbUuid: string;
};

/** Compact favorite toggle for use in drawer headers (e.g. playlist selector). */
export default function DrawerFavoriteButton({ climbUuid }: DrawerFavoriteButtonProps) {
  const { isFavorited, isLoading, toggleFavorite, isAuthenticated } = useFavorite({ climbUuid });
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }
      toggleFavorite();
    },
    [isAuthenticated, toggleFavorite],
  );

  return (
    <>
      <IconButton
        size="small"
        aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        disabled={isLoading}
        onClick={handleClick}
        sx={{ color: isFavorited ? themeTokens.colors.error : themeTokens.neutral[400] }}
      >
        {isFavorited ? <Favorite fontSize="small" /> : <FavoriteBorderOutlined fontSize="small" />}
      </IconButton>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          toggleFavorite();
        }}
        title="Sign in to save favorites"
        description="Sign in to save this climb to your favorites."
      />
    </>
  );
}
