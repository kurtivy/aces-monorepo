// backend/routes/api/v1/debug.ts (NEW)
import { FastifyInstance } from 'fastify';

export async function debugRoutes(fastify: FastifyInstance) {
  // Only enable in development
  //   if (process.env.NODE_ENV === 'production') {
  //     return;
  //   }

  // 🚀 NEW: WebSocket Gateway Stats (replaces old bonding monitor)
  // Use /api/v1/ws/stats instead (this is just a redirect)
  fastify.get('/api/v1/debug/websocket-stats', async (request, reply) => {
    return reply.redirect('/api/v1/ws/stats');
  });

  // 🔍 NEW: Check adapter connection status
  fastify.get('/api/v1/debug/adapter-status', async (request, reply) => {
    const adapterManager = fastify.adapterManager;
    
    if (!adapterManager) {
      return reply.send({
        success: false,
        error: 'AdapterManager not initialized',
      });
    }

    // Get individual adapter status
    const status = {
      isConnected: adapterManager.isConnected(),
      quickNode: adapterManager['quickNode']?.isConnected() ?? false,
      goldsky: adapterManager['goldsky']?.isConnected() ?? false,
      bitQuery: adapterManager['bitQuery']?.isConnected() ?? false,
      aerodrome: adapterManager['aerodrome']?.isConnected() ?? false,
    };

    return reply.send({
      success: true,
      data: status,
    });
  });

  // 🔍 NEW: List all registered Fastify routes
  fastify.get('/api/v1/debug/routes', async (request, reply) => {
    const routes = fastify.printRoutes({ commonPrefix: false });
    return reply.send({
      success: true,
      routes: routes,
      routesList: fastify.printRoutes({ commonPrefix: false, includeHooks: false }),
    });
  });

  // Test BitQuery Pool
  fastify.get('/api/v1/debug/bitquery/pool/:poolAddress', async (request, reply) => {
    try {
      const { poolAddress } = request.params as { poolAddress: string };
      const { BitQueryService } = await import('../services/bitquery-service');

      const bitquery = new BitQueryService(
        fastify.acesUsdPriceService,
        fastify.rateLimitMonitor,
      );

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
