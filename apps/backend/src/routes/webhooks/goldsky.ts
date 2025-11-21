// src/routes/webhooks/goldsky.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { priceCacheService } from '../../services/price-cache-service';
import { clearBondingDataCache } from '../v1/bonding-data'; // 🔥 NEW: Cache invalidation
import { getMemoryStore } from '../../services/goldsky-memory-store'; // 🚀 NEW: In-memory store
import Decimal from 'decimal.js';

/**
 * Helper function to convert scientific notation numbers to full decimal strings
 * Goldsky sends large numbers like 1.208373e+24 which need to be converted to full integer strings
 */
function toFullDecimalString(value: any): string {
  if (value === null || value === undefined || value === '') return '0';
  
  // If already a string without scientific notation, return as-is
  if (typeof value === 'string' && !value.includes('e') && !value.includes('E')) {
    return value;
  }
  
  // Convert to number first, then to BigInt-compatible string
  const num = typeof value === 'number' ? value : parseFloat(value);
  
  if (!Number.isFinite(num) || num === 0) return '0';
  
  // Use toLocaleString with fullwide to get full decimal representation
  // This prevents scientific notation
  return num.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
}

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
    } | string;
    trader: {
      address: string;
    } | string;
    isBuy: boolean;
    tokenAmount?: string;
    acesTokenAmount?: string;
    protocolFeeAmount?: string;
    subjectFeeAmount?: string;
    supply: string;
    createdAt?: string; // Unix timestamp as string
    blockNumber?: string;
    // Flexible extra fields for pipeline payloads
    token_address?: string;
    token_amount?: string;
    aces_token_amount?: string;
    created_at?: string;
    block_number?: string;
    is_buy?: boolean;
    timestamp?: number | string;
    transaction_hash?: string;
  };
}

