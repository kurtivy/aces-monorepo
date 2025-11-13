'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { ethers } from 'ethers';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { LoadingDots } from './loading-dots';
import { useTransferEventListener } from '@/hooks/use-transfer-event-listener';

// ERC20 ABI for balance checking
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
const COMMUNITY_REWARD_USD = 40_000;

// Value Equilibrium Calculator (embedded)
interface TokenMetrics {
  totalSupply: number;
  lpPoolTokens: number;
  circulatingSupply: number;
  tokenPrice: number;
  communityReward: number;
  rewardPerToken: number;
  valueEquilibriumRatio: number;
  marketCap: number;
  signal: MarketSignal;
  equilibriumPrice: number;
  acesRatio: number;
}

interface MarketSignal {
  action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  description: string;
  confidence: number;
}

class ValueEquilibriumCalculator {
  private readonly TOTAL_SUPPLY: number = 1_000_000_000;

  calculateCirculatingSupply(lpPoolTokens: number): number {
    return this.TOTAL_SUPPLY - lpPoolTokens;
  }

  calculateRewardPerToken(communityReward: number, circulatingSupply: number): number {
    if (circulatingSupply <= 0) return 0;
    return communityReward / circulatingSupply;
  }

  calculateVER(tokenPrice: number, rewardPerToken: number): number {
    // Return null for invalid calculations (will be displayed as --)
    if (rewardPerToken <= 0 || tokenPrice <= 0) return NaN;
    return (rewardPerToken / tokenPrice) * 100;
  }

  generateMarketSignal(ver: number): MarketSignal {
    if (ver < 0.8) {
      return {
        action: 'STRONG_BUY',
        description: 'High reward potential',
        confidence: 90,
      };
    } else if (ver < 1.2) {
      return {
        action: 'HOLD',
        description: 'Fair Value',
        confidence: 60,
      };
    } else if (ver < 2.0) {
      return {
        action: 'SELL',
        description: 'Price premium over rewards',
        confidence: 80,
      };
    } else {
      return {
        action: 'STRONG_SELL',
        description: 'Significantly overvalued',
        confidence: 95,
      };
    }
  }

  findEquilibriumPrice(communityReward: number, lpPoolTokens: number): number {
    const circulatingSupply = this.calculateCirculatingSupply(lpPoolTokens);
    return this.calculateRewardPerToken(communityReward, circulatingSupply);
  }

  getMetrics(
    circulatingSupply: number,
    tokenPrice: number,
    communityReward: number,
    assetSalePrice: number,
    marketCap: number,
  ): TokenMetrics {
    const rewardPerToken = this.calculateRewardPerToken(communityReward, circulatingSupply);
    const valueEquilibriumRatio = this.calculateVER(tokenPrice, rewardPerToken);
    const signal = this.generateMarketSignal(valueEquilibriumRatio);
    const equilibriumPrice = rewardPerToken; // Equilibrium is when price = reward per token
    const acesRatio = assetSalePrice > 0 ? marketCap / assetSalePrice : 0;

    return {
      totalSupply: this.TOTAL_SUPPLY,
      lpPoolTokens: this.TOTAL_SUPPLY - circulatingSupply, // For display purposes only
      circulatingSupply,
      tokenPrice,
      communityReward,
      rewardPerToken,
      valueEquilibriumRatio,
      marketCap,
      signal,
      equilibriumPrice,
      acesRatio,
    };
  }
}

// Utility functions
const formatNumber = (num: number, decimals: number = 2): string => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(decimals)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
};

