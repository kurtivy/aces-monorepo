'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';

interface TradingViewWidgetProps {
  interval?: string;
  symbol?: string;
}

const TradingViewWidget = memo(
  ({ interval = 'D', symbol = 'BINANCE:ETHUSDT' }: TradingViewWidgetProps) => {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const currentContainer = container.current;

      // Clear previous widget
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = `
      {
        "allow_symbol_change": true,
        "calendar": false,
        "details": false,
        "hide_side_toolbar": true,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "hide_volume": false,
        "hotlist": false,
        "interval": "${interval}",
        "locale": "en",
        "save_image": true,
        "style": "1",
        "symbol": "${symbol}",
        "theme": "dark",
        "timezone": "Etc/UTC",
        "backgroundColor": "#0F0F0F",
        "gridColor": "rgba(242, 242, 242, 0.06)",
        "watchlist": [],
        "withdateranges": false,
        "compareSymbols": [],
        "studies": [],
        "autosize": true
      }`;

      // Create widget container structure
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container__widget';
      widgetContainer.style.height = 'calc(100% - 32px)';
      widgetContainer.style.width = '100%';

      const copyright = document.createElement('div');
      copyright.className = 'tradingview-widget-copyright';
      copyright.innerHTML =
        '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a>';

      if (currentContainer) {
        currentContainer.appendChild(widgetContainer);
        currentContainer.appendChild(copyright);
        currentContainer.appendChild(script);
      }

      // Cleanup function
      return () => {
        if (currentContainer) {
          currentContainer.innerHTML = '';
        }
      };
    }, [interval, symbol]);

    return (
      <div
        className="tradingview-widget-container"
        ref={container}
        style={{ height: '100%', width: '100%' }}
      />
    );
  },
);

TradingViewWidget.displayName = 'TradingViewWidget';

// Main Token Graph Component
interface TokenGraphProps {
  currentPrice?: number;
  priceChange?: number;
  volume?: string;
}

export default function TokenGraph({
  currentPrice = 2000,
  priceChange = 2.5,
  volume = '$1.2M',
}: TokenGraphProps) {
  type TimeframeKey = '5m' | '15m' | '1H' | '4H' | '1D' | '1W';
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1D');
  const timeframes: TimeframeKey[] = ['5m', '15m', '1H', '4H', '1D', '1W'];

  // Interval mapping for TradingView
  const intervalMap: Record<TimeframeKey, string> = {
    '5m': '5',
    '15m': '15',
    '1H': '60',
    '4H': '240',
    '1D': 'D',
    '1W': 'W',
  };

  return (
    <div className="col-span-2 w-full rounded-lg bg-black/20 p-4">
      {/* Header with price info */}
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-white">{`$${currentPrice.toFixed(2)}`}</h3>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                priceChange >= 0 ? 'text-emerald-500' : 'text-red-500',
              )}
            >
              {priceChange >= 0 ? '+' : ''}
              {priceChange}%
            </span>
            <span className="text-sm text-gray-400">24h Volume: {volume}</span>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg bg-black/40 p-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'rounded px-3 py-1 text-sm font-medium transition-colors',
                timeframe === tf ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white',
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* TradingView Chart */}
      <div className="h-[400px] w-full overflow-hidden rounded-lg bg-gray-900">
        <TradingViewWidget interval={intervalMap[timeframe]} symbol="BINANCE:ETHUSDT" />
      </div>
    </div>
  );
}
