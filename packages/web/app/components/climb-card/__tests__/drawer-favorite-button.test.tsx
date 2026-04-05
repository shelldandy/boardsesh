import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// --- Mocks ---

const mockToggleFavorite = vi.fn().mockResolvedValue(true);
let mockUseFavoriteReturn = {
  isFavorited: false,
  isLoading: false,
  toggleFavorite: mockToggleFavorite,
  isAuthenticated: true,
};

vi.mock('../../climb-actions', () => ({
  useFavorite: () => mockUseFavoriteReturn,
}));

vi.mock('../../auth/auth-modal', () => ({
  default: ({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) =>
    open ? (
      <div data-testid="auth-modal">
        <button data-testid="auth-close" onClick={onClose}>Close</button>
        <button data-testid="auth-success" onClick={onSuccess}>Sign in</button>
      </div>
    ) : null,
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    colors: { error: '#B8524C', primary: '#8C4A52' },
    neutral: { 400: '#9CA3AF' },
  },
}));

import DrawerFavoriteButton from '../drawer-favorite-button';

describe('DrawerFavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFavoriteReturn = {
      isFavorited: false,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: true,
    };
  });

  it('renders unfavorited state with correct aria-label', () => {
    render(<DrawerFavoriteButton climbUuid="climb-1" />);
    expect(screen.getByLabelText('Add to favorites')).toBeTruthy();
    expect(screen.getByTestId('FavoriteBorderOutlinedIcon')).toBeTruthy();
  });

  it('renders favorited state with filled heart', () => {
    mockUseFavoriteReturn = { ...mockUseFavoriteReturn, isFavorited: true };
    render(<DrawerFavoriteButton climbUuid="climb-1" />);
    expect(screen.getByLabelText('Remove from favorites')).toBeTruthy();
    expect(screen.getByTestId('FavoriteIcon')).toBeTruthy();
  });

  it('calls toggleFavorite on click when authenticated', () => {
    render(<DrawerFavoriteButton climbUuid="climb-1" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockToggleFavorite).toHaveBeenCalledOnce();
  });

  it('shows auth modal on click when not authenticated', () => {
    mockUseFavoriteReturn = { ...mockUseFavoriteReturn, isAuthenticated: false };
    render(<DrawerFavoriteButton climbUuid="climb-1" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockToggleFavorite).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-modal')).toBeTruthy();
  });

  it('calls toggleFavorite after successful auth', () => {
    mockUseFavoriteReturn = { ...mockUseFavoriteReturn, isAuthenticated: false };
    render(<DrawerFavoriteButton climbUuid="climb-1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByTestId('auth-success'));
    expect(mockToggleFavorite).toHaveBeenCalledOnce();
  });

  it('closes auth modal without toggling on close', () => {
    mockUseFavoriteReturn = { ...mockUseFavoriteReturn, isAuthenticated: false };
    render(<DrawerFavoriteButton climbUuid="climb-1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByTestId('auth-close'));
    expect(mockToggleFavorite).not.toHaveBeenCalled();
    expect(screen.queryByTestId('auth-modal')).toBeNull();
  });

  it('disables button when loading', () => {
    mockUseFavoriteReturn = { ...mockUseFavoriteReturn, isLoading: true };
    render(<DrawerFavoriteButton climbUuid="climb-1" />);
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
  });
});
