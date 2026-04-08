'use client';

import { useRef, useCallback } from 'react';

/**
 * Custom swipe-to-close for nested disablePortal drawers.
 * MUI's built-in swipe doesn't work for these because the parent drawer's
 * document-level touchstart handler claims the touch first. This hook
 * detects a "pull down" gesture and translates the Paper to follow the
 * finger, closing past a threshold.
 */
export function useNestedDrawerSwipe(onClose: () => void) {
  const paperRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ startY: 0, scrollContainer: null as HTMLElement | null, isPulling: false, translateY: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Walk up to find the nearest scroll container so we can check scrollTop
    let el: HTMLElement | null = e.target as HTMLElement;
    let scrollContainer: HTMLElement | null = null;
    while (el) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainer = el;
        break;
      }
      el = el.parentElement;
    }

    stateRef.current = { startY: e.touches[0].clientY, scrollContainer, isPulling: false, translateY: 0 };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = stateRef.current;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - state.startY;

    const atTop = !state.scrollContainer || state.scrollContainer.scrollTop <= 0;

    if (atTop && deltaY > 0) {
      if (!state.isPulling && deltaY > 10) {
        state.isPulling = true;
      }
      if (state.isPulling) {
        state.translateY = deltaY;
        if (paperRef.current) {
          paperRef.current.style.transform = `translateY(${deltaY}px)`;
          paperRef.current.style.transition = 'none';
        }
      }
    } else if (state.isPulling) {
      state.isPulling = false;
      state.translateY = 0;
      if (paperRef.current) {
        paperRef.current.style.transform = '';
        paperRef.current.style.transition = '';
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const state = stateRef.current;
    if (!state.isPulling) {
      if (paperRef.current && state.translateY > 0) {
        paperRef.current.style.transform = '';
        paperRef.current.style.transition = '';
      }
      return;
    }

    const paper = paperRef.current;
    const CLOSE_THRESHOLD = 80;

    if (state.translateY > CLOSE_THRESHOLD && paper) {
      const targetY = paper.offsetHeight;
      paper.style.transition = 'transform 200ms cubic-bezier(0.0, 0, 0.2, 1)';
      paper.style.transform = `translateY(${targetY}px)`;
      setTimeout(() => {
        onClose();
      }, 210);
    } else if (paper) {
      paper.style.transition = 'transform 200ms cubic-bezier(0.0, 0, 0.2, 1)';
      paper.style.transform = '';
      setTimeout(() => {
        if (paper) paper.style.transition = '';
      }, 210);
    }

    state.isPulling = false;
    state.translateY = 0;
  }, [onClose]);

  return { paperRef, handleTouchStart, handleTouchMove, handleTouchEnd };
}
