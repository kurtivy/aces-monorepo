'use client';

import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';

interface BondingProgressSectionProps {
  tokenAddress?: string;
  chainId?: number;
  percentageOverride?: number;
  isBondedOverride?: boolean;
  tokenSymbol?: string;
}

export function BondingProgressSection({
  tokenAddress,
  chainId,
  percentageOverride,
  isBondedOverride,
  tokenSymbol = 'RWA',
}: BondingProgressSectionProps) {
  const { bondingPercentage, isBonded, loading, currentSupply, tokensBondedAt } =
    useTokenBondingData(tokenAddress, chainId);

  const combinedPercentage = useMemo(() => {
    const a = Number.isFinite(bondingPercentage) ? bondingPercentage : 0;
    const b = Number.isFinite(percentageOverride ?? Number.NaN)
      ? (percentageOverride as number)
      : 0;
    return Math.min(100, Math.max(a, b));
  }, [bondingPercentage, percentageOverride]);

  const combinedIsBonded = isBondedOverride || isBonded || combinedPercentage >= 100;

  const remainingDisplay = useMemo(() => {
    if (!tokensBondedAt || !currentSupply) return null;
    try {
      const maxWei = ethers.utils.parseEther(tokensBondedAt);
      const curWei = ethers.utils.parseEther(currentSupply);
      if (maxWei.lte(curWei)) return '0';
      const remaining = Number.parseFloat(ethers.utils.formatEther(maxWei.sub(curWei)));
      const maxFrac = remaining >= 1 ? 2 : 6;
      return remaining.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
    } catch {
      return null;
    }
  }, [tokensBondedAt, currentSupply]);

  return (
    <div className="">
      {/* Progress rail */}
      <div className="h-3 rounded-full bg-[#1B1F1B] border border-[#D0B284]/20 relative overflow-hidden">
        <div className="h-full bg-[#D7BF75]/70" style={{ width: `${combinedPercentage}%` }} />
        {/* ticks */}
        <div className="absolute inset-0 pointer-events-none flex justify-between px-2">
          {[0, 25, 50, 75, 100].map((t) => (
            <div key={t} className="h-full flex items-center">
              <div className="w-px h-3 bg-[#D0B284]/30" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/80">
        {loading && !combinedIsBonded
          ? 'Loading bonding data...'
          : combinedIsBonded
            ? 'BONDED - 100%'
            : `BONDED ${combinedPercentage.toFixed(1)}% / 100%`}
      </div>

      {/* {!!remainingDisplay && !combinedIsBonded && (
        <div className="mt-2 text-xs text-[#D0B284]/80 text-center">
          {remainingDisplay} {tokenSymbol} left in the bonding curve
        </div>
      )} */}
    </div>
  );
}

export default BondingProgressSection;
