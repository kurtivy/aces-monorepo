'use client';

import { formatEther } from 'viem';

interface UsdtRaisedSectionProps {
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
  totalETHRaised?: bigint;
  totalUSDCRaised?: bigint;
  totalSupply?: bigint;
}

export default function UsdtRaisedSection({
  currentAmount,
  targetAmount,
  percentage,
  totalETHRaised = BigInt(0),
  totalUSDCRaised = BigInt(0),
  totalSupply = BigInt(0),
}: UsdtRaisedSectionProps) {
  // Calculate real values from contract data
  const totalETHRaisedNumber = Number(formatEther(totalETHRaised));
  const totalUSDCRaisedNumber = Number(formatEther(totalUSDCRaised)) / 1e6; // USDC has 6 decimals
  const totalSupplyNumber = Number(formatEther(totalSupply));

  // Calculate current amount (ETH + USDC in USD equivalent)
  const ethInUSD = totalETHRaisedNumber * 3000; // Assuming 1 ETH = $3000
  const currentAmountReal = ethInUSD + totalUSDCRaisedNumber;

  // Calculate target amount (total supply value)
  const targetAmountReal = totalSupplyNumber * 0.00000006 * 3000; // Base price * ETH value

  // Calculate percentage
  const percentageReal = targetAmountReal > 0 ? (currentAmountReal / targetAmountReal) * 100 : 0;

  // Use real values or fallback to props
  const displayCurrentAmount = currentAmount || currentAmountReal;
  const displayTargetAmount = targetAmount || targetAmountReal;
  const displayPercentage = percentage || percentageReal;

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
      {/* Emerald Green Gradient Background */}
      <div className="absolute inset-0 rounded-xl" />

      {/* Subtle overlay texture */}
      <div className="absolute inset-0 rounded-xl" />

      {/* Content Container */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-4">
        {/* Progress Bar Container */}
        <div className="flex items-center w-full justify-center gap-2">
          {/* Enhanced Progress Bar */}
          <div className="relative w-[70%] h-6 group">
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
                    width: `calc(${displayPercentage}% - 2px)`,
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
                  style={{ left: `calc(${displayPercentage}% - 6px)` }}
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
        </div>

        {/* Amount Display */}
        <div className="text-center">
          <span
            className="text-[#DCDDCC] text-sm font-medium tracking-wide"
            style={{ fontFamily: 'system, serif' }}
          >
            TOTAL RAISED: {formatCurrency(displayCurrentAmount)} /{' '}
            {formatCurrency(displayTargetAmount)}
          </span>
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
