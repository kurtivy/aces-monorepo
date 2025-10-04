import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
// Import services with type assertions to avoid compilation issues
import { TokenService } from '../../../services/token-service';
import { OHLCVService } from '../../../services/ohlcv-service';

export async function cronRoutes(fastify: FastifyInstance) {
  // Manual trigger endpoint for testing
  fastify.post('/api/v1/cron/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({ error: 'Not allowed in production' });
    }

    try {
      const startTime = Date.now();
      const activeTokensFromSubgraph = await getActiveTokensFromSubgraph(fastify.prisma);

      const tokenService = new TokenService(fastify.prisma);
      const ohlcvService = new OHLCVService(fastify.prisma, tokenService);

      const results = {
        processed: 0,
        errors: 0,
        tokenResults: [] as any[],
      };

      for (const tokenData of activeTokensFromSubgraph) {
        try {
          await syncTokenData(tokenData, tokenService, ohlcvService, fastify.prisma);
          results.processed++;
          results.tokenResults.push({
            address: tokenData.address,
            symbol: tokenData.symbol,
            status: 'success',
          });
        } catch (error) {
          results.errors++;
          results.tokenResults.push({
            address: tokenData.address,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        message: 'Manual trigger completed',
        duration: `${duration}ms`,
        results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Status endpoint to check cron health
  fastify.get('/api/v1/cron/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const recentSync = await fastify.prisma.token.findFirst({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          contractAddress: true,
          symbol: true,
          updatedAt: true,
        },
      });

      const totalTokens = await fastify.prisma.token.count();
      const activeTokens = await fastify.prisma.token.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
          },
        },
      });

      return reply.send({
        success: true,
        cronEnabled: process.env.ENABLE_CRON === 'true',
        lastSync: recentSync,
        totalTokens,
        activeTokens,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

async function getActiveTokensFromSubgraph(prisma: PrismaClient) {
  try {
    // Single query to get all tokens with activity filtering
    const query = `{
      tokens(first: 50, orderBy: tradesCount, orderDirection: desc) {
        id
        address
        name
        symbol
        tradesCount
        tokensBought
        tokensSold
        bonded
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

    const result = (await response.json()) as any;
    if (result.errors) {
      throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
    }

    const allTokens = result.data?.tokens || [];

    // Get database tokens that have been recently viewed/updated
    const recentlyViewedTokens = await getRecentlyViewedTokens(prisma);

    // Filter to only active tokens (have trades OR recently viewed)
    const activeTokens = allTokens.filter(
      (token: any) =>
        token.tradesCount > 0 || recentlyViewedTokens.includes(token.address.toLowerCase()),
    );

    console.log(
      `[CRON] Found ${activeTokens.length} active tokens out of ${allTokens.length} total`,
    );
    return activeTokens;
  } catch (error) {
    console.error('[CRON] Error fetching tokens from subgraph:', error);

    // Fallback: get recently viewed tokens from database
    const fallbackTokens = await prisma.token.findMany({
      where: {
        isActive: true,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
      },
      select: {
        contractAddress: true,
        symbol: true,
      },
    });

    return fallbackTokens.map((t) => ({
      address: t.contractAddress,
      symbol: t.symbol,
      tradesCount: 0,
    }));
  }
}

async function getRecentlyViewedTokens(prisma: PrismaClient): Promise<string[]> {
  // Get tokens that users have interacted with recently
  const recentTokens = await prisma.token.findMany({
    where: {
      updatedAt: {
        gte: new Date(Date.now() - 6 * 60 * 60 * 1000), // Last 6 hours
      },
    },
    select: {
      contractAddress: true,
    },
  });

  return recentTokens.map((t) => t.contractAddress.toLowerCase());
}

async function syncTokenData(
  tokenData: any,
  tokenService: any,
  ohlcvService: any,
  prisma: PrismaClient,
) {
  const contractAddress = tokenData.address;

  // Skip dormant tokens unless recently viewed
  if (tokenData.tradesCount === 0) {
    console.log(`[CRON] Skipping dormant token ${tokenData.symbol} (${contractAddress})`);
    return;
  }

  // Use database transaction for atomicity with increased timeout
  await prisma.$transaction(
    async (tx) => {
      // Update the services to use the transaction client
      const txTokenService = new TokenService(tx as any);
      const txOhlcvService = new OHLCVService(tx as any, txTokenService);

      // 1. Fetch and update basic token data
      await txTokenService.fetchAndUpdateTokenData(contractAddress);

      // 2. Generate cached data for ALL active timeframes
      const allTimeframes = ['1m', '5m', '15m', '1h', '4h']; // Added minute timeframes

      for (const timeframe of allTimeframes) {
        await txOhlcvService.generateOHLCVCandles(contractAddress, timeframe);
        console.log(`[CRON] Generated ${timeframe} candles for ${tokenData.symbol}`);
      }

      // 3. Update the token's lastSyncedAt timestamp
      await tx.token.update({
        where: { contractAddress: contractAddress.toLowerCase() },
        data: { updatedAt: new Date() },
      });
    },
    {
      timeout: 90000, // 90 seconds timeout to handle all 5 timeframes
    },
  );
}
