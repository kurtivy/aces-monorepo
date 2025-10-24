import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

interface SubgraphTrade {
  id: string;
  isBuy: boolean;
  tokenAmount: string;
  acesTokenAmount: string;
  supply: string;
  createdAt: string;
  blockNumber: string;
}

interface SubgraphTokenDay {
  id: string;
  date: number;
  tradesCount: number;
  tokensBought: string;
  tokensSold: string;
}

interface SubgraphToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  supply: string;
  tradesCount: number;
  // New fields from enhanced subgraph
  owner?: {
    id: string;
    address: string;
  };
  bonded?: boolean;
  holdersCount?: number; // Holders count from subgraph
  tokensBought?: string;
  tokensSold?: string;
  subjectFeeAmount?: string;
  protocolFeeAmount?: string;
  tokenHours?: Array<{
    id: string;
    tradesCount: number;
    tokensBought: string;
    tokensSold: string;
  }>;
  tokenDays?: Array<{
    id: string;
    tradesCount: number;
    tokensBought: string;
    tokensSold: string;
  }>;
}

export class TokenService {
  private bondingLiquidityCache = new Map<
    string,
    { netWei: Decimal; fetchedAt: number; tradeCount: number }
  >();
  private static readonly BONDING_LIQUIDITY_CACHE_MS = 30_000;

  constructor(private prisma: PrismaClient) {}

  async getOrCreateToken(contractAddress: string) {
    const lowerAddress = contractAddress.toLowerCase();

    let token = await this.prisma.token.findUnique({
      where: { contractAddress: lowerAddress },
    });

    if (!token) {
      token = await this.prisma.token.create({
        data: {
          contractAddress: lowerAddress,
          symbol: 'UNKNOWN',
          name: 'Loading...',
          currentPrice: '0',
          currentPriceACES: '0',
          volume24h: '0',
          chainId: 8453,
          priceSource: 'BONDING_CURVE',
        },
      });
    }

    return token;
  }

  async fetchAndUpdateTokenData(contractAddress: string) {
    try {
      let token = await this.getOrCreateToken(contractAddress);

      // Fetch data from your subgraph
      const subgraphData = await this.fetchFromSubgraph(contractAddress);

      if (subgraphData?.data.tokens?.[0]) {
        const tokenData = subgraphData.data.tokens[0];
        const trades = subgraphData.data.trades || [];

        // Calculate current price from most recent trade (with division by zero protection)
        let currentPrice = '0';
        if (trades.length > 0) {
          const latestTrade = trades[0];
          const tokenAmt = new Decimal(latestTrade.tokenAmount);
          const acesAmt = new Decimal(latestTrade.acesTokenAmount);
          currentPrice = tokenAmt.isZero() ? '0' : acesAmt.div(tokenAmt).toString();
        }

        // Calculate 24h volume from recent trades (BOTH buys AND sells)
        const oneDayAgo = Date.now() / 1000 - 24 * 60 * 60; // 24 hours ago in Unix timestamp
        const recentTrades = trades.filter((t: SubgraphTrade) => parseInt(t.createdAt) > oneDayAgo);

        // Volume = sum of ALL trade amounts (buys + sells)
        const volume24h = recentTrades
          .reduce((sum: Decimal, trade: SubgraphTrade) => {
            const acesAmount = new Decimal(trade.acesTokenAmount || '0');
            return sum.add(acesAmount.abs());
          }, new Decimal(0))
          .toString();

        // Update token
        token = await this.prisma.token.update({
          where: { contractAddress: contractAddress.toLowerCase() },
          data: {
            symbol: tokenData.symbol,
            name: tokenData.name,
            currentPriceACES: currentPrice,
            volume24h: volume24h,
            updatedAt: new Date(),
          },
        });

        // Store recent trades
        await this.storeRecentTrades(contractAddress, trades);
      }

      return token;
    } catch (error) {
      console.error('Error updating token data:', error);
      return await this.getOrCreateToken(contractAddress);
    }
  }

