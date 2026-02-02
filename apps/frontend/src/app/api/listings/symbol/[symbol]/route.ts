import { NextRequest, NextResponse } from 'next/server';
import type { TokenHealthData } from '@/lib/api/token-health';
import { prisma } from '@/lib/prisma';
import { getTokenHealth } from '@/lib/services/token-health';

/**
 * GET /api/listings/symbol/:symbol
 * Returns a listing by its symbol (case-insensitive).
 * Query: includeHealth=1 — when set and listing has a token, includes token health in one round trip.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;
    const includeHealth =
      request.nextUrl.searchParams.get('includeHealth') === '1' ||
      request.nextUrl.searchParams.get('includeHealth') === 'true';

    if (!symbol || symbol.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Symbol is required',
        },
        { status: 400 },
      );
    }

    // Fetch listing from database
    const listing = await prisma.listing.findFirst({
      where: {
        symbol: {
          equals: symbol,
          mode: 'insensitive',
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            privyDid: true,
            walletAddress: true,
            email: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            privyDid: true,
          },
        },
        token: true,
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Listing not found',
        },
        { status: 404 },
      );
    }

    // Get comment count
    const commentCount = typeof listing._count?.comments === 'number' ? listing._count.comments : 0;

    // Get holder count if token exists (optional - can be slow)
    // For now, use null - holder count can be calculated separately if needed
    // TODO: Implement TokenHolderService in frontend if needed
    let holderCount: number | null = null;

    // Try to get from token if the field exists (may not be in schema)
    if (listing.token) {
      const tokenAny = listing.token as any;
      holderCount = tokenAny.holderCount ?? tokenAny.holdersCount ?? null;
    }

    // Prepare response (similar to backend format)
    const responseListing = {
      id: listing.id,
      title: listing.title,
      symbol: listing.symbol,
      brand: listing.brand,
      story: listing.story,
      details: listing.details,
      provenance: listing.provenance,
      value: listing.value,
      reservePrice: listing.reservePrice,
      hypeSentence: listing.hypeSentence,
      assetType: listing.assetType,
      imageGallery: listing.imageGallery,
      location: listing.location,
      isLive: listing.isLive,
      launchDate: listing.launchDate,
      startingBidPrice: listing.startingBidPrice,
      hypePoints: listing.hypePoints,
      assetDetails: listing.assetDetails,
      ownerId: listing.ownerId,
      approvedBy: listing.approvedBy,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      owner: listing.owner,
      approvedByUser: listing.approvedByUser,
      commentCount: commentCount,
      token: listing.token
        ? {
            ...listing.token,
            holderCount: holderCount,
            holdersCount: holderCount,
          }
        : undefined,
      // DEX metadata (if token exists and has pool)
      dex: listing.token?.poolAddress
        ? {
            poolAddress: listing.token.poolAddress,
            isDexLive: listing.token.phase === 'DEX_TRADING',
            dexLiveAt: listing.token.dexLiveAt,
            priceSource: listing.token.priceSource || 'DEX',
            lastUpdated: listing.token.updatedAt,
            bondingCutoff: listing.token.dexLiveAt,
          }
        : null,
    };

    const payload: { success: true; data: typeof responseListing; health?: TokenHealthData } = {
      success: true,
      data: responseListing,
    };

    if (includeHealth && listing.token?.contractAddress) {
      try {
        payload.health = await getTokenHealth(prisma, listing.token.contractAddress, 8453, 'usd');
      } catch (healthErr) {
        console.warn('[Listings] includeHealth failed:', healthErr);
      }
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[Listings] Error getting listing by symbol:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch listing',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
