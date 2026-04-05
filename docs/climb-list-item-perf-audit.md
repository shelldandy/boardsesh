# ClimbListItem Performance Audit

Audit of `climb-list-item.tsx` and related files after the swipe performance fix and double-tap-to-favorite merge. This component is `React.memo` with a custom comparator, rendered 100+ times in a non-virtualized list. Every unnecessary re-render, object allocation, or DOM operation matters.

---

## Summary

The core optimization replaces React state-driven swipe offset updates (which caused re-renders at ~60fps during gestures across 100+ list items) with direct DOM manipulation via refs. The `useDoubleTap` hook was also stabilized. The changes are mostly correct, but several remaining issues were identified and addressed.

---

## Issue 1: Inline ref callback on swipeable content div recreated every render -- FIXED

- **File:Line** -- `climb-list-item.tsx:398-403`
- **Severity** -- Medium
- **Issue** -- The `ref` prop on the swipeable content `<div>` was an inline arrow function that created a new closure on every render.
- **Impact** -- Every render of each of the 100+ list items creates a new function reference. React calls the old ref with `null` then the new ref with the node on every render, causing unnecessary ref churn.
- **Fix** -- Extracted to `contentCombinedRef` via `useCallback`.

---

## Issue 2: Inline onClick handler on IconButton recreated every render

- **File:Line** -- `climb-list-item.tsx:454-462`
- **Severity** -- Medium
- **Status** -- Not fixed (pre-existing, hidden on mobile via CSS `.menuButton`)
- **Issue** -- The `onClick` handler for the menu `IconButton` is an inline arrow function.
- **Impact** -- Creates a new function reference on every render for each of 100+ items. `IconButton` from MUI is not memoized by default, but it still adds GC pressure and prevents any future memoization.
- **Fix** -- Extract to a `useCallback` with deps `[onOpenActions, climb]`.

---

## Issue 3: Inline onClick handler on thumbnail div recreated every render -- FIXED

- **File:Line** -- `climb-list-item.tsx:411-420`
- **Severity** -- Medium
- **Issue** -- The `onClick` for the thumbnail container was a conditional inline function that also captured a potentially stale `onThumbnailClick` closure.
- **Impact** -- When `onThumbnailClick` is truthy, a new closure is created every render. Combined with `onThumbnailClick` being removed from the memo comparator, the inline handler could use a stale reference.
- **Fix** -- Extracted to `handleThumbnailClick` via `useCallback`, using `onThumbnailClickRef` to always read the latest value.

---

## Issue 4: Inline onDoubleClick handler on thumbnail div recreated every render -- FIXED

- **File:Line** -- `climb-list-item.tsx:423-429`
- **Severity** -- Low
- **Issue** -- The `onDoubleClick` was an inline arrow function.
- **Impact** -- New closure on every render for 100+ items. Minor GC pressure.
- **Fix** -- Extracted to `handleThumbnailDoubleClick` via `useCallback` with dep `[handleDoubleTapClick]`. Since `handleDoubleTapClick` is now stable (from the `useDoubleTap` callbackRef fix), this callback is also stable.

---

## Issue 5: `onThumbnailClick` removed from custom comparator -- stale closure risk -- FIXED

- **File:Line** -- `climb-list-item.tsx` (the `React.memo` comparator)
- **Severity** -- Critical
- **Issue** -- The diff removed `prev.onThumbnailClick === next.onThumbnailClick` from the comparator. If the parent passes a new `onThumbnailClick` function (e.g., one that closes over different state), the memoized component would not re-render, and the click handler would use a stale closure.
- **Impact** -- The thumbnail click handler could invoke an outdated callback, leading to incorrect behavior (e.g., navigating to wrong climb, operating on stale data).
- **Fix** -- Stored `onThumbnailClick` in `onThumbnailClickRef` so the handler always reads the latest value without requiring it in the comparator.

---

## Issue 6: Inline callbacks in SwipeableDrawer children recreated every render

- **File:Line** -- `climb-list-item.tsx:477-478, 487-490, 492, 499-503, 510`
- **Severity** -- Low
- **Status** -- Not fixed (pre-existing, low impact)
- **Issue** -- Multiple inline arrow functions passed as props to `SwipeableDrawer` and its children (`onClose`, `onOpenPlaylistSelector`, `onActionComplete`, `onDone`).
- **Impact** -- These only matter when `!hasParentDrawers`, and the drawers are conditionally rendered / usually closed. Low priority since the drawers are dynamic imports and only mount when open.
- **Fix** -- Extract to `useCallback` for consistency, though impact is minimal since these elements don't render 100+ times.

---

## Issue 7: Inline styles object for playlist selector drawer recreated every render

- **File:Line** -- `climb-list-item.tsx:500-503`
- **Severity** -- Low
- **Status** -- Not fixed (pre-existing, low impact)
- **Issue** -- The `styles` prop for the playlist `SwipeableDrawer` is an inline object literal with nested objects.
- **Impact** -- Creates a new object on every render. Same caveat as Issue 6 -- only when `!hasParentDrawers`.
- **Fix** -- Hoist to a module-level constant like `drawerStyles` above it.

---

