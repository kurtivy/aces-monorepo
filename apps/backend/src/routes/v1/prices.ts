import { FastifyInstance } from 'fastify';
import { priceCacheService } from '../../services/price-cache-service';

export async function pricesRoutes(fastify: FastifyInstance) {
  fastify.get('/weth-usd', async (_request, reply) => {
    try {
      const data = await priceCacheService.getPrices();

      return reply.send({
        success: true,
        price: Number(data.wethUsd.toFixed(6)),
        usdc: Number(data.usdcUsd.toFixed(6)),
        usdt: Number(data.usdtUsd.toFixed(6)),
        updatedAt: new Date(data.updatedAt).toISOString(),
        isStale: data.isStale,
      });
    } catch (error) {
      fastify.log.error('[pricesRoutes] Failed to fetch cached WETH/USD price');
      return reply.code(500).send({ success: false, error: 'Failed to fetch price' });
    }
  });

  fastify.get('/aces-usd', async (_request, reply) => {
    try {
      const data = await priceCacheService.getPrices();

      return reply.send({
        success: true,
        data: {
          acesUsdPrice: Number(data.acesUsd.toFixed(6)),
          wethUsdPrice: Number(data.wethUsd.toFixed(6)),
          usdcUsdPrice: Number(data.usdcUsd.toFixed(6)),
          usdtUsdPrice: Number(data.usdtUsd.toFixed(6)),
          acesPerWeth: Number(data.acesPerWeth.toFixed(8)),
          updatedAt: new Date(data.updatedAt).toISOString(),
          isStale: data.isStale,
        },
      });
    } catch (error) {
      fastify.log.error('[pricesRoutes] Failed to fetch cached ACES/USD price');
      return reply.code(500).send({ success: false, error: 'Failed to fetch price' });
    }
  });

  fastify.post('/refresh', async (_request, reply) => {
    try {
      const data = await priceCacheService.forceRefresh();

      return reply.send({
        success: true,
        data: {
          acesUsdPrice: Number(data.acesUsd.toFixed(6)),
          wethUsdPrice: Number(data.wethUsd.toFixed(6)),
          usdcUsdPrice: Number(data.usdcUsd.toFixed(6)),
          usdtUsdPrice: Number(data.usdtUsd.toFixed(6)),
          acesPerWeth: Number(data.acesPerWeth.toFixed(8)),
          updatedAt: new Date(data.updatedAt).toISOString(),
          isStale: data.isStale,
        },
      });
    } catch (error) {
      fastify.log.error('[pricesRoutes] Failed to refresh cached prices');
      return reply.code(500).send({ success: false, error: 'Failed to refresh prices' });
    }
  });
}
