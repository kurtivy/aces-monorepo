// src/routes/webhooks/goldsky.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { priceCacheService } from '../../services/price-cache-service';

/**
 * GoldSky webhook payload structure for Trade entity
 * Matches the subgraph schema from goldsky-client.ts
 */
interface GoldSkyTradeWebhook {
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  data_source?: string;
  webhook_name?: string;
  webhook_id?: string;
  data: {
    id: string; // Transaction hash or unique trade ID
    token: {
      address: string;
      name: string;
      symbol: string;
    };
    trader: {
      address: string;
    };
    isBuy: boolean;
    tokenAmount: string;
    acesTokenAmount: string;
    protocolFeeAmount: string;
    subjectFeeAmount: string;
    supply: string;
    createdAt: string; // Unix timestamp as string
    blockNumber: string;
  };
}

export async function goldskyWebhookRoutes(fastify: FastifyInstance) {
  /**
   * Webhook endpoint for Trade entity events
   * This fires every time a new trade happens on the bonding curve
   * GoldSky will POST to this endpoint with trade data
   */
  fastify.post<{ Body: GoldSkyTradeWebhook }>(
    '/trade',
    async (request: FastifyRequest<{ Body: GoldSkyTradeWebhook }>, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        const { op, data } = request.body;

        // 1. VERIFY WEBHOOK SECRET
        const goldskySecret = request.headers['x-goldsky-signature'] as string;
        const expectedSecret = process.env.GOLDSKY_WEBHOOK_SECRET;

        if (!expectedSecret) {
          fastify.log.error('[GoldSky] GOLDSKY_WEBHOOK_SECRET not configured!');
          return reply.code(500).send({
            success: false,
            error: 'Server configuration error',
          });
        }

        if (goldskySecret !== expectedSecret) {
          fastify.log.warn(
            `[GoldSky] Invalid webhook signature - received: ${goldskySecret ? 'present' : 'missing'}`,
          );
          return reply.code(401).send({
            success: false,
            error: 'Unauthorized',
          });
        }

        // 2. ONLY PROCESS INSERT OPERATIONS (new trades)
        if (op !== 'INSERT') {
          fastify.log.debug(`[GoldSky] Skipping ${op} operation for trade ${data.id}`);
          return reply.code(200).send({
            success: true,
            message: `Skipped ${op} operation`,
          });
        }

        fastify.log.info(
          `[GoldSky] 📥 Processing new trade - ${data.token.symbol} (${data.token.address}) - Block: ${data.blockNumber}`,
        );

        // 3. FETCH CURRENT ACES USD PRICE
        let acesUsdPrice: number;
        let priceSource: string;

        try {
          const priceData = await priceCacheService.getPrices();
          acesUsdPrice = priceData.acesUsd;
          priceSource = priceData.isStale ? 'fallback' : 'aerodrome';

          fastify.log.info(
            `[GoldSky] 💰 ACES USD Price fetched: $${acesUsdPrice.toFixed(6)} (${priceSource})`,
          );

          // Validation: Ensure price is reasonable
          if (!isFinite(acesUsdPrice) || acesUsdPrice <= 0) {
            throw new Error(`Invalid ACES price: ${acesUsdPrice}`);
          }
        } catch (priceError) {
          fastify.log.error(
            `[GoldSky] ❌ Failed to fetch ACES price for trade ${data.id}: ${priceError}`,
          );

          // CRITICAL: If we can't get price, we should fail and let GoldSky retry
          return reply.code(500).send({
            success: false,
            error: 'Failed to fetch ACES price',
          });
        }

        // 4. STORE PRICE SNAPSHOT IN DATABASE
        try {
          // Access Prisma client from Fastify instance (following your pattern)
          await fastify.prisma.acesPriceSnapshot.create({
            data: {
              tradeId: data.id,
              tokenAddress: data.token.address.toLowerCase(),
              acesUsdPrice: acesUsdPrice.toString(),
              blockNumber: BigInt(data.blockNumber),
              timestamp: BigInt(data.createdAt),
              source: priceSource,
            },
          });

          const duration = Date.now() - startTime;

          fastify.log.info(
            `[GoldSky] ✅ Price snapshot stored for trade ${data.id} - $${acesUsdPrice.toFixed(6)} (${duration}ms)`,
          );

          return reply.code(200).send({
            success: true,
            data: {
              tradeId: data.id,
              acesUsdPrice: acesUsdPrice.toFixed(6),
              timestamp: data.createdAt,
              source: priceSource,
            },
          });
        } catch (dbError: unknown) {
          // Handle duplicate trade ID (idempotency)
          if (
            dbError &&
            typeof dbError === 'object' &&
            'code' in dbError &&
            dbError.code === 'P2002'
          ) {
            // Prisma unique constraint violation
            fastify.log.warn(`[GoldSky] ⚠️ Duplicate trade ID - already processed: ${data.id}`);

            return reply.code(200).send({
              success: true,
              message: 'Trade already processed (duplicate)',
              tradeId: data.id,
            });
          }

          // Other database errors should cause retry
          fastify.log.error(`[GoldSky] ❌ Database error for trade ${data.id}: ${dbError}`);

          throw dbError; // Will be caught by outer try-catch
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        fastify.log.error(`[GoldSky] ❌ Webhook processing failed (${duration}ms): ${errorMsg}`);

        return reply.code(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    },
  );

  /**
   * Health check endpoint for webhook
   */
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      success: true,
      message: 'GoldSky webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
    });
  });
}
