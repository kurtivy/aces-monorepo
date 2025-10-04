import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PortfolioService } from '../../services/portfolio-service';

interface PortfolioParams {
  walletAddress: string;
}

interface PortfolioQuery {
  includeMetrics?: string;
  limit?: number;
}

export async function portfolioRoutes(fastify: FastifyInstance) {
  const portfolioService = new PortfolioService(fastify.prisma);

  // GET /api/v1/portfolio/:walletAddress - Get user's complete portfolio
  fastify.get(
    '/:walletAddress',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            includeMetrics: z.string().optional().default('true'),
            limit: z.string().transform(Number).optional().default('100'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: PortfolioParams;
        Querystring: PortfolioQuery;
      }>,
      reply,
    ) => {
      try {
        const { walletAddress } = request.params;
        const { includeMetrics = 'true', limit = 100 } = request.query;

        console.log(`[API] Fetching portfolio for wallet: ${walletAddress}`);

        const portfolioData = await portfolioService.getUserPortfolio(walletAddress);

        // Limit holdings if requested
        const limitedHoldings = portfolioData.holdings.slice(0, limit);

        const response = {
          success: true,
          data: {
            walletAddress,
            holdings: limitedHoldings,
            ...(includeMetrics === 'true' && { metrics: portfolioData.metrics }),
            meta: {
              totalHoldings: portfolioData.holdings.length,
              returnedHoldings: limitedHoldings.length,
              hasMore: portfolioData.holdings.length > limit,
              lastUpdate: Date.now(),
            },
          },
        };

        reply.code(200).send(response);
      } catch (error) {
        console.error('[API] Portfolio fetch error:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to fetch portfolio data',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // GET /api/v1/portfolio/:walletAddress/summary - Get portfolio summary only
  fastify.get(
    '/:walletAddress/summary',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: PortfolioParams;
      }>,
      reply,
    ) => {
      try {
        const { walletAddress } = request.params;

        console.log(`[API] Fetching portfolio summary for: ${walletAddress}`);

        const portfolioData = await portfolioService.getUserPortfolio(walletAddress);

        reply.code(200).send({
          success: true,
          data: {
            walletAddress,
            metrics: portfolioData.metrics,
            topHoldings: portfolioData.holdings
              .sort((a, b) => parseFloat(b.currentValue) - parseFloat(a.currentValue))
              .slice(0, 5)
              .map((holding) => ({
                tokenAddress: holding.tokenAddress,
                tokenSymbol: holding.tokenSymbol,
                tokenName: holding.tokenName,
                currentValue: holding.currentValue,
                pnlPercentage: holding.pnlPercentage,
                allocation: holding.allocation,
              })),
            lastUpdate: Date.now(),
          },
        });
      } catch (error) {
        console.error('[API] Portfolio summary error:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to fetch portfolio summary',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // GET /api/v1/portfolio/:walletAddress/token/:tokenAddress - Get specific token holding
  fastify.get(
    '/:walletAddress/token/:tokenAddress',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: PortfolioParams & { tokenAddress: string };
      }>,
      reply,
    ) => {
      try {
        const { walletAddress, tokenAddress } = request.params;

        console.log(`[API] Fetching ${tokenAddress} holding for ${walletAddress}`);

        const portfolioData = await portfolioService.getUserPortfolio(walletAddress);
        const tokenHolding = portfolioData.holdings.find(
          (h) => h.tokenAddress.toLowerCase() === tokenAddress.toLowerCase(),
        );

        if (!tokenHolding) {
          reply.code(404).send({
            success: false,
            error: 'Token holding not found',
            details: `No holding found for token ${tokenAddress}`,
          });
          return;
        }

        reply.code(200).send({
          success: true,
          data: {
            walletAddress,
            tokenAddress,
            holding: tokenHolding,
            lastUpdate: Date.now(),
          },
        });
      } catch (error) {
        console.error('[API] Token holding fetch error:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to fetch token holding',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
