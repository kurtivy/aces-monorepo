'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

// Value Equilibrium Calculator (embedded)
interface TokenMetrics {
  totalSupply: number;
  lpPoolTokens: number;
  circulatingSupply: number;
  tokenPrice: number;
  communityReward: number;
  rewardPerToken: number;
  valueEquilibriumRatio: number;
  rewardYield: number;
  marketCap: number;
  signal: MarketSignal;
  equilibriumPrice: number;
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

  calculateRewardYield(rewardPerToken: number, tokenPrice: number): number {
    if (tokenPrice <= 0) return 0;
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

  getMetrics(lpPoolTokens: number, tokenPrice: number, communityReward: number): TokenMetrics {
    const circulatingSupply = this.calculateCirculatingSupply(lpPoolTokens);
    const rewardPerToken = this.calculateRewardPerToken(communityReward, circulatingSupply);
    const valueEquilibriumRatio = this.calculateVER(tokenPrice, rewardPerToken);
    const rewardYield = this.calculateRewardYield(rewardPerToken, tokenPrice);
    const marketCap = tokenPrice * circulatingSupply;
    const signal = this.generateMarketSignal(valueEquilibriumRatio);
    const equilibriumPrice = this.findEquilibriumPrice(communityReward, lpPoolTokens);

    return {
      totalSupply: this.TOTAL_SUPPLY,
      lpPoolTokens,
      circulatingSupply,
      tokenPrice,
      communityReward,
      rewardPerToken,
      valueEquilibriumRatio,
      rewardYield,
      marketCap,
      signal,
      equilibriumPrice,
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
interface TokenHealthPanelProps {
  ratioText?: string;
}

export default function TokenHealthPanel({ ratioText }: TokenHealthPanelProps) {
  // Hardcoded values to produce HOLD signal (VER between 0.8-1.2)
  const lpPoolTokens = 150_000_000; // Less LP = more circulating = lower reward per token
  const tokenPrice = 0.001; // Lower price
  const communityReward = 850_000; // Higher reward pool
  const userTokenHoldings = 1_000_000; // User's token holdings for trading credits

  const calculator = useMemo(() => new ValueEquilibriumCalculator(), []);

  const metrics = useMemo(() => {
    return calculator.getMetrics(lpPoolTokens, tokenPrice, communityReward);
  }, [calculator, lpPoolTokens, tokenPrice, communityReward]);

  // Get signal color
  const tradingCredits = useMemo(() => {
    return userTokenHoldings * metrics.rewardPerToken;
  }, [userTokenHoldings, metrics.rewardPerToken]);

  return (
    <motion.div
      className="h-full flex flex-col bg-[#151c16] p-6 font-mono"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      {/* ACES RATIO - Single Line */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
      >
        <div className="text-[#D0B284] text-xs tracking-wider mb-1">ACES RATIO</div>
        <div className="text-white text-3xl font-bold tracking-tight">
          {ratioText || `${metrics.valueEquilibriumRatio.toFixed(2)}x`}
        </div>
      </motion.div>

      {/* VER and SIGNAL - Two Columns */}
      <motion.div
        className="mb-6 grid grid-cols-2 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div>
          <div className="text-[#D0B284] text-xs tracking-wider mb-1">VER</div>
          <div className="text-white text-3xl font-bold">
            {metrics.valueEquilibriumRatio.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[#D0B284] text-xs tracking-wider mb-1">SIGNAL</div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getSignalColor(metrics.signal.action) }}
            />
            <span
              className="text-2xl font-bold"
              style={{ color: getSignalColor(metrics.signal.action) }}
            >
              {metrics.signal.action}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Reward Per Token and Reward Yield - Two Columns */}
      <motion.div
        className="mb-6 grid grid-cols-2 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <div>
          <div className="text-[#D0B284] text-xs tracking-wider mb-1">REWARD PER TOKEN</div>
          <div className="text-white text-2xl font-bold">
            ${formatPrice(metrics.rewardPerToken)}
          </div>
        </div>
        <div>
          <div className="text-[#D0B284] text-xs tracking-wider mb-1">REWARD YIELD</div>
          <div className="text-white text-2xl font-bold">{metrics.rewardYield.toFixed(1)}%</div>
        </div>
      </motion.div>

      {/* Trading Credits - Single Line */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="text-[#D0B284] text-xs tracking-wider mb-1">TRADING CREDITS</div>
        <div className="text-white text-2xl font-bold">${formatNumber(tradingCredits)}</div>
        <div className="text-[#D0B284] text-xs mt-1 opacity-70">
          {formatNumber(userTokenHoldings)} tokens × ${formatPrice(metrics.rewardPerToken)}
        </div>
      </motion.div>

      {/* Circulating Supply - Single Line */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <div className="text-[#D0B284] text-xs tracking-wider mb-1">CIRCULATING SUPPLY</div>
        <div className="text-white text-2xl font-bold">
          {formatNumber(metrics.circulatingSupply)} tokens
        </div>
      </motion.div>
    </motion.div>
  );
}
