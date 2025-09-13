import { useEffect, useState } from 'react';
import { TokensApi } from '@/lib/api/tokens';

interface LivePriceData {
  price: string;
  previousPrice: string;
  timestamp: number;
  percentageChange: string;
}

export const useLivePrice = (tokenAddress: string, intervalMs = 30000) => {
  const [livePrice, setLivePrice] = useState<LivePriceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!tokenAddress) return;

    let intervalId: NodeJS.Timeout | null = null;
    let previousPrice = '0';

    const fetchPrice = async () => {
      try {
        const result = await TokensApi.getTokenData(tokenAddress);

        if (result.success && result.data) {
          const currentPrice = result.data.currentPriceACES;

          // Calculate percentage change from previous fetch
          let percentageChange = '0';
          if (previousPrice !== '0' && previousPrice !== currentPrice) {
            const current = parseFloat(currentPrice);
            const previous = parseFloat(previousPrice);
            if (previous !== 0) {
              percentageChange = (((current - previous) / previous) * 100).toFixed(2);
            }
          }

          setLivePrice({
            price: currentPrice,
            previousPrice,
            timestamp: Date.now(),
            percentageChange,
          });

          previousPrice = currentPrice;
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Live price fetch error:', error);
        setIsConnected(false);
      }
    };

    // Initial fetch
    fetchPrice();

    // Set up interval
    intervalId = setInterval(fetchPrice, intervalMs);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      setIsConnected(false);
    };
  }, [tokenAddress, intervalMs]);

  return { livePrice, isConnected };
};