// Not currently used (VER/Signal display removed from UI), but kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getSignalColor = (action: string) => {
  switch (action) {
    case 'STRONG_BUY':
      return '#22c55e';
    case 'BUY':
      return '#84cc16';
    case 'HOLD':
      return '#eab308';
    case 'SELL':
      return '#f97316';
    case 'STRONG_SELL':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

// Helper component for labels with tooltips
const LabelWithTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => (
  <div className="flex items-center gap-1">
    <span className="text-[11px] xl:text-xs tracking-[0.18em] uppercase font-proxima-nova font-semibold text-[#D0B284]">
      {label}
    </span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center justify-center text-[#D0B284]/60 hover:text-[#D0B284] transition-colors">
          <Info className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="max-w-[280px] bg-[#1a2318] border border-[#D0B284]/30 text-[#DCDDCC] text-xs leading-relaxed"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  </div>
);

const SectionLabel = ({ label }: { label: string }) => (
  <span className="text-[11px] xl:text-xs tracking-[0.18em] uppercase font-proxima-nova font-semibold text-[#D0B284]">
    {label}
  </span>
);

interface TokenHealthPanelProps {
  tokenAddress?: string;
  reservePrice?: string | null; // USD value of physical asset
  chainId?: number;
  marketCap?: number; // Market cap in USD (passed from parent)
  marketCapLoading?: boolean;
  dexMeta?: {
    poolAddress: string | null;
    isDexLive: boolean;
    dexLiveAt: string | null;
  } | null;
  liveTokenPrice?: number; // Live token price in USD from chart datafeed
  volume24hAces?: string; // 24h volume in ACES from API
  volume24hUsd?: number; // 24h volume in USD (preferred when available)
  liquidityUsd?: number | null;
  liquiditySource?: 'bonding_curve' | 'dex' | null;
  metricsLoading?: boolean;
  circulatingSupply?: number | null; // Circulating supply from unified health endpoint
}

type LiquidityState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; value: number };

export default function TokenHealthPanel({
  tokenAddress,
  reservePrice,
  chainId: _chainId,
  marketCap: marketCapProp,
  marketCapLoading = false,
  dexMeta,
  liveTokenPrice,
  volume24hAces: _volume24hAces,
  volume24hUsd: volume24hUsdProp,
  liquidityUsd: liquidityUsdProp,
  liquiditySource: _liquiditySource,
  metricsLoading = false,
  circulatingSupply: circulatingSupplyProp,
}: TokenHealthPanelProps) {
  const { walletAddress } = useAuth();
  const [userTokenBalance, setUserTokenBalance] = useState<string>('0');

  // Determine if token is in DEX mode
  const isDexMode = useMemo(() => {
    return Boolean(dexMeta?.isDexLive);
  }, [dexMeta]);

  // Parse asset sale price (reserve price)
  const assetSalePrice = useMemo(() => {
    if (!reservePrice) return 0;
    const parsed = parseFloat(reservePrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [reservePrice]);

  // Community reward pool is currently fixed at $40,000
  const communityReward = COMMUNITY_REWARD_USD;

  // Constants for market cap supply (fixed values)
  const BONDING_SUPPLY = 800_000_000; // 800M during bonding curve
  const DEX_SUPPLY = 1_000_000_000; // 1B after DEX graduation

  // Market cap supply: Fixed 800M (bonding) or 1B (DEX)
  const marketCapSupply = useMemo(() => {
    return isDexMode ? DEX_SUPPLY : BONDING_SUPPLY;
  }, [isDexMode]);

  // Circulating supply: Actual tokens sold (used for reward calculations)
  // This varies from 1 to 800M during bonding, then up to 1B in DEX mode
  const circulatingSupply = useMemo(() => {
    // Accept 0 as a valid value (early bonding state)
    if (circulatingSupplyProp !== undefined && circulatingSupplyProp !== null) {
      return Number.isFinite(circulatingSupplyProp) ? circulatingSupplyProp : 0;
    }
    return null; // Return null instead of 0 for truly missing data
  }, [circulatingSupplyProp]);

  // Use live token price if available, otherwise calculate from market cap
  const tokenPrice = useMemo(() => {
    // Prefer live token price from chart datafeed (affected by ACES price movements)
    if (
      liveTokenPrice !== undefined &&
      liveTokenPrice !== null &&
      Number.isFinite(liveTokenPrice)
    ) {
      return liveTokenPrice;
    }

    // Fallback: calculate from market cap if available
    if (marketCapProp && circulatingSupply !== null && circulatingSupply > 0) {
      return marketCapProp / circulatingSupply;
    }

    return 0;
  }, [liveTokenPrice, marketCapProp, circulatingSupply]);

  // Calculate market cap for ACES Ratio (using fixed supply and live price)
  const calculatedMarketCap = useMemo(() => {
    return tokenPrice * marketCapSupply;
  }, [tokenPrice, marketCapSupply]);

  const marketCapForMetrics = useMemo(() => {
    if (
      marketCapProp !== undefined &&
      marketCapProp !== null &&
      Number.isFinite(marketCapProp) &&
      marketCapProp > 0
    ) {
      return marketCapProp;
    }
    return calculatedMarketCap;
  }, [marketCapProp, calculatedMarketCap]);

  // Fetch user's token balance
  const fetchUserBalance = useCallback(async () => {
    if (!tokenAddress || !walletAddress || !window.ethereum) {
      setUserTokenBalance('0');
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(walletAddress);
      setUserTokenBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error('Failed to fetch user token balance:', error);
      setUserTokenBalance('0');
    }
  }, [tokenAddress, walletAddress]);

  useEffect(() => {
    fetchUserBalance();
    // Refresh balance every 30 seconds (fallback)
    const interval = setInterval(fetchUserBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchUserBalance]);

  // 🔥 NEW: Real-time balance updates via Transfer event listening
  // Instant updates when user receives or sends tokens
  useTransferEventListener(tokenAddress, walletAddress, fetchUserBalance, {
    debug: false,
  });

  const userTokenHoldings = useMemo(() => {
    const parsed = parseFloat(userTokenBalance);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [userTokenBalance]);

  // Calculate 24h volume in USD (prefer USD value from backend)
  const volume24hUsd = useMemo(() => {
    // Prefer pre-calculated USD volume from backend
    if (volume24hUsdProp !== undefined && Number.isFinite(volume24hUsdProp)) {
      return volume24hUsdProp;
    }
    return 0;
  }, [volume24hUsdProp]);

  const liquidityState: LiquidityState = useMemo(() => {
    // Show loading while metrics are being fetched or liquidity value hasn't been received yet
    if (metricsLoading || liquidityUsdProp === undefined) {
      return { status: 'loading' } as const;
    }

    // Show unavailable if liquidity is explicitly null or invalid
    if (liquidityUsdProp === null || !Number.isFinite(liquidityUsdProp)) {
      return { status: 'unavailable' } as const;
    }

    // Show the actual liquidity value
    return { status: 'ready', value: liquidityUsdProp as number } as const;
  }, [liquidityUsdProp, metricsLoading]);

  const calculator = useMemo(() => new ValueEquilibriumCalculator(), []);

  const metrics = useMemo(() => {
    // Ensure circulatingSupply is at least 1 to avoid division by zero
    const safeCirculatingSupply = Math.max(circulatingSupply ?? 1, 1);

    // Use actual circulating supply for reward calculations
    // Use calculated market cap for ACES ratio
    return calculator.getMetrics(
      safeCirculatingSupply,
      tokenPrice,
      communityReward,
      assetSalePrice,
      marketCapForMetrics,
    );
  }, [
    calculator,
    circulatingSupply,
    tokenPrice,
    communityReward,
    assetSalePrice,
    marketCapForMetrics,
  ]);

  // Calculate total reward earned: (user holdings / circulating supply) × community reward (10% of asset price)
  const totalRewardEarned = useMemo(() => {
    if (circulatingSupply === null || circulatingSupply <= 0 || userTokenHoldings <= 0) return 0;
    const userShareOfSupply = userTokenHoldings / circulatingSupply;
    return userShareOfSupply * communityReward;
  }, [userTokenHoldings, circulatingSupply, communityReward]);

  const ratioDisplay = useMemo(() => {
    const safeRatio = Number.isFinite(metrics.acesRatio) ? metrics.acesRatio : 0;
    const raw = `${safeRatio.toFixed(2)}x`;
    const match = raw.match(/^([0-9.,]+)/);

    if (!match) {
      return { numeric: '', suffix: raw };
    }

    return { numeric: match[1], suffix: raw.slice(match[1].length) };
  }, [metrics.acesRatio]);

  const rewardDisplay = useMemo(() => {
    const formatted = formatNumber(totalRewardEarned);
    return {
      numeric: formatted,
      prefix: '$',
    };
  }, [totalRewardEarned]);

  const rowClass =
    'flex items-center justify-between gap-3 px-4 py-2 border-b border-[#D0B284]/15 last:border-b-0';
  const valueClass = 'text-sm xl:text-base font-semibold font-proxima-nova leading-none text-white';

  // Progressive loading states for each metric
  // Distinguish between "loading" (data not arrived) vs "zero" (data arrived but is 0)
  const acesRatioLoading =
    marketCapLoading ||
    reservePrice === undefined ||
    reservePrice === null ||
    !tokenAddress ||
    marketCapForMetrics === undefined ||
    marketCapForMetrics === null ||
    !Number.isFinite(marketCapForMetrics);

  const tradeRewardLoading =
    circulatingSupply === undefined ||
    circulatingSupply === null ||
    reservePrice === undefined ||
    reservePrice === null ||
    !tokenAddress;

  const rewardEarnedLoading =
    circulatingSupply === undefined || circulatingSupply === null || !tokenAddress;

  const volumeLoading = metricsLoading || !tokenAddress;

  return (
    <motion.div
      className="h-full flex flex-col bg-transparent"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      <motion.div
        className={`${rowClass} items-end`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
      >
        <LabelWithTooltip
          label="ACES RATIO"
          tooltip="Market Cap divided by the asset's reserve price. Shows how much the token market values the asset compared to its physical value."
        />
        <div className="flex items-end gap-1 text-white">
          {acesRatioLoading ||
          !ratioDisplay.numeric ||
          !ratioDisplay.suffix ||
          metrics.acesRatio === 0 ? (
            <span className={valueClass}>0.00x</span>
          ) : (
            <>
              <span className={valueClass}>{ratioDisplay.numeric}</span>
              <span className={valueClass}>{ratioDisplay.suffix}</span>
            </>
          )}
        </div>
      </motion.div>

      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <LabelWithTooltip
          label="TRADE REWARD"
          tooltip="Reward multiplier from collectible sale commissions. Shows how much you'll receive per dollar spent when the item sells, distributed proportionally to your token holdings."
        />
        <div className="flex items-baseline gap-0">
          {tradeRewardLoading || !Number.isFinite(metrics.valueEquilibriumRatio) ? (
            <span className={valueClass}>0%</span>
          ) : (
            <>
              <span className={valueClass}>{metrics.valueEquilibriumRatio.toFixed(0)}</span>
              <span className={`${valueClass} leading-none`}>%</span>
            </>
          )}
        </div>
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <LabelWithTooltip
          label="REWARD EARNED"
          tooltip="Your proportional share of the community reward pool. Calculated as: (Your Holdings ÷ Circulating Supply) × Community Reward."
        />
        {rewardEarnedLoading ? (
          <LoadingDots className={valueClass} />
        ) : totalRewardEarned === 0 && (circulatingSupply === 0 || userTokenHoldings === 0) ? (
          <span className={valueClass}>--</span>
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-xs xl:text-sm font-proxima-nova leading-none text-white">
              {rewardDisplay.prefix}
            </span>
            <span className={valueClass}>{rewardDisplay.numeric}</span>
          </div>
        )}
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        <LabelWithTooltip
          label="LIQUIDITY"
          tooltip="During bonding this is the ACES deposited into the curve (converted to USD). After launch it reflects Aerodrome pool liquidity."
        />
        {liquidityState.status === 'loading' ? (
          <LoadingDots className={valueClass} />
        ) : liquidityState.status === 'unavailable' ? (
          <span className="text-xs xl:text-sm font-proxima-nova leading-none text-white/60">
            Data unavailable
          </span>
        ) : liquidityState.value === 0 ? (
          <span className={valueClass}>$ ---</span>
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-xs xl:text-sm font-proxima-nova leading-none">$</span>
            <span className={valueClass}>{formatNumber(liquidityState.value, 2)}</span>
          </div>
        )}
      </motion.div>

      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <SectionLabel label="VOLUME (24H)" />
        {volumeLoading ? (
          <LoadingDots className={valueClass} />
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-xs xl:text-sm font-proxima-nova leading-none">$</span>
            <span className={valueClass}>{formatNumber(volume24hUsd)}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
