'use client';

import TradingViewChart from '@/components/charts/trading-view-chart';
import TradeHistory from '../middle-column/token-details/trade-history';
import { DatabaseListing } from '@/types/rwa/section.types';

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
  dexMeta?: DatabaseListing['dex'] | null;
  images?: ImageData[];
  selectedImageIndex?: number;
  onImageSelect?: (index: number) => void;
}

export function TradingSection({
  tokenAddress,
  tokenSymbol,
  title,
  chainId,
  dexMeta,
  images,
  selectedImageIndex,
  onImageSelect,
}: TradingSectionProps) {
  return (
    <div className="space-y-0">
      {/* TradingView Chart - Directly, without TokenMarketCap */}
      <div className="space-y-4">
        <TradingViewChart
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
          tokenName={title}
          imageSrc={images?.[selectedImageIndex || 0]?.src}
          heightClass="h-[600px] min-h-[400px]"
          dexMeta={dexMeta}
        />
      </div>

      {/* Trade History */}
      <TradeHistory tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} dexMeta={dexMeta} />
    </div>
  );
}
