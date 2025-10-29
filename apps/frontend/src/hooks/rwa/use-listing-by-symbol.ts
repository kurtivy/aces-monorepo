// hooks/rwa/use-listing-by-symbol.ts
import { useState, useEffect } from 'react';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { validateAndWarnAddress } from '@/lib/validation/address';

const resolveApiBaseUrl = () => {
  // Use environment variable if available
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // For localhost development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3002';
  }

  // Dynamic URL based on current deployment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const href = window.location.href;

    // Check for dev/git-dev branch
    if (href.includes('git-dev') || hostname.includes('git-dev')) {
      return 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
    }
  }

  // Production fallback (main branch and aces.fun)
  return 'https://acesbackend-production.up.railway.app';
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

    let isCancelled = false;
    let isInitialLoad = true;

    async function fetchListingBySymbol() {
      try {
        // Only show loading state on initial load, not on polls
        if (isInitialLoad) {
          setLoading(true);
        }
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/api/v1/listings/symbol/${encodeURIComponent(symbol)}`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            if (!isCancelled) setListing(null);
            return;
          }
          throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          const newListing = result.data as DatabaseListing;

          // Validate and sanitize token address
          if (newListing.token?.contractAddress) {
            const validatedAddress = validateAndWarnAddress(
              newListing.token.contractAddress,
              'useListingBySymbol',
            );

            // Update the listing with validated address (keep original if validation fails)
            if (validatedAddress) {
              newListing.token = {
                ...newListing.token,
                contractAddress: validatedAddress,
              };
            }
          }

          if (!isCancelled) {
            // Check if DEX status changed (token graduated)
            const oldDexStatus = listing?.dex?.isDexLive;
            const newDexStatus = newListing.dex?.isDexLive;

            if (oldDexStatus === false && newDexStatus === true) {
              console.log('🎓 [useListingBySymbol] Token graduated to DEX!', {
                symbol: newListing.symbol,
                poolAddress: newListing.dex?.poolAddress,
                dexLiveAt: newListing.dex?.dexLiveAt,
              });
            }

            setListing(newListing);
          }
        } else {
          if (!isCancelled) setListing(null);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching listing by symbol:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch listing');
        }
      } finally {
        if (!isCancelled && isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    }

    // Initial fetch
    fetchListingBySymbol();

    // Poll every 10 seconds to detect DEX graduation and other updates
    const pollInterval = setInterval(() => {
      if (!isCancelled) {
        fetchListingBySymbol();
      }
    }, 10000); // 10 second polling interval

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
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
        const listing = result.data as DatabaseListing;

        // Validate and sanitize token address
        if (listing.token?.contractAddress) {
          const validatedAddress = validateAndWarnAddress(
            listing.token.contractAddress,
            'useListingBySymbol.refetch',
          );

          // Update the listing with validated address (keep original if validation fails)
          if (validatedAddress) {
            listing.token = {
              ...listing.token,
              contractAddress: validatedAddress,
            };
          }
        }

        setListing(listing);
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
