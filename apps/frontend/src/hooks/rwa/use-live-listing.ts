// hooks/rwa/use-live-listing.ts
import { useState, useEffect } from 'react';
import type { DatabaseListing } from '@/types/rwa/section.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function useLiveListing() {
  const [listing, setListing] = useState<DatabaseListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLiveListing() {
      try {
        setLoading(true);
        setError(null);

        // Fetch live listings from backend API
        const response = await fetch(`${API_BASE_URL}/api/v1/listings/live`);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch live listings: ${response.status} ${response.statusText}`,
          );
        }

        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          // Get the first live listing
          setListing(result.data[0]);
        } else {
          // No live listings found
          setListing(null);
        }
      } catch (err) {
        console.error('Error fetching live listing:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch live listing');
      } finally {
        setLoading(false);
      }
    }

    fetchLiveListing();
  }, []);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/v1/listings/live`);

      if (!response.ok) {
        throw new Error(`Failed to fetch live listings: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        setListing(result.data[0]);
      } else {
        setListing(null);
      }
    } catch (err) {
      console.error('Error refetching live listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to refetch live listing');
    } finally {
      setLoading(false);
    }
  };

  return {
    listing,
    loading,
    error,
    refetch,
    // Launch date information
    launchDate: listing?.launchDate,
    isLaunched: listing?.launchDate ? new Date(listing.launchDate) <= new Date() : true,
  };
}
