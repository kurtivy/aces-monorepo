import { useState, useEffect } from 'react';
import type { DatabaseListing } from '@/types/rwa/section.types';
import type { TokenHealthData } from '@/lib/api/token-health';
import { validateAndWarnAddress } from '@/lib/validation/address';

/**
 * Resolve base URL for /api/listings/symbol so RWA page always hits this app's API.
 * - Client: relative '' so fetch('/api/...') goes to same origin.
 * - Server (SSR): absolute origin so fetch hits this Next.js app, not a separate backend.
 */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  );
}

const API_BASE_URL = resolveApiBaseUrl();

/** Cache key for listing + health so modal prefetch matches RWA page request. */
function cacheKey(symbol: string, includeHealth: boolean): string {
  return `${symbol.trim().toLowerCase()}:${includeHealth}`;
}

const LISTING_CACHE_TTL_MS = 60 * 1000; // 1 minute

interface CachedListing {
  listing: DatabaseListing;
  health: TokenHealthData | null;
  timestamp: number;
}

const listingCache = new Map<string, CachedListing>();
const pendingFetches = new Map<string, Promise<{ listing: DatabaseListing; health: TokenHealthData | null } | null>>();

async function fetchListingBySymbolInternal(
  symbol: string,
  includeHealth: boolean,
): Promise<{ listing: DatabaseListing; health: TokenHealthData | null } | null> {
  const url = `${API_BASE_URL}/api/listings/symbol/${encodeURIComponent(symbol)}${includeHealth ? '?includeHealth=1' : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch listing: ${response.status} ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success || !result.data) return null;
  let newListing = result.data as DatabaseListing;
  if (newListing.token?.contractAddress) {
    const validated = validateAndWarnAddress(newListing.token.contractAddress, 'listing-cache');
    if (validated) {
      newListing = { ...newListing, token: { ...newListing.token, contractAddress: validated } };
    }
  }
  return { listing: newListing, health: result.health ?? null };
}

/**
 * Shared fetch: uses cache (if fresh), dedupes in-flight requests.
 * Used by prefetch (modal) and useListingBySymbol (RWA page) so the RWA page can show data immediately when prefetch completed.
 */
async function fetchListingBySymbol(
  symbol: string,
  includeHealth: boolean,
): Promise<{ listing: DatabaseListing; health: TokenHealthData | null } | null> {
  const key = cacheKey(symbol, includeHealth);
  const cached = listingCache.get(key);
  if (cached && Date.now() - cached.timestamp < LISTING_CACHE_TTL_MS) {
    return { listing: cached.listing, health: cached.health };
  }
  let pending = pendingFetches.get(key);
  if (!pending) {
    pending = fetchListingBySymbolInternal(symbol, includeHealth).then((data) => {
      pendingFetches.delete(key);
      if (data) listingCache.set(key, { ...data, timestamp: Date.now() });
      return data;
    });
    pendingFetches.set(key, pending);
  }
  return pending;
}

/**
 * Prefetch listing (and health) for a symbol. Call this when the user is about to navigate to the RWA page (e.g. Trade/Auction in image-details-modal).
 * The RWA page's useListingBySymbol will use the cached result if the prefetch completed, making the load feel instant.
 */
export function prefetchListingBySymbol(symbol: string, includeHealth = true): void {
  const s = symbol?.trim();
  if (!s) return;
  fetchListingBySymbol(s, includeHealth).catch(() => {
    // Prefetch is fire-and-forget; RWA page will refetch on mount if cache miss
  });
}

export interface UseListingBySymbolOptions {
  /** When true, request listing + token health in one round trip (faster DATA panel). Default false. */
  includeHealth?: boolean;
}

export function useListingBySymbol(symbol: string, options: UseListingBySymbolOptions = {}) {
  const { includeHealth = false } = options;

  const [listing, setListing] = useState<DatabaseListing | null>(null);
  const [health, setHealth] = useState<TokenHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    const key = cacheKey(symbol, includeHealth);
    const cached = listingCache.get(key);

    // Hydrate from cache immediately so RWA page can render without full-page loader when prefetch completed (e.g. from modal Trade/Auction).
    if (cached && Date.now() - cached.timestamp < LISTING_CACHE_TTL_MS) {
      setListing(cached.listing);
      setHealth(cached.health);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    async function doFetch() {
      try {
        const data = await fetchListingBySymbol(symbol, includeHealth);
        if (isCancelled) return;
        if (data) {
          setListing(data.listing);
          setHealth(data.health);
        } else {
          setListing(null);
          setHealth(null);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching listing by symbol:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch listing');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    doFetch();
    const pollInterval = setInterval(doFetch, 10000);
    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [symbol, includeHealth]);

  const refetch = async () => {
    if (!symbol) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchListingBySymbol(symbol, includeHealth);
      if (data) {
        setListing(data.listing);
        setHealth(data.health);
      } else {
        setListing(null);
        setHealth(null);
      }
    } catch (err) {
      console.error('Error refetching listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to refetch listing');
    } finally {
      setLoading(false);
    }
  };

  return {
    listing,
    health,
    loading,
    error,
    refetch,
    isLive: listing?.isLive ?? false,
    isPreLaunch: listing ? !listing.isLive : false,
    isDexLive: listing?.dex?.isDexLive ?? listing?.token?.phase === 'DEX_TRADING',
    dex: listing?.dex ?? null,
    launchDate: listing?.launchDate,
    isLaunched: listing?.launchDate ? new Date(listing.launchDate) <= new Date() : true,
    owner: listing?.owner,
  };
}

export function useIsOwner(listing: DatabaseListing | null, currentUserAddress?: string) {
  if (!listing || !currentUserAddress) return false;
  return listing.owner?.walletAddress?.toLowerCase() === currentUserAddress.toLowerCase();
}
