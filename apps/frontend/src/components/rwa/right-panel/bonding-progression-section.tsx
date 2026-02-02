'use client';

interface BondingProgressSectionProps {
  tokenAddress?: string;
  chainId?: number;
  percentageOverride?: number;
  isBondedOverride?: boolean;
  tokenSymbol?: string;
  // Optional: Pass bonding data from parent to avoid duplicate API calls (deprecated - not used)
  bondingDataFromParent?: {
    bondingPercentage: number;
    isBonded: boolean;
    currentSupply: string;
    tokensBondedAt: string;
  } | null;
}

export function BondingProgressSection({
  tokenSymbol = 'RWA',
}: BondingProgressSectionProps) {
  // Bonding curve removed - always show 100% sold out
  // No API calls needed
  const bondingPercentage = 100;
  const isBonded = true;
  const loading = false; // No loading state needed - always 100%

  const barGradient = `linear-gradient(90deg,
        #184D37 0%,
        #928357 25%,
        #D0B284 50%,
        #D7BF75 75%,
        #D0B284 100%
      )`;

  // Bonding curve removed - always show as sold out
  const soldOutState = true;
  const combinedIsBonded = true;
  const cappedPercentage = 100;
  const percentageLabel = '100.0';

  return (
    <div className="">
      {/* Remaining supply display - always sold out */}
      <div className="text-sm text-[#D0B284]/80 text-center mb-2 font-proxima-nova font-semibold">
        Sold out
      </div>

      <div className="relative w-full overflow-hidden px-2 py-1">
        <div className="relative h-4 w-full group">
          <div className="relative h-full w-full overflow-hidden rounded-full border border-[#D0B284]/20 bg-gradient-to-r from-[#231F20] to-[#1a1718] shadow-inner">
            <div className="absolute inset-[3px] rounded-full bg-gradient-to-r from-[#0f0d0e] to-[#231F20]">
              <div className="absolute inset-0 flex items-center">
                {[25, 50, 75].map((milestone) => (
                  <div
                    key={milestone}
                    className="absolute h-2 w-0.5 rounded-full bg-[#D0B264]/30"
                    style={{ left: `${milestone}%`, transform: 'translateX(-50%)' }}
                  />
                ))}
              </div>

              {loading && !soldOutState ? (
                <div className="absolute inset-0 flex items-center justify-center"></div>
              ) : (
                <>
                  <div
                    className="absolute left-0.5 top-0.5 bottom-0.5 overflow-hidden rounded-full shadow-lg transition-all duration-1000 ease-out"
                    style={{
                      width: `${cappedPercentage}%`,
                      background: barGradient,
                    }}
                  >
                    <div className="absolute inset-0 opacity-60" />
                    <div
                      className={`absolute right-0 top-0 h-full w-3 bg-gradient-to-l ${
                        combinedIsBonded ? 'from-green-300/80' : 'from-[#D7BF75]/80'
                      } to-transparent`}
                    />
                    <div className="absolute left-0 right-0 top-0 h-0.5 rounded-full bg-gradient-to-r from-white/20 to-transparent" />
                  </div>

                  <div
                    className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white/30 shadow-lg transition-all duration-1000 ease-out bg-gradient-to-br from-[#D7BF75] to-[#D0B284]"
                    style={{ left: `${cappedPercentage}%` }}
                  >
                    <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-[#D7BF75] to-[#D0B284]" />
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            className="absolute -bottom-5 flex w-full justify-between text-[10px] uppercase tracking-[0.3em] text-[#DCDDCC]/60"
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

      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/80">
        {loading && !combinedIsBonded && !soldOutState
          ? 'Loading bonding data...'
          : soldOutState
            ? 'BONDED - 100%'
            : `BONDED ${percentageLabel}% / 100%`}
      </div>
    </div>
  );
}

export default BondingProgressSection;
