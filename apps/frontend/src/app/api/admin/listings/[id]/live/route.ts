import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { syncListingLiveToConvex } from '@/lib/convex-sync';
import { z } from 'zod';

const SetLiveSchema = z.object({
  isLive: z.boolean(),
});

/**
 * PATCH /api/admin/listings/[id]/live - Toggle isLive status
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminConvex(request);

    const { id } = await params;
    const body = await request.json();
    const { isLive } = SetLiveSchema.parse(body);

    console.log(`[ADMIN] Setting listing ${id} isLive to ${isLive}`);

    // Verify listing exists in Convex
    const { fetchQuery } = await import('convex/nextjs');
    const { api } = await import('../../../../../../../convex/_generated/api');
    const existing = await fetchQuery(api.listings.getById, { id });

    if (!existing || !existing.listing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Listing not found',
          message: `Listing with ID ${id} does not exist`,
        },
        { status: 404 },
      );
    }

    // Update isLive status in Convex
    const { fetchMutation } = await import('convex/nextjs');
    const { api: apiMutation } = await import('../../../../../../../convex/_generated/api');
    await fetchMutation(apiMutation.listings.setLive, {
      id,
      isLive,
    });

    // Sync isLive to canvasItems so canvas live badge stays in sync
    await syncListingLiveToConvex(id, isLive);

    // Fetch updated listing
    const { fetchQuery: fetchQueryUpdated } = await import('convex/nextjs');
    const { api: apiQuery } = await import('../../../../../../../convex/_generated/api');
    const updated = await fetchQueryUpdated(apiQuery.listings.getById, { id });

    console.log(`[ADMIN] Listing ${id} isLive set to ${isLive}`);

    return NextResponse.json({
      success: true,
      message: `Listing "${updated?.listing.title}" ${isLive ? 'is now live' : 'is no longer live'}`,
      data: updated?.listing,
    });
  } catch (error) {
    console.error('[ADMIN] Error toggling listing live status:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to toggle listing live status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
