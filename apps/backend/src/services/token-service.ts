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

export class TokenService {
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

        // Calculate 24h volume from recent trades
        const oneDayAgo = Date.now() / 1000 - 24 * 60 * 60; // 24 hours ago in Unix timestamp
        const recentTrades = trades.filter((t: SubgraphTrade) => parseInt(t.createdAt) > oneDayAgo);

        const volume24h = recentTrades
          .reduce((sum: Decimal, trade: SubgraphTrade) => {
            return sum.add(new Decimal(trade.acesTokenAmount));
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

  private async fetchFromSubgraph(
    contractAddress: string,
  ): Promise<{ data: { tokens: any[]; trades: any[] } } | null> {
    try {
      const query = `{
        tokens(where: {address: "${contractAddress.toLowerCase()}"}) {
          id
          address
          name
          symbol
          supply
          tradesCount
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

      return (await response.json()) as { data: { tokens: any[]; trades: any[] } };
    } catch (error) {
      console.error('Subgraph fetch error:', error);
      return null;
    }
  }

  private async storeRecentTrades(contractAddress: string, trades: SubgraphTrade[]) {
    for (const trade of trades.slice(0, 10)) {
      try {
        const tokenAmt = new Decimal(trade.tokenAmount);
        const acesAmt = new Decimal(trade.acesTokenAmount);
        const pricePerToken = tokenAmt.isZero() ? '0' : acesAmt.div(tokenAmt).toString();

        await this.prisma.tokenTrade.upsert({
          where: { txHash: trade.id }, // Using trade ID as txHash
          update: {},
          create: {
            contractAddress: contractAddress.toLowerCase(),
            txHash: trade.id,
            trader: 'unknown',
            tradeType: trade.isBuy ? 'BUY' : 'SELL',
            tokenAmount: trade.tokenAmount,
            acesAmount: trade.acesTokenAmount,
            pricePerToken: pricePerToken,
            timestamp: new Date(parseInt(trade.createdAt) * 1000),
            source: 'SUBGRAPH',
          },
        });
      } catch (error) {
        console.warn('Failed to store trade:', error);
      }
    }
  }

  async getRecentTrades(contractAddress: string, limit = 10) {
    return await this.prisma.tokenTrade.findMany({
      where: { contractAddress: contractAddress.toLowerCase() },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
