/**
 * GET /api/tokens/:address/health/stream
 *
 * Server-Sent Events (SSE) stream of token health. Pushes the same shape as the
 * one-shot health endpoint at an interval. Uses shared cache (5s TTL, dedupe)
 * so RPC/Alchemy is not hit more than once per 5s per token — safe for rate limits.
 *
 * Query: chainId (default 8453), currency (usd|aces), intervalMs (default 5000).
 */

import { NextRequest } from 'next/server';
import type { TokenHealthData } from '@/lib/api/token-health';
import { prisma } from '@/lib/prisma';
import { getHealthCached } from '@/lib/services/health-stream-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_CHAIN_ID = 8453;
const DEFAULT_CURRENCY = 'usd';
/** Default 5s to align with health cache TTL — avoids extra RPC beyond cache refresh */
const DEFAULT_INTERVAL_MS = 5000;
const MAX_INTERVAL_MS = 30000;

function healthToRealtimePayload(
  address: string,
  data: {
    metricsData?: TokenHealthData['metricsData'];
    marketCapData?: TokenHealthData['marketCapData'];
  },
): Record<string, unknown> {
  const normalized = address.toLowerCase();
  const payload: Record<string, unknown> = {
    tokenAddress: normalized,
    timestamp: Date.now(),
  };
  if (data.metricsData) {
    payload.marketCapUsd = data.metricsData.marketCapUsd;
    payload.volume24hUsd = data.metricsData.volume24hUsd;
    payload.volume24hAces = data.metricsData.volume24hAces;
    payload.liquidityUsd = data.metricsData.liquidityUsd;
    payload.liquiditySource = data.metricsData.liquiditySource;
  }
  if (data.marketCapData) {
    payload.currentPriceUsd = data.marketCapData.currentPriceUsd;
    payload.circulatingSupply = data.marketCapData.circulatingSupply;
    payload.rewardSupply = data.marketCapData.rewardSupply;
  }
  return payload;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const { searchParams } = new URL(request.url);
  const chainIdStr = searchParams.get('chainId');
  const currency = (searchParams.get('currency') as 'usd' | 'aces') || DEFAULT_CURRENCY;
  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : DEFAULT_CHAIN_ID;
  const intervalMs = Math.min(
    MAX_INTERVAL_MS,
    Math.max(
      1000,
      parseInt(searchParams.get('intervalMs') || String(DEFAULT_INTERVAL_MS), 10) ||
        DEFAULT_INTERVAL_MS,
    ),
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (e) {
          // Client may have closed
        }
      };

      const tick = async () => {
        if (request.signal.aborted) return;
        try {
          const response = await getHealthCached(prisma, address, chainId, currency);
          const payload = healthToRealtimePayload(address, response.data);
          payload.success = true;
          send(payload);
        } catch (err) {
          send({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            tokenAddress: address.toLowerCase(),
            timestamp: Date.now(),
          });
        }
      };

      let intervalId: ReturnType<typeof setInterval> | null = null;
      request.signal.addEventListener('abort', () => {
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      await tick();
      intervalId = setInterval(tick, intervalMs);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
