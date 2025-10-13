import { useState, useEffect } from 'react';

interface UseAcesUsdPriceProps {
  enabled?: boolean;
}

interface ApiResponse {
  success: boolean;
  data?: {
    price: string | number;
  };
  error?: string;
}

export function useAcesUsdPrice({ enabled = true }: UseAcesUsdPriceProps = {}) {
  const [acesUsdPrice, setAcesUsdPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchPrice = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await window.fetch(`${apiUrl}/api/v1/aces/price`);

        if (!response.ok) {
          throw new Error(`Failed to fetch ACES price: ${response.status}`);
        }

        const data = (await response.json()) as ApiResponse;

        if (isMounted && data.success && data.data) {
          const price = data.data.price;
          // Normalize to string and keep as-is (no rounding here unless you want it)
          setAcesUsdPrice(typeof price === 'number' ? price.toString() : (price ?? null));
          setError(null);
        } else if (isMounted && !data.success) {
          setError(data.error ?? 'Failed to fetch ACES price');
        }
      } catch (err) {
        if (isMounted) {
          console.error('[useAcesUsdPrice] Error:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch ACES price');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchPrice();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPrice, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [enabled]);

  return { acesUsdPrice, loading, error };
}
