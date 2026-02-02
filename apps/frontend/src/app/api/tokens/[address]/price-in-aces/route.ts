import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAerodromeService } from '@/lib/services/aerodrome-service';

/**
 * GET /api/tokens/:address/price-in-aces
 * Returns the current price of a token in ACES (from Aerodrome pool reserves)
 * Uses Token.poolAddress from DB when available (Slipstream/V3 pools), else resolves from factory
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

    const normalizedAddress = address.toLowerCase();

    // Pool address is stored separately in Token (may be Slipstream/V3, not resolvable via factory)
    const token = await prisma.token.findUnique({
      where: { contractAddress: normalizedAddress },
      select: { poolAddress: true },
    });
    const knownPoolAddress = token?.poolAddress ?? undefined;

    const service = getAerodromeService(prisma);
    const poolState = await service.getPoolState(normalizedAddress, knownPoolAddress);

    if (!poolState) {
      return NextResponse.json(
        {
          error: 'No ACES pool found for this token',
          tokenAddress: normalizedAddress,
          details:
            'The token may not have an Aerodrome pool paired with ACES, or the pool may not exist yet.',
        },
        { status: 404 },
      );
    }

    const response = {
      tokenAddress: normalizedAddress,
      priceInAces: poolState.priceInCounter,
      poolAddress: poolState.poolAddress,
      reserves: {
        token: poolState.reserves.token,
        aces: poolState.reserves.counter,
      },
      lastUpdated: poolState.lastUpdated,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=10',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PriceInAcesRoute] Error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to fetch price in ACES',
        details: errorMessage,
        tokenAddress: (await params).address,
      },
      { status: 500 },
    );
  }
}
