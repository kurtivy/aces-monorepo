import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncListingToConvex } from '@/lib/convex-sync';
import { Prisma } from '@prisma/client';
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
    const listings = await prisma.listing.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
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

    // If tokenId is provided, verify token exists
    if (data.tokenId) {
      const token = await prisma.token.findUnique({
        where: { contractAddress: data.tokenId.toLowerCase() },
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
    const owner = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (!owner) {
      return NextResponse.json(
        {
          success: false,
          error: 'No admin user found',
          message: 'Create a user with role ADMIN in the database to create listings without auth.',
        },
        { status: 500 },
      );
    }

    // Enforce "exactly one featured": if this listing is featured, clear others first
    if (data.isFeatured) {
      await prisma.listing.updateMany({
        where: {},
        data: { isFeatured: false },
      });
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        title: data.title,
        symbol: data.symbol,
        brand: data.brand || null,
        story: data.story || null,
        details: data.details || null,
        provenance: data.provenance || null,
        value: data.value || null,
        reservePrice: data.reservePrice || null,
        hypeSentence: data.hypeSentence || null,
        assetType: data.assetType,
        imageGallery: data.imageGallery,
        location: data.location || null,
        assetDetails: data.assetDetails
          ? (data.assetDetails as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        hypePoints: data.hypePoints,
        startingBidPrice: data.startingBidPrice || null,
        launchDate: data.launchDate ? new Date(data.launchDate) : null,
        isLive: false, // Always start as not live
        submissionId: null, // No submission required
        ownerId: owner.id,
        approvedBy: owner.id,
        showOnCanvas: data.showOnCanvas,
        isFeatured: data.isFeatured,
        showOnDrops: data.showOnDrops,
      },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            email: true,
          },
        },
      },
    });

    // Link token if provided
    if (data.tokenId) {
      await prisma.token.update({
        where: { contractAddress: data.tokenId.toLowerCase() },
        data: { listingId: listing.id },
      });
    }

    // Sync to Convex when showOnCanvas so it appears on the infinite canvas
    if (listing.showOnCanvas) {
      await syncListingToConvex({
        id: listing.id,
        title: listing.title,
        symbol: listing.symbol,
        story: listing.story ?? null,
        details: listing.details ?? null,
        hypeSentence: listing.hypeSentence ?? null,
        imageGallery: listing.imageGallery,
        showOnCanvas: listing.showOnCanvas,
        isFeatured: listing.isFeatured,
        isLive: listing.isLive,
        showOnDrops: listing.showOnDrops,
      });
    }

    console.log(`[ADMIN] Listing created successfully: ${listing.id}`);

    return NextResponse.json({
      success: true,
      message: `Listing "${listing.title}" created successfully`,
      data: listing,
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
