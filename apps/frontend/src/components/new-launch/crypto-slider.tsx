'use client';

import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { formatEther } from 'viem';
import Image from 'next/image';
import { Currency, SUPPORTED_CURRENCIES } from '@/types/contracts';

interface CryptoSliderProps {
  // Value and onChange
  value: number;
  onValueChange: (value: number) => void;

  // Currency and balance info
  selectedCurrency: Currency;
  userCurrencyBalance: bigint;
  ethPrice: number;

  // Slider bounds
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

// Note: getCurrencyIcon function removed as it's not used in this component
// Currency icons are handled in the parent modal component

export function CryptoSlider({
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
  contractState,
  isCalculating = false,
  tokenSymbol = 'ACES',
  step = 0.001,
  onMaxClick,
}: CryptoSliderProps) {
  const currencyInfo = SUPPORTED_CURRENCIES[selectedCurrency];

  return (
    <div className="space-y-4">
      {/* Amount Slider */}
      <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#DCDDCC] font-mono">
            {selectedCurrency === 'ETH' ? 'ETH AMOUNT' : `${selectedCurrency} AMOUNT`}
          </span>
          <button
            onClick={onMaxClick}
            disabled={maxAmount <= 0}
            className="px-2 py-1 text-xs font-bold text-[#D0B284] border border-[#D0B284]/50 rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 hover:border-[#D0B284] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            MAX
          </button>
        </div>

        {/* Amount Display */}
        <div className="text-center mb-4">
          <div className="text-4xl font-bold text-white font-mono mb-2">{value.toFixed(4)} ETH</div>

          {/* USD Value Display */}
          <div className="text-sm text-[#928357] font-mono">
            ≈ ${(value * ethPrice).toFixed(2)} USD
          </div>

          {/* Percentage of Available Balance */}
          <div className="text-xs text-[#D0B284] font-mono mt-1">
            {(((value - minAmount) / (maxAmount - minAmount)) * 100).toFixed(0)}% of available
            balance
          </div>

          {/* Actual Cost Display */}
          {actualCost !== '0' && (
            <div className="text-xs text-[#928357] font-mono mt-1">
              Actual Cost: {Number(actualCost).toFixed(6)} ETH
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

          {/* Percentage Indicators */}
          <div className="flex justify-between text-xs text-[#928357] mt-2 font-mono">
            <span>0 ETH</span>
            <span>{(maxAmount / 2).toFixed(4)} ETH</span>
            <span>{maxAmount.toFixed(4)} ETH</span>
          </div>

          {/* Percentage Quick Selection Buttons */}
          <div className="flex flex-wrap gap-1 mt-3 justify-center">
            {[10, 25, 50, 75, 100].map((percentage) => (
              <button
                key={percentage}
                onClick={() => {
                  const targetValue = minAmount + ((maxAmount - minAmount) * percentage) / 100;
                  onValueChange(targetValue);
                }}
                className="px-2 py-1 text-xs font-medium text-[#D0B284] border border-[#D0B284]/30 rounded bg-[#D0B284]/5 hover:bg-[#D0B284]/15 hover:border-[#D0B284]/60 transition-all duration-150"
              >
                {percentage}%
              </button>
            ))}
          </div>

          {/* Wallet Balance Reference */}
          <div className="text-xs text-[#928357]/70 mt-2 text-center font-mono">
            Available:{' '}
            {(Number(userCurrencyBalance) / Math.pow(10, currencyInfo.decimals)).toFixed(4)}{' '}
            {selectedCurrency}
            {selectedCurrency === 'ETH' && ' (Gas reserved)'}
          </div>
        </div>
      </div>

      {/* Expected Tokens Display */}
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

        {/* {contractState?.currentPrice && (
          <div className="text-xs text-[#928357] font-mono mt-1">
            Current Price: {Number(formatEther(contractState.currentPrice)).toFixed(8)} ETH per
            share
          </div>
        )} */}

        {shareCount > BigInt(0) && (
          <div className="text-xs text-[#928357] font-mono mt-1">
            Share Count: {shareCount.toString()}
          </div>
        )}
      </div>
    </div>
  );
}
