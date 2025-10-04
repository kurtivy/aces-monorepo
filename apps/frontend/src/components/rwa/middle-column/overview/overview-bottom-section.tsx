'use client';

import ProgressionBar from './progression-bar';
import ScoreboardSplitFlap from './scorebaord-split-flap';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';

interface OverviewBottomSectionProps {
  launchDate?: string | null;
  showProgression?: boolean;
  progressionPercentage?: number; // Deprecated - will be calculated from contract
  showProgressionDesktopOnly?: boolean;
  tokenAddress?: string; // New prop for dynamic bonding data
  chainId?: number;
}

export default function OverviewBottomSection({
  launchDate,
  showProgression = true,
  progressionPercentage: propPercentage = 26.9,
  showProgressionDesktopOnly = false,
  tokenAddress,
  chainId,
}: OverviewBottomSectionProps) {
  // Use the same hook as TokenSwapInterface for consistent behavior
  const {
    bondingPercentage,
    isBonded: contractIsBonded,
    loading: contractLoading,
  } = useTokenBondingData(tokenAddress, chainId);

  // Use contract data if available, otherwise fall back to prop
  const percentage = bondingPercentage > 0 ? bondingPercentage : propPercentage;
  const isBonded = contractIsBonded;
  const loading = contractLoading;

  return (
    <div className="w-full space-y-6">
      <div className="w-full">
        <ScoreboardSplitFlap launchDate={launchDate} />
      </div>

      {showProgression && (
        <div className="space-y-3">
          <div className={showProgressionDesktopOnly ? 'hidden lg:block' : ''}>
            <ProgressionBar
              tokenAddress={tokenAddress}
              chainId={chainId}
              percentage={percentage}
              isBondedOverride={isBonded}
            />
            {loading ? (
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/40">
                Loading...
              </div>
            ) : (
              <div
                className={
                  'text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/80'
                }
              >
                {isBonded ? 'BONDED - 100%' : `Bonded ${percentage.toFixed(1)}% / 100%`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
