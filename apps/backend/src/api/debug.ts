// backend/routes/api/v1/debug.ts (NEW)
import { FastifyInstance } from 'fastify';

export async function debugRoutes(fastify: FastifyInstance) {
  // Only enable in development
  //   if (process.env.NODE_ENV === 'production') {
  //     return;
  //   }

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

      // Check if we have any OHLCV data
      const ohlcvCount = await fastify.prisma.tokenOHLCV.count({
        where: { contractAddress: tokenAddress.toLowerCase() },
      });

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
          ohlcvRecords: ohlcvCount,
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
