'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';
import { useAuth } from '@/lib/auth/auth-context';
import { ethers } from 'ethers';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAcesPrice } from '@/hooks/use-aces-price';
import { LoadingDots } from './loading-dots';

// ERC20 ABI for balance checking
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

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
    if (rewardPerToken <= 0) return Infinity;
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

const formatPrice = (price: number): string => {
  if (price < 0.00001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
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
  <div className="flex items-center gap-1.5">
    <span className="text-xs tracking-[0.2em] uppercase font-proxima-nova font-semibold text-[#D0B284]">
      {label}
    </span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center justify-center text-[#D0B284]/60 hover:text-[#D0B284] transition-colors">
          <Info className="w-3.5 h-3.5" />
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
  <span className="text-xs tracking-[0.2em] uppercase font-proxima-nova font-semibold text-[#D0B284]">
    {label}
  </span>
);

interface TokenHealthPanelProps {
  tokenAddress?: string;
  reservePrice?: string | null; // USD value of physical asset
  chainId?: number;
  marketCap?: number; // Market cap in USD (passed from parent)
  dexMeta?: {
    poolAddress: string | null;
    isDexLive: boolean;
    dexLiveAt: string | null;
  } | null;
  liveTokenPrice?: number; // Live token price in USD from chart datafeed
  volume24hAces?: string; // 24h volume in ACES from API
}

export default function TokenHealthPanel({
  tokenAddress,
  reservePrice,
  chainId,
  marketCap: marketCapProp,
  dexMeta,
  liveTokenPrice,
  volume24hAces,
}: TokenHealthPanelProps) {
  const { walletAddress } = useAuth();
  const [userTokenBalance, setUserTokenBalance] = useState<string>('0');

  // Fetch ACES/USD price for volume conversion
  const { acesUsdPrice } = useAcesPrice();

  // Fetch bonding data (acesBalance not extracted - market cap comes from props now)
  const { currentSupply, loading: bondingLoading } = useTokenBondingData(tokenAddress, chainId);

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

  // Calculate community reward (10% of asset sale price)
  const communityReward = useMemo(() => {
    return assetSalePrice * 0.1;
  }, [assetSalePrice]);

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
    const parsed = parseFloat(currentSupply || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [currentSupply]);

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
    if (marketCapProp && circulatingSupply > 0) {
      return marketCapProp / circulatingSupply;
    }

    return 0;
  }, [liveTokenPrice, marketCapProp, circulatingSupply]);

  // Calculate market cap for ACES Ratio (using fixed supply and live price)
  const calculatedMarketCap = useMemo(() => {
    return tokenPrice * marketCapSupply;
  }, [tokenPrice, marketCapSupply]);

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
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchUserBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchUserBalance]);

  const userTokenHoldings = useMemo(() => {
    const parsed = parseFloat(userTokenBalance);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [userTokenBalance]);

  // Calculate 24h volume in USD
  const volume24hUsd = useMemo(() => {
    if (!volume24hAces || !acesUsdPrice) return 0;
    const volumeAces = parseFloat(volume24hAces);
    if (!Number.isFinite(volumeAces)) return 0;
    return volumeAces * acesUsdPrice;
  }, [volume24hAces, acesUsdPrice]);

  const calculator = useMemo(() => new ValueEquilibriumCalculator(), []);

  const metrics = useMemo(() => {
    // Use actual circulating supply for reward calculations
    // Use calculated market cap for ACES ratio
    return calculator.getMetrics(
      circulatingSupply,
      tokenPrice,
      communityReward,
      assetSalePrice,
      calculatedMarketCap,
    );
  }, [
    calculator,
    circulatingSupply,
    tokenPrice,
    communityReward,
    assetSalePrice,
    calculatedMarketCap,
  ]);

  // Calculate total reward earned: (user holdings / circulating supply) × community reward (10% of asset price)
  const totalRewardEarned = useMemo(() => {
    if (circulatingSupply <= 0 || userTokenHoldings <= 0) return 0;
    const userShareOfSupply = userTokenHoldings / circulatingSupply;
    return userShareOfSupply * communityReward;
  }, [userTokenHoldings, circulatingSupply, communityReward]);

  const ratioDisplay = useMemo(() => {
    const safeRatio = Number.isFinite(metrics.acesRatio) ? metrics.acesRatio : 0;
    const displayRatio = Math.max(safeRatio, 0.1);
    const raw = `${displayRatio.toFixed(2)}x`;
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
    'flex items-center justify-between gap-4 px-5 py-3 border-b border-[#D0B284]/15 last:border-b-0';
  const valueClass = 'text-base font-semibold font-proxima-nova leading-none text-white';

  const isLoading = bondingLoading || !tokenAddress;
  const hasData = circulatingSupply > 0 && tokenPrice > 0;

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
          {isLoading || !hasData ? (
            <LoadingDots className="text-lg font-semibold font-proxima-nova leading-none text-white" />
          ) : ratioDisplay.numeric ? (
            <>
              <span className="text-lg font-semibold font-proxima-nova leading-none text-white">
                {ratioDisplay.numeric}
              </span>
              {ratioDisplay.suffix ? (
                <span className="text-lg font-semibold font-proxima-nova leading-tight text-white">
                  {ratioDisplay.suffix}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-lg font-semibold font-proxima-nova leading-none text-white">
              {ratioDisplay.suffix}
            </span>
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
        <span className={valueClass}>
          {isLoading || !hasData ? (
            <LoadingDots className={valueClass} />
          ) : (
            `${metrics.valueEquilibriumRatio.toFixed(0)}%`
          )}
        </span>
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
        {isLoading || !hasData ? (
          <LoadingDots className={valueClass} />
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-sm font-proxima-nova leading-none text-white">
              {rewardDisplay.prefix}
            </span>
            <span className="text-lg font-semibold font-proxima-nova leading-none text-white">
              {rewardDisplay.numeric}
            </span>
          </div>
        )}
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        <SectionLabel label="VOLUME (24H)" />
        {isLoading || !hasData ? (
          <LoadingDots className={valueClass} />
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-sm font-proxima-nova leading-none">$</span>
            <span className="text-lg font-semibold font-proxima-nova leading-none text-white">
              {formatNumber(volume24hUsd)}
            </span>
          </div>
        )}
      </motion.div>

      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <LabelWithTooltip
          label="LIQUIDITY"
          tooltip="Community Reward ÷ Circulating Supply. Community reward is 10% of the asset's sale price, distributed among all token holders."
        />
        {isLoading || !hasData ? (
          <LoadingDots className={valueClass} />
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-sm font-proxima-nova leading-none">$</span>
            <span className="text-lg font-semibold font-proxima-nova leading-none text-white">
              {formatPrice(metrics.rewardPerToken)}
            </span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
