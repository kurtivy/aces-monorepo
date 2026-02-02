import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/bids/listing/:listingId/highest
 * Get the highest bid for a listing. Returns null when there are no bids or on error,
 * so the place-bids UI never breaks (most listings have zero or few bids).
 */
function safeJson(data: { success: true; data: unknown }) {
  return NextResponse.json(data);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await params;

    if (!listingId) {
      return safeJson({ success: true, data: null });
    }

    const { prisma } = await import('@/lib/prisma');

    const highestBid = await prisma.bid.findFirst({
      where: {
        listingId,
        status: 'PENDING',
        isActive: true,
      },
      include: {
        bidder: {
          select: {
            id: true,
            username: true,
            walletAddress: true,
            email: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            symbol: true,
            ownerId: true,
            isLive: true,
            startingBidPrice: true,
            reservePrice: true,
          },
        },
      },
      orderBy: { amount: 'desc' },
    });

    // Serialize to plain JSON-safe shape (Prisma Dates etc. can cause 500 on strict serialization)
    const data = highestBid
      ? {
          ...highestBid,
          expiresAt: highestBid.expiresAt?.toISOString?.() ?? (highestBid as any).expiresAt,
          respondedAt: highestBid.respondedAt?.toISOString?.() ?? (highestBid as any).respondedAt,
          createdAt: highestBid.createdAt?.toISOString?.() ?? (highestBid as any).createdAt,
          updatedAt: highestBid.updatedAt?.toISOString?.() ?? (highestBid as any).updatedAt,
        }
      : null;

    return safeJson({ success: true, data });
  } catch (error) {
    console.warn('[bids/listing/highest] No highest bid (error or no bids):', error);
    return safeJson({ success: true, data: null });
  }
}
