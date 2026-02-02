import { useState, useEffect, useCallback } from 'react';

interface AcesPriceData {
  acesUsdPrice: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch and track ACES/USD price
 * Polls CoinGecko API every 30 seconds for real-time price
 */
export function useAcesPrice(): AcesPriceData {
  const [acesUsdPrice, setAcesUsdPrice] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAcesPrice = useCallback(async () => {
    try {
      // Use relative path for Next.js API route (no /v1)
      const apiBaseUrl =
        typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

      // Fetch from Next.js API endpoint
      const response = await fetch(`${apiBaseUrl}/api/prices/aces-usd`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Extract price from backend response format
      const price = result?.data?.acesUsdPrice;

      if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
        setAcesUsdPrice(price);
        setError(null);
      } else {
        throw new Error('Invalid ACES price data received');
      }
    } catch (err) {
      console.error('[useAcesPrice] Failed to fetch ACES price:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ACES price');
      // Keep last known price on error to avoid breaking UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchAcesPrice();

    // Poll every 30 seconds
    const interval = setInterval(fetchAcesPrice, 30000);

    return () => clearInterval(interval);
  }, [fetchAcesPrice]);

  return {
    acesUsdPrice,
    loading,
    error,
    refetch: fetchAcesPrice,
  };
}
