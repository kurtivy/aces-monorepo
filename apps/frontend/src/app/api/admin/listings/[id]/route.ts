import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
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
    await requireAdminConvex(request);

    const { id } = await params;
    const body = await request.json();
    const data = UpdateListingSchema.parse(body);

    console.log(`[ADMIN] Updating listing: ${id}`);

    // Verify listing exists in Convex
    const { fetchQuery } = await import('convex/nextjs');
    const { api } = await import('../../../../../../convex/_generated/api');
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

    // Serialize assetDetails to JSON string if present
    const assetDetailsJson = data.assetDetails ? JSON.stringify(data.assetDetails) : undefined;

    // Build patch object
    const patch: any = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.symbol !== undefined) patch.symbol = data.symbol;
    if (data.brand !== undefined) patch.brand = data.brand ?? undefined;
    if (data.story !== undefined) patch.story = data.story ?? undefined;
    if (data.details !== undefined) patch.details = data.details ?? undefined;
    if (data.provenance !== undefined) patch.provenance = data.provenance ?? undefined;
    if (data.value !== undefined) patch.value = data.value ?? undefined;
    if (data.reservePrice !== undefined) patch.reservePrice = data.reservePrice ?? undefined;
    if (data.hypeSentence !== undefined) patch.hypeSentence = data.hypeSentence ?? undefined;
    if (data.assetType !== undefined) patch.assetType = data.assetType;
    if (data.imageGallery !== undefined) patch.imageGallery = data.imageGallery;
    if (data.location !== undefined) patch.location = data.location ?? undefined;
    if (assetDetailsJson !== undefined) patch.assetDetails = assetDetailsJson;
    if (data.hypePoints !== undefined) patch.hypePoints = data.hypePoints;
    if (data.startingBidPrice !== undefined) patch.startingBidPrice = data.startingBidPrice ?? undefined;

    // Update listing in Convex
    const { fetchMutation } = await import('convex/nextjs');
    const { api: apiMutation } = await import('../../../../../../convex/_generated/api');
    await fetchMutation(apiMutation.listings.update, {
      id,
      patch,
    });

    // Fetch updated listing to return
    const { fetchQuery: fetchQueryUpdated } = await import('convex/nextjs');
    const { api: apiQuery } = await import('../../../../../../convex/_generated/api');
    const updated = await fetchQueryUpdated(apiQuery.listings.getById, { id });

    console.log(`[ADMIN] Listing updated successfully: ${id}`);

    return NextResponse.json({
      success: true,
      message: `Listing "${updated?.listing.title}" updated successfully`,
      data: updated?.listing,
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