  // New method to fetch trades for chart data
  async fetchTradesForChart(contractAddress: string, timeframe: string) {
    try {
      // Determine how much historical data to fetch based on timeframe
      const hoursBack = this.getHoursBack(timeframe);
      const startTime = Math.floor(Date.now() / 1000) - hoursBack * 60 * 60;

      const query = `{
        trades(
          where: {
            token: "${contractAddress.toLowerCase()}"
            createdAt_gte: "${startTime}"
          }
          orderBy: createdAt
          orderDirection: asc
          first: 1000
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          blockNumber
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      const result = (await response.json()) as { data: { trades: SubgraphTrade[] } };
      return result.data.trades || [];
    } catch (error) {
      console.error('Chart data fetch error:', error);
      return [];
    }
  }

  // New method to fetch daily aggregated data
  async fetchTokenDayData(contractAddress: string) {
    try {
      const query = `{
        tokenDays(
          where: {token: "${contractAddress.toLowerCase()}"}
          orderBy: date
          orderDirection: desc
          first: 30
        ) {
          id
          date
          tradesCount
          tokensBought
          tokensSold
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      const result = (await response.json()) as { data: { tokenDays: SubgraphTokenDay[] } };
      return result.data.tokenDays || [];
    } catch (error) {
      console.error('Token day data fetch error:', error);
      return [];
    }
  }

  private getHoursBack(timeframe: string): number {
    const timeframeHours: { [key: string]: number } = {
      '1m': 2, // 2 hours for minute data
      '5m': 12, // 12 hours for 5-minute data
      '15m': 48, // 48 hours for 15-minute data
      '1h': 168, // 1 week for hourly data
      '1d': 720, // 30 days for daily data
    };

    return timeframeHours[timeframe] || 168;
  }

  async fetchFromSubgraph(
    contractAddress: string,
    retries = 3,
  ): Promise<{ data: { tokens: SubgraphToken[]; trades: SubgraphTrade[] } } | null> {
    let lastError: Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const query = `{
          tokens(where: {address: "${contractAddress.toLowerCase()}"}) {
            id
            address
            name
            symbol
            supply
            tradesCount
            bonded
            holdersCount
            tokensBought
            tokensSold
            subjectFeeAmount
            protocolFeeAmount
            tokenHours(first: 24, orderBy: id, orderDirection: desc) {
              id
              tradesCount
              tokensBought
              tokensSold
            }
            tokenDays(first: 30, orderBy: id, orderDirection: desc) {
              id
              tradesCount
              tokensBought
              tokensSold
            }
          }
          trades(
            where: {token: "${contractAddress.toLowerCase()}"}
            orderBy: createdAt
            orderDirection: desc
            first: 50
          ) {
            id
            isBuy
            tokenAmount
            acesTokenAmount
            supply
            createdAt
            blockNumber
            protocolFeeAmount
            subjectFeeAmount
          }
        }`;

        const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          // Add timeout
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        if (!response.ok) {
          throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
        }

        const result = (await response.json()) as any;

        if (result.errors) {
          throw new Error(`Subgraph GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        return result as {
          data: { tokens: SubgraphToken[]; trades: SubgraphTrade[] };
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(
      `Subgraph fetch failed after ${retries} attempts. Last error: ${lastError!.message}`,
    );
    return null;
  }

  // REMOVED: TokenTrade storage - all trade data now comes from subgraph directly
  // No need to cache trades in database as subgraph is the source of truth
  private async storeRecentTrades(contractAddress: string, trades: SubgraphTrade[]) {
    console.log(
      `[TokenService] Skipping trade storage for ${contractAddress} - using subgraph as source of truth`,
    );
    // No-op: trades are queried directly from subgraph when needed
  }

  // New method to fetch fresh trades from subgraph for trade history component
  async getRecentTradesForToken(contractAddress: string, limit = 50) {
    try {
      const query = `{
        trades(
          where: { token: "${contractAddress.toLowerCase()}" }
          orderBy: createdAt
          orderDirection: desc
          first: ${limit}
        ) {
          id
          isBuy
          trader { id }
          tokenAmount
          acesTokenAmount
          createdAt
          blockNumber
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.error(`[TokenService] Subgraph request failed with status: ${response.status}`);
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      const result = (await response.json()) as {
        data: {
          trades: Array<{
            id: string;
            isBuy: boolean;
            trader: { id: string };
            tokenAmount: string;
            acesTokenAmount: string;
            createdAt: string;
            blockNumber: string;
          }>;
        };
      };

      const trades = result.data.trades || [];
      return trades;
    } catch (error) {
      console.error('[TokenService] Trade history fetch error:', error);
      return [];
    }
  }

  /**
   * Fetches total fees accumulated from all trades for a token
   * Returns fees in ACES (converted from WEI)
   */
  async getTotalFees(tokenAddress: string): Promise<{ acesAmount: string; weiAmount: string }> {
    try {
      const query = `{
        trades(where: {token: "${tokenAddress.toLowerCase()}"}, first: 1000) {
          subjectFeeAmount
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      const result = (await response.json()) as {
        data: { trades: Array<{ subjectFeeAmount: string }> };
      };

      const trades = result.data.trades || [];

      // Sum all subjectFeeAmount values (in WEI)
      const totalFeesWei = trades.reduce((sum, trade) => {
        return sum.add(new Decimal(trade.subjectFeeAmount || '0'));
      }, new Decimal(0));

      // Convert from WEI to ACES (divide by 10^18)
      const totalFeesAces = totalFeesWei.div(new Decimal(10).pow(18));

      return {
        weiAmount: totalFeesWei.toString(),
        acesAmount: totalFeesAces.toString(),
      };
    } catch (error) {
      console.error('[TokenService] Failed to fetch total fees:', error);
      return {
        weiAmount: '0',
        acesAmount: '0',
      };
    }
  }

  /**
   * Calculates net ACES liquidity still held in the bonding curve by aggregating subgraph trades.
   * Applies a short-lived in-memory cache to limit repeated full-history scans.
   */
  async getBondingCurveLiquidity(tokenAddress: string): Promise<{
    netLiquidityWei: Decimal;
    tradeCount: number;
  }> {
    const normalizedAddress = tokenAddress.toLowerCase();
    const cached = this.bondingLiquidityCache.get(normalizedAddress);
    if (cached && Date.now() - cached.fetchedAt < TokenService.BONDING_LIQUIDITY_CACHE_MS) {
      return {
        netLiquidityWei: cached.netWei,
        tradeCount: cached.tradeCount,
      };
    }

    const pageSize = 1000;
    const maxPages = 50; // Safeguard: cap at 50k trades per refresh cycle
    let skip = 0;
    let netWei = new Decimal(0);
    let processedTrades = 0;

    try {
      for (let page = 0; page < maxPages; page++) {
        const query = `
          query BondingCurveLiquidity($token: String!, $first: Int!, $skip: Int!) {
            trades(
              where: { token: $token }
              orderBy: createdAt
              orderDirection: asc
              first: $first
              skip: $skip
            ) {
              isBuy
              acesTokenAmount
            }
          }
        `;

        const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: {
              token: normalizedAddress,
              first: pageSize,
              skip,
            },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
        }

        const result = (await response.json()) as {
          data?: {
            trades?: Array<{ isBuy: boolean; acesTokenAmount: string }>;
          };
          errors?: Array<{ message: string }>;
        };

        if (result.errors?.length) {
          throw new Error(`Subgraph GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        const trades = result.data?.trades ?? [];
        if (trades.length === 0) {
          break;
        }

        for (const trade of trades) {
          const amountWei = new Decimal(trade.acesTokenAmount || '0');
          if (trade.isBuy) {
            netWei = netWei.add(amountWei);
          } else {
            netWei = netWei.sub(amountWei);
          }
        }

        processedTrades += trades.length;
        skip += trades.length;

        if (trades.length < pageSize) {
          break;
        }
      }
    } catch (error) {
      console.error('[TokenService] Failed to aggregate bonding curve liquidity:', error);
      return {
        netLiquidityWei: Decimal.max(new Decimal(0), netWei),
        tradeCount: processedTrades,
      };
    }

    // Clamp to zero to avoid negative liquidity when sells exceed buys
    const clampedWei = Decimal.max(new Decimal(0), netWei);

    this.bondingLiquidityCache.set(normalizedAddress, {
      netWei: clampedWei,
      fetchedAt: Date.now(),
      tradeCount: processedTrades,
    });

    return {
      netLiquidityWei: clampedWei,
      tradeCount: processedTrades,
    };
  }
}
