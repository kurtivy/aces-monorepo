// hooks/rwa/use-listing-by-symbol.ts
import { useState, useEffect } from 'react';
import type { DatabaseListing } from '@/types/rwa/section.types';

const resolveApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // Fallback for SSR – stick to relative requests and rely on Next.js proxy config
  return '';
};

const API_BASE_URL = resolveApiBaseUrl();

export function useListingBySymbol(symbol: string) {
  const [listing, setListing] = useState<DatabaseListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      return;
    }

    async function fetchListingBySymbol() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/api/v1/listings/symbol/${encodeURIComponent(symbol)}`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            setListing(null);
            return;
          }
          throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setListing(result.data as DatabaseListing);
        } else {
          setListing(null);
        }
      } catch (err) {
        console.error('Error fetching listing by symbol:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch listing');
      } finally {
        setLoading(false);
      }
    }

    fetchListingBySymbol();
  }, [symbol]);

  const refetch = async () => {
    if (!symbol) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/listings/symbol/${encodeURIComponent(symbol)}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setListing(null);
          return;
        }
        throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setListing(result.data as DatabaseListing);
      } else {
        setListing(null);
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
    loading,
    error,
    refetch,
    // Convenience properties
    isLive: listing?.isLive ?? false,
    isPreLaunch: listing ? !listing.isLive : false,
    isDexLive: listing?.dex?.isDexLive ?? listing?.token?.phase === 'DEX_TRADING',
    dex: listing?.dex ?? null,
    // Launch date information
    launchDate: listing?.launchDate,
    isLaunched: listing?.launchDate ? new Date(listing.launchDate) <= new Date() : true,
    // Owner information
    owner: listing?.owner,
  };
}

// Helper hook to check if current user is the owner
export function useIsOwner(listing: DatabaseListing | null, currentUserAddress?: string) {
  if (!listing || !currentUserAddress) return false;
  return listing.owner?.walletAddress?.toLowerCase() === currentUserAddress.toLowerCase();
}
