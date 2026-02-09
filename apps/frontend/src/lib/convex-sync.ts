/**
 * Server-side Convex sync: call Convex mutations from API routes.
 * Only runs when NEXT_PUBLIC_CONVEX_URL is set (after `npx convex dev`).
 */

import type { PrismaClient, UserRole, SellerStatus } from '@prisma/client';

function getOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://aces.fun'
  ).replace(/\/$/, '');
}

function prefixImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const origin = getOrigin();
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
}

export type ListingForCanvas = {
  id: string;
  title: string;
  symbol: string;
  story: string | null;
  details: string | null;
  hypeSentence: string | null;
  imageGallery: string[];
  showOnCanvas: boolean;
  isFeatured: boolean;
  isLive: boolean;
  showOnDrops: boolean;
};

/**
 * Sync a newly created listing to Convex canvasItems when showOnCanvas is true and listing has at least one image.
 * Listings without images are not included on the canvas.
 */
export async function syncListingToConvex(listing: ListingForCanvas): Promise<void> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    console.warn('[Convex] syncListingToConvex skipped: NEXT_PUBLIC_CONVEX_URL is not set');
    return;
  }
  if (!listing.showOnCanvas || !listing.imageGallery?.length) {
    return; // Only sync listings that are shown on canvas and have at least one image
  }
  try {
    const { fetchMutation } = await import('convex/nextjs');
    const { api } = await import('../../convex/_generated/api');
    const image =
      listing.imageGallery?.[0] != null ? prefixImageUrl(listing.imageGallery[0]) : undefined;
    const description =
      [listing.story, listing.details, listing.hypeSentence].filter(Boolean).join('\n\n') ||
      listing.title;
    await fetchMutation(api.canvasItems.insertCanvasItem, {
      id: listing.id,
      title: listing.title,
      description,
      symbol: listing.symbol,
      ticker: `$${listing.symbol}`,
      image,
      listingId: listing.id,
      showOnCanvas: listing.showOnCanvas,
      isFeatured: listing.isFeatured,
      isLive: listing.isLive,
      showOnDrops: listing.showOnDrops,
    });
    // Enforce "exactly one featured" in Convex so the featured section shows this listing
    if (listing.isFeatured) {
      await fetchMutation(api.canvasItems.setFeatured, { id: listing.id });
    }
  } catch (err) {
    console.error('[Convex] syncListingToConvex failed:', err);
  }
}

/**
 * Sync all given listings to Convex (e.g. from Prisma).
 * Only listings with showOnCanvas and at least one image in imageGallery are synced.
 */
export async function syncAllListingsToConvex(listings: ListingForCanvas[]): Promise<{
  synced: number;
  failed: number;
  skipped: boolean;
}> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return { synced: 0, failed: 0, skipped: true };
  }
  let synced = 0;
  let failed = 0;
  for (const listing of listings) {
    if (!listing.showOnCanvas || !listing.imageGallery?.length) continue;
    try {
      await syncListingToConvex(listing);
      synced++;
    } catch (err) {
      console.error('[Convex] syncAllListingsToConvex item failed:', listing.id, err);
      failed++;
    }
  }
  return { synced, failed, skipped: false };
}

/**
 * Remove from Convex any canvas item whose listingId is not in keepListingIds.
 * Use after sync to prune items that should no longer be on the canvas (e.g. listings without images).
 */
export async function removeCanvasItemsNotInList(keepListingIds: string[]): Promise<{
  removed: number;
  skipped: boolean;
}> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return { removed: 0, skipped: true };
  }
  const keepSet = new Set(keepListingIds);
  try {
    const { fetchQuery, fetchMutation } = await import('convex/nextjs');
    const { api } = await import('../../convex/_generated/api');
    const currentIds = await fetchQuery(api.canvasItems.listCanvasListingIds);
    let removed = 0;
    for (const listingId of currentIds) {
      if (!keepSet.has(listingId)) {
        await fetchMutation(api.canvasItems.removeByListingId, { listingId });
        removed++;
      }
    }
    return { removed, skipped: false };
  } catch (err) {
    console.error('[Convex] removeCanvasItemsNotInList failed:', err);
    return { removed: 0, skipped: false };
  }
}

/**
 * Update Convex canvas item when listing isLive is toggled.
 */
export async function syncListingLiveToConvex(listingId: string, isLive: boolean): Promise<void> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return;
  try {
    const { fetchMutation } = await import('convex/nextjs');
    const { api } = await import('../../convex/_generated/api');
    await fetchMutation(api.canvasItems.updateCanvasItem, {
      listingId,
      patch: { isLive },
    });
  } catch (err) {
    console.error('[Convex] syncListingLiveToConvex failed:', err);
  }
}

// --- Token sync (Prisma → Convex) ---

export type TokenForConvex = {
  contractAddress: string;
  symbol: string;
  name: string;
  chainId: number;
  decimals?: number;
  listingId?: string | null;
  isActive: boolean;
};

/**
 * Sync a token to Convex when created/updated in Prisma.
 */
