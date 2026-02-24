import React, { type Dispatch, type SetStateAction } from 'react';
import DexScreenerChart from '@/components/charts/dexscreener-chart';
import TokenMarketCap from './token-market-cap';
import type { DatabaseListing, ImageData } from '@/types/rwa/section.types';

interface TradingChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  title?: string;
  imageSrc?: string;
  heightClass?: string;
  chainId?: number;
  dexMeta?: DatabaseListing['dex'] | null;
  images?: ImageData[];
  selectedImageIndex?: number;
  onImageSelect?: Dispatch<SetStateAction<number>>;
}

const TradingChart: React.FC<TradingChartProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  title = 'Trading Chart',
  imageSrc = '/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  heightClass = 'h-[600px] min-h-[400px]',
  chainId,
  dexMeta,
  images,
  selectedImageIndex,
  onImageSelect,
}) => {
  const poolAddress = dexMeta?.poolAddress || tokenAddress;

  return (
    <div className="space-y-4">
      <TokenMarketCap
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        chainId={chainId}
        images={images}
        selectedImageIndex={selectedImageIndex}
        onImageSelect={onImageSelect}
      />
      <DexScreenerChart
        poolAddress={poolAddress}
        tokenSymbol={tokenSymbol}
        heightClass={heightClass}
      />
    </div>
  );
};

export default TradingChart;
