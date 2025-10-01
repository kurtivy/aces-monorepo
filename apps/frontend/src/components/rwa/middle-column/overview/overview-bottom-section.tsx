'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import ProgressionBar from './progression-bar';
import ScoreboardSplitFlap from './scorebaord-split-flap';
import { useAcesFactoryContract } from '@/hooks/contracts/use-aces-factory-contract';

interface OverviewBottomSectionProps {
  launchDate?: string | null;
  showProgression?: boolean;
  progressionPercentage?: number; // Deprecated - will be calculated from contract
  showProgressionDesktopOnly?: boolean;
  tokenAddress?: string; // New prop for dynamic bonding data
}

export default function OverviewBottomSection({
  launchDate,
  showProgression = true,
  progressionPercentage: propPercentage = 26.9,
  showProgressionDesktopOnly = false,
  tokenAddress,
}: OverviewBottomSectionProps) {
  const [percentage, setPercentage] = useState(propPercentage);
  const [isBonded, setIsBonded] = useState(false);
  const [loading, setLoading] = useState(false);

  const { contractState, fetchTokenInfo, isReady } = useAcesFactoryContract(84532);

  // Fetch bonding progress when tokenAddress is provided
  useEffect(() => {
    const loadBondingProgress = async () => {
      if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
        setLoading(false);
        return;
      }

      if (!isReady) {
        return;
      }

      try {
        setLoading(true);
        await fetchTokenInfo(tokenAddress);
      } catch (error) {
        console.error('Failed to fetch bonding progress in overview:', error);
        setLoading(false);
      }
    };

    loadBondingProgress();
  }, [tokenAddress, isReady, fetchTokenInfo]);

  // Update percentage when contract state changes
  useEffect(() => {
    if (contractState.tokenInfo && contractState.currentSupply) {
      const currentSupply = parseFloat(contractState.currentSupply);
      const tokensBondedAt = parseFloat(
        ethers.utils.formatEther(contractState.tokenInfo.tokensBondedAt),
      );

      if (tokensBondedAt > 0) {
        const calculatedPercentage = (currentSupply / tokensBondedAt) * 100;
        setPercentage(Math.min(calculatedPercentage, 100));
        setIsBonded(contractState.tokenInfo.tokenBonded);
      }

      setLoading(false);
    }
  }, [contractState.tokenInfo, contractState.currentSupply]);

  return (
    <div className="w-full space-y-6">
      <div className="w-full">
        <ScoreboardSplitFlap launchDate={launchDate} />
      </div>

      {showProgression && (
        <div className="space-y-3">
          <div className={showProgressionDesktopOnly ? 'hidden lg:block' : ''}>
            <ProgressionBar tokenAddress={tokenAddress} percentage={propPercentage} />
            {loading ? (
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/40">
                Loading...
              </div>
            ) : (
              <div
                className={`text-xs font-semibold uppercase tracking-[0.3em] text-center ${
                  isBonded ? 'text-green-400' : 'text-[#D7BF75]/80'
                }`}
              >
                {isBonded ? '✅ BONDED - 100%' : `Bonded ${percentage.toFixed(1)}% / 100%`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