## Issue 8: `resolvedTitleProps` creates new object with JSX element on every render -- FIXED

- **File:Line** -- `climb-list-item.tsx:355-361`
- **Severity** -- Medium
- **Issue** -- When `titleProps` is not provided (the common case), `resolvedTitleProps` created a new object literal containing a new `<AscentStatus>` JSX element on every render.
- **Impact** -- The `rightAddon` JSX creates a new React element every render, which means `ClimbTitle` (if memoized) would always receive a new prop reference. With 100+ items, this is 100+ unnecessary object + element allocations per render cycle.
- **Fix** -- Wrapped in `useMemo` with deps `[titleProps, climb.uuid, isFavorited]`.

---

## Issue 9: `HeartAnimationOverlay` receives `sx` prop with inline object

- **File:Line** -- `heart-animation-overlay.tsx:26`
- **Severity** -- Low
- **Status** -- Not fixed (minimal impact)
- **Issue** -- The `Favorite` icon inside `HeartAnimationOverlay` receives `sx={{ fontSize: size, color: 'white' }}`. While the component itself is now `React.memo`, the `sx` prop creates a new object on every render of the overlay.
- **Impact** -- Minimal in practice because the component returns `null` most of the time (only renders during animation, single instance not 100+).
- **Fix** -- Could memoize the sx object or use a CSS class, but low priority.

---

## Issue 10: `useDoubleTapFavorite` returns a new object every call

- **File:Line** -- `use-double-tap-favorite.ts:55-61`
- **Severity** -- Medium
- **Status** -- Mitigated
- **Issue** -- The hook returns a new object literal on every render. `handleDoubleTap` changes whenever `isFavorited` changes (deps: `[isAuthenticated, isFavorited, toggleFavorite, openAuthModal]`).
- **Impact** -- For the current usage pattern (immediate destructuring), this is not directly harmful. The `handleDoubleTap` instability no longer causes event listener churn because `useDoubleTap` now uses a `callbackRef` pattern.
- **Fix** -- No action needed for current usage, but wrapping the return in `useMemo` would be more defensive.

---

## Issue 11: `swipeHandlers` spread creates inline functions from `react-swipeable`

- **File:Line** -- `climb-list-item.tsx:397`
- **Severity** -- Low
- **Status** -- Not fixed (library limitation)
- **Issue** -- `{...(disableSwipe ? {} : swipeHandlers)}` spreads event handlers from `useSwipeable`. The `react-swipeable` library returns a new handlers object on each render if any of its dependencies change.
- **Impact** -- The swipe handlers object likely changes on every render since `useSwipeable` doesn't deeply memoize. However, this is inherent to the library and the handlers are spread directly onto a plain `div`, not a memoized component.
- **Fix** -- Low priority. Would require wrapping `useSwipeable` options in `useMemo` inside `use-swipe-actions.ts`.

---

## What's Clean

1. **Core swipe optimization** -- Replacing `setSwipeOffset` (React state at 60fps) with direct DOM manipulation via refs (`handleSwipeOffset`) eliminates the biggest performance bottleneck. For 100+ items, this prevents thousands of unnecessary re-renders during swipe gestures.

2. **`useDoubleTap` callbackRef pattern** -- Correctly stabilizes event listeners so they don't need to be re-attached when the callback changes. The empty dependency arrays on `handleTouchEnd` and `onDoubleClick` are correct because they read from `callbackRef.current`.

3. **Static style objects hoisted to module scope** -- `shortSwipeLayerInitialStyle`, `longSwipeLayerInitialStyle`, `rightActionLayerInitialStyle`, `defaultLeftActionStyle`, `defaultRightActionStyle` are all correctly hoisted out of the component, eliminating per-render object allocations for 100+ items.

4. **`thumbnailStyle` consolidation** -- Merging `position: 'relative'` into the static `thumbnailStyle` constant eliminates a spread allocation per render per item.

5. **`HeartAnimationOverlay` memoization** -- Wrapping in `React.memo` prevents unnecessary re-renders when parent state changes but `visible`/`onAnimationEnd`/`size` haven't changed.

6. **`onThumbnailClick` ref pattern** -- Removes the unstable callback from the memo comparator while ensuring the handler always reads the latest value.

---

## Priority Summary

| Priority | Issue | Status |
|----------|-------|--------|
| Critical | #5: `onThumbnailClick` stale closure | Fixed |
| Medium | #1: Inline ref callback on content div | Fixed |
| Medium | #3: Inline onClick on thumbnail | Fixed |
| Medium | #8: `resolvedTitleProps` not memoized | Fixed |
| Medium | #2: Inline onClick on IconButton | Not fixed (pre-existing) |
| Medium | #10: `useDoubleTapFavorite` return object | Mitigated |
| Low | #4: Inline onDoubleClick on thumbnail | Fixed |
| Low | #6: Inline callbacks in drawers | Not fixed (pre-existing) |
| Low | #7: Inline styles on playlist drawer | Not fixed (pre-existing) |
| Low | #9: `sx` prop in HeartAnimationOverlay | Not fixed (minimal impact) |
| Low | #11: `swipeHandlers` instability | Not fixed (library limitation) |
