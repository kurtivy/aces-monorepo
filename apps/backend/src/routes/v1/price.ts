import { FastifyInstance } from 'fastify';
import { PriceService } from '../../services/price-service';

export const priceRoutes = async (fastify: FastifyInstance) => {
  const priceService = new PriceService(fastify.prisma);

  // Get ACES price in USD
  fastify.get('/aces', async (request, reply) => {
    try {
      const priceData = await priceService.getAcesPrice();

      reply.send({
        success: true,
        data: {
          symbol: 'ACES',
          priceUSD: parseFloat(priceData.priceUSD).toFixed(2),
          updatedAt: priceData.updatedAt,
          isStale: priceData.isStale,
        },
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch ACES price',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Convert ACES amount to USD
  fastify.get<{
    Querystring: { amount: string };
  }>('/convert', async (request, reply) => {
    try {
      const { amount } = request.query;

      if (!amount || isNaN(parseFloat(amount))) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid amount parameter',
        });
      }

      const usdValue = await priceService.convertAcesToUsd(amount);
      const priceData = await priceService.getAcesPrice();

      reply.send({
        success: true,
        data: {
          acesAmount: amount,
          usdValue: usdValue,
          acesPrice: parseFloat(priceData.priceUSD).toFixed(2),
          isStale: priceData.isStale,
        },
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to convert amount',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Health check endpoint for price service
  fastify.get('/health', async (request, reply) => {
    try {
      const healthData = await priceService.healthCheck();

      reply.send({
        success: true,
        data: healthData,
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Price service health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
