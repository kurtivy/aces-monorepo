'use client';

import { formatEther } from 'viem';
import { useBondingCurveContracts } from '@/hooks/use-ico-contracts';

interface ProgressionBarProps {
  // Props are now optional since we get data from the hook
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
}

export default function ProgressionBar({
  currentAmount,
  targetAmount,
  percentage,
}: ProgressionBarProps) {
  const { contractState, ethPrice } = useBondingCurveContracts();

  // Calculate values from contract data with live ETH price
  const totalETHRaised = contractState?.totalETHRaised || BigInt(0);
  const targetRaiseUSD = contractState?.targetRaiseUSD || BigInt(1000); // $1,000 target
  const tokenSupply = contractState?.tokenSupply || BigInt(0);
  const bondingCurveSupply = contractState?.bondingCurveSupply || BigInt(8000000);

  // Convert ETH to USD using live Uniswap price
  const totalETHRaisedNumber = Number(formatEther(totalETHRaised));
  const currentAmountReal = totalETHRaisedNumber * ethPrice.current; // Live ETH price from Uniswap

  // Target amount in USD
  const targetAmountReal = Number(targetRaiseUSD);

  // Calculate percentage based on token supply progress (more accurate than USD progress)
  const tokenProgress =
    bondingCurveSupply > 0
      ? (Number(formatEther(tokenSupply)) / Number(formatEther(bondingCurveSupply))) * 100
      : 0;

  // Use real values or fallback to props
  const displayCurrentAmount = currentAmount || currentAmountReal;
  const displayTargetAmount = targetAmount || targetAmountReal;
  const displayPercentage = percentage || tokenProgress;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center rounded-xl px-6 py-2 flex-1 shadow-2xl relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 rounded-xl" />
      <div className="absolute inset-0 rounded-xl" />

      {/* Content Container */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-4">
        {/* Enhanced Percentage Display */}
        <div className="bg-gradient-to-br from-[#231F20] to-[#1a1718] border-2 border-[#D0B284]/40 rounded-xl px-4 py-2 shadow-xl backdrop-blur-sm relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#D0B284]/10 to-transparent rounded-xl" />

          <span
            className="text-[#D7BF75] text-lg font-bold min-w-[52px] text-center block tabular-nums relative z-10"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {displayPercentage.toFixed(1)}%
          </span>

          {/* Corner accent */}
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#D0B284]/40 rounded-full" />
        </div>

        {/* Progress Bar Container */}
        <div className="flex items-center w-[510px] justify-center">
          {/* Enhanced Progress Bar */}
          <div className="relative w-full h-6 group">
            {/* Outer container with premium styling */}
            <div className="relative h-full bg-gradient-to-r from-[#231F20] to-[#1a1718] rounded-full border border-[#D0B284]/20 shadow-2xl overflow-hidden">
              {/* Inner track with subtle texture */}
              <div className="absolute inset-0.5 bg-gradient-to-r from-[#0f0d0e] to-[#231F20] rounded-full shadow-inner">
                {/* Milestone markers */}
                <div className="absolute inset-0 flex items-center">
                  {[25, 50, 75].map((milestone) => (
                    <div
                      key={milestone}
                      className="absolute w-0.5 h-3 bg-[#D0B264]/30 rounded-full"
                      style={{ left: `${milestone}%`, transform: 'translateX(-50%)' }}
                    />
                  ))}
                </div>

                {/* Progress fill with brand gradient */}
                <div
                  className="absolute left-0.5 top-0.5 bottom-0.5 rounded-full shadow-lg transition-all duration-1000 ease-out overflow-hidden"
                  style={{
                    width: `calc(${Math.min(displayPercentage, 100)}% - 2px)`,
                    background: `linear-gradient(90deg, 
                      #184D37 0%, 
                      #928357 25%, 
                      #D0B284 50%, 
                      #D7BF75 75%, 
                      #D0B284 100%
                    )`,
                  }}
                >
                  {/* Animated shine overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse opacity-60" />

                  {/* Progress end glow */}
                  <div className="absolute right-0 top-0 w-4 h-full bg-gradient-to-l from-[#D7BF75]/80 to-transparent" />

                  {/* Inner highlight */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/20 to-white/10 rounded-full" />
                </div>

                {/* Progress indicator dot */}
                <div
                  className="absolute top-1/2 w-5 h-5 bg-gradient-to-br from-[#D7BF75] to-[#D0B284] rounded-full shadow-lg border-2 border-white/20 transition-all duration-1000 ease-out transform -translate-y-1/2"
                  style={{ left: `calc(${Math.min(displayPercentage, 100)}% - 6px)` }}
                >
                  <div className="absolute inset-0.5 bg-gradient-to-br from-[#D7BF75] to-[#D0B284] rounded-full animate-pulse" />
                </div>
              </div>

              {/* Outer glow effect */}
              <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(208,178,132,0.3)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>

            {/* Milestone labels */}
            <div
              className="absolute -bottom-6 w-full flex justify-between text-xs text-[#DCDDCC]/60"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Amount Display with Live ETH Price */}
        <div className="text-center">
          <span
            className="text-[#DCDDCC] text-sm font-medium tracking-wide"
            style={{ fontFamily: 'system, serif' }}
          >
            TOTAL RAISED: {formatCurrency(displayCurrentAmount)} /{' '}
            {formatCurrency(displayTargetAmount)}
          </span>

          {/* Show token progress and ETH price source */}
          {contractState && (
            <div className="space-y-1 mt-2">
              <div
                className="text-xs text-[#928357]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {Number(formatEther(contractState.tokenSupply)).toLocaleString()} /{' '}
                {Number(formatEther(contractState.bondingCurveSupply)).toLocaleString()} tokens sold
              </div>

              {/* Live price indicator */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div
                    className={`w-2 h-2 rounded-full ${ethPrice.error ? 'bg-red-400' : ethPrice.isStale ? 'bg-yellow-400' : 'bg-green-400'}`}
                  ></div>
                  <span
                    className="text-[#928357]"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    ETH: ${ethPrice.current.toLocaleString()} ({ethPrice.source})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Corner Accents */}
      <div className="absolute top-3 left-3 w-2 h-2 border-l-2 border-t-2 border-[#D0B284]/30 rounded-tl-lg" />
      <div className="absolute top-3 right-3 w-2 h-2 border-r-2 border-t-2 border-[#D0B284]/30 rounded-tr-lg" />
      <div className="absolute bottom-3 left-3 w-2 h-2 border-l-2 border-b-2 border-[#D0B284]/30 rounded-bl-lg" />
      <div className="absolute bottom-3 right-3 w-2 h-2 border-r-2 border-b-2 border-[#D0B284]/30 rounded-br-lg" />
    </div>
  );
}
