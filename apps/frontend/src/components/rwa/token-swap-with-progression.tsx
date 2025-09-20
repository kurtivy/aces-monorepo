'use client';

import TokenSwapInterface from './token-swap-interface';

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
  // Progression bar props
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
}

export default function TokenSwapWithProgression({
  tokenSymbol = 'RWA',
  tokenPrice = 0.000268,
  userBalance = 0.5,
  tokenAddress,
  tokenName,
  tokenOwner,
  primaryImage,
  imageGallery,
  currentAmount,
  targetAmount,
  percentage = 26.9,
}: TokenSwapWithProgressionProps) {
  return (
    <div className="h-full">
      <TokenSwapInterface
        tokenSymbol={tokenSymbol}
        tokenPrice={tokenPrice}
        userBalance={userBalance}
        tokenAddress={tokenAddress}
        tokenName={tokenName}
        tokenOwner={tokenOwner}
        primaryImage={primaryImage}
        imageGallery={imageGallery}
        showFrame={false}
        currentAmount={currentAmount}
        targetAmount={targetAmount}
        percentage={percentage}
      />
    </div>
  );
}
