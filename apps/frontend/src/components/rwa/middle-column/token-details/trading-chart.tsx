import React from 'react';
import TradingViewChart from '@/components/charts/trading-view-chart';
import TokenMarketCap from './token-market-cap';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface TradingChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  title?: string;
  imageSrc?: string;
  heightClass?: string;
  chainId?: number;
  dexMeta?: DatabaseListing['dex'] | null;
}

const TradingChart: React.FC<TradingChartProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  title = 'Trading Chart',
  imageSrc = '/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  heightClass = 'h-[600px] min-h-[400px]',
  chainId,
  dexMeta,
}) => {
  return (
    <div className="space-y-4">
      <TokenMarketCap
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        chainId={chainId}
      />
      <TradingViewChart
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        tokenName={title}
        imageSrc={imageSrc}
        heightClass={heightClass}
        dexMeta={dexMeta}
      />
    </div>
  );
};

export default TradingChart;
