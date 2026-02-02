import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAerodromeService } from '@/lib/services/aerodrome-service';

/**
 * GET /api/dex/:tokenAddress/pool
 * Returns DEX pool state for a token.
 * Use ?poolAddress=0x... when available - token address in path alone often 404s
 * for Slipstream/V3 pools that aren't resolvable via factory.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> },
) {
  try {
    const { tokenAddress } = await params;
    const { searchParams } = new URL(request.url);
    const poolAddressFromQuery = searchParams.get('poolAddress');

    // Validate token address format
    if (!tokenAddress || !tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address format' },
        { status: 400 },
      );
    }

    const normalizedToken = tokenAddress.toLowerCase();

    // Prefer poolAddress from query, then from DB (Token.poolAddress)
    let knownPoolAddress: string | undefined = poolAddressFromQuery
      ? poolAddressFromQuery.toLowerCase()
      : undefined;

    if (!knownPoolAddress) {
      const token = await prisma.token.findUnique({
        where: { contractAddress: normalizedToken },
        select: { poolAddress: true },
      });
      knownPoolAddress = token?.poolAddress ?? undefined;
    }

    const service = getAerodromeService(prisma);
    const poolState = await service.getPoolState(normalizedToken, knownPoolAddress);

    if (!poolState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pool not found',
          details:
            'No ACES pool found. Pass ?poolAddress=0x... if known, or ensure token has poolAddress in DB.',
        },
        { status: 404 },
      );
    }

    const response = {
      success: true,
      data: {
        poolAddress: poolState.poolAddress,
        tokenAddress: poolState.tokenAddress,
        counterToken: poolState.counterToken,
        reserves: poolState.reserves,
        reserveRaw: poolState.reserveRaw,
        priceInCounter: poolState.priceInCounter,
        lastUpdated: poolState.lastUpdated,
      },
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, max-age=10' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DexPoolRoute] Error:', errorMessage);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pool state', details: errorMessage },
      { status: 500 },
    );
  }
}
