// src/lib/goldsky-client.ts
import { FastifyBaseLogger } from 'fastify';

/**
 * Extended SubgraphTrade type with all fields needed for webhooks and price tracking
 * This extends the existing SubgraphTrade interface from token-service.ts with additional fields
 */
export interface SubgraphTrade {
  id: string; // Transaction hash
  isBuy: boolean;
  tokenAmount: string;
  acesTokenAmount: string;
  supply: string;
  createdAt: string; // Unix timestamp as string
  blockNumber: string;
  // Additional fields for webhook handling:
  token: {
    address: string;
    name: string;
    symbol: string;
  };
  trader: {
    address: string;
  };
  protocolFeeAmount: string;
  subjectFeeAmount: string;
}

interface SubgraphResponse {
  data?: {
    trades: SubgraphTrade[];
  };
  errors?: Array<{ message: string }>;
}

interface SingleTradeResponse {
  data?: {
    trade: SubgraphTrade | null;
  };
  errors?: Array<{ message: string }>;
}

/**
 * GraphQL client for GoldSky subgraph
 * Centralizes all subgraph queries with proper error handling and logging
 */
export class GoldskyClient {
  private readonly endpoint: string;

  constructor(endpoint?: string) {
    // Use environment variable, following the pattern from existing services
    this.endpoint = endpoint || process.env.GOLDSKY_SUBGRAPH_URL || '';

    if (!this.endpoint) {
      throw new Error('[GoldskyClient] GOLDSKY_SUBGRAPH_URL environment variable not set');
    }
  }

  /**
   * Fetch trades for a specific token with optional time range filtering
   * @param tokenAddress - Token contract address
   * @param limit - Maximum number of trades to fetch (default: 5000)
   * @param fromTimestamp - Optional: only fetch trades after this timestamp (seconds)
   * @param toTimestamp - Optional: only fetch trades before this timestamp (seconds)
   */
  async getTrades(
    tokenAddress: string,
    limit: number = 5000,
    fromTimestamp?: number,
    toTimestamp?: number,
    logger?: FastifyBaseLogger,
  ): Promise<SubgraphTrade[]> {
    // Build where clause with optional timestamp filters
    const whereConditions: string[] = [`token_: { address: "${tokenAddress.toLowerCase()}" }`];

    if (fromTimestamp !== undefined) {
      whereConditions.push(`createdAt_gte: ${fromTimestamp}`);
    }

    if (toTimestamp !== undefined) {
      whereConditions.push(`createdAt_lte: ${toTimestamp}`);
    }

    const whereClause = whereConditions.join('\n            ');

    const query = `{
      trades(
        where: {
          ${whereClause}
        }
        orderBy: createdAt
        orderDirection: desc
        first: ${limit}
      ) {
        id
        token {
          address
          name
          symbol
        }
        trader {
          address
        }
        isBuy
        tokenAmount
        acesTokenAmount
        protocolFeeAmount
        subjectFeeAmount
        supply
        createdAt
        blockNumber
      }
    }`;

    try {
      if (logger) {
        logger.debug({
          msg: '[GoldskyClient] Fetching trades from subgraph',
          tokenAddress,
          limit,
          fromTimestamp,
          toTimestamp,
        });
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as SubgraphResponse;

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
      }

      if (!result.data?.trades) {
        throw new Error('No trades data in response');
      }

      if (logger) {
        logger.debug({
          msg: '[GoldskyClient] Successfully fetched trades',
          count: result.data.trades.length,
        });
      }

      return result.data.trades;
    } catch (error) {
      console.error('[GoldskyClient] Failed to fetch trades:', error);
      throw error;
    }
  }

  /**
   * Fetch a single trade by ID
   * Useful for webhook validation or debugging
   * @param tradeId - Trade transaction hash
   */
  async getTradeById(tradeId: string, _logger?: FastifyBaseLogger): Promise<SubgraphTrade | null> {
    const query = `{
      trade(id: "${tradeId}") {
        id
        token {
          address
          name
          symbol
        }
        trader {
          address
        }
        isBuy
        tokenAmount
        acesTokenAmount
        protocolFeeAmount
        subjectFeeAmount
        supply
        createdAt
        blockNumber
      }
    }`;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as SingleTradeResponse;

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
      }

      return result.data?.trade || null;
    } catch (error) {
      console.error('[GoldskyClient] Failed to fetch trade:', error);
      throw error;
    }
  }

  /**
   * Get the latest trade for a token
   * @param tokenAddress - Token contract address
   */
  async getLatestTrade(
    tokenAddress: string,
    logger?: FastifyBaseLogger,
  ): Promise<SubgraphTrade | null> {
    const trades = await this.getTrades(tokenAddress, 1, undefined, undefined, logger);
    return trades[0] || null;
  }
}

// Singleton instance for use across the application
// This follows the same pattern as priceCacheService
export const goldskyClient = new GoldskyClient();
