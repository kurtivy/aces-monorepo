'use client';

import type React from 'react';
import Image from 'next/image';
import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  interval?: string;
  symbol?: string;
}

const TradingViewWidget = memo(
  ({ interval = 'D', symbol = 'BINANCE:ETHUSDT' }: TradingViewWidgetProps) => {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const currentContainer = container.current;
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }

      // Add CSS to ensure TradingView iframe scrolling works
      const style = document.createElement('style');
      style.setAttribute('data-tradingview-scroll', 'true');
      style.textContent = `
      .tradingview-widget-container iframe {
        overflow: visible !important;
      }
      .tradingview-widget-container__widget {
        overflow: visible !important;
      }
    `;
      document.head.appendChild(style);

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = `
        {
          "allow_symbol_change": true,
          "calendar": false,
          "details": false,
          "hide_side_toolbar": false,
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
          "backgroundColor": "#231F20",
          "gridColor": "rgba(208, 178, 132, 0.1)",
          "watchlist": [],
          "withdateranges": true,
          "compareSymbols": [],
          "studies": [],
          "autosize": true,
          "show_popup_button": false,
          "popup_width": "1000",
          "popup_height": "650",
          "enable_publishing": false,
          "hide_top_toolbar": false,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "container_id": "tradingview_widget",
          "drawings": true,
          "show_timeframes_toolbar": true
        }`;

      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container__widget';
      widgetContainer.style.height = '100%';
      widgetContainer.style.width = '100%';

      if (currentContainer) {
        currentContainer.appendChild(widgetContainer);
        currentContainer.appendChild(script);
      }

      return () => {
        if (currentContainer) {
          currentContainer.innerHTML = '';
        }
        // Clean up the style tag
        const existingStyle = document.querySelector('style[data-tradingview-scroll]');
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }, [interval, symbol]);

    return (
      <div
        className="tradingview-widget-container relative h-full w-full"
        ref={container}
        style={{
          height: '100%',
          width: '100%',
          overflow: 'visible',
        }}
      />
    );
  },
);

TradingViewWidget.displayName = 'TradingViewWidget';

interface TokenGraphProps {
  tokenSymbol?: string;
  title?: string;
  imageSrc?: string;
  tokenAddress?: string;
  fdv?: string;
  createdAt?: string;
  volume?: string;
  height?: string;
  currentPrice?: number;
  priceChange?: number;
}

const TokenGraph: React.FC<TokenGraphProps> = ({
  tokenSymbol = 'RWA',
  title = "King Solomon's Baby",
  imageSrc = '/canvas-image/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  tokenAddress = '0x7300...0219FE',
  fdv = '$100k',
  createdAt = '1 day ago',
  height = 'h-[500px]',
}) => {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getSymbol = (tokenSymbol: string) => {
    const symbolMap: Record<string, string> = {
      ETH: 'BINANCE:ETHUSDT',
      BTC: 'BINANCE:BTCUSDT',
      KRUGER: 'BINANCE:ETHUSDT',
      RWA: 'BINANCE:ETHUSDT',
    };
    return symbolMap[tokenSymbol] || 'BINANCE:ETHUSDT';
  };

  return (
    <div className={`flex flex-col ${height} w-full bg-[#231f20]/50 overflow-hidden`}>
      <div className="space-y-3 p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8 rounded-lg overflow-hidden bg-[#231F20]/60 border border-[#D0B284]/20">
                <Image
                  src={imageSrc}
                  alt={title}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="mt-1">
                <div className="flex items-center gap-2 rounded-md bg-[#231F20]/60 px-2 py-1.5 border border-[#D0B284]/20 w-fit">
                  <span className="text-xs text-[#DCDDCC] font-mono">{tokenAddress}</span>
                  <span className="text-sm text-[#DCDDCC]">{`$${tokenSymbol}`}</span>
                  <button
                    onClick={() => copyToClipboard(tokenAddress)}
                    className="flex h-5 w-5 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#D0B284"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex flex-col items-center">
                <span className="text-[#DCDDCC]">FDV</span>
                <span className="text-white">{fdv}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[#DCDDCC]">Created At</span>
                <span className="text-white">{createdAt}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full bg-[#231F20] rounded-none border-t border-[#D0B284]/20 min-h-[400px]">
        <TradingViewWidget interval="D" symbol={getSymbol(tokenSymbol)} />
      </div>
    </div>
  );
};

export default TokenGraph;
