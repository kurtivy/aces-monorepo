'use client';

import React from 'react';
import { useRealtimeChart } from '@/hooks/use-realtime-chart';

interface RealtimePriceTickerProps {
  tokenAddress: string;
  tokenSymbol?: string;
  timeframe?: string;
  className?: string;
}

/**
 * Example component showing how to use the centralized useRealtimeChart hook
 * This demonstrates the efficiency of the Smart Polling Manager integration
 */
const RealtimePriceTicker: React.FC<RealtimePriceTickerProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  timeframe = '1h',
  className = '',
}) => {
  const { data, isPolling, isConnected, hasData, lastUpdateTime, getPollingStats } =
    useRealtimeChart(tokenAddress, timeframe);

  // Get latest price from candles
  const latestPrice =
    hasData && data.candles.length > 0 ? data.candles[data.candles.length - 1].close : 0;

  // Calculate price change from first to last candle
  const priceChange =
    hasData && data.candles.length > 1
      ? ((latestPrice - data.candles[0].open) / data.candles[0].open) * 100
      : 0;

  const pollingStats = getPollingStats();

  return (
    <div className={`bg-[#231F20]/60 border border-[#D0B284]/20 rounded-lg p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#DCDDCC]">${tokenSymbol}</span>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
        <div className="text-xs text-gray-400">
          {timeframe} • {isPolling ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Price Display */}
      {hasData ? (
        <div className="space-y-1">
          <div className="text-lg font-bold text-white">{latestPrice.toFixed(6)} ACES</div>
          <div className={`text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange >= 0 ? '+' : ''}
            {priceChange.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-400">
            Updated: {lastUpdateTime.toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-400">{data.error || 'Loading price data...'}</div>
      )}

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 pt-2 border-t border-[#D0B284]/10">
          <div className="text-xs text-gray-500 space-y-1">
            <div>Active Subscriptions: {pollingStats.activeSubscriptions}</div>
            <div>Candles: {data.candles.length}</div>
            <div>Volume Points: {data.volume.length}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealtimePriceTicker;

