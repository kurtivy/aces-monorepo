import { NextRequest, NextResponse } from 'next/server';
import { getPriceCacheService } from '@/lib/services/price-cache-service';

/**
 * GET /api/prices/aces-usd
 * Returns ACES/USD price and related token prices
 */
export async function GET(_request: NextRequest) {
  try {
    const priceService = getPriceCacheService();
    const data = await priceService.getPrices();

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=5',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[prices/aces-usd] Failed to fetch cached ACES/USD price:', error);
    // Surface safe, actionable error so deployment logs or API response can diagnose env/network issues
    const safeMessage =
      message.startsWith('[PriceCacheService]') || message.startsWith('Missing ')
        ? message
        : 'Failed to fetch price';
    return NextResponse.json(
      { success: false, error: safeMessage },
      { status: 500 },
    );
  }
}