export async function goldskyWebhookRoutes(fastify: FastifyInstance) {
  /**
   * Normalize pipeline (SQL transform) payloads into the shape expected by processSingleTrade
   */
  const normalizePipelineTrade = (raw: any): GoldSkyTradeWebhook => {
    const tokenAddress =
      raw?.token_address ||
      raw?.token ||
      (raw?.token?.address as string | undefined) ||
      raw?.tokenAddress ||
      '';

    const traderAddress =
      raw?.trader?.address ||
      raw?.trader ||
      (typeof raw?.trader === 'string' ? raw.trader : undefined) ||
      'unknown';

    // Prefer explicit timestamp, fall back to created_at, then now (seconds)
    const timestampSeconds = (() => {
      if (raw?.timestamp != null) return Number(raw.timestamp);
      if (raw?.created_at != null) return Number(raw.created_at);
      if (raw?.createdAt != null) return Number(raw.createdAt);
      return Math.floor(Date.now() / 1000);
    })();

    const blockNumber =
      raw?.block_number ?? raw?.blockNumber ?? raw?.block_number ?? raw?.block_number ?? '0';

    const id =
      raw?.id ||
      raw?.transaction_hash ||
      raw?.transactionHash ||
      `pipeline-${tokenAddress}-${Date.now()}`;

    return {
      op: 'INSERT',
      data: {
        id,
        token: tokenAddress,
        trader: traderAddress,
        isBuy: Boolean(raw?.is_buy ?? raw?.isBuy),
        // 🔥 FIX: Convert scientific notation to full decimal string
        // Goldsky sends numbers like 1.208373e+24, need to convert to full integer string
        tokenAmount: toFullDecimalString(raw?.token_amount ?? raw?.tokenAmount ?? '0'),
        acesTokenAmount: toFullDecimalString(raw?.aces_token_amount ?? raw?.acesAmount ?? raw?.acesTokenAmount ?? '0'),
        protocolFeeAmount: toFullDecimalString(raw?.protocol_fee_amount ?? raw?.protocolFeeAmount ?? '0'),
        subjectFeeAmount: toFullDecimalString(raw?.subject_fee_amount ?? raw?.subjectFeeAmount ?? '0'),
        supply: toFullDecimalString(raw?.supply ?? '0'),
        createdAt: String(timestampSeconds),
        blockNumber: String(blockNumber),
        // Also expose snake_case fields for downstream compatibility
        token_address: tokenAddress,
        // 🔥 FIX: Convert scientific notation to full decimal string
        token_amount: toFullDecimalString(raw?.token_amount ?? raw?.tokenAmount ?? '0'),
        aces_token_amount: toFullDecimalString(raw?.aces_token_amount ?? raw?.acesAmount ?? raw?.acesTokenAmount ?? '0'),
        created_at: String(timestampSeconds),
        block_number: String(blockNumber),
        is_buy: Boolean(raw?.is_buy ?? raw?.isBuy),
        transaction_hash: raw?.transaction_hash ?? raw?.transactionHash ?? id,
        timestamp: timestampSeconds,
      },
    };
  };

  /**
   * Shared batch processor used by both the original webhook and the pipeline-compatible alias.
   */
  const processTradeBatch = async (
    trades: GoldSkyTradeWebhook[],
    reply: FastifyReply,
    sourceLabel: string,
  ) => {
    const startTime = Date.now();
    const isBatched = trades.length > 1;

    console.log('\n========================================');
    console.log(`[GoldSky Webhook] 🎯 INCOMING ${isBatched ? 'BATCHED' : 'SINGLE'} REQUEST`);
    console.log('========================================');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Batch size:', trades.length);
    console.log('Source:', sourceLabel);
    console.log(
      '[GoldSky Webhook] Tokens in batch:',
      trades.map((t) => (t.data as any)?.token || (t.data as any)?.token_address || 'unknown'),
    );

    if (!isBatched || trades.length <= 3) {
      console.log('Body:', JSON.stringify(trades, null, 2));
    } else {
      console.log('Body (truncated):', `${trades.length} trades in batch`);
    }

    try {
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

  // Trade webhook handler (shared logic) - Supports BATCHED requests
  const handleTradeWebhook = async (
    request: FastifyRequest<{ Body: GoldSkyTradeWebhook | GoldSkyTradeWebhook[] }>,
    reply: FastifyReply,
  ) => {
    // Detect if this is a batched request and normalize to array
    const trades: GoldSkyTradeWebhook[] = Array.isArray(request.body)
      ? request.body
      : [request.body];

    // 1. VERIFY WEBHOOK SECRET (existing behavior)
    console.log('\n[GoldSky] 🔐 Checking webhook secret...');
    const goldskySecret =
      (request.headers['x-webhook-secret'] as string) ||
      (request.headers['goldsky-webhook-secret'] as string) ||
      (request.headers['x-goldsky-signature'] as string) || // Goldsky default header
      (request.headers['x-goldsky-webhook-signature'] as string) ||
      (request.headers['x-goldsky-secret'] as string);
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

    return processTradeBatch(trades, reply, 'goldsky-webhook');
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

    // Validate token address to avoid polluting the memory store with empty keys
    if (!tokenAddress || typeof tokenAddress !== 'string' || tokenAddress.trim() === '') {
      const message = `[GoldSky] ❌ Missing token address in webhook payload, skipping trade ${tradeId}`;
      console.error(message, { tradeId, tokenAddress, source: webhookPayload?.data_source || 'unknown' });
      throw new Error('Missing token address in GoldSky webhook payload');
    }

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
      // Normalize amounts out of wei to keep frontend math consistent
      const tokenAmountWei = new Decimal(toFullDecimalString(data.token_amount || '0'));
      const acesAmountWei = new Decimal(toFullDecimalString(data.aces_token_amount || '0'));
      const supplyWei = new Decimal(toFullDecimalString(supplyWei || '0'));

      const tokenAmount = tokenAmountWei.div(new Decimal('1e18'));
      const acesAmount = acesAmountWei.div(new Decimal('1e18'));
      const supply = supplyWei.div(new Decimal('1e18'));

      // Compute per-token price in ACES and USD
      const pricePerTokenAces =
        tokenAmount.gt(0) && acesAmount.gt(0)
          ? acesAmount.div(tokenAmount)
          : new Decimal(0);
      const priceUsdAtTrade = pricePerTokenAces.mul(acesUsdPrice);

      memoryStore.storeTrade({
        id: tradeId,
        tokenAddress: tokenAddress,
        trader: data.trader || 'unknown',
        isBuy: data.is_buy || false,
        tokenAmount: tokenAmount.toFixed(), // human-readable units
        acesAmount: acesAmount.toFixed(),
        pricePerToken: pricePerTokenAces.toFixed(),
        priceUsd: priceUsdAtTrade.toFixed(),
        // 🔥 FIX: Convert supply to human-readable units
        supply: supply.toFixed(),
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
        // 🔥 FIX: Convert supply to full decimal string
        supply: toFullDecimalString(supplyWei || '0'),
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
   * Pipeline-compatible alias (plural route) that accepts the SQL transform payload
   * and normalizes it before handing off to the existing processor.
   */
  fastify.post<{ Body: Record<string, any> | Record<string, any>[] }>(
    '/trades',
    async (request, reply) => {
      // Verify webhook secret (same as legacy route)
      const goldskySecret =
        (request.headers['x-webhook-secret'] as string) ||
        (request.headers['goldsky-webhook-secret'] as string);
      const expectedSecret = process.env.GOLDSKY_WEBHOOK_SECRET;

      if (!expectedSecret) {
        console.log('[GoldSky] ❌ GOLDSKY_WEBHOOK_SECRET not configured!');
        fastify.log.error('[GoldSky] GOLDSKY_WEBHOOK_SECRET not configured!');
        return reply.code(500).send({
          success: false,
          error: 'Server configuration error',
        });
      }

      if (goldskySecret !== expectedSecret) {
        console.log('[GoldSky] ❌ Invalid webhook signature (pipeline alias)');
        fastify.log.warn(
          `[GoldSky] Invalid webhook signature on /trades - received: ${goldskySecret ? 'present' : 'missing'}`,
        );
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
        });
      }

      const payloadArray = Array.isArray(request.body) ? request.body : [request.body];
      const normalizedTrades = payloadArray.map(normalizePipelineTrade);

      return processTradeBatch(normalizedTrades, reply, 'goldsky-pipeline-alias');
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
