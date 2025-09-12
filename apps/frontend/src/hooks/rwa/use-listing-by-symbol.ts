// hooks/rwa/use-listing-by-symbol.ts
import { useState, useEffect } from 'react';
import type { DatabaseListing } from '@/types/rwa/section.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

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

        // Since backend doesn't have a direct "get by symbol" endpoint,
        // we'll fetch live listings and filter by symbol
        // For now, we'll only check live listings. If you need to show non-live listings too,
        // you'd need to add an admin endpoint or modify the backend
        const response = await fetch(`${API_BASE_URL}/api/v1/listings/live`);

        if (!response.ok) {
          throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          // Find the listing with matching symbol
          const foundListing = result.data.find(
            (l: DatabaseListing) => l.symbol.toUpperCase() === symbol.toUpperCase(),
          );

          if (foundListing) {
            setListing(foundListing);
          } else {
            setListing(null);
          }
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

      const response = await fetch(`${API_BASE_URL}/api/v1/listings/live`);

      if (!response.ok) {
        throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const foundListing = result.data.find(
          (l: DatabaseListing) => l.symbol.toUpperCase() === symbol.toUpperCase(),
        );

        if (foundListing) {
          setListing(foundListing);
        } else {
          setListing(null);
        }
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
