import { useState, useEffect } from 'react';

interface PriceData {
  acesAmount: string;
  usdValue: string;
  acesPrice: string;
  isStale: boolean;
}

export function usePriceConversion(acesAmount: string) {
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!acesAmount || parseFloat(acesAmount) <= 0) {
      setData(null);
      return;
    }

    const fetchPrice = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ||
          (typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? 'http://localhost:3002'
            : 'https://aces-monorepo-backend.vercel.app');
        const response = await fetch(`${apiUrl}/api/v1/price/convert?amount=${acesAmount}`);

        if (!response.ok) {
          throw new Error('Failed to fetch price');
        }

        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Price conversion error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch price');
      } finally {
        setLoading(false);
      }
    };

    // Debounce: wait 500ms after user stops typing
    const timeoutId = setTimeout(fetchPrice, 500);

    return () => clearTimeout(timeoutId);
  }, [acesAmount]);

  return { data, loading, error };
}
