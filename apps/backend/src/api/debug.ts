// backend/routes/api/v1/debug.ts (NEW)
import { FastifyInstance } from 'fastify';

export async function debugRoutes(fastify: FastifyInstance) {
  // Only enable in development
  //   if (process.env.NODE_ENV === 'production') {
  //     return;
  //   }

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
