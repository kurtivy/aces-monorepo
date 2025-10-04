'use client';

import TokenSwapInterface from './token-swap-interface';
// import FloatingStreamButton from '@/components/twitch/floating-stream-button';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { NETWORK_CONFIG } from '@/lib/contracts/addresses';

interface TokenSwapWithProgressionProps {
  tokenSymbol?: string;
  tokenPrice?: number;
  userBalance?: number;
  tokenAddress?: string;
  tokenName?: string;
  tokenOwner?: string;
  // Image props
  primaryImage?: string;
  imageGallery?: string[];
  // Chain ID for contract interaction
  chainId?: number;
  dexMeta?: DatabaseListing['dex'] | null;
  // Deprecated props (kept for backward compatibility)
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
}

export default function TokenSwapWithProgression({
  tokenSymbol = 'RWA',
  tokenPrice = 0.000268,
  userBalance = 0,
  tokenAddress,
  tokenName,
  tokenOwner,
  primaryImage,
  imageGallery,
  chainId = NETWORK_CONFIG.DEFAULT_CHAIN_ID, // Default to configured network (Base Sepolia in dev)
  dexMeta = null,
}: TokenSwapWithProgressionProps) {
  const normalizedUserBalance = Number.isFinite(userBalance) && userBalance > 0 ? userBalance : 0;

  return (
    <div className="h-full relative">
      <TokenSwapInterface
        tokenSymbol={tokenSymbol}
        tokenPrice={tokenPrice}
        userBalance={normalizedUserBalance}
        tokenAddress={tokenAddress}
        tokenName={tokenName}
        tokenOwner={tokenOwner}
        primaryImage={primaryImage}
        imageGallery={imageGallery}
        showFrame={false}
        chainId={chainId}
        dexMeta={dexMeta}
      />

      {/* Floating Stream Button positioned at bottom of screen */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        {/* <FloatingStreamButton
          channelName={process.env.NEXT_PUBLIC_TWITCH_CHANNEL_NAME || 'testchannel'}
          className="relative"
        /> */}
      </div>
    </div>
  );
}
