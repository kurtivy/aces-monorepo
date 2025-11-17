// src/routes/webhooks/goldsky.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { priceCacheService } from '../../services/price-cache-service';
import { clearBondingDataCache } from '../v1/bonding-data'; // 🔥 NEW: Cache invalidation
import { getMemoryStore } from '../../services/goldsky-memory-store'; // 🚀 NEW: In-memory store

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
  // Trade webhook handler (shared logic) - Supports BATCHED requests
  const handleTradeWebhook = async (
    request: FastifyRequest<{ Body: GoldSkyTradeWebhook | GoldSkyTradeWebhook[] }>,
    reply: FastifyReply,
  ) => {
    const startTime = Date.now();
    
    // Detect if this is a batched request and normalize to array
    const trades: GoldSkyTradeWebhook[] = Array.isArray(request.body) 
      ? request.body 
      : [request.body];
    const isBatched = Array.isArray(request.body);

    // Log incoming request with clear visual separator
    console.log('\n========================================');
    console.log(`[GoldSky Webhook] 🎯 INCOMING ${isBatched ? 'BATCHED' : 'SINGLE'} REQUEST`);
    console.log('========================================');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Batch size:', trades.length);
    console.log('Headers:', JSON.stringify(request.headers, null, 2));
    if (!isBatched || trades.length <= 3) {
      console.log('Body:', JSON.stringify(request.body, null, 2));
    } else {
      console.log('Body (truncated):', `${trades.length} trades in batch`);
    }

    try {
      // 1. VERIFY WEBHOOK SECRET
      console.log('\n[GoldSky] 🔐 Checking webhook secret...');
      // Goldsky Webhook Sink can use custom headers (x-webhook-secret or goldsky-webhook-secret)
      const goldskySecret = 
        (request.headers['x-webhook-secret'] as string) || 
        (request.headers['goldsky-webhook-secret'] as string);
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
      
      // 2. PROCESS ALL TRADES IN BATCH
      let processed = 0;
      let skipped = 0;
      let errors = 0;
      
      for (const webhookPayload of trades) {
        try {
          await processSingleTrade(webhookPayload, fastify);
          processed++;
        } catch (error) {
          errors++;
          console.error('[GoldSky] Error processing trade:', error);
        }
      }
      
      const duration = Date.now() - startTime;
      console.log('\n========================================');
      console.log('[GoldSky] 📊 BATCH PROCESSING COMPLETE');
      console.log('========================================');
      console.log('Total trades:', trades.length);
      console.log('Processed:', processed);
      console.log('Skipped:', skipped);
      console.log('Errors:', errors);
      console.log('Duration:', duration + 'ms');
      console.log('Avg per trade:', Math.round(duration / trades.length) + 'ms');
      
      return reply.code(200).send({
        success: true,
        processed,
        skipped,
        errors,
        duration,
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[GoldSky] ❌ Batch processing error:', errorMsg);
      fastify.log.error(`[GoldSky] Batch processing error: ${errorMsg}`);
      return reply.code(500).send({
        success: false,
        error: errorMsg,
        duration,
      });
    }
  };
  
  // Process a single trade from the batch
  const processSingleTrade = async (
    webhookPayload: GoldSkyTradeWebhook,
    fastify: FastifyInstance,
  ): Promise<void> => {
    const startTime = Date.now();
    
    // GoldSky payload structure: op and data.new (not data directly)
    const { op, data: payloadData } = webhookPayload;
    const data = (payloadData as any)?.new || payloadData;

    // 1. ONLY PROCESS INSERT OPERATIONS (new trades)
    console.log('\n[GoldSky] 📋 Operation type:', op);
    if (op !== 'INSERT') {
      console.log(`[GoldSky] ⏭️ Skipping ${op} operation for trade ${data.id}`);
      return; // Skip silently
    }

    // Extract fields from GoldSky's format (snake_case)
    const tradeId = data.id;
    const tokenAddress = data.token;
    const blockNumber = data.block_number;
    const timestamp = data.created_at;
    const supplyWei = data.supply;

    console.log(
      `\n[GoldSky] 📥 Processing trade - Token: ${tokenAddress} - Block: ${blockNumber} - Supply: ${supplyWei}`,
    );

    // 2. FETCH CURRENT ACES USD PRICE
    let acesUsdPrice: number;
    let priceSource: string;

    try {
      const priceData = await priceCacheService.getPrices();
      acesUsdPrice = priceData.acesUsd;
      priceSource = priceData.isStale ? 'fallback' : 'aerodrome';

      console.log(`[GoldSky] 💰 ACES Price: $${acesUsdPrice.toFixed(6)} (${priceSource})`);

      // Validation: Ensure price is reasonable
      if (!isFinite(acesUsdPrice) || acesUsdPrice <= 0) {
        throw new Error(`Invalid ACES price: ${acesUsdPrice}`);
      }
    } catch (priceError) {
      console.error('[GoldSky] ❌ Failed to fetch ACES price:', priceError);
      throw new Error('Failed to fetch ACES price'); // Will be caught by batch handler
    }

    // 3. STORE PRICE SNAPSHOT IN DATABASE
    try {
      console.log('[GoldSky] 💾 Storing to database...');

      // Access Prisma client from Fastify instance (following your pattern)
      await fastify.prisma.acesPriceSnapshot.create({
        data: {
          tradeId: tradeId,
          tokenAddress: tokenAddress.toLowerCase(),
          acesUsdPrice: acesUsdPrice.toString(),
          blockNumber: BigInt(blockNumber),
          timestamp: BigInt(timestamp),
          source: priceSource,
        },
      });

      const duration = Date.now() - startTime;
      console.log(`[GoldSky] ✅ Price snapshot stored (${duration}ms)`);

      // 4. Invalidate bonding data cache for this token
      const clearedCount = clearBondingDataCache(tokenAddress);
      console.log(`[GoldSky] 🗑️ Invalidated ${clearedCount} cache entries`);

      // 5. 🚀 Store trade in memory for real-time WebSocket streaming
      const memoryStore = getMemoryStore();
      memoryStore.storeTrade({
        id: tradeId,
        tokenAddress: tokenAddress,
        trader: data.trader || 'unknown',
        isBuy: data.is_buy || false,
        tokenAmount: data.token_amount || '0',
        acesAmount: data.aces_token_amount || '0',
        pricePerToken: '0',
        priceUsd: acesUsdPrice.toString(),
        supply: supplyWei,
        timestamp: parseInt(timestamp) * 1000,
        blockNumber: parseInt(blockNumber),
        transactionHash: tradeId,
        dataSource: 'goldsky' as const,
      });
      console.log('[GoldSky] 🧠 Stored in memory for WebSocket streaming');

      // 6. Store bonding status in memory
      memoryStore.storeBondingStatus({
        tokenAddress: tokenAddress,
        isBonded: false,
        supply: supplyWei,
        bondingProgress: 0,
        poolAddress: undefined,
        graduatedAt: undefined,
      });

      console.log(`[GoldSky] ✅ Trade processed successfully: ${tradeId}`);
      
    } catch (dbError: unknown) {
      // Handle duplicate trade ID (idempotency)
      if (
        dbError &&
        typeof dbError === 'object' &&
        'code' in dbError &&
        dbError.code === 'P2002'
      ) {
        console.log(`[GoldSky] ⚠️ Duplicate trade (already processed): ${tradeId}`);
        return; // Skip duplicate, don't throw
      }

      // Other database errors should cause retry
      console.error(`[GoldSky] ❌ Database error for trade ${tradeId}:`, dbError);
      throw dbError;
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
