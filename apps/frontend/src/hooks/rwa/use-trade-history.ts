import { useEffect, useState } from 'react';
import { TokensApi, type TradeData } from '@/lib/api/tokens';

export const useTradeHistory = (tokenAddress: string, intervalMs = 8000) => {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  const fetchTrades = async () => {
    if (!tokenAddress) {
      console.log('No token address provided');
      return;
    }

    try {
      // Only show loading on first load or after an error
      if (trades.length === 0 || error) {
        setIsLoading(true);
      }
      setError(null);

      const result = await TokensApi.getTrades(tokenAddress, 50);

      if (result.success && result.data) {
        // The API wrapper returns { success: true, data: { success: true, data: trades } }
        // So we need to access result.data.data for the actual trades array
        const apiResponse = result.data as any;
        if (apiResponse.success && apiResponse.data) {
          const tradesData = Array.isArray(apiResponse.data) ? apiResponse.data : [];
          console.log('Trades loaded:', tradesData.length, 'trades');

          // Smart update: only update if there are new trades or it's the first load
          setTrades((prevTrades) => {
            if (prevTrades.length === 0) {
              // First load - set all trades
              return tradesData;
            }

            // Find new trades by comparing with existing ones
            const existingIds = new Set(prevTrades.map((trade) => trade.id));
            const newTrades = tradesData.filter((trade: TradeData) => !existingIds.has(trade.id));

            if (newTrades.length > 0) {
              console.log('New trades found:', newTrades.length);
              // Add new trades to the top, keep existing ones
              return [...newTrades, ...prevTrades];
            }

            // No new trades - keep existing list to prevent flicker
            return prevTrades;
          });

          setIsConnected(true);
        } else {
          setError(
            typeof apiResponse.error === 'string' ? apiResponse.error : 'Failed to fetch trades',
          );
          setIsConnected(false);
        }
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Failed to fetch trades');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Trade history fetch error:', error);
      setError('Network error while fetching trades');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!tokenAddress) {
      setTrades([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;

    // Initial fetch
    fetchTrades();

    // Set up interval for continuous updates
    intervalId = setInterval(fetchTrades, intervalMs);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      setIsConnected(false);
    };
  }, [tokenAddress, intervalMs]);

  return {
    trades,
    isLoading,
    error,
    isConnected,
    refresh: fetchTrades,
  };
};
