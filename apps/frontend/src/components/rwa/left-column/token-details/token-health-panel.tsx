'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';
import { usePriceConversion } from '@/hooks/use-price-conversion';
import { useAuth } from '@/lib/auth/auth-context';
import { ethers } from 'ethers';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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
    return tokenPrice / rewardPerToken;
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
    lpPoolTokens: number,
    tokenPrice: number,
    communityReward: number,
    assetSalePrice: number,
  ): TokenMetrics {
    const circulatingSupply = this.calculateCirculatingSupply(lpPoolTokens);
    const rewardPerToken = this.calculateRewardPerToken(communityReward, circulatingSupply);
    const valueEquilibriumRatio = this.calculateVER(tokenPrice, rewardPerToken);
    const marketCap = tokenPrice * circulatingSupply;
    const signal = this.generateMarketSignal(valueEquilibriumRatio);
    const equilibriumPrice = this.findEquilibriumPrice(communityReward, lpPoolTokens);
    const acesRatio = assetSalePrice > 0 ? marketCap / assetSalePrice : 0;

    return {
      totalSupply: this.TOTAL_SUPPLY,
      lpPoolTokens,
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
    <span className="text-[10px] tracking-[0.28em] uppercase font-spray-letters text-[#D0B284]">
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

interface TokenHealthPanelProps {
  tokenAddress?: string;
  reservePrice?: string | null; // USD value of physical asset
  chainId?: number;
}

export default function TokenHealthPanel({
  tokenAddress,
  reservePrice,
  chainId,
}: TokenHealthPanelProps) {
  const { walletAddress } = useAuth();
  const [userTokenBalance, setUserTokenBalance] = useState<string>('0');

  // Fetch bonding data
  const {
    currentSupply,
    acesBalance,
    loading: bondingLoading,
  } = useTokenBondingData(tokenAddress, chainId);

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

  // Parse current supply - this is the CIRCULATING supply (tokens already sold)
  const circulatingSupply = useMemo(() => {
    const parsed = parseFloat(currentSupply || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [currentSupply]);

  // Calculate LP pool tokens (tokens still in bonding curve)
  const TOTAL_SUPPLY = 1_000_000_000;
  const lpPoolTokens = useMemo(() => {
    return TOTAL_SUPPLY - circulatingSupply;
  }, [circulatingSupply]);

  // Get market cap in USD (ACES balance converted to USD)
  const acesDepositedFloat = useMemo(() => {
    const parsed = parseFloat(acesBalance || '0');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [acesBalance]);

  const { data: marketCapConversion } = usePriceConversion(
    acesDepositedFloat > 0 ? acesDepositedFloat.toString() : '0',
  );

  const marketCapUSD = useMemo(() => {
    if (!marketCapConversion?.usdValue) return 0;
    const usd = Number(marketCapConversion.usdValue);
    return Number.isFinite(usd) ? usd : 0;
  }, [marketCapConversion]);

  // Calculate token price in USD
  const tokenPrice = useMemo(() => {
    if (circulatingSupply <= 0 || marketCapUSD <= 0) return 0;
    return marketCapUSD / circulatingSupply;
  }, [marketCapUSD, circulatingSupply]);

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

  const calculator = useMemo(() => new ValueEquilibriumCalculator(), []);

  const metrics = useMemo(() => {
    // Pass lpPoolTokens - calculator will derive circulating supply from it
    return calculator.getMetrics(lpPoolTokens, tokenPrice, communityReward, assetSalePrice);
  }, [calculator, lpPoolTokens, tokenPrice, communityReward, assetSalePrice]);

  // Get signal color
  const tradingCredits = useMemo(() => {
    return userTokenHoldings * metrics.rewardPerToken;
  }, [userTokenHoldings, metrics.rewardPerToken]);

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

  const tradingCreditsDisplay = useMemo(() => {
    const formatted = formatNumber(tradingCredits);
    return {
      numeric: formatted,
      prefix: '$',
    };
  }, [tradingCredits]);

  const rowClass =
    'flex items-center justify-between gap-4 px-5 py-3 border-b border-[#D0B284]/15 last:border-b-0';
  const valueClass = 'text-sm font-semibold font-proxima-nova leading-none text-white';

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
          {ratioDisplay.numeric ? (
            <>
              <span className="text-base font-semibold font-proxima-nova leading-none text-white">
                {ratioDisplay.numeric}
              </span>
              {ratioDisplay.suffix ? (
                <span className="text-base font-semibold font-proxima-nova leading-tight text-white">
                  {ratioDisplay.suffix}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-base font-semibold font-proxima-nova leading-none text-white">
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
          label="VER"
          tooltip="Value Equilibrium Ratio = Token Price ÷ Reward Per Token. Below 0.8 = undervalued (buy), 0.8-1.2 = fair value (hold), above 1.2 = overvalued (sell)."
        />
        <span className={valueClass}>
          {isLoading ? '...' : hasData ? metrics.valueEquilibriumRatio.toFixed(2) : '--'}
        </span>
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        <LabelWithTooltip
          label="SIGNAL"
          tooltip="Trading signal based on VER analysis. Indicates whether the token is undervalued (buy), fairly valued (hold), or overvalued (sell)."
        />
        {isLoading || !hasData ? (
          <span className={valueClass}>...</span>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getSignalColor(metrics.signal.action) }}
            />
            <span
              className="text-sm font-bold font-spray-letters tracking-[0.3em]"
              style={{ color: getSignalColor(metrics.signal.action) }}
            >
              {metrics.signal.action}
            </span>
          </div>
        )}
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <LabelWithTooltip
          label="TRADING CREDITS"
          tooltip="Your share of the community reward pool = Your Token Balance × Reward Per Token. These credits can be used for future trading."
        />
        {isLoading || !hasData ? (
          <span className={valueClass}>...</span>
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-xs font-proxima-nova leading-none text-white">
              {tradingCreditsDisplay.prefix}
            </span>
            <span className="text-base font-semibold font-proxima-nova leading-none text-white">
              {tradingCreditsDisplay.numeric}
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
          label="REWARD PER TOKEN"
          tooltip="Community Reward ÷ Circulating Supply. Community reward is 10% of the asset's sale price, distributed among all token holders."
        />
        {isLoading || !hasData ? (
          <span className={valueClass}>...</span>
        ) : (
          <div className="flex items-baseline gap-0.5 text-white">
            <span className="text-xs font-proxima-nova leading-none">$</span>
            <span className="text-base font-semibold font-proxima-nova leading-none text-white">
              {formatPrice(metrics.rewardPerToken)}
            </span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
