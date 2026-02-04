import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMarketCapService } from '@/lib/services/market-cap-service';

/**
 * GET /api/market-cap/:address
 * Returns current market cap for a token (DEX-only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    // Validate address format
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        {
          error: 'Invalid token address format',
          tokenAddress: address,
        },
        { status: 400 },
      );
    }

    // Get market cap from service (null when token has no DEX pool)
    const marketCapService = getMarketCapService(prisma);
    const marketCapData = await marketCapService.getMarketCap(address, 8453); // Base Mainnet

    if (!marketCapData) {
      return NextResponse.json(
        {
          error: 'No market cap data',
          message: 'Token has no DEX pool or pool reserves could not be fetched',
          tokenAddress: address.toLowerCase(),
        },
        { status: 404 },
      );
    }

    const response = {
      tokenAddress: address.toLowerCase(),
      marketCapUsd: marketCapData.marketCapUsd,
      currentPriceUsd: marketCapData.currentPriceUsd,
      supply: marketCapData.supply,
      rewardSupply: marketCapData.rewardSupply,
      source: marketCapData.source,
      calculatedAt: marketCapData.calculatedAt,
    };

    // Cache for 5 seconds (same as service cache)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=5',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MarketCapRoute] Error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to fetch market cap',
        details: errorMessage,
        tokenAddress: (await params).address,
      },
      { status: 500 },
    );
  }
}
