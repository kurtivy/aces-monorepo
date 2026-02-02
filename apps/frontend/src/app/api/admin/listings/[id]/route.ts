import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSupabase } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const UpdateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  symbol: z.string().min(1).max(10).optional(),
  brand: z.string().max(100).optional().nullable(),
  story: z.string().max(5000).optional().nullable(),
  details: z.string().max(5000).optional().nullable(),
  provenance: z.string().max(5000).optional().nullable(),
  value: z.string().max(100).optional().nullable(),
  reservePrice: z.string().max(100).optional().nullable(),
  hypeSentence: z.string().max(500).optional().nullable(),
  assetType: z
    .enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER'])
    .optional(),
  imageGallery: z.array(z.string().url()).optional(),
  location: z.string().max(200).optional().nullable(),
  assetDetails: z.record(z.string(), z.string()).optional().nullable(),
  hypePoints: z.array(z.string()).optional(),
  startingBidPrice: z.string().max(100).optional().nullable(),
});

/**
 * PATCH /api/admin/listings/[id] - Update listing details
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSupabase(request);

    const { id } = await params;
    const body = await request.json();
    const data = UpdateListingSchema.parse(body);

    console.log(`[ADMIN] Updating listing: ${id}`);

    // Verify listing exists
    const existing = await prisma.listing.findUnique({
      where: { id },
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

    // Update listing
    // Handle assetDetails JSON field properly - Prisma JSON fields need special handling
    const { assetDetails, ...restData } = data;
    const updateData: Prisma.ListingUpdateInput = {
      ...restData,
      updatedAt: new Date(),
    };

    // Handle assetDetails JSON field - Prisma requires explicit JSON handling
    if (assetDetails !== undefined) {
      if (assetDetails === null) {
        updateData.assetDetails = Prisma.JsonNull;
      } else {
        // Cast to InputJsonValue - Prisma accepts any JSON-serializable value
        updateData.assetDetails = assetDetails as unknown as Prisma.InputJsonValue;
      }
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: updateData,
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

    console.log(`[ADMIN] Listing updated successfully: ${listing.id}`);

    return NextResponse.json({
      success: true,
      message: `Listing "${listing.title}" updated successfully`,
      data: listing,
    });
  } catch (error) {
    console.error('[ADMIN] Error updating listing:', error);

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
        error: 'Failed to update listing',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
