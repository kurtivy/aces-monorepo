import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getHealthCached } from '@/lib/services/health-stream-cache';

/**
 * GET /api/tokens/:address/health
 * Unified endpoint: metrics + market cap in-process (no internal HTTP).
 * Uses shared cache (5s TTL, in-flight dedupe) to stay within RPC/Alchemy rate limits.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const chainIdStr = searchParams.get('chainId');
    const currency = (searchParams.get('currency') as 'usd' | 'aces') || 'usd';
    const chainId = chainIdStr ? parseInt(chainIdStr, 10) : 8453;
    const includeFees =
      searchParams.get('includeFees') === '1' || searchParams.get('includeFees') === 'true';

    const responseData = await getHealthCached(prisma, address, chainId, currency, { includeFees });
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[Health] Failed to fetch token health:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch token health data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
