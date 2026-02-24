import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/backfill-listings
 * One-time migration: read all listings from Prisma/Supabase and insert into Convex listings table.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminConvex(request);

    console.log('[ADMIN] Starting listings backfill from Prisma to Convex...');

    // Import Convex functions
    const { fetchMutation } = await import('convex/nextjs');
    const { api } = await import('../../../../../convex/_generated/api');

    // Fetch all listings from Prisma
    const prismaListings = await prisma.listing.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            email: true,
          },
        },
        token: {
          select: {
            contractAddress: true,
            symbol: true,
            name: true,
          },
        },
      },
    });

    console.log(`[ADMIN] Found ${prismaListings.length} listings in Prisma`);

    let synced = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const listing of prismaListings) {
      try {
        // Serialize assetDetails to JSON string
        let assetDetailsJson: string | undefined = undefined;
        if (listing.assetDetails) {
          try {
            assetDetailsJson = JSON.stringify(listing.assetDetails);
          } catch (e) {
            console.warn(`[ADMIN] Failed to serialize assetDetails for ${listing.id}:`, e);
          }
        }

        // Insert into Convex listings table
        await fetchMutation(api.listings.insert, {
          id: listing.id,
          title: listing.title,
          symbol: listing.symbol,
          brand: listing.brand ?? undefined,
          story: listing.story ?? undefined,
          details: listing.details ?? undefined,
          provenance: listing.provenance ?? undefined,
          value: listing.value ?? undefined,
          reservePrice: listing.reservePrice ?? undefined,
          hypeSentence: listing.hypeSentence ?? undefined,
          assetType: listing.assetType,
          imageGallery: listing.imageGallery,
          location: listing.location ?? undefined,
          assetDetails: assetDetailsJson,
          hypePoints: listing.hypePoints,
          startingBidPrice: listing.startingBidPrice ?? undefined,
          isLive: listing.isLive,
          launchDate: listing.launchDate?.toISOString(),
          ownerId: listing.ownerId,
          approvedBy: listing.approvedBy ?? undefined,
          submissionId: listing.submissionId ?? undefined,
          showOnCanvas: listing.showOnCanvas,
          isFeatured: listing.isFeatured,
          showOnDrops: listing.showOnDrops,
          createdAt: listing.createdAt.getTime(),
          updatedAt: listing.updatedAt.getTime(),
        });

        synced++;
        console.log(`[ADMIN] Synced listing ${listing.id} (${listing.symbol})`);
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ id: listing.id, error: errorMsg });
        console.error(`[ADMIN] Failed to sync listing ${listing.id}:`, err);
      }
    }

    console.log(`[ADMIN] Backfill complete: ${synced} synced, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Backfill complete: ${synced} listings synced, ${failed} failed`,
      data: {
        total: prismaListings.length,
        synced,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Error during backfill:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to backfill listings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
