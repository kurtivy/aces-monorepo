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
  // Trade webhook handler (shared logic)
  const handleTradeWebhook = async (
    request: FastifyRequest<{ Body: GoldSkyTradeWebhook }>,
    reply: FastifyReply,
  ) => {
      const startTime = Date.now();

      // Log incoming request with clear visual separator
      console.log('\n========================================');
      console.log('[GoldSky Webhook] 🎯 INCOMING REQUEST');
      console.log('========================================');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Headers:', JSON.stringify(request.headers, null, 2));
      console.log('Body:', JSON.stringify(request.body, null, 2));

      try {
        const { op, data } = request.body;

        // 1. VERIFY WEBHOOK SECRET
        console.log('\n[GoldSky] 🔐 Checking webhook secret...');
        const goldskySecret = request.headers['x-goldsky-signature'] as string;
        const expectedSecret = process.env.GOLDSKY_WEBHOOK_SECRET;
        console.log('Expected secret set:', !!expectedSecret);
        console.log('Received signature header:', goldskySecret ? 'PRESENT' : 'MISSING');

        if (!expectedSecret) {
          console.log('[GoldSky] ❌ GOLDSKY_WEBHOOK_SECRET not configured!');
          fastify.log.error('[GoldSky] GOLDSKY_WEBHOOK_SECRET not configured!');
          return reply.code(500).send({
            success: false,
            error: 'Server configuration error',
          });
        }

        if (goldskySecret !== expectedSecret) {
          console.log('[GoldSky] ❌ Invalid webhook signature');
          fastify.log.warn(
            `[GoldSky] Invalid webhook signature - received: ${goldskySecret ? 'present' : 'missing'}`,
          );
          return reply.code(401).send({
            success: false,
            error: 'Unauthorized',
          });
        }

        console.log('[GoldSky] ✅ Webhook secret verified');

        // 2. ONLY PROCESS INSERT OPERATIONS (new trades)
        console.log('\n[GoldSky] 📋 Operation type:', op);
        if (op !== 'INSERT') {
          console.log(`[GoldSky] ⏭️ Skipping ${op} operation for trade ${data.id}`);
          fastify.log.debug(`[GoldSky] Skipping ${op} operation for trade ${data.id}`);
          return reply.code(200).send({
            success: true,
            message: `Skipped ${op} operation`,
          });
        }

        console.log(
          `\n[GoldSky] 📥 Processing new trade - ${data.token.symbol} (${data.token.address}) - Block: ${data.blockNumber}`,
        );
        fastify.log.info(
          `[GoldSky] 📥 Processing new trade - ${data.token.symbol} (${data.token.address}) - Block: ${data.blockNumber}`,
        );

        // 3. FETCH CURRENT ACES USD PRICE
        let acesUsdPrice: number;
        let priceSource: string;

        try {
          console.log('\n[GoldSky] 💰 Fetching ACES USD price...');
          const priceData = await priceCacheService.getPrices();
          acesUsdPrice = priceData.acesUsd;
          priceSource = priceData.isStale ? 'fallback' : 'aerodrome';

          console.log('[GoldSky] 💰 Price Data:');
          console.log('  ACES USD:', acesUsdPrice);
          console.log('  Source:', priceSource);
          console.log('  Is Stale:', priceData.isStale);

          fastify.log.info(
            `[GoldSky] 💰 ACES USD Price fetched: $${acesUsdPrice.toFixed(6)} (${priceSource})`,
          );

          // Validation: Ensure price is reasonable
          if (!isFinite(acesUsdPrice) || acesUsdPrice <= 0) {
            throw new Error(`Invalid ACES price: ${acesUsdPrice}`);
          }
        } catch (priceError) {
          console.log('[GoldSky] ❌ Failed to fetch ACES price:', priceError);
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
          console.log('\n[GoldSky] 💾 Storing to database:');
          console.log('  Trade ID:', data.id);
          console.log('  Token:', data.token.address);
          console.log('  Block Number:', data.blockNumber);
          console.log('  Timestamp:', data.createdAt);
          console.log('  ACES Price:', acesUsdPrice);
          console.log('  Source:', priceSource);

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

          console.log('\n[GoldSky] ✅ SUCCESS - Price snapshot stored');
          console.log('  Duration:', duration, 'ms');
          console.log('========================================\n');

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
            console.log(`[GoldSky] ⚠️ Duplicate trade ID - already processed: ${data.id}`);
            console.log('========================================\n');
            fastify.log.warn(`[GoldSky] ⚠️ Duplicate trade ID - already processed: ${data.id}`);

            return reply.code(200).send({
              success: true,
              message: 'Trade already processed (duplicate)',
              tradeId: data.id,
            });
          }

          // Other database errors should cause retry
          console.log(`[GoldSky] ❌ Database error for trade ${data.id}:`, dbError);
          console.log('========================================\n');
          fastify.log.error(`[GoldSky] ❌ Database error for trade ${data.id}: ${dbError}`);

          throw dbError; // Will be caught by outer try-catch
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        console.log(`\n[GoldSky] ❌ Webhook processing failed (${duration}ms): ${errorMsg}`);
        console.log('========================================\n');
        fastify.log.error(`[GoldSky] ❌ Webhook processing failed (${duration}ms): ${errorMsg}`);

        return reply.code(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
  };

  /**
   * Webhook endpoint for Trade entity events
   * This fires every time a new trade happens on the bonding curve
   * GoldSky will POST to this endpoint with trade data
   * Supports both /trade and /trade/ (with/without trailing slash)
   */
  fastify.post<{ Body: GoldSkyTradeWebhook }>('/trade', handleTradeWebhook);
  fastify.post<{ Body: GoldSkyTradeWebhook }>('/trade/', handleTradeWebhook);

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

  /**
   * Test endpoint to simulate GoldSky webhook locally
   * GET to /api/webhooks/goldsky/test to get test payload and curl command
   */
  fastify.get('/test', async (request, reply) => {
    console.log('\n[Test Webhook] 🧪 Generating test payload...');

    const testPayload: GoldSkyTradeWebhook = {
      op: 'INSERT',
      data_source: 'test',
      webhook_name: 'test-webhook',
      webhook_id: 'test-id',
      data: {
        id: `test-trade-${Date.now()}`,
        token: {
          address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
        },
        trader: {
          address: '0x0987654321098765432109876543210987654321',
        },
        isBuy: true,
        tokenAmount: '1000000000000000000',
        acesTokenAmount: '500000000000000000',
        protocolFeeAmount: '50000000000000000',
        subjectFeeAmount: '50000000000000000',
        supply: '10000000000000000000',
        createdAt: Math.floor(Date.now() / 1000).toString(),
        blockNumber: '12345678',
      },
    };

    const testSecret = process.env.GOLDSKY_WEBHOOK_SECRET || 'your-secret-here';
    const port = (request.socket as any).localPort || 3001;
    const baseUrl =
      request.hostname === 'localhost' ? `http://localhost:${port}` : `https://${request.hostname}`;

    const curlCommand = `curl -X POST ${baseUrl}/api/webhooks/goldsky/trade \\
  -H "Content-Type: application/json" \\
  -H "x-goldsky-signature: ${testSecret}" \\
  -d '${JSON.stringify(testPayload)}'`;

    console.log('[Test Webhook] ✅ Test payload generated');
    console.log('\nTo test the webhook, run this command:');
    console.log(curlCommand);

    return reply.send({
      message: 'GoldSky webhook test helper',
      instructions: 'Copy and run the curl command below to test the /trade endpoint',
      payload: testPayload,
      curlCommand,
      notes: [
        'This simulates what GoldSky would send when a trade occurs',
        'The webhook secret is automatically included in the header',
        'Check your console logs for detailed processing output',
        'Verify the database with: npx prisma studio',
      ],
    });
  });
}
