import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';
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

    // Verify listing exists
    const existing = await prisma.listing.findUnique({
      where: { id },
      include: {
        token: {
          select: {
            contractAddress: true,
            symbol: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Listing not found',
          message: `Listing with ID ${id} does not exist`,
        },
        { status: 404 },
      );
    }

    // Update isLive status
    const listing = await prisma.listing.update({
      where: { id },
      data: {
        isLive,
        ...(isLive && !existing.launchDate ? { launchDate: new Date() } : {}),
      },
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

    // Sync isLive to Convex so canvas live badge stays in sync
    await syncListingLiveToConvex(listing.id, listing.isLive);

    console.log(`[ADMIN] Listing ${listing.id} isLive set to ${isLive}`);

    return NextResponse.json({
      success: true,
      message: `Listing "${listing.title}" ${isLive ? 'is now live' : 'is no longer live'}`,
      data: listing,
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
