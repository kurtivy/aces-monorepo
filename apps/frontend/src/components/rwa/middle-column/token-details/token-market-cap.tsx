'use client';

import React, { useMemo } from 'react';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';
import { usePriceConversion } from '@/hooks/use-price-conversion';

interface TokenMarketCapProps {
  tokenAddress: string;
  tokenSymbol?: string;
  chainId?: number;
}

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat('en-US', options).format(value);
};

const TokenMarketCap: React.FC<TokenMarketCapProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  chainId,
}) => {
  const { acesBalance, loading: bondingLoading } = useTokenBondingData(tokenAddress, chainId);

  const depositedAces = useMemo(() => {
    const parsed = parseFloat(acesBalance || '0');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [acesBalance]);

  const { data: conversion } = usePriceConversion(
    depositedAces > 0 ? depositedAces.toString() : '0',
  );

  const formattedMarketCapUSD = useMemo(() => {
    if (!conversion?.usdValue) {
      return null;
    }

    const usd = Number(conversion.usdValue);
    if (!Number.isFinite(usd)) {
      return null;
    }

    return formatNumber(usd, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: usd >= 1000 ? 0 : 2,
      notation: usd >= 1_000_000 ? 'compact' : 'standard',
    });
  }, [conversion]);

  const formattedMarketCapACES = useMemo(() => {
    if (depositedAces <= 0) {
      return `0 ${tokenSymbol}`;
    }

    return `${formatNumber(depositedAces, {
      maximumFractionDigits: depositedAces >= 1000 ? 0 : 2,
      notation: depositedAces >= 1_000_000 ? 'compact' : 'standard',
    })} ${tokenSymbol}`;
  }, [depositedAces, tokenSymbol]);

  const isLoading = bondingLoading;

  const usdDisplay = isLoading
    ? 'Calculating…'
    : formattedMarketCapUSD ?? (depositedAces > 0 ? '$0.00' : '$0');

  return (
    <div className="mb-4 rounded-xl border border-[#D0B284]/15 bg-transparent px-4 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-xs uppercase tracking-wide text-[#DCDDCC]/60">Market Cap</div>
        <div className="text-xs text-[#DCDDCC]/50">{formattedMarketCapACES}</div>
      </div>
      <div className="mt-1 text-xl font-semibold text-[#D0B284]">
        {usdDisplay}
      </div>
    </div>
  );
};

export default TokenMarketCap;
