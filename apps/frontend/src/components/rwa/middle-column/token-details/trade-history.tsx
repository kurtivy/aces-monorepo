'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface TradeHistoryProps {
  tokenAddress: string;
  tokenSymbol?: string;
  poolAddress?: string | null;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export default function TradeHistory({
  tokenSymbol = 'TOKEN',
  poolAddress,
  className,
  contentClassName,
  style,
}: TradeHistoryProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!poolAddress) return;

    setIsLoaded(false);
    setError(null);

    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
    }

    loadTimeoutRef.current = window.setTimeout(() => {
      setError('DEX transactions are taking longer than expected to load.');
    }, 15000);

    return () => {
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [poolAddress]);

  const containerClasses = cn(
    'relative bg-[#151c16] rounded-xl overflow-hidden mt-0 flex flex-col',
    className,
  );
  const contentClasses = cn('flex flex-col flex-1', contentClassName);

  // If no pool address, show fallback message
  if (!poolAddress) {
    return (
      <div className={containerClasses} style={style}>
        <div className={contentClasses}>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center py-8">
            <div className="text-[#D0B284] text-base font-semibold">Trading data unavailable</div>
            <div className="text-sm text-gray-400">No DEX pool address available for this token</div>
          </div>
        </div>
      </div>
    );
  }

  const normalizedPool = poolAddress.trim().toLowerCase();
  const iframeUrl = `https://dexscreener.com/base/${normalizedPool}?embed=1&theme=dark&info=0&trades=1`;

  return (
    <div className={containerClasses} style={style}>
      <div className={contentClasses}>
        <div className="w-full h-full bg-black relative flex flex-col">
          {!isLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 border-2 border-[#D0B284]/20 border-t-[#D0B284] rounded-full animate-spin mx-auto" />
                <div className="text-[#DCDDCC] text-sm font-medium">
                  Loading DEX transactions for {tokenSymbol}...
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 px-6 text-center space-y-4">
              <div className="space-y-2">
                <div className="text-[#D0B284] font-semibold">DEX transactions unavailable</div>
                <div className="text-gray-400 text-sm">{error}</div>
              </div>
            </div>
          )}

          <iframe
            src={iframeUrl}
            title={`DEXScreener transactions for ${tokenSymbol}`}
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
    </div>
  );
}
