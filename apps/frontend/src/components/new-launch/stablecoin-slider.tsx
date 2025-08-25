'use client';

import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';

import Image from 'next/image';
import { Currency, SUPPORTED_CURRENCIES } from '@/types/contracts';

interface StablecoinSliderProps {
  // Value and onChange - using USD values directly
  value: number; // USD value (e.g., 4.95)
  onValueChange: (value: number) => void;

  // Currency and balance info
  selectedCurrency: 'USDC' | 'USDT';
  userCurrencyBalance: bigint;
  ethPrice: number;

  // Slider bounds (in USD)
  minAmount: number;
  maxAmount: number;

  // Token expectation (for display)
  expectedTokens: string;
  actualCost: string;
  shareCount: bigint;
  contractState?: { currentPrice?: bigint }; // For current price display

  // Loading states
  isCalculating?: boolean;

  // Token symbol
  tokenSymbol?: string;

  // Step for slider
  step?: number;

  // Callback for MAX button
  onMaxClick: () => void;
}

export function StablecoinSlider({
  value,
  onValueChange,
  selectedCurrency,
  userCurrencyBalance,
  ethPrice,
  minAmount,
  maxAmount,
  expectedTokens,
  actualCost,
  shareCount,
  contractState: _contractState,
  isCalculating = false,
  tokenSymbol = 'ACES',
  step = 0.001,
  onMaxClick,
}: StablecoinSliderProps) {
  const currencyInfo = SUPPORTED_CURRENCIES[selectedCurrency];

  // Value is already in USD
  const usdValue = value;

  // Convert balance to USD for display
  const balanceUSD = Number(formatUnits(userCurrencyBalance, currencyInfo.decimals));

  // Suppress unused variable warning
  void _contractState;

  return (
    <div className="space-y-4">
      {/* Amount Slider */}
      <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#DCDDCC] font-mono">
            {selectedCurrency} AMOUNT
          </span>
          <button
            onClick={onMaxClick}
            disabled={maxAmount <= 0}
            className="px-2 py-1 text-xs font-bold text-[#D0B284] border border-[#D0B284]/50 rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 hover:border-[#D0B284] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            MAX
          </button>
        </div>

        {/* Amount Display - Show USD instead of ETH */}
        <div className="text-center mb-4">
          <div className="text-4xl font-bold text-white font-mono mb-2">
            ${usdValue.toFixed(2)} {selectedCurrency}
          </div>
          {/* ETH Equivalent Display */}
          <div className="text-sm text-[#928357] font-mono">
            ≈ {(value / ethPrice).toFixed(6)} ETH
          </div>
          {/* Percentage of Available Balance */}
          <div className="text-xs text-[#D0B284] font-mono mt-1">
            {(((value - minAmount) / (maxAmount - minAmount)) * 100).toFixed(0)}% of available
            balance
          </div>
          {/* Actual Cost Display */}
          {actualCost !== '0' && (
            <div className="text-xs text-[#928357] font-mono mt-1">
              Actual Cost: ${Number(actualCost).toFixed(2)} {selectedCurrency}
            </div>
          )}
        </div>

        {/* Slider with Percentage Indicators */}
        <div className="px-2">
          <div className="crypto-slider-container">
            <style
              dangerouslySetInnerHTML={{
                __html: `
                .crypto-slider-container [data-slot="slider-thumb"] {
                  background-color: #184D37 !important;
                  border-color: #184D37 !important;
                  border-width: 2px !important;
                }
              `,
              }}
            />
            <Slider
              value={[value]}
              onValueChange={(val) => onValueChange(val[0])}
              max={maxAmount}
              min={minAmount}
              step={step}
              className="w-full [&>*[data-slot=slider-track]]:bg-[#928357]/30 [&>*[data-slot=slider-range]]:bg-gradient-to-r [&>*[data-slot=slider-range]]:from-[#D0B284] [&>*[data-slot=slider-range]]:to-[#D7BF75] [&>*[data-slot=slider-thumb]]:shadow-lg"
            />
          </div>

          {/* Percentage Indicators - Show USD values */}
          <div className="flex justify-between text-xs text-[#928357] mt-2 font-mono">
            <span>$0 {selectedCurrency}</span>
            <span>
              ${(balanceUSD / 2).toFixed(2)} {selectedCurrency}
            </span>
            <span>
              ${balanceUSD.toFixed(2)} {selectedCurrency}
            </span>
          </div>

          {/* Percentage Quick Selection Buttons */}
          <div className="flex flex-wrap gap-1 mt-3 justify-center">
            {[10, 25, 50, 75, 100].map((percentage) => (
              <button
                key={percentage}
                onClick={() => {
                  // Calculate based on actual USDC/USDT balance - direct USD calculation
                  const targetUSDAmount = (balanceUSD * percentage) / 100;

                  // Ensure it's within bounds (now all in USD)
                  const boundedValue = Math.max(minAmount, Math.min(maxAmount, targetUSDAmount));

                  console.log('💰 Corrected stablecoin percentage button clicked:', {
                    percentage,
                    balanceUSD,
                    targetUSDAmount,
                    boundedValue,
                    minAmount,
                    maxAmount,
                    selectedCurrency,
                  });

                  onValueChange(boundedValue);
                }}
                className="px-2 py-1 text-xs font-medium text-[#D0B284] border border-[#D0B284]/30 rounded bg-[#D0B284]/5 hover:bg-[#D0B284]/15 hover:border-[#D0B284]/60 transition-all duration-150"
              >
                {percentage}%
              </button>
            ))}
          </div>

          {/* Wallet Balance Reference */}
          <div className="text-xs text-[#928357]/70 mt-2 text-center font-mono">
            Available: {balanceUSD.toFixed(4)} {selectedCurrency}
          </div>
        </div>
      </div>

      {/* Expected Tokens Display - Identical to ETH slider */}
      <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#DCDDCC] font-mono">YOU RECEIVE</span>
          <div className="flex items-center gap-2">
            <Image
              src={'/aces-logo.png'}
              alt={tokenSymbol}
              width={24}
              height={24}
              className="rounded-full"
            />
            <span className="text-[#D0B284] font-medium">{tokenSymbol}</span>
          </div>
        </div>

        <div className="text-3xl font-bold text-[#D0B284] font-mono flex items-center gap-2">
          {isCalculating ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : Number(expectedTokens) > 1000 ? (
            `${(Number(expectedTokens) / 1000).toFixed(1)}K`
          ) : (
            Number(expectedTokens).toFixed(0)
          )}
        </div>

        <div className="text-sm text-[#928357] font-mono mt-1">
          ≈ {Number(expectedTokens).toLocaleString()} {tokenSymbol} Tokens
        </div>

        {shareCount > BigInt(0) && (
          <div className="text-xs text-[#928357] font-mono mt-1">
            Share Count: {shareCount.toString()}
          </div>
        )}
      </div>
    </div>
  );
}
