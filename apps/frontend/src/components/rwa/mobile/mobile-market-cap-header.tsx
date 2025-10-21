'use client';

import React, { useMemo } from 'react';
import { useTokenMarketCap } from '@/hooks/use-token-market-cap';

interface MobileMarketCapHeaderProps {
  tokenAddress?: string | null;
}

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat('en-US', options).format(value);
};

const MobileMarketCapHeader: React.FC<MobileMarketCapHeaderProps> = ({ tokenAddress }) => {
  const { marketCapUsd, loading, error } = useTokenMarketCap(tokenAddress ?? undefined, 'usd');

  const formattedMarketCapUSD = useMemo(() => {
    if (marketCapUsd <= 0) {
      return null;
    }

    return formatNumber(marketCapUsd, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: marketCapUsd >= 1000 ? 0 : 2,
      notation: marketCapUsd >= 1_000_000 ? 'compact' : 'standard',
    });
  }, [marketCapUsd]);

  const displayValue = useMemo(() => {
    if (!tokenAddress) {
      return 'Unavailable';
    }

    if (loading) {
      return 'Calculating…';
    }

    if (error) {
      return 'Error loading';
    }

    return formattedMarketCapUSD ?? (marketCapUsd > 0 ? '$0.00' : '$0');
  }, [error, formattedMarketCapUSD, loading, marketCapUsd, tokenAddress]);

  return (
    <div className="flex h-12 items-center justify-between bg-black px-4">
      <span className="text-base uppercase font-bold tracking-[0.2em] text-[#DCDDCC]/80 font-proxima-nova">
        Market Cap
      </span>
      <span className="text-base font-semibold text-[#D0B284] whitespace-nowrap font-proxima-nova">
        {displayValue}
      </span>
    </div>
  );
};

export default MobileMarketCapHeader;
