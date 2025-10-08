'use client';

import { TokenHeaderSection } from './token-header-section';
import { TokenMetricsSection } from './token-metrics-section';
import { ChatSection } from './chat-section';
import { DatabaseListing } from '@/types/rwa/section.types';
import { useMemo } from 'react';
import { usePriceConversion } from '@/hooks/use-price-conversion';

interface LeftColumnNavigationV2Props {
  listing?: DatabaseListing | null;
  loading?: boolean;
}

export function LeftColumnNavigationV2({ listing, loading }: LeftColumnNavigationV2Props) {
  // Calculate market cap from ACES balance
  const acesBalance = listing?.token?.currentPriceACES || '0';
  const acesDepositedFloat = useMemo(() => {
    const parsed = parseFloat(acesBalance);
    return isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [acesBalance]);

  const { data: marketCapConversion } = usePriceConversion(
    acesDepositedFloat > 0 ? acesDepositedFloat.toString() : '0',
  );

  const marketCapUSD = useMemo(() => {
    if (!marketCapConversion?.usdValue) return 0;
    const usd = Number(marketCapConversion.usdValue);
    return isFinite(usd) ? usd : 0;
  }, [marketCapConversion]);

  if (loading || !listing) {
    return (
      <div className="w-72 bg-black flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <span className="text-[#D0B284] text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-72 bg-black flex flex-col overflow-hidden"
      style={{
        height: 'calc(100vh - 120px)',
        minHeight: '750px',
      }}
    >
      {/* Section 1: Token Header - Fixed */}
      <div className="flex-shrink-0">
        <TokenHeaderSection
          tokenSymbol={listing.symbol}
          tokenAddress={listing.token?.contractAddress}
          tokenImage={listing.imageGallery?.[0]}
          marketCap={marketCapUSD}
        />
      </div>

      {/* Section 2: Token Metrics (DATA + STORY) - Fixed */}
      <div className="flex-shrink-0">
        <TokenMetricsSection
          tokenAddress={listing.token?.contractAddress}
          reservePrice={listing.reservePrice || listing.rrp}
          chainId={listing.token?.chainId}
          rrp={listing.rrp || listing.reservePrice}
          brand={listing.brand}
          hypePoints={listing.hypePoints}
        />
      </div>

      {/* Section 4: Chat - Flexible, Scrollable */}
      <div className="flex-1 min-h-0">
        <ChatSection listingId={listing.id} listingTitle={listing.title} isLive={listing.isLive} />
      </div>
    </div>
  );
}
