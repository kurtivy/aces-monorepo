'use client';

import DexScreenerChart from '@/components/charts/dexscreener-chart';
import { DatabaseListing } from '@/types/rwa/section.types';
import { type Dispatch, type SetStateAction } from 'react';

interface ImageData {
  id: number;
  src: string;
  thumbnail?: string;
  alt: string;
}

interface TradingSectionProps {
  tokenAddress: string;
  tokenSymbol?: string;
  title?: string;
  chainId?: number;
  poolAddress?: string | null;
  images?: ImageData[];
  selectedImageIndex?: number;
  onImageSelect?: Dispatch<SetStateAction<number>>;
}

export function TradingSection({
  tokenAddress,
  tokenSymbol,
  poolAddress: poolAddressProp,
}: TradingSectionProps) {
  const resolvedTokenSymbol = tokenSymbol || 'RWA';
  const poolAddress = poolAddressProp || tokenAddress;

  return (
    <div className="flex flex-col flex-1">
      <DexScreenerChart
        poolAddress={poolAddress}
        tokenSymbol={resolvedTokenSymbol}
        showTransactions={true}
        showTokenInfo={false}
        fullHeight={true}
      />
    </div>
  );
}
