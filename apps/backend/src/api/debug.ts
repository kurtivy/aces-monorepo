// backend/routes/api/v1/debug.ts (NEW)
import { FastifyInstance } from 'fastify';

export async function debugRoutes(fastify: FastifyInstance) {
  // Only enable in development
  //   if (process.env.NODE_ENV === 'production') {
  //     return;
  //   }

  // 🔥 UNIFIED GOLDSKY TEST ENDPOINT - Raw Query Test
  fastify.get('/api/v1/debug/unified-goldsky/:tokenAddress/raw', async (request, reply) => {
    try {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const goldskyUrl = process.env.GOLDSKY_SUBGRAPH_URL;

      if (!goldskyUrl) {
        return reply.code(503).send({
          success: false,
          error: 'GOLDSKY_SUBGRAPH_URL not configured',
        });
      }

      const normalizedAddress = tokenAddress.toLowerCase();

      // Use the exact same query as UnifiedGoldSkyDataService
      const query = `{
        tokens(where: {address: "${normalizedAddress}"}) {
          address
          steepness
          floor
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
          where: {token: "${normalizedAddress}"}
          orderBy: createdAt
          orderDirection: desc
          first: 1000
        ) {
          id
          isBuy
          trader { id }
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          blockNumber
          protocolFeeAmount
          subjectFeeAmount
        }
      }`;

      console.log(`[Debug] Testing unified query directly for: ${tokenAddress}`);

      const response = await fetch(goldskyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000),
      });

      const responseText = await response.text();
      let result: {
        data?: any;
        errors?: Array<{ message: string; locations?: any[]; path?: any[] }>;
      };

      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        return reply.code(500).send({
          success: false,
          error: 'Failed to parse response',
          responseText: responseText.substring(0, 1000),
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      return reply.send({
        success: response.ok,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        hasErrors: !!result.errors && result.errors.length > 0,
        errors: result.errors || [],
        tokensFound: result.data?.tokens?.length || 0,
        tradesFound: result.data?.trades?.length || 0,
        data: result.data,
      });
    } catch (error) {
      console.error('[Debug] Raw query test error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  // 🔥 UNIFIED GOLDSKY TEST ENDPOINT
  fastify.get('/api/v1/debug/unified-goldsky/:tokenAddress', async (request, reply) => {
    try {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const unifiedService = (fastify as any).unifiedGoldSkyService;

      if (!unifiedService) {
        return reply.code(503).send({
          success: false,
          error: 'Unified GoldSky service not initialized',
        });
      }

      console.log(`[Debug] Testing Unified GoldSky service for token: ${tokenAddress}`);

      // Check if GoldSky URL is configured
      const goldskyUrl = process.env.GOLDSKY_SUBGRAPH_URL;
      if (!goldskyUrl) {
        return reply.code(503).send({
          success: false,
          error: 'GOLDSKY_SUBGRAPH_URL not configured',
          details: 'Please set GOLDSKY_SUBGRAPH_URL environment variable',
        });
      }

      // Test fetching unified data
      const startTime = Date.now();
      const unifiedData = await unifiedService.getUnifiedTokenData(tokenAddress);
      const fetchTime = Date.now() - startTime;

      if (!unifiedData) {
        // Try to get more details about why it failed
        const errorDetails: Record<string, unknown> = {
          tokenAddress,
          goldskyUrl: goldskyUrl.substring(0, 50) + '...',
        };

        // Check if service has any error logs we can expose
        try {
          // Try a direct fetch to see what happens
          const testQuery = `{
            tokens(where: {address: "${tokenAddress.toLowerCase()}"}) {
              address
              symbol
            }
          }`;

          const testResponse = await fetch(goldskyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: testQuery }),
            signal: AbortSignal.timeout(5000),
          });

          if (testResponse.ok) {
            const testData = (await testResponse.json()) as {
              data?: {
                tokens?: Array<{ address: string; symbol: string }>;
              };
              errors?: Array<{ message: string }>;
            };
            errorDetails.testQueryWorked = true;
            errorDetails.testTokensFound = testData?.data?.tokens?.length || 0;
            if (testData.errors) {
              errorDetails.testErrors = testData.errors;
            }
          } else {
            errorDetails.testQueryWorked = false;
            errorDetails.testStatus = testResponse.status;
            errorDetails.testStatusText = testResponse.statusText;
          }
        } catch (testError) {
          errorDetails.testError =
            testError instanceof Error ? testError.message : String(testError);
        }

        return reply.code(404).send({
          success: false,
          error: 'Token not found or failed to fetch unified data',
          details: 'Check server logs for more information',
          debug: errorDetails,
        });
      }

      // Test cache hit
      const cacheStartTime = Date.now();
      const cachedData = await unifiedService.getUnifiedTokenData(tokenAddress);
      const cacheTime = Date.now() - cacheStartTime;

      return reply.send({
        success: true,
        tokenAddress,
        metrics: {
          fetchTimeMs: fetchTime,
          cacheTimeMs: cacheTime,
          isCacheHit: cacheTime < 10, // Cache should be < 10ms
          tradeCount: unifiedData.tradeCount,
          hasTokenMetadata: !!unifiedData.steepness && !!unifiedData.floor,
          hasHoldersCount: unifiedData.holdersCount !== null,
          hasTokenHours: unifiedData.tokenHours.length > 0,
          hasTokenDays: unifiedData.tokenDays.length > 0,
        },
        data: {
          address: unifiedData.address,
          steepness: unifiedData.steepness,
          floor: unifiedData.floor,
          tokensBondedAt: unifiedData.tokensBondedAt,
          holdersCount: unifiedData.holdersCount,
          tradeCount: unifiedData.tradeCount,
          tokensBought: unifiedData.tokensBought,
          tokensSold: unifiedData.tokensSold,
          firstTrade: unifiedData.trades[0] || null,
          lastTrade: unifiedData.trades[unifiedData.trades.length - 1] || null,
          fetchedAt: new Date(unifiedData.fetchedAt).toISOString(),
        },
        cacheTest: {
          firstFetch: fetchTime,
          secondFetch: cacheTime,
          cacheWorking: cacheTime < 10 && cacheTime < fetchTime,
        },
      });
    } catch (error) {
      console.error('[Debug] Unified GoldSky test error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  // Test cache invalidation
  fastify.post('/api/v1/debug/unified-goldsky/:tokenAddress/invalidate', async (request, reply) => {
    try {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const unifiedService = (fastify as any).unifiedGoldSkyService;

      if (!unifiedService) {
        return reply.code(503).send({
          success: false,
          error: 'Unified GoldSky service not initialized',
        });
      }

      console.log(`[Debug] Invalidating unified cache for token: ${tokenAddress}`);

      // Fetch first to populate cache
      await unifiedService.getUnifiedTokenData(tokenAddress);

      // Invalidate
      unifiedService.invalidateToken(tokenAddress);

      // Fetch again (should be fresh)
      const freshData = await unifiedService.getUnifiedTokenData(tokenAddress);

      return reply.send({
        success: true,
        tokenAddress,
        message: 'Cache invalidated successfully',
        freshDataFetched: !!freshData,
        tradeCount: freshData?.tradeCount || 0,
      });
    } catch (error) {
      console.error('[Debug] Cache invalidation test error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Bonding Monitor Stats
  fastify.get('/api/v1/debug/bonding-monitor', async (request, reply) => {
    try {
      const bondingMonitor = (fastify as any).bondingMonitor;
      if (!bondingMonitor) {
        return reply.code(503).send({
          success: false,
          error: 'Bonding monitor not initialized',
        });
      }

      const stats = bondingMonitor.getStats();
      return reply.send({
        success: true,
        ...stats,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Test BitQuery Pool
  fastify.get('/api/v1/debug/bitquery/pool/:poolAddress', async (request, reply) => {
    try {
      const { poolAddress } = request.params as { poolAddress: string };
      const { BitQueryService } = await import('../services/bitquery-service');

      const bitquery = new BitQueryService();

      console.log(`[Debug] Testing BitQuery for pool: ${poolAddress}`);

      // Try to get recent swaps
      const swaps = await bitquery.getRecentSwaps(
        '0x0806a12b64fc2f7373a699fb25932a19fd35b557', // token address
        poolAddress,
        { limit: 10 },
      );

      console.log(`[Debug] Found ${swaps.length} swaps`);

      return reply.send({
        success: true,
        poolAddress,
        tradesFound: swaps.length,
        trades: swaps,
      });
    } catch (error) {
      console.error('[Debug] BitQuery test error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  fastify.get('/api/v1/debug/token/:tokenAddress', async (request, reply) => {
    const { tokenAddress } = request.params as { tokenAddress: string };

    try {
      // Check if token exists in database
      const token = await fastify.prisma.token.findUnique({
        where: { contractAddress: tokenAddress.toLowerCase() },
      });

      // OHLCV data removed - using real-time aggregation from subgraph

      // Try to fetch from subgraph
      const subgraphQuery = `{
        tokens(where: {address: "${tokenAddress.toLowerCase()}"}) {
          address
          symbol
          name
          bonded
          supply
          tradesCount
        }
        trades(
          where: {token: "${tokenAddress.toLowerCase()}"}
          orderBy: createdAt
          orderDirection: desc
          first: 5
        ) {
          id
          createdAt
          tokenAmount
          acesTokenAmount
        }
      }`;

      const subgraphResponse = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: subgraphQuery }),
      });

      const subgraphData = await subgraphResponse.json();

      return reply.send({
        success: true,
        tokenAddress,
        database: {
          exists: !!token,
          token,
        },
        subgraph: subgraphData,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
