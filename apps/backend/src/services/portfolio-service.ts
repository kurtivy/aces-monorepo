import { PrismaClient } from '@prisma/client';

interface UserTokenHolding {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  balance: string;
  currentPrice: string;
  entryPrice: string;
  totalInvested: string;
  currentValue: string;
  pnl: string;
  pnlPercentage: string;
  allocation: number;
  owner: {
    id: string;
    address: string;
  };
  tokenData: {
    supply: string;
    tradesCount: number;
    bonded: boolean;
    tokensBought: string;
    tokensSold: string;
  };
}

interface PortfolioMetrics {
  totalValue: string;
  totalInvested: string;
  totalPnL: string;
  pnlPercentage: string;
  tokenCount: number;
  topPerformer: UserTokenHolding | null;
  worstPerformer: UserTokenHolding | null;
}

interface SubgraphPortfolioResponse {
  data: {
    tokens: Array<{
      id: string;
      address: string;
      name: string;
      symbol: string;
      supply: string;
      tradesCount: number;
      owner: {
        id: string;
        address: string;
      };
      bonded: boolean;
      tokensBought: string;
      tokensSold: string;
      subjectFeeAmount: string;
      protocolFeeAmount: string;
    }>;
    trades: Array<{
      id: string;
      isBuy: boolean;
      tokenAmount: string;
      acesTokenAmount: string;
      supply: string;
      createdAt: string;
      token: {
        address: string;
        name: string;
        symbol: string;
      };
    }>;
  };
  errors?: any[];
}

