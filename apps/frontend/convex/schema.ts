import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Canvas items: metadata for infinite canvas tiles and drops page.
 * Synced from Prisma Listing when showOnCanvas/showOnDrops; also holds static/special tiles.
 */
export default defineSchema({
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
});