export async function syncTokenToConvex(token: TokenForConvex): Promise<void> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    console.warn('[Convex] syncTokenToConvex skipped: NEXT_PUBLIC_CONVEX_URL is not set');
    return;
  }
  try {
    const { fetchMutation } = await import('convex/nextjs');
    const { api } = await import('../../convex/_generated/api');
    await fetchMutation(api.tokens.insertToken, {
      contractAddress: token.contractAddress,
      symbol: token.symbol,
      name: token.name,
      chainId: token.chainId,
      decimals: token.decimals,
      listingId: token.listingId ?? undefined,
      isActive: token.isActive,
    });
  } catch (err) {
    console.error('[Convex] syncTokenToConvex failed:', err);
  }
}

/**
 * Sync all given tokens to Convex (e.g. from Prisma for backfill).
 */
export async function syncAllTokensToConvex(tokens: TokenForConvex[]): Promise<{
  synced: number;
  failed: number;
  skipped: boolean;
}> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return { synced: 0, failed: 0, skipped: true };
  }
  let synced = 0;
  let failed = 0;
  for (const token of tokens) {
    try {
      await syncTokenToConvex(token);
      synced++;
    } catch (err) {
      console.error('[Convex] syncAllTokensToConvex item failed:', token.contractAddress, err);
      failed++;
    }
  }
  return { synced, failed, skipped: false };
}

// --- App users sync (Prisma → Convex backfill) ---

export type UserForConvexBackfill = {
  id: string;
  privyDid: string;
  walletAddress?: string | null;
  email?: string | null;
  username?: string | null;
  role: string;
  isActive: boolean;
  sellerStatus?: string | null;
  createdAt: number;
  updatedAt: number;
};

/**
 * Upsert one user into Convex appUsers (for one-time backfill from Prisma).
 */
export async function syncUserToConvexForBackfill(user: UserForConvexBackfill): Promise<void> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return;
  const { fetchMutation } = await import('convex/nextjs');
  const { api } = await import('../../convex/_generated/api');
  const payload = {
    id: user.id,
    privyDid: user.privyDid,
    walletAddress: user.walletAddress != null ? user.walletAddress : undefined,
    email: user.email != null ? user.email : undefined,
    username: user.username != null ? user.username : undefined,
    role: user.role,
    isActive: user.isActive,
    sellerStatus: user.sellerStatus != null ? user.sellerStatus : undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  await fetchMutation(api.users.upsertForBackfill, payload);
}

/**
 * Sync all given users to Convex appUsers (one-time backfill). Same pattern as syncAllTokensToConvex.
 */
export async function syncAllUsersToConvex(users: UserForConvexBackfill[]): Promise<{
  synced: number;
  failed: number;
  skipped: boolean;
}> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return { synced: 0, failed: 0, skipped: true };
  }
  let synced = 0;
  let failed = 0;
  for (const user of users) {
    try {
      await syncUserToConvexForBackfill(user);
      synced++;
    } catch (err) {
      console.error('[Convex] syncAllUsersToConvex item failed:', user.id, err);
      failed++;
    }
  }
  return { synced, failed, skipped: false };
}

// --- App users sync (Convex → Prisma) ---

export type AppUserFromConvex = {
  id: string;
  privyDid: string;
  walletAddress?: string | null;
  email?: string | null;
  username?: string | null;
  role: string;
  isActive: boolean;
  sellerStatus?: string | null;
  createdAt: number;
  updatedAt: number;
};

/**
 * Upsert a Convex app user into Prisma so Listing.ownerId and other FKs keep working.
 * Call after getOrCreateUser / getById from Convex.
 */
/** Map Convex role to Prisma UserRole (Prisma has no SELLER, map to TRADER). */
function toPrismaRole(role: string): UserRole {
  if (role === 'ADMIN') return 'ADMIN';
  return 'TRADER'; // TRADER or SELLER from Convex
}

/** Map Convex sellerStatus to Prisma SellerStatus (APPLIED→PENDING, VERIFIED→APPROVED). */
function toPrismaSellerStatus(status: string | null | undefined): SellerStatus {
  switch (status) {
    case 'PENDING':
      return 'PENDING';
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'APPLIED':
    case 'VERIFIED':
      return status === 'VERIFIED' ? 'APPROVED' : 'PENDING';
    default:
      return 'NOT_APPLIED';
  }
}

export async function syncAppUserToPrisma(
  prisma: PrismaClient,
  user: AppUserFromConvex,
): Promise<void> {
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      privyDid: user.privyDid,
      walletAddress: user.walletAddress ?? null,
      email: user.email ?? null,
      username: user.username ?? null,
      role: toPrismaRole(user.role),
      isActive: user.isActive,
      sellerStatus: toPrismaSellerStatus(user.sellerStatus),
    },
    update: {
      privyDid: user.privyDid,
      walletAddress: user.walletAddress ?? null,
      email: user.email ?? null,
      username: user.username ?? null,
      role: toPrismaRole(user.role),
      isActive: user.isActive,
      sellerStatus: toPrismaSellerStatus(user.sellerStatus),
      updatedAt: new Date(user.updatedAt),
    },
  });
}
