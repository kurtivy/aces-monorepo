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
      quickNode: (adapterManager as any)['quickNode']?.isConnected() ?? false,
      goldsky: (adapterManager as any)['goldsky']?.isConnected() ?? false,
      aerodrome: (adapterManager as any)['aerodrome']?.isConnected() ?? false,
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