export class PortfolioService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get user's complete portfolio from subgraph
   */
  async getUserPortfolio(walletAddress: string): Promise<{
    holdings: UserTokenHolding[];
    metrics: PortfolioMetrics;
  }> {
    try {
      console.log(`[Portfolio] Fetching portfolio for ${walletAddress}`);

      // Fetch tokens owned by the user and their trading history
      const portfolioData = await this.fetchUserPortfolioFromSubgraph(walletAddress);

      if (!portfolioData) {
        return {
          holdings: [],
          metrics: this.getEmptyMetrics(),
        };
      }

      // Calculate holdings and metrics
      const holdings = await this.calculateUserHoldings(walletAddress, portfolioData);
      const metrics = this.calculatePortfolioMetrics(holdings);

      console.log(`[Portfolio] Found ${holdings.length} token holdings for ${walletAddress}`);

      return { holdings, metrics };
    } catch (error) {
      console.error('[Portfolio] Error fetching user portfolio:', error);
      return {
        holdings: [],
        metrics: this.getEmptyMetrics(),
      };
    }
  }

  /**
   * Fetch user's tokens and trades from enhanced subgraph
   */
  private async fetchUserPortfolioFromSubgraph(
    walletAddress: string,
  ): Promise<SubgraphPortfolioResponse | null> {
    try {
      const query = `{
        tokens(where: {owner: "${walletAddress.toLowerCase()}"}) {
          id
          address
          name
          symbol
          supply
          tradesCount
          bonded
          tokensBought
          tokensSold
          subjectFeeAmount
          protocolFeeAmount
        }
        trades(
          where: {
            or: [
              {token_: {owner: "${walletAddress.toLowerCase()}"}},
              {trader: "${walletAddress.toLowerCase()}"}
            ]
          }
          orderBy: createdAt
          orderDirection: desc
          first: 1000
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          protocolFeeAmount
          subjectFeeAmount
          token {
            address
            name
            symbol
          }
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      const result = (await response.json()) as SubgraphPortfolioResponse;
      if (result.errors) {
        throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
      }

      return result;
    } catch (error) {
      console.error('[Portfolio] Error fetching from subgraph:', error);
      return null;
    }
  }

  /**
   * Calculate user's current holdings based on owned tokens and trading history
   */
  private async calculateUserHoldings(
    walletAddress: string,
    portfolioData: SubgraphPortfolioResponse,
  ): Promise<UserTokenHolding[]> {
    const holdings: UserTokenHolding[] = [];
    const { tokens, trades } = portfolioData.data;

    // Process owned tokens (tokens where user is the owner/creator)
    for (const token of tokens) {
      try {
        // Get current price from recent trades or bonding curve
        const currentPrice = await this.getCurrentTokenPrice(token.address);

        // Calculate user's position in this token
        const userTrades = trades.filter(
          (trade) => trade.token.address.toLowerCase() === token.address.toLowerCase(),
        );

        const position = this.calculateTokenPosition(userTrades, token.supply);

        if (position.balance > 0) {
          const currentValue = position.balance * parseFloat(currentPrice);
          const pnl = currentValue - position.totalInvested;
          const pnlPercentage =
            position.totalInvested > 0 ? (pnl / position.totalInvested) * 100 : 0;

          holdings.push({
            tokenAddress: token.address,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            balance: position.balance.toString(),
            currentPrice,
            entryPrice: position.averageEntryPrice.toString(),
            totalInvested: position.totalInvested.toString(),
            currentValue: currentValue.toString(),
            pnl: pnl.toString(),
            pnlPercentage: pnlPercentage.toString(),
            allocation: 0, // Will be calculated in metrics
            owner: token.owner,
            tokenData: {
              supply: token.supply,
              tradesCount: token.tradesCount,
              bonded: token.bonded,
              tokensBought: token.tokensBought,
              tokensSold: token.tokensSold,
            },
          });
        }
      } catch (error) {
        console.error(`[Portfolio] Error calculating holding for ${token.symbol}:`, error);
      }
    }

    return holdings;
  }

  /**
   * Calculate user's position in a specific token
   */
  private calculateTokenPosition(
    userTrades: any[],
    tokenSupply: string,
  ): {
    balance: number;
    totalInvested: number;
    averageEntryPrice: number;
  } {
    let balance = 0;
    let totalInvested = 0;
    let totalTokensBought = 0;

    for (const trade of userTrades) {
      const tokenAmount = parseFloat(trade.tokenAmount);
      const acesAmount = parseFloat(trade.acesTokenAmount);

      if (trade.isBuy) {
        balance += tokenAmount;
        totalInvested += acesAmount;
        totalTokensBought += tokenAmount;
      } else {
        balance -= tokenAmount;
        // For sells, reduce total invested proportionally
        if (totalTokensBought > 0) {
          const sellRatio = tokenAmount / totalTokensBought;
          totalInvested -= totalInvested * sellRatio;
        }
      }
    }

    const averageEntryPrice = totalTokensBought > 0 ? totalInvested / totalTokensBought : 0;

    return {
      balance: Math.max(0, balance), // Can't have negative balance
      totalInvested: Math.max(0, totalInvested),
      averageEntryPrice,
    };
  }

  /**
   * Get current token price from recent trades or bonding curve
   */
  private async getCurrentTokenPrice(tokenAddress: string): Promise<string> {
    try {
      // Fetch recent trades to get current price
      const query = `{
        trades(
          where: {token: "${tokenAddress.toLowerCase()}"}
          orderBy: createdAt
          orderDirection: desc
          first: 1
        ) {
          tokenAmount
          acesTokenAmount
          supply
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const result = (await response.json()) as {
          data?: {
            trades?: Array<{
              tokenAmount: string;
              acesTokenAmount: string;
              supply: string;
            }>;
          };
          errors?: any[];
        };

        const latestTrade = result.data?.trades?.[0];

        if (latestTrade) {
          const price =
            parseFloat(latestTrade.acesTokenAmount) / parseFloat(latestTrade.tokenAmount);
          return price.toString();
        }
      }

      // Fallback: calculate from bonding curve using current supply
      // This would require the bonding curve formula
      return '0.001'; // Placeholder
    } catch (error) {
      console.error(`[Portfolio] Error getting price for ${tokenAddress}:`, error);
      return '0.001'; // Fallback price
    }
  }

  /**
   * Calculate overall portfolio metrics
   */
  private calculatePortfolioMetrics(holdings: UserTokenHolding[]): PortfolioMetrics {
    if (holdings.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalValue = holdings.reduce((sum, holding) => sum + parseFloat(holding.currentValue), 0);
    const totalInvested = holdings.reduce(
      (sum, holding) => sum + parseFloat(holding.totalInvested),
      0,
    );
    const totalPnL = totalValue - totalInvested;
    const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    // Calculate allocations
    holdings.forEach((holding) => {
      holding.allocation =
        totalValue > 0 ? (parseFloat(holding.currentValue) / totalValue) * 100 : 0;
    });

    // Find top and worst performers
    const sortedByPnL = [...holdings].sort(
      (a, b) => parseFloat(b.pnlPercentage) - parseFloat(a.pnlPercentage),
    );

    return {
      totalValue: totalValue.toString(),
      totalInvested: totalInvested.toString(),
      totalPnL: totalPnL.toString(),
      pnlPercentage: pnlPercentage.toString(),
      tokenCount: holdings.length,
      topPerformer: sortedByPnL[0] || null,
      worstPerformer: sortedByPnL[sortedByPnL.length - 1] || null,
    };
  }

  private getEmptyMetrics(): PortfolioMetrics {
    return {
      totalValue: '0',
      totalInvested: '0',
      totalPnL: '0',
      pnlPercentage: '0',
      tokenCount: 0,
      topPerformer: null,
      worstPerformer: null,
    };
  }
}
