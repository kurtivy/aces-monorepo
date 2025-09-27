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

  const ratioDisplay = useMemo(() => {
    const raw = ratioText ?? `${metrics.valueEquilibriumRatio.toFixed(2)}x`;
    const match = raw.match(/^([0-9.,]+)/);

    if (!match) {
      return { numeric: '', suffix: raw };
    }

    return { numeric: match[1], suffix: raw.slice(match[1].length) };
  }, [ratioText, metrics.valueEquilibriumRatio]);

  const tradingCreditsDisplay = useMemo(() => {
    const formatted = formatNumber(tradingCredits);
    return {
      numeric: formatted,
      prefix: '$',
    };
  }, [tradingCredits]);

  const metricCardClass =
    'rounded-xl border border-[#D0B284]/20 bg-[#111712]/90 px-5 py-4 flex flex-col gap-3';

  return (
    <motion.div
      className="h-full flex flex-col bg-[#151c16]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      {/* ACES RATIO - Single Line */}
      <motion.div
        className={metricCardClass}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[#D0B284] text-base uppercase tracking-[0.3em] font-spray-letters whitespace-nowrap">
            ACES RATIO
          </span>
          <div className="flex items-end gap-2 text-white">
            {ratioDisplay.numeric ? (
              <>
                <span className="text-3xl font-semibold font-proxima-nova leading-none">
                  {ratioDisplay.numeric}
                </span>
                {ratioDisplay.suffix ? (
                  <span className="text-2xl font-spray-letters leading-tight">
                    {ratioDisplay.suffix}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-3xl font-spray-letters leading-none">
                {ratioDisplay.suffix}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* VER and SIGNAL - Two Columns */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className={`${metricCardClass} text-center items-center`}>
          <div className="text-[#D0B284] text-sm tracking-[0.28em] uppercase font-spray-letters">
            VER
          </div>
          <div className="text-white text-2xl font-semibold font-proxima-nova">
            {metrics.valueEquilibriumRatio.toFixed(2)}
          </div>
        </div>
        <div className={`${metricCardClass} text-center items-center`}>
          <div className="text-[#D0B284] text-sm tracking-[0.28em] uppercase font-spray-letters">
            SIGNAL
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getSignalColor(metrics.signal.action) }}
            />
            <span
              className="text-xl font-bold font-spray-letters tracking-[0.3em]"
              style={{ color: getSignalColor(metrics.signal.action) }}
            >
              {metrics.signal.action}
            </span>
          </div>
        </div>
      </motion.div>
      {/* Trading Credits - Single Line */}
      <motion.div
        className={metricCardClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center justify-between gap-4 text-white">
          <span className="text-[#D0B284] text-base uppercase tracking-[0.28em] font-spray-letters whitespace-nowrap">
            TRADING CREDITS
          </span>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-proxima-nova leading-none">
              {tradingCreditsDisplay.prefix}
            </span>
            <span className="text-3xl font-semibold font-proxima-nova leading-none">
              {tradingCreditsDisplay.numeric}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Reward Per Token and Reward Yield - Two Columns */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <div className={metricCardClass}>
          <div className="text-[#D0B284] text-xs tracking-[0.28em] uppercase font-spray-letters">
            REWARD PER TOKEN
          </div>
          <div className="flex items-end gap-1 text-white">
            <span className="text-base font-proxima-nova leading-none">$</span>
            <span className="text-2xl font-semibold font-proxima-nova leading-none">
              {formatPrice(metrics.rewardPerToken)}
            </span>
          </div>
        </div>
        <div className={metricCardClass}>
          <div className="text-[#D0B284] text-xs tracking-[0.28em] uppercase font-spray-letters">
            REWARD YIELD
          </div>
          <div className="flex items-end gap-1 text-white">
            <span className="text-2xl font-semibold font-proxima-nova leading-none">
              {metrics.rewardYield.toFixed(1)}
            </span>
            <span className="text-base font-proxima-nova leading-none">%</span>
          </div>
        </div>
      </motion.div>

      {/* Circulating Supply - Single Line */}
      <motion.div
        className={metricCardClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <div className="text-[#D0B284] text-sm tracking-[0.28em] uppercase font-spray-letters">
          CIRCULATING SUPPLY
        </div>
        <div className="flex flex-wrap items-end gap-2 text-white">
          <span className="text-2xl font-semibold font-proxima-nova leading-none">
            {formatNumber(metrics.circulatingSupply)}
          </span>
          <span className="text-xs uppercase tracking-[0.32em] font-spray-letters text-[#D0B284]">
            tokens
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
