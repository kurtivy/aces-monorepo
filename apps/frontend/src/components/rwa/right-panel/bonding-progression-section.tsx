'use client';

import { useMemo, useEffect, useState } from 'react';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';

const MAX_SUPPLY_TOKENS = 800_000_000;

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
  const { bondingPercentage, isBonded, loading, currentSupply } = useTokenBondingData(
    tokenAddress,
    chainId,
  );

  const supplyMetrics = useMemo(() => {
    if (!currentSupply) {
      return {
        totalSupplyValue: null as number | null,
        soldPercentage: null as number | null,
        remainingDisplay: null as string | null,
      };
    }

    const totalSupplyValue = Number.parseFloat(currentSupply);

    if (!Number.isFinite(totalSupplyValue) || totalSupplyValue < 0) {
      return {
        totalSupplyValue: null,
        soldPercentage: null,
        remainingDisplay: null,
      };
    }

    const soldPercentage = Math.min(100, (totalSupplyValue / MAX_SUPPLY_TOKENS) * 100);
    const remainingTokens = Math.max(0, MAX_SUPPLY_TOKENS - totalSupplyValue);
    const remainingDigits = remainingTokens >= 1 ? 2 : 6;

    return {
      totalSupplyValue,
      soldPercentage,
      remainingDisplay: remainingTokens.toLocaleString(undefined, {
        maximumFractionDigits: remainingDigits,
      }),
    };
  }, [currentSupply]);

  const combinedPercentage = useMemo(() => {
    const bonding = Number.isFinite(bondingPercentage) ? bondingPercentage : Number.NaN;
    const sold = Number.isFinite(supplyMetrics.soldPercentage ?? Number.NaN)
      ? (supplyMetrics.soldPercentage as number)
      : Number.NaN;
    const override = Number.isFinite(percentageOverride ?? Number.NaN)
      ? (percentageOverride as number)
      : Number.NaN;

    const candidatePercentages = [sold, bonding, override].filter((value) =>
      Number.isFinite(value),
    ) as number[];

    if (candidatePercentages.length === 0) {
      return 0;
    }

    return Math.min(100, Math.max(...candidatePercentages));
  }, [bondingPercentage, percentageOverride, supplyMetrics.soldPercentage]);

  const isSoldOut =
    supplyMetrics.totalSupplyValue !== null && supplyMetrics.totalSupplyValue >= MAX_SUPPLY_TOKENS;

  const [hasSoldOut, setHasSoldOut] = useState(false);

  useEffect(() => {
    if (isSoldOut) {
      setHasSoldOut(true);
    }
  }, [isSoldOut]);

  const soldOutState = hasSoldOut;
  const combinedIsBonded = isBondedOverride || isBonded || soldOutState;
  const cappedPercentage = soldOutState
    ? 100
    : Math.min(combinedPercentage, 99.9);
  const percentageLabel = soldOutState
    ? '100.0'
    : combinedPercentage >= 99.9
      ? '99.9'
      : cappedPercentage.toFixed(1);

  return (
    <div className="">
      {/* Progress rail */}
      {(soldOutState || supplyMetrics.remainingDisplay) && (
        <div className="text-sm text-[#D0B284]/80 text-center mb-3 font-proxima-nova font-semibold">
          {soldOutState ? 'Sold out' : `${supplyMetrics.remainingDisplay} ${tokenSymbol} left`}
        </div>
      )}
      <div className="h-3 rounded-full bg-[#1B1F1B] border border-[#D0B284]/20 relative overflow-hidden">
        <div className="h-full bg-[#D7BF75]/70" style={{ width: `${cappedPercentage}%` }} />
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
          : soldOutState
            ? 'BONDED - 100%'
            : `BONDED ${percentageLabel}% / 100%`}
      </div>
    </div>
  );
}

export default BondingProgressSection;
