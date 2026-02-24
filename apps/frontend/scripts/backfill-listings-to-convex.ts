/**
 * One-time script to backfill listings from Supabase/Prisma to Convex.
 * Run with: npx tsx scripts/backfill-listings-to-convex.ts
 */

import { PrismaClient } from '@prisma/client';
import { fetchMutation } from 'convex/nextjs';
import { api } from '../convex/_generated/api';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_DATABASE_URL,
    },
  },
});

async function main() {
  console.log('[Backfill] Starting listings migration from Prisma to Convex...');

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    console.error('[Backfill] Error: NEXT_PUBLIC_CONVEX_URL is not set');
    process.exit(1);
  }

  console.log(`[Backfill] Using Convex URL: ${process.env.NEXT_PUBLIC_CONVEX_URL}`);

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

  console.log(`[Backfill] Found ${prismaListings.length} listings in Prisma`);

  let synced = 0;
  let failed = 0;
  const errors: Array<{ id: string; symbol: string; error: string }> = [];

  for (const listing of prismaListings) {
    try {
      // Serialize assetDetails to JSON string
      let assetDetailsJson: string | undefined = undefined;
      if (listing.assetDetails) {
        try {
          assetDetailsJson = JSON.stringify(listing.assetDetails);
        } catch (e) {
          console.warn(`[Backfill] Failed to serialize assetDetails for ${listing.id}:`, e);
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
      console.log(`[Backfill] ✓ Synced listing ${listing.symbol} (${listing.id})`);
    } catch (err) {
      failed++;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ id: listing.id, symbol: listing.symbol, error: errorMsg });
      console.error(`[Backfill] ✗ Failed to sync listing ${listing.symbol} (${listing.id}):`, err);
    }
  }

  console.log('\n[Backfill] Migration complete!');
  console.log(`  Total: ${prismaListings.length}`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\n[Backfill] Errors:');
    errors.forEach((e) => {
      console.log(`  - ${e.symbol} (${e.id}): ${e.error}`);
    });
  }

  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log('[Backfill] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Backfill] Fatal error:', error);
    process.exit(1);
  });
