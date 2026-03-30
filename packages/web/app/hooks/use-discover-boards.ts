import { useState, useEffect, useRef, useCallback } from 'react';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { SEARCH_BOARDS, type SearchBoardsQueryResponse } from '@/app/lib/graphql/operations';
import type { UserBoard } from '@boardsesh/shared-schema';

interface UseDiscoverBoardsOptions {
  /** Maximum number of boards to return */
  limit?: number;
  /** Whether to request geolocation from the browser */
  enableLocation?: boolean;
}

interface DiscoverBoardsResult {
  boards: UserBoard[];
  isLoading: boolean;
  hasLocation: boolean;
  error: string | null;
}

/**
 * Discovers public boards for the home page.
 * If location is enabled and available, nearby boards appear first (sorted by distance).
 * Remaining slots are filled with popular boards (sorted by totalAscents).
 * Deduplication ensures no board appears twice.
 */
export function useDiscoverBoards({
  limit = 20,
  enableLocation = true,
}: UseDiscoverBoardsOptions = {}): DiscoverBoardsResult {
  const { token } = useWsAuthToken();
  const [boards, setBoards] = useState<UserBoard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLocation, setHasLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchBoards = useCallback(async (coords: { latitude: number; longitude: number } | null) => {
    const client = createGraphQLHttpClient(token ?? undefined);
    const nearbyUuids = new Set<string>();
    let nearbyBoards: UserBoard[] = [];

    // 1. If location available, fetch nearby boards first
    if (coords) {
      try {
        const nearbyResult = await client.request<SearchBoardsQueryResponse>(SEARCH_BOARDS, {
          input: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            radiusKm: 100,
            limit,
          },
        });
        nearbyBoards = nearbyResult.searchBoards.boards;
        nearbyBoards.forEach((b) => nearbyUuids.add(b.uuid));
        setHasLocation(true);
      } catch {
        // Location search failed, fall through to popular
      }
    }

    // 2. Fetch popular boards (all public boards, we'll sort client-side)
    try {
      const popularResult = await client.request<SearchBoardsQueryResponse>(SEARCH_BOARDS, {
        input: { limit: limit * 2 }, // Fetch extra to have enough after dedup
      });

      // Sort by totalAscents descending for popularity
      const popularBoards = popularResult.searchBoards.boards
        .filter((b: UserBoard) => !nearbyUuids.has(b.uuid))
        .sort((a: UserBoard, b: UserBoard) => b.totalAscents - a.totalAscents);

      // Merge: nearby first, then popular, capped at limit
      const merged = [...nearbyBoards, ...popularBoards].slice(0, limit);
      setBoards(merged);
    } catch (err) {
      // If popular fetch fails but we have nearby, use those
      if (nearbyBoards.length > 0) {
        setBoards(nearbyBoards);
      } else {
        console.error('Failed to discover boards:', err);
        setError('Failed to load boards');
      }
    }
  }, [token, limit]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const doFetch = async () => {
      setIsLoading(true);
      setError(null);

      // Try to get geolocation if enabled
      let coords: { latitude: number; longitude: number } | null = null;
      if (enableLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 300000, // Cache for 5 minutes
              enableHighAccuracy: false,
            });
          });
          coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        } catch {
          // Location denied or unavailable, proceed without
        }
      }

      await fetchBoards(coords);
      setIsLoading(false);
    };

    doFetch();
  }, [enableLocation, fetchBoards]);

  return { boards, isLoading, hasLocation, error };
}
