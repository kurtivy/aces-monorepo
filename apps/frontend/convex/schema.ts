import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

/**
 * Canvas items: metadata for infinite canvas tiles and drops page.
 * Synced from Prisma Listing when showOnCanvas/showOnDrops; also holds static/special tiles.
 */
export default defineSchema({
  ...authTables,

  /** Admins: email + role for Convex Auth admin authorization. */
  admins: defineTable({
    email: v.string(),
    role: v.union(v.literal('admin'), v.literal('superadmin')),
    createdAt: v.number(),
  }).index('by_email', ['email']),

  canvasItems: defineTable({
    // Stable id for the item (e.g. "27", "click-to-trade") – used for routing and featured lookup
    id: v.string(),
    title: v.string(),
    description: v.string(),
    symbol: v.optional(v.string()),
    ticker: v.optional(v.string()),
    date: v.optional(v.string()),
    countdownDate: v.optional(v.string()),
    image: v.optional(v.string()),
    rrp: v.optional(v.number()),
    tokenPrice: v.optional(v.number()),
    marketCap: v.optional(v.number()),
    tokenSupply: v.optional(v.number()),
    listingId: v.optional(v.string()),
    showOnCanvas: v.boolean(),
    isFeatured: v.boolean(),
    isLive: v.boolean(),
    showOnDrops: v.boolean(),
  })
    .index('by_listingId', ['listingId'])
    .index('by_showOnCanvas', ['showOnCanvas'])
    .index('by_showOnDrops', ['showOnDrops'])
    .index('by_isFeatured', ['isFeatured'])
    .index('by_stable_id', ['id']),

  /**
   * App users: source of truth for user/account identity (Privy + admin).
   * Synced to Prisma so Listing.ownerId and other FKs keep working.
   * id is stable cuid (same as Prisma User.id).
   */
  appUsers: defineTable({
    id: v.string(),
    privyDid: v.string(),
    walletAddress: v.optional(v.string()),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    role: v.string(),
    isActive: v.boolean(),
    sellerStatus: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_privyDid', ['privyDid'])
    .index('by_stable_id', ['id']),

  /**
   * Tokens: our curated token list, synced from Prisma when tokens are created.
   * Used for profile holdings and future canvas/UI use.
   */
  tokens: defineTable({
    contractAddress: v.string(),
    symbol: v.string(),
    name: v.string(),
    chainId: v.number(),
    decimals: v.optional(v.number()),
    listingId: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index('by_contractAddress', ['contractAddress'])
    .index('by_chainId', ['chainId'])
    .index('by_isActive', ['isActive']),
});
