import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

const canvasItemValidator = {
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
};

/**
 * List all canvas items that should appear on the infinite canvas.
 */
export const listForCanvas = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('canvasItems')
      .withIndex('by_showOnCanvas', (q) => q.eq('showOnCanvas', true))
      .order('asc')
      .collect();
  },
});

/**
 * List all canvas items that should appear on the drops/upcoming page.
 */
export const listForDrops = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('canvasItems')
      .withIndex('by_showOnDrops', (q) => q.eq('showOnDrops', true))
      .order('asc')
      .collect();
  },
});

/**
 * Get the single featured item (for the featured section).
 */
export const getFeatured = query({
  args: {},
  handler: async (ctx) => {
    const item = await ctx.db
      .query('canvasItems')
      .withIndex('by_isFeatured', (q) => q.eq('isFeatured', true))
      .first();
    return item ?? null;
  },
});

/**
 * Insert a canvas item (e.g. when creating a listing with showOnCanvas).
 * Idempotent by id: if an item with this id exists, replace it (or skip per your policy).
 */
export const insertCanvasItem = mutation({
  args: canvasItemValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('canvasItems')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        description: args.description,
        symbol: args.symbol,
        ticker: args.ticker,
        date: args.date,
        countdownDate: args.countdownDate,
        image: args.image,
        rrp: args.rrp,
        tokenPrice: args.tokenPrice,
        marketCap: args.marketCap,
        tokenSupply: args.tokenSupply,
        listingId: args.listingId,
        showOnCanvas: args.showOnCanvas,
        isFeatured: args.isFeatured,
        isLive: args.isLive,
        showOnDrops: args.showOnDrops,
      });
      return existing._id;
    }
    return await ctx.db.insert('canvasItems', args);
  },
});

/**
 * Update a canvas item (e.g. isLive when toggling listing live, or showOnCanvas, isFeatured, showOnDrops).
 */
export const updateCanvasItem = mutation({
  args: {
    listingId: v.string(),
    patch: v.object({
      isLive: v.optional(v.boolean()),
      showOnCanvas: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      showOnDrops: v.optional(v.boolean()),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      symbol: v.optional(v.string()),
      ticker: v.optional(v.string()),
      countdownDate: v.optional(v.string()),
      rrp: v.optional(v.number()),
      tokenPrice: v.optional(v.number()),
      marketCap: v.optional(v.number()),
      tokenSupply: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query('canvasItems')
      .withIndex('by_listingId', (q) => q.eq('listingId', args.listingId))
      .first();
    if (!item) return null;
    await ctx.db.patch(item._id, args.patch);
    return item._id;
  },
});

/**
 * Update by stable id (for items that don't have listingId, e.g. migrated static items).
 */
export const updateCanvasItemById = mutation({
  args: {
    id: v.string(),
    patch: v.object({
      isLive: v.optional(v.boolean()),
      showOnCanvas: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      showOnDrops: v.optional(v.boolean()),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      symbol: v.optional(v.string()),
      ticker: v.optional(v.string()),
      countdownDate: v.optional(v.string()),
      rrp: v.optional(v.number()),
      tokenPrice: v.optional(v.number()),
      marketCap: v.optional(v.number()),
      tokenSupply: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query('canvasItems')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();
    if (!item) return null;
    await ctx.db.patch(item._id, args.patch);
    return item._id;
  },
});

/**
 * List listingIds of all canvas items with showOnCanvas true (for sync pruning).
 */
export const listCanvasListingIds = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query('canvasItems')
      .withIndex('by_showOnCanvas', (q) => q.eq('showOnCanvas', true))
      .collect();
    return items.map((doc) => doc.listingId).filter((id): id is string => id != null);
  },
});

/**
 * Remove a canvas item by listingId (e.g. when listing has no image and should not appear on canvas).
 */
export const removeByListingId = mutation({
  args: { listingId: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query('canvasItems')
      .withIndex('by_listingId', (q) => q.eq('listingId', args.listingId))
      .first();
    if (!item) return null;
    await ctx.db.delete(item._id);
    return item._id;
  },
});

/**
 * Set exactly one item as featured (set isFeatured true for this id, false for all others).
 */
export const setFeatured = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query('canvasItems').collect();
    for (const doc of all) {
      await ctx.db.patch(doc._id, {
        isFeatured: doc.id === args.id,
      });
    }
    return args.id;
  },
});

/**
 * Patch a canvas item by its Convex document _id (e.g. to set showOnCanvas so it appears on the home canvas).
 * Run from Convex dashboard Functions with args: { convexId: "j57b5py5tn8nj3bctrx9waj08s80dq8x", patch: { showOnCanvas: true } }
 */
export const patchByConvexId = mutation({
  args: {
    convexId: v.id('canvasItems'),
    patch: v.object({
      showOnCanvas: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      showOnDrops: v.optional(v.boolean()),
      isLive: v.optional(v.boolean()),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      symbol: v.optional(v.string()),
      ticker: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.convexId, args.patch);
    return args.convexId;
  },
});
