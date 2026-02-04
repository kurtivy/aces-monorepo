import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';
import { syncAllListingsToConvex, removeCanvasItemsNotInList } from '@/lib/convex-sync';

/**
 * POST /api/admin/sync-canvas
 * Sync Prisma listings that have showOnCanvas and at least one image to Convex.
 * Listings without images are not included; existing Convex items for those listings are removed (pruned).
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminConvex(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }
    throw error;
  }

  try {
    const allShowOnCanvas = await prisma.listing.findMany({
      where: { showOnCanvas: true },
      orderBy: { createdAt: 'asc' },
    });

    // Only include listings that have at least one image
    const listingsWithImages = allShowOnCanvas.filter(
      (l) => Array.isArray(l.imageGallery) && l.imageGallery.length > 0,
    );
    const keepListingIds = listingsWithImages.map((l) => l.id);

    // Prune Convex: remove canvas items whose listing has no images (or is not in our keep list)
    const pruneResult = await removeCanvasItemsNotInList(keepListingIds);

    const result = await syncAllListingsToConvex(
      listingsWithImages.map((l) => ({
        id: l.id,
        title: l.title,
        symbol: l.symbol,
        story: l.story ?? null,
        details: l.details ?? null,
        hypeSentence: l.hypeSentence ?? null,
        imageGallery: l.imageGallery,
        showOnCanvas: l.showOnCanvas,
        isFeatured: l.isFeatured,
        isLive: l.isLive,
        showOnDrops: l.showOnDrops,
      })),
    );

    if (result.skipped) {
      return NextResponse.json({
        success: false,
        error: 'Convex sync skipped: NEXT_PUBLIC_CONVEX_URL is not set',
        synced: 0,
        failed: 0,
        removed: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} listing(s) to Convex; removed ${pruneResult.removed} item(s) without images.`,
      synced: result.synced,
      failed: result.failed,
      removed: pruneResult.removed,
    });
  } catch (error) {
    console.error('[ADMIN] Error syncing canvas:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync canvas',
        message: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 },
    );
  }
}
