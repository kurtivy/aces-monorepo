/**
 * Market Cap Endpoint
 *
 * GET /api/v1/market-cap/:tokenAddress
 * Returns current (real-time) market cap data independent of chart candles
 */

import { FastifyInstance } from 'fastify';

interface MarketCapResponse {
  tokenAddress: string;
  marketCapUsd: number;
  currentPriceUsd: number;
  supply: number;
  rewardSupply: number; // Actual circulating supply for reward calculations (excludes LP tokens)
  source: 'bonding_curve' | 'dex_pool' | 'dex_bitquery' | 'cached';
  calculatedAt: number;
  error?: string;
}

export const marketCapRoutes = async (fastify: FastifyInstance) => {
  /**
   * Get current market cap for a token
   *
   * @param tokenAddress - Token contract address (Base network)
   * @returns Market cap data with price, supply, and calculation source
   *
   * Example:
   * GET /api/v1/market-cap/0x1234...
   *
   * Response:
   * {
   *   "tokenAddress": "0x1234...",
   *   "marketCapUsd": 1500000,
   *   "currentPriceUsd": 0.0015,
   *   "supply": 1000000000,
   *   "rewardSupply": 700000000,
   *   "source": "dex_pool",
   *   "calculatedAt": 1699564800000
   * }
   */
  fastify.get<{ Params: { tokenAddress: string } }>(
    '/api/v1/market-cap/:tokenAddress',
    async (request, reply) => {
      try {
        const { tokenAddress } = request.params;

        // Validate address format
        if (!tokenAddress || !tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          return reply.status(400).send({
            error: 'Invalid token address format',
            tokenAddress,
          });
        }

        // Get market cap from service
        if (!fastify.marketCapService) {
          return reply.status(500).send({
            error: 'Market cap service not initialized',
          });
        }

        const marketCapData = await fastify.marketCapService.getMarketCap(
          tokenAddress,
          8453, // Base network chain ID
        );

        const response: MarketCapResponse = {
          tokenAddress: tokenAddress.toLowerCase(),
          marketCapUsd: marketCapData.marketCapUsd,
          currentPriceUsd: marketCapData.currentPriceUsd,
          supply: marketCapData.supply,
          rewardSupply: marketCapData.rewardSupply,
          source: marketCapData.source,
          calculatedAt: marketCapData.calculatedAt,
        };

        // Cache for 5 seconds (same as service cache)
        return reply.header('Cache-Control', 'public, max-age=5').send(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[MarketCapRoute] Error:', errorMessage);

        return reply.status(500).send({
          error: 'Failed to fetch market cap',
          details: errorMessage,
          tokenAddress: request.params.tokenAddress,
        });
      }
    },
  );

  /**
   * Batch endpoint for multiple tokens
   *
   * POST /api/v1/market-cap/batch
   * Body: { "tokenAddresses": ["0x...", "0x..."] }
   *
   * Returns: { "data": [...], "errors": [...] }
   */
  fastify.post<{ Body: { tokenAddresses: string[] } }>(
    '/api/v1/market-cap/batch',
    async (request, reply) => {
      try {
        const { tokenAddresses } = request.body;

        if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
          return reply.status(400).send({
            error: 'tokenAddresses must be a non-empty array',
          });
        }

        if (tokenAddresses.length > 50) {
          return reply.status(400).send({
            error: 'Maximum 50 tokens per batch request',
          });
        }

        // Validate service
        if (!fastify.marketCapService) {
          return reply.status(500).send({
            error: 'Market cap service not initialized',
          });
        }

        // Fetch market cap for all tokens in parallel
        const results = await Promise.allSettled(
          tokenAddresses.map(async (address) => {
            const marketCapData = await fastify.marketCapService!.getMarketCap(address, 8453);

            return {
              tokenAddress: address.toLowerCase(),
              marketCapUsd: marketCapData.marketCapUsd,
              currentPriceUsd: marketCapData.currentPriceUsd,
              supply: marketCapData.supply,
              rewardSupply: marketCapData.rewardSupply,
              source: marketCapData.source,
              calculatedAt: marketCapData.calculatedAt,
            };
          }),
        );

        // Separate successful and failed results
        const data: MarketCapResponse[] = [];
        const errors: Array<{ tokenAddress: string; error: string }> = [];

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            data.push(result.value);
          } else {
            errors.push({
              tokenAddress: tokenAddresses[index],
              error: result.reason?.message || 'Unknown error',
            });
          }
        });

        return reply.header('Cache-Control', 'public, max-age=5').send({
          data,
          errors,
          totalRequested: tokenAddresses.length,
          totalSuccessful: data.length,
          totalFailed: errors.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[MarketCapBatchRoute] Error:', errorMessage);

        return reply.status(500).send({
          error: 'Failed to fetch market cap batch',
          details: errorMessage,
        });
      }
    },
  );

  /**
   * Health check endpoint
   * Verifies the market cap service is working correctly
   *
   * GET /api/v1/market-cap/health
   */
  fastify.get('/api/v1/market-cap/health', async (request, reply) => {
    try {
      if (!fastify.marketCapService) {
        return reply.status(500).send({
          status: 'error',
          service: 'market-cap-service',
          error: 'Market cap service not initialized',
          timestamp: Date.now(),
        });
      }

      const stats = fastify.marketCapService.getCacheStats();

      return reply.send({
        status: 'ok',
        service: 'market-cap-service',
        cache: {
          size: stats.size,
          entries: stats.entries.length,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MarketCapHealthRoute] Error:', errorMessage);

      return reply.status(500).send({
        status: 'error',
        service: 'market-cap-service',
        error: errorMessage,
        timestamp: Date.now(),
      });
    }
  });
};
