'use client';

import { useMemo, useEffect, useState } from 'react';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';
import { parseUnits, formatUnits } from 'viem';
import { LoadingDots } from '../left-column/token-details/loading-dots';

interface BondingProgressSectionProps {
  tokenAddress?: string;
  chainId?: number;
  percentageOverride?: number;
  isBondedOverride?: boolean;
  tokenSymbol?: string;
  // Optional: Pass bonding data from parent to avoid duplicate API calls
  bondingDataFromParent?: {
    bondingPercentage: number;
    isBonded: boolean;
    currentSupply: string;
    tokensBondedAt: string;
  } | null;
}

export function BondingProgressSection({
  tokenAddress,
  chainId,
  percentageOverride,
  isBondedOverride,
  tokenSymbol = 'RWA',
  bondingDataFromParent,
}: BondingProgressSectionProps) {
  // Bonding curve removed - always show 100% sold out
  // Keep hook call for backwards compatibility but don't use the data
  const hookData = useTokenBondingData(tokenAddress, bondingDataFromParent ? undefined : chainId);

  // Always show 100% sold out (bonding curve removed)
  const bondingPercentage = 100;
  const isBonded = true;
  const currentSupply = bondingDataFromParent?.currentSupply ?? hookData.currentSupply;
  const tokensBondedAt = bondingDataFromParent?.tokensBondedAt ?? hookData.tokensBondedAt;
  const loading = false; // No loading state needed - always 100%

  const barGradient = `linear-gradient(90deg,
        #184D37 0%,
        #928357 25%,
        #D0B284 50%,
        #D7BF75 75%,
        #D0B284 100%
      )`;

  // Single source of truth for default bonding target used during loading/unknown
  const DEFAULT_BONDING_TARGET = 700000000; // 700M tokens (bonding curve supply)

  const supplyMetrics = useMemo(() => {
    // Check if we have valid data - currentSupply can be '0' which is valid
    if (currentSupply === undefined || currentSupply === null || currentSupply === '') {
      return {
        totalSupplyValue: null as number | null,
        soldPercentage: null as number | null,
        remainingDisplay: null as string | null,
      };
    }

    const totalSupplyValue = Number.parseFloat(currentSupply);
    // Prefer contract-provided tokensBondedAt when present and > 0; otherwise use default during loading
    const parsedTarget = Number.parseFloat(tokensBondedAt || '');
    const hasValidTarget = Number.isFinite(parsedTarget) && parsedTarget > 0;
    const bondingTarget = hasValidTarget ? parsedTarget : DEFAULT_BONDING_TARGET;

    if (
      !Number.isFinite(totalSupplyValue) ||
      totalSupplyValue < 0 ||
      !Number.isFinite(bondingTarget)
    ) {
      return {
        totalSupplyValue: null,
        soldPercentage: null,
        remainingDisplay: null,
      };
    }

    const soldPercentage = hasValidTarget
      ? Math.min(100, (totalSupplyValue / bondingTarget) * 100)
      : null;

    let remainingTokensNumber = Math.max(0, bondingTarget - totalSupplyValue);
    let remainingWei: bigint | null = null;

    try {
      const supplyWei = parseUnits(currentSupply, 18);
      const targetWei = hasValidTarget
        ? parseUnits(tokensBondedAt as string, 18)
        : parseUnits(DEFAULT_BONDING_TARGET.toString(), 18);
      remainingWei = targetWei > supplyWei ? targetWei - supplyWei : BigInt(0);
      remainingTokensNumber = Number.parseFloat(formatUnits(remainingWei, 18));
    } catch {
      remainingWei = null;
    }

    let remainingDisplay: string | null = null;
    if (Number.isFinite(remainingTokensNumber)) {
      if (remainingWei !== null) {
        const remainingStr = formatUnits(remainingWei, 18);
        if (!remainingStr.includes('.')) {
          remainingDisplay = Number.parseFloat(remainingStr).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          });
        } else {
          const [intPart, rawFraction = ''] = remainingStr.split('.');
          const fraction = rawFraction.replace(/0+$/, '');

          if (intPart !== '0') {
            remainingDisplay = Number.parseFloat(`${intPart}.${fraction || '0'}`).toLocaleString(
              undefined,
              {
                maximumFractionDigits: 2,
              },
            );
          } else if (fraction) {
            const firstSignificant = fraction.search(/[1-9]/);
            if (firstSignificant === -1) {
              remainingDisplay = '0';
            } else {
              const leadingZeros = fraction.slice(0, firstSignificant);
              const significantDigits = fraction
                .slice(firstSignificant, firstSignificant + 6)
                .replace(/0+$/, '');
              remainingDisplay = `0.${leadingZeros}${significantDigits}`;
            }
          } else {
            remainingDisplay = '0';
          }
        }
      } else if (remainingTokensNumber >= 1) {
        remainingDisplay = remainingTokensNumber.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        });
      } else if (remainingTokensNumber > 0) {
        remainingDisplay = remainingTokensNumber.toLocaleString(undefined, {
          maximumFractionDigits: 12,
        });
      } else {
        remainingDisplay = '0';
      }
    }

    return {
      totalSupplyValue,
      soldPercentage,
      remainingDisplay,
    };
  }, [currentSupply, tokensBondedAt]);

  // Bonding curve removed - always 100%
  const combinedPercentage = 100;

  // useEffect(() => {}, [tokenAddress, chainId, currentSupply, tokensBondedAt, supplyMetrics]);

  // Bonding curve removed - always show as sold out
  const soldOutState = true;
  const combinedIsBonded = true;
  const cappedPercentage = 100;
  const percentageLabel = '100.0';

  return (
    <div className="">
      {/* Remaining supply display */}
      {loading && !soldOutState ? (
        <div className="text-sm text-[#D0B284]/80 text-center mb-2 font-proxima-nova font-semibold flex items-center justify-center gap-1">
          <LoadingDots className="text-sm text-[#D0B284]/80" />
        </div>
      ) : (
        (soldOutState || supplyMetrics.remainingDisplay) && (
          <div className="text-sm text-[#D0B284]/80 text-center mb-2 font-proxima-nova font-semibold">
            {soldOutState ? 'Sold out' : `${supplyMetrics.remainingDisplay} ${tokenSymbol} left`}
          </div>
        )
      )}

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
