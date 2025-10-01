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

  const rowClass =
    'flex items-center justify-between gap-4 px-5 py-4 border-b border-[#D0B284]/15 last:border-b-0';
  const labelClass =
    'text-xs tracking-[0.28em] uppercase font-spray-letters text-[#D0B284]';
  const valueClass = 'text-xl font-semibold font-proxima-nova leading-none text-white';

  return (
    <motion.div
      className="h-full flex flex-col rounded-xl border border-[#D0B284]/20 bg-[#111712]/90"
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
        <span className={`${labelClass} whitespace-nowrap`}>ACES RATIO</span>
        <div className="flex items-end gap-2 text-white">
          {ratioDisplay.numeric ? (
            <>
              <span className="text-2xl font-semibold font-proxima-nova leading-none text-white">
                {ratioDisplay.numeric}
              </span>
              {ratioDisplay.suffix ? (
                <span className="text-xl font-semibold font-proxima-nova leading-tight text-white">
                  {ratioDisplay.suffix}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-2xl font-semibold font-proxima-nova leading-none text-white">
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
        <span className={labelClass}>VER</span>
        <span className={valueClass}>{metrics.valueEquilibriumRatio.toFixed(2)}</span>
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        <span className={labelClass}>SIGNAL</span>
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
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <span className={`${labelClass} whitespace-nowrap`}>TRADING CREDITS</span>
        <div className="flex items-end gap-1 text-white">
          <span className="text-base font-proxima-nova leading-none text-white">
            {tradingCreditsDisplay.prefix}
          </span>
          <span className="text-2xl font-semibold font-proxima-nova leading-none text-white">
            {tradingCreditsDisplay.numeric}
          </span>
        </div>
      </motion.div>
      <motion.div
        className={rowClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <span className={labelClass}>REWARD PER TOKEN</span>
        <div className="flex items-end gap-1 text-white">
          <span className="text-sm font-proxima-nova leading-none">$</span>
          <span className={valueClass}>{formatPrice(metrics.rewardPerToken)}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
