import { NextRequest, NextResponse } from 'next/server';
import { syncListingToConvex } from '@/lib/convex-sync';
import { z } from 'zod';

const CreateListingSchema = z.object({
  title: z.string().min(1).max(200),
  symbol: z.string().min(1).max(10),
  brand: z.string().max(100).optional().nullable(),
  story: z.string().max(5000).optional().nullable(),
  details: z.string().max(5000).optional().nullable(),
  provenance: z.string().max(5000).optional().nullable(),
  value: z.string().max(100).optional().nullable(),
  reservePrice: z.string().max(100).optional().nullable(),
  hypeSentence: z.string().max(500).optional().nullable(),
  assetType: z.enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER']),
  imageGallery: z.array(z.string().url()).default([]),
  location: z.string().max(200).optional().nullable(),
  assetDetails: z.record(z.string(), z.string()).optional().nullable(),
  hypePoints: z.array(z.string()).default([]),
  startingBidPrice: z.string().max(100).optional().nullable(),
  launchDate: z.string().optional().nullable(), // ISO datetime string
  tokenId: z.string().optional().nullable(), // Optional token to link
  showOnCanvas: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  showOnDrops: z.boolean().optional().default(false),
});

/**
 * GET /api/admin/listings - List all listings (no auth required for now)
 */
export async function GET(request: NextRequest) {
  try {
    const { fetchQuery } = await import('convex/nextjs');
    const { api } = await import('../../../../../convex/_generated/api');
    const enrichedListings = await fetchQuery(api.listings.list, { limit: 100 });

    // Map to response format
    const listings = enrichedListings.map((item) => ({
      ...item.listing,
      owner: item.owner
        ? {
            id: item.owner.id,
            walletAddress: item.owner.walletAddress ?? null,
            email: item.owner.email ?? null,
          }
        : null,
      token: item.token
        ? {
            contractAddress: item.token.contractAddress,
            symbol: item.token.symbol,
            name: item.token.name,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      count: listings.length,
      data: listings,
    });
  } catch (error) {
    console.error('[ADMIN] Error fetching listings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch listings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/listings - Create new listing (no auth required for now; uses first ADMIN user as owner)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = CreateListingSchema.parse(body);

    console.log(`[ADMIN] Creating listing: ${data.title}`);

    // If tokenId is provided, verify token exists in Convex
    if (data.tokenId) {
      const { fetchQuery } = await import('convex/nextjs');
      const { api } = await import('../../../../../convex/_generated/api');
      const token = await fetchQuery(api.tokens.getByContractAddress, {
        contractAddress: data.tokenId.toLowerCase(),
      });

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token not found',
            message: `Token with address ${data.tokenId} does not exist`,
          },
          { status: 404 },
        );
      }

      // Check if token is already linked to another listing
      if (token.listingId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token already linked',
            message: `Token is already linked to another listing`,
          },
          { status: 400 },
        );
      }
    }

    // Resolve owner: need a User id for ownerId (required). Use first ADMIN user when no auth.
    const { fetchQuery: fetchQueryUsers } = await import('convex/nextjs');
    const { api: apiUsers } = await import('../../../../../convex/_generated/api');
    const allUsers = await fetchQueryUsers(apiUsers.users.list, {});
    const owner = allUsers.find((u) => u.role === 'ADMIN');
    
    if (!owner) {
      return NextResponse.json(
        {
          success: false,
          error: 'No admin user found',
          message: 'Create a user with role ADMIN in Convex to create listings without auth.',
        },
        { status: 500 },
      );
    }

    // Generate a unique ID (cuid-like)
    const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Serialize assetDetails to JSON string if present
    const assetDetailsJson = data.assetDetails ? JSON.stringify(data.assetDetails) : undefined;

    // Create listing in Convex
    const { fetchMutation } = await import('convex/nextjs');
    const { api: apiMutation } = await import('../../../../../convex/_generated/api');
    await fetchMutation(apiMutation.listings.insert, {
      id: listingId,
      title: data.title,
      symbol: data.symbol,
      brand: data.brand ?? undefined,
      story: data.story ?? undefined,
      details: data.details ?? undefined,
      provenance: data.provenance ?? undefined,
      value: data.value ?? undefined,
      reservePrice: data.reservePrice ?? undefined,
      hypeSentence: data.hypeSentence ?? undefined,
      assetType: data.assetType,
      imageGallery: data.imageGallery,
      location: data.location ?? undefined,
      assetDetails: assetDetailsJson,
      hypePoints: data.hypePoints,
      startingBidPrice: data.startingBidPrice ?? undefined,
      isLive: false,
      launchDate: data.launchDate ?? undefined,
      ownerId: owner.id,
      approvedBy: owner.id,
      submissionId: undefined,
      showOnCanvas: data.showOnCanvas,
      isFeatured: data.isFeatured,
      showOnDrops: data.showOnDrops,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Link token if provided
    if (data.tokenId) {
      // Update token in Convex to link to this listing
      const { fetchMutation: fetchMutationToken } = await import('convex/nextjs');
      const { api: apiToken } = await import('../../../../../convex/_generated/api');
      await fetchMutationToken(apiToken.tokens.insertToken, {
        contractAddress: data.tokenId.toLowerCase(),
        symbol: '', // Will be updated by the token data
        name: '',
        chainId: 8453,
        isActive: true,
        listingId: listingId,
      });
    }

    // Sync to canvasItems if showOnCanvas
    if (data.showOnCanvas) {
      await syncListingToConvex({
        id: listingId,
        title: data.title,
        symbol: data.symbol,
        story: data.story ?? null,
        details: data.details ?? null,
        hypeSentence: data.hypeSentence ?? null,
        imageGallery: data.imageGallery,
        showOnCanvas: data.showOnCanvas,
        isFeatured: data.isFeatured,
        isLive: false,
        showOnDrops: data.showOnDrops,
      });
    }

    console.log(`[ADMIN] Listing created successfully: ${listingId}`);

    return NextResponse.json({
      success: true,
      message: `Listing "${data.title}" created successfully`,
      data: { id: listingId, ...data },
    });
  } catch (error) {
    console.error('[ADMIN] Error creating listing:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create listing',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
