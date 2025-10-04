// ValueEquilibriumCalculator.ts
// Standalone TypeScript module for VER calculations

export interface TokenMetrics {
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
}

export interface MarketSignal {
  action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  description: string;
  confidence: number; // 0-100
  verThreshold: {
    min: number;
    max: number;
  };
}

export interface UserRewards {
  tradingCredits: number;
  formattedCredits: string;
}

export class ValueEquilibriumCalculator {
  private readonly TOTAL_SUPPLY: number = 1_000_000_000;

  /**
   * Calculate circulating supply based on LP pool tokens
   */
  public calculateCirculatingSupply(lpPoolTokens: number): number {
    const circulating = this.TOTAL_SUPPLY - lpPoolTokens;
    if (circulating < 0) {
      throw new Error('Invalid LP pool tokens: exceeds total supply');
    }
    return circulating;
  }

  /**
   * Calculate reward per token
   */
  public calculateRewardPerToken(communityReward: number, circulatingSupply: number): number {
    if (circulatingSupply <= 0) return 0;
    if (communityReward < 0) {
      throw new Error('Community reward cannot be negative');
    }
    return communityReward / circulatingSupply;
  }

  /**
   * Calculate Value Equilibrium Ratio
   */
  public calculateVER(tokenPrice: number, rewardPerToken: number): number {
    if (rewardPerToken <= 0) return Infinity;
    if (tokenPrice < 0) {
      throw new Error('Token price cannot be negative');
    }
    return tokenPrice / rewardPerToken;
  }

  /**
   * Calculate reward yield percentage
   */
  public calculateRewardYield(rewardPerToken: number, tokenPrice: number): number {
    if (tokenPrice <= 0) return 0;
    return (rewardPerToken / tokenPrice) * 100;
  }

  /**
   * Calculate market cap
   */
  public calculateMarketCap(tokenPrice: number, circulatingSupply: number): number {
    return tokenPrice * circulatingSupply;
  }

  /**
   * Generate market signal based on VER
   */
  public generateMarketSignal(ver: number): MarketSignal {
    if (ver === Infinity) {
      return {
        action: 'STRONG_SELL',
        description: 'No reward value - Exit immediately',
        confidence: 100,
        verThreshold: { min: 10, max: Infinity },
      };
    }

    if (ver < 0.5) {
      return {
        action: 'STRONG_BUY',
        description: 'Extremely undervalued - Maximum accumulation opportunity',
        confidence: 95,
        verThreshold: { min: 0, max: 0.5 },
      };
    } else if (ver < 0.8) {
      return {
        action: 'BUY',
        description: 'Undervalued - Good entry point for reward accumulation',
        confidence: 75,
        verThreshold: { min: 0.5, max: 0.8 },
      };
    } else if (ver < 1.2) {
      return {
        action: 'HOLD',
        description: 'Fair value - Market is in equilibrium',
        confidence: 60,
        verThreshold: { min: 0.8, max: 1.2 },
      };
    } else if (ver < 2.0) {
      return {
        action: 'SELL',
        description: 'Overvalued - Consider taking partial profits',
        confidence: 70,
        verThreshold: { min: 1.2, max: 2.0 },
      };
    } else {
      return {
        action: 'STRONG_SELL',
        description: 'Extremely overvalued - High risk of correction',
        confidence: 85,
        verThreshold: { min: 2.0, max: Infinity },
      };
    }
  }

  /**
   * Calculate user's trading credits
   */
  public calculateUserRewards(userTokenHoldings: number, rewardPerToken: number): UserRewards {
    const tradingCredits = userTokenHoldings * rewardPerToken;
    return {
      tradingCredits,
      formattedCredits: this.formatNumber(tradingCredits),
    };
  }

  /**
   * Get comprehensive metrics
   */
  public getMetrics(
    lpPoolTokens: number,
    tokenPrice: number,
    communityReward: number,
  ): TokenMetrics {
    const circulatingSupply = this.calculateCirculatingSupply(lpPoolTokens);
    const rewardPerToken = this.calculateRewardPerToken(communityReward, circulatingSupply);
    const valueEquilibriumRatio = this.calculateVER(tokenPrice, rewardPerToken);
    const rewardYield = this.calculateRewardYield(rewardPerToken, tokenPrice);
    const marketCap = this.calculateMarketCap(tokenPrice, circulatingSupply);
    const signal = this.generateMarketSignal(valueEquilibriumRatio);

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
    };
  }

  /**
   * Validate inputs
   */
  public validateInputs(
    lpPoolTokens: number,
    tokenPrice: number,
    communityReward: number,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (lpPoolTokens < 0) {
      errors.push('LP pool tokens cannot be negative');
    }
    if (lpPoolTokens > this.TOTAL_SUPPLY) {
      errors.push('LP pool tokens cannot exceed total supply');
    }
    if (tokenPrice < 0) {
      errors.push('Token price cannot be negative');
    }
    if (communityReward < 0) {
      errors.push('Community reward cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format large numbers for display
   */
  private formatNumber(num: number, decimals: number = 2): string {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(decimals)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  }

  /**
   * Format price based on magnitude
   */
  public formatPrice(price: number): string {
    if (price < 0.00001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return this.formatNumber(price);
  }
}

// Example usage and API integration guide
export const VERCalculatorUsage = {
  /**
   * Example of how to use the calculator with API data
   */
  example: () => {
    const calculator = new ValueEquilibriumCalculator();

    // API data you'll need:
    const apiData = {
      lpPoolTokens: 150_000_000, // From LP pool contract
      tokenPrice: 0.0025, // From AMM price feed
      communityReward: 500_000, // From rewards contract
      userTokenHoldings: 1_000_000, // From user's wallet
    };

    // Validate inputs first
    const validation = calculator.validateInputs(
      apiData.lpPoolTokens,
      apiData.tokenPrice,
      apiData.communityReward,
    );

    if (!validation.valid) {
      console.error('Invalid inputs:', validation.errors);
      return;
    }

    // Get all metrics
    const metrics = calculator.getMetrics(
      apiData.lpPoolTokens,
      apiData.tokenPrice,
      apiData.communityReward,
    );

    // Calculate user rewards
    const userRewards = calculator.calculateUserRewards(
      apiData.userTokenHoldings,
      metrics.rewardPerToken,
    );

    return {
      ver: metrics.valueEquilibriumRatio.toFixed(2),
      signal: metrics.signal.action,
      rewardYield: `${metrics.rewardYield.toFixed(1)}%`,
      tradingCredits: userRewards.formattedCredits,

      // Additional data for UI
      signalDescription: metrics.signal.description,
      confidence: metrics.signal.confidence,
      rewardPerToken: calculator.formatPrice(metrics.rewardPerToken),
    };
  },

  /**
   * API endpoints you'll need to implement or connect to
   */
  requiredApiData: {
    lpPoolTokens: 'Get from LP contract: contract.getReserves() or similar',
    tokenPrice: 'Get from AMM: current token price in USD',
    communityReward: 'Get from rewards contract: total reward pool',
    userTokenHoldings: "Get from wallet: user's token balance",
  },
};

export default ValueEquilibriumCalculator;
