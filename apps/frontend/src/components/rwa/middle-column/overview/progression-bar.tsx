'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useAcesFactoryContract } from '@/hooks/contracts/use-aces-factory-contract';

interface ProgressionBarProps {
  tokenAddress?: string;
  currentAmount?: number; // Deprecated - will be fetched from contract
  targetAmount?: number; // Deprecated - will be fetched from contract
  percentage?: number; // Deprecated - will be calculated
}

export default function ProgressionBar({
  tokenAddress,
  percentage: propPercentage,
}: ProgressionBarProps) {
  const [percentage, setPercentage] = useState(propPercentage || 0);
  const [isBonded, setIsBonded] = useState(false);
  const [loading, setLoading] = useState(true);

  const { contractState, fetchTokenInfo, isReady } = useAcesFactoryContract();

  useEffect(() => {
    if (typeof propPercentage === 'number') {
      setPercentage(propPercentage);
    }
  }, [propPercentage]);

  // Fetch bonding progress when tokenAddress changes
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
        console.error('Failed to fetch bonding progress:', error);
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

  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  // Determine bar color based on bonding status
  const barGradient = isBonded
    ? `linear-gradient(90deg,
        #10b981 0%,
        #34d399 25%,
        #6ee7b7 50%,
        #34d399 75%,
        #10b981 100%
      )` // Green gradient when bonded
    : `linear-gradient(90deg,
        #184D37 0%,
        #928357 25%,
        #D0B284 50%,
        #D7BF75 75%,
        #D0B284 100%
      )`; // Original gradient

  return (
    <div className="relative w-full overflow-hidden px-4 py-4">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-[#D0B284]/10 to-transparent opacity-40" />

      <div className="relative z-10 flex flex-col gap-3">
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

              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-xs text-[#D0B284]/60">Loading...</div>
                </div>
              ) : (
                <>
                  <div
                    className="absolute left-0.5 top-0.5 bottom-0.5 overflow-hidden rounded-full shadow-lg transition-all duration-1000 ease-out"
                    style={{
                      width: `${clampedPercentage}%`,
                      background: barGradient,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-60" />
                    <div
                      className={`absolute right-0 top-0 h-full w-3 bg-gradient-to-l ${
                        isBonded ? 'from-green-300/80' : 'from-[#D7BF75]/80'
                      } to-transparent`}
                    />
                    <div className="absolute left-0 right-0 top-0 h-0.5 rounded-full bg-gradient-to-r from-white/20 to-transparent" />
                  </div>

                  <div
                    className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white/30 shadow-lg transition-all duration-1000 ease-out ${
                      isBonded
                        ? 'bg-gradient-to-br from-green-400 to-green-600'
                        : 'bg-gradient-to-br from-[#D7BF75] to-[#D0B284]'
                    }`}
                    style={{ left: `${clampedPercentage}%` }}
                  >
                    <div
                      className={`absolute inset-[2px] rounded-full ${
                        isBonded
                          ? 'bg-gradient-to-br from-green-400 to-green-600'
                          : 'bg-gradient-to-br from-[#D7BF75] to-[#D0B284]'
                      }`}
                    />
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
    </div>
  );
}
