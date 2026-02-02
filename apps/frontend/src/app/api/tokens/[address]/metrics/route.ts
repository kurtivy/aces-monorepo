import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenMetricsService } from '@/lib/services/token-metrics-service';

/**
 * GET /api/tokens/:address/metrics
 * Returns aggregated token metrics (DEX-only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId')
      ? parseInt(searchParams.get('chainId')!)
      : undefined;

    // Validate address format
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token address format',
        },
        { status: 400 },
      );
    }

    // Get metrics from service
    const metricsService = getTokenMetricsService(prisma);
    const metricsData = await metricsService.getTokenMetrics(address, chainId || 8453);

    return NextResponse.json(
      {
        success: true,
        data: metricsData,
        cached: false,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=5',
        },
      },
    );
  } catch (error) {
    console.error('[tokens/metrics] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch token metrics',
      },
      { status: 500 },
    );
  }
}
