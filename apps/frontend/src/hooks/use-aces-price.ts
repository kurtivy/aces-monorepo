import { useState, useEffect, useCallback } from 'react';

interface AcesPriceData {
  acesUsdPrice: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch and track ACES/USD price
 * Polls CoinGecko API every 60 seconds for real-time price
 */
export function useAcesPrice(): AcesPriceData {
  const [acesUsdPrice, setAcesUsdPrice] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAcesPrice = useCallback(async () => {
    try {
      // Fetch from CoinGecko API
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ace-of-base&vs_currencies=usd',
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const price = data['ace-of-base']?.usd;

      if (typeof price === 'number' && Number.isFinite(price)) {
        setAcesUsdPrice(price);
        setError(null);
      } else {
        throw new Error('Invalid ACES price data received');
      }
    } catch (err) {
      console.error('[useAcesPrice] Failed to fetch ACES price:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ACES price');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchAcesPrice();

    // Poll every 60 seconds
    const interval = setInterval(fetchAcesPrice, 60000);

    return () => clearInterval(interval);
  }, [fetchAcesPrice]);

  return {
    acesUsdPrice,
    loading,
    error,
    refetch: fetchAcesPrice,
  };
}
