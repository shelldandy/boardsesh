import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockToggleFavorite = vi.fn().mockResolvedValue(true);

vi.mock('../use-favorite', () => ({
  useFavorite: vi.fn(() => ({
    isFavorited: false,
    isLoading: false,
    toggleFavorite: mockToggleFavorite,
    isAuthenticated: true,
  })),
}));

import { useDoubleTapFavorite } from '../use-double-tap-favorite';
import { useFavorite } from '../use-favorite';

const mockedUseFavorite = vi.mocked(useFavorite);

describe('useDoubleTapFavorite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseFavorite.mockReturnValue({
      isFavorited: false,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: true,
    });
  });

  it('returns expected shape', () => {
    const { result } = renderHook(() =>
      useDoubleTapFavorite({ climbUuid: 'test-uuid' }),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        handleDoubleTap: expect.any(Function),
        showHeart: false,
        dismissHeart: expect.any(Function),
        isFavorited: false,
        toggleFavorite: expect.any(Function),
        showAuthModal: false,
        setShowAuthModal: expect.any(Function),
      }),
    );
  });

  it('shows auth modal when unauthenticated', () => {
    mockedUseFavorite.mockReturnValue({
      isFavorited: false,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: false,
    });

    const { result } = renderHook(() =>
      useDoubleTapFavorite({ climbUuid: 'test-uuid' }),
    );

    act(() => {
      result.current.handleDoubleTap();
    });

    expect(result.current.showAuthModal).toBe(true);
    expect(result.current.showHeart).toBe(false);
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it('toggles favorite and shows heart when not yet favorited', () => {
    const { result } = renderHook(() =>
      useDoubleTapFavorite({ climbUuid: 'test-uuid' }),
    );

    act(() => {
      result.current.handleDoubleTap();
    });

    expect(result.current.showHeart).toBe(true);
    expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('shows heart but does NOT unfavorite when already favorited', () => {
    mockedUseFavorite.mockReturnValue({
      isFavorited: true,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: true,
    });

    const { result } = renderHook(() =>
      useDoubleTapFavorite({ climbUuid: 'test-uuid' }),
    );

    act(() => {
      result.current.handleDoubleTap();
    });

    expect(result.current.showHeart).toBe(true);
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it('dismissHeart resets showHeart to false', () => {
    const { result } = renderHook(() =>
      useDoubleTapFavorite({ climbUuid: 'test-uuid' }),
    );

    act(() => {
      result.current.handleDoubleTap();
    });
    expect(result.current.showHeart).toBe(true);

    act(() => {
      result.current.dismissHeart();
    });
    expect(result.current.showHeart).toBe(false);
  });

  it('setShowAuthModal controls auth modal visibility', () => {
    const { result } = renderHook(() =>
      useDoubleTapFavorite({ climbUuid: 'test-uuid' }),
    );

    expect(result.current.showAuthModal).toBe(false);

    act(() => {
      result.current.setShowAuthModal(true);
    });
    expect(result.current.showAuthModal).toBe(true);

    act(() => {
      result.current.setShowAuthModal(false);
    });
    expect(result.current.showAuthModal).toBe(false);
  });

  it('passes isFavorited and toggleFavorite through from useFavorite', () => {
    mockedUseFavorite.mockReturnValue({
      isFavorited: true,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: true,
    });

    const { result } = renderHook(() =>
      useDoubleTapFavorite({ climbUuid: 'test-uuid' }),
    );

    expect(result.current.isFavorited).toBe(true);
    expect(result.current.toggleFavorite).toBeDefined();
  });
});
