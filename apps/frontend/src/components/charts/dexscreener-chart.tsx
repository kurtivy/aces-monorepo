'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

interface DexScreenerChartProps {
  poolAddress: string;
  tokenSymbol?: string;
  heightClass?: string;
  heightPx?: number;
  minHeightPx?: number;
  /** When true, shows transactions panel at bottom (trades=1) */
  showTransactions?: boolean;
  /** When true, shows the right sidebar with token info (info=1). Default false to hide it. */
  showTokenInfo?: boolean;
  /** When true, uses full viewport height minus header */
  fullHeight?: boolean;
}

const FALLBACK_MESSAGE = 'DEXScreener chart is taking longer than expected.';

const DexScreenerChart: React.FC<DexScreenerChartProps> = ({
  poolAddress,
  tokenSymbol = 'TOKEN',
  heightClass = 'h-[600px] min-h-[400px]',
  heightPx,
  minHeightPx,
  showTransactions = false,
  showTokenInfo = false,
  fullHeight = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const loadTimeoutRef = useRef<number | null>(null);

  const iframeUrl = useMemo(() => {
    const normalizedPool = poolAddress.trim().toLowerCase();
    // info=0 hides the right sidebar (token info panel with market cap, liquidity, etc.)
    // info=1 shows it
    // trades=0 hides the bottom transactions panel
    // trades=1 shows it (with Transactions, Top Traders, Holders, Liquidity Providers, BubbleMaps tabs)
    const infoParam = showTokenInfo ? '1' : '0';
    const tradesParam = showTransactions ? '1' : '0';
    return `https://dexscreener.com/base/${normalizedPool}?embed=1&theme=dark&info=${infoParam}&trades=${tradesParam}`;
  }, [poolAddress, showTokenInfo, showTransactions]);

  useEffect(() => {
    setIsLoaded(false);
    setError(null);

    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
    }

    loadTimeoutRef.current = window.setTimeout(() => {
      setError((prev) => prev ?? FALLBACK_MESSAGE);
    }, 15000);

    return () => {
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [iframeUrl, retryKey]);

  const containerStyle: React.CSSProperties = {};
  if (fullHeight) {
    // Full viewport height minus approximate header height (50px for ChartHeader)
    containerStyle.height = 'calc(100vh - 50px)';
    containerStyle.minHeight = '600px';
  } else {
    if (typeof heightPx === 'number') containerStyle.height = `${heightPx}px`;
    if (typeof minHeightPx === 'number') containerStyle.minHeight = `${minHeightPx}px`;
  }

  const containerClass =
    fullHeight || typeof heightPx === 'number'
      ? 'flex flex-col w-full bg-black overflow-hidden'
      : `flex flex-col ${heightClass} w-full bg-black overflow-hidden`;

  const handleRetry = () => {
    setRetryKey((prev) => prev + 1);
    setError(null);
    setIsLoaded(false);
  };

  const externalUrl = `https://dexscreener.com/base/${poolAddress.trim().toLowerCase()}`;

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="w-full h-full bg-black relative flex flex-col">
        {!isLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 border-2 border-[#D0B284]/20 border-t-[#D0B284] rounded-full animate-spin mx-auto" />
              <div className="text-[#DCDDCC] text-sm font-medium">
                Loading DEX chart for {tokenSymbol}...
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 px-6 text-center space-y-4">
            <div className="space-y-2">
              <div className="text-[#D0B284] font-semibold">DEX chart unavailable</div>
              <div className="text-gray-400 text-sm">{error}</div>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 text-sm border border-[#D0B284]/40 text-[#D0B284] rounded-md hover:bg-[#D0B284]/10 transition-colors"
              >
                Retry
              </button>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm bg-[#D0B284] text-black rounded-md hover:bg-[#D0B284]/90 transition-colors"
              >
                Open on DEXScreener
              </a>
            </div>
          </div>
        )}

        <iframe
          key={`${iframeUrl}-${retryKey}`}
          src={iframeUrl}
          title={`DEXScreener chart for ${tokenSymbol}`}
          className="flex-1 w-full border-0"
          loading="lazy"
          onLoad={() => {
            if (loadTimeoutRef.current) {
              window.clearTimeout(loadTimeoutRef.current);
              loadTimeoutRef.current = null;
            }
            setIsLoaded(true);
            setError(null);
          }}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};

export default DexScreenerChart;
