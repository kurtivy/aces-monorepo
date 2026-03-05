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

    // Fetch listing from Convex (includes token and owner joins)
    const { fetchQuery } = await import('convex/nextjs');
    const { api } = await import('../../../../../../convex/_generated/api');
    const result = await fetchQuery(api.listings.getBySymbol, {
      symbol: symbol.trim(),
    });

    if (!result || !result.listing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Listing not found',
        },
        { status: 404 },
      );
    }

    const { listing, token, owner, approvedByUser } = result;

    // Comment count - for now return 0 (comments are in Prisma, can migrate later)
    const commentCount = 0;

    // Parse assetDetails from JSON string if present
    let assetDetails = null;
    if (listing.assetDetails) {
      try {
        assetDetails = JSON.parse(listing.assetDetails);
      } catch (e) {
        console.warn('[Listings] Failed to parse assetDetails JSON:', e);
      }
    }

    const holderCount: number | null = null;

    // Prepare response (similar to backend format)
    const responseListing = {
      id: listing.id,
      title: listing.title,
      symbol: listing.symbol,
      brand: listing.brand ?? null,
      story: listing.story ?? null,
      details: listing.details ?? null,
      provenance: listing.provenance ?? null,
      value: listing.value ?? null,
      reservePrice: listing.reservePrice ?? null,
      hypeSentence: listing.hypeSentence ?? null,
      assetType: listing.assetType,
      imageGallery: listing.imageGallery,
      location: listing.location ?? null,
      isLive: listing.isLive,
      launchDate: listing.launchDate ?? null,
      startingBidPrice: listing.startingBidPrice ?? null,
      hypePoints: listing.hypePoints,
      assetDetails: assetDetails,
      ownerId: listing.ownerId,
      approvedBy: listing.approvedBy ?? null,
      createdAt: new Date(listing.createdAt).toISOString(),
      updatedAt: new Date(listing.updatedAt).toISOString(),
      owner: owner
        ? {
            id: owner.id,
            walletAddress: owner.walletAddress ?? null,
            email: owner.email ?? null,
            role: owner.role,
          }
        : undefined,
      approvedByUser: approvedByUser
        ? {
            id: approvedByUser.id,
            privyDid: approvedByUser.privyDid,
          }
        : undefined,
      commentCount: commentCount,
      token: token
        ? {
            id: token.contractAddress, // Use contractAddress as id
            contractAddress: token.contractAddress,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals ?? 18,
            currentPrice: '0', // Will be populated by token health if needed
            currentPriceACES: '0',
            volume24h: '0',
            phase: 'DEX_TRADING' as const,
            isActive: token.isActive,
            chainId: token.chainId,
            holderCount: holderCount,
            holdersCount: holderCount,
            priceSource: 'DEX' as const,
            poolAddress: token.poolAddress ?? null,
            dexLiveAt: null,
          }
        : undefined,
      // DEX metadata - all tokens are DEX mode now
      dex: token
        ? {
            poolAddress: token.poolAddress ?? null,
            isDexLive: true,
            dexLiveAt: null,
            priceSource: 'DEX' as const,
            lastUpdated: null,
            bondingCutoff: null,
          }
        : null,
    };

    const payload: { success: true; data: typeof responseListing; health?: TokenHealthData } = {
      success: true,
      data: responseListing,
    };

    if (includeHealth && token?.contractAddress) {
      try {
        const healthTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Token health timeout')), 5000),
        );
        payload.health = await Promise.race([
          getTokenHealth(prisma, token.contractAddress, 8453, 'usd'),
          healthTimeout,
        ]);
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
