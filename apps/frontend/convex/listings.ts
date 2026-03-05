import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

const listingValidator = {
  id: v.string(),
  title: v.string(),
  symbol: v.string(),
  brand: v.optional(v.string()),
  story: v.optional(v.string()),
  details: v.optional(v.string()),
  provenance: v.optional(v.string()),
  value: v.optional(v.string()),
  reservePrice: v.optional(v.string()),
  hypeSentence: v.optional(v.string()),
  assetType: v.string(),
  imageGallery: v.array(v.string()),
  location: v.optional(v.string()),
  assetDetails: v.optional(v.string()),
  hypePoints: v.array(v.string()),
  startingBidPrice: v.optional(v.string()),
  isLive: v.boolean(),
  launchDate: v.optional(v.string()),
  ownerId: v.string(),
  approvedBy: v.optional(v.string()),
  submissionId: v.optional(v.string()),
  showOnCanvas: v.boolean(),
  isFeatured: v.boolean(),
  showOnDrops: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
};

/**
 * Get listing by symbol (case-insensitive).
 * Joins with tokens table (via listingId) and appUsers (via ownerId).
 */
export const getBySymbol = query({
  args: { symbol: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.symbol.trim();
    if (!trimmed) return null;

    // Symbols are stored uppercase — normalise input and use the index directly
    const upperSymbol = trimmed.toUpperCase();
    const listing = await ctx.db
      .query('listings')
      .withIndex('by_symbol', (q) => q.eq('symbol', upperSymbol))
      .first();

    if (!listing) return null;

    // Join with token (if listingId matches)
    const token = await ctx.db
      .query('tokens')
      .withIndex('by_listingId', (q) => q.eq('listingId', listing.id))
      .first();

    // Join with owner
    const owner = await ctx.db
      .query('appUsers')
      .withIndex('by_stable_id', (q) => q.eq('id', listing.ownerId))
      .first();

    // Join with approvedBy user if exists
    let approvedByUser = null;
    if (listing.approvedBy) {
      approvedByUser = await ctx.db
        .query('appUsers')
        .withIndex('by_stable_id', (q) => q.eq('id', listing.approvedBy!))
        .first();
    }

    return {
      listing,
      token: token ?? null,
      owner: owner ?? null,
      approvedByUser: approvedByUser,
    };
  },
});

/**
 * Get listing by Convex document _id.
 */
export const getByConvexId = query({
  args: { _id: v.id('listings') },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args._id);
    if (!listing) return null;

    // Join with token (if listingId matches)
    const token = await ctx.db
      .query('tokens')
      .withIndex('by_listingId', (q) => q.eq('listingId', listing.id))
      .first();

    // Join with owner
    const owner = await ctx.db
      .query('appUsers')
      .withIndex('by_stable_id', (q) => q.eq('id', listing.ownerId))
      .first();

    // Join with approvedBy user if exists
    let approvedByUser = null;
    if (listing.approvedBy) {
      approvedByUser = await ctx.db
        .query('appUsers')
        .withIndex('by_stable_id', (q) => q.eq('id', listing.approvedBy!))
        .first();
    }

    return {
      listing,
      token: token ?? null,
      owner: owner ?? null,
      approvedByUser: approvedByUser,
    };
  },
});

/**
 * Get listing by stable id.
 */
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const listing = await ctx.db
      .query('listings')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();
    
    if (!listing) return null;

    // Join with token (if listingId matches)
    const token = await ctx.db
      .query('tokens')
      .withIndex('by_listingId', (q) => q.eq('listingId', listing.id))
      .first();

    // Join with owner
    const owner = await ctx.db
      .query('appUsers')
      .withIndex('by_stable_id', (q) => q.eq('id', listing.ownerId))
      .first();

    // Join with approvedBy user if exists
    let approvedByUser = null;
    if (listing.approvedBy) {
      approvedByUser = await ctx.db
        .query('appUsers')
        .withIndex('by_stable_id', (q) => q.eq('id', listing.approvedBy!))
        .first();
    }

    return {
      listing,
      token: token ?? null,
      owner: owner ?? null,
      approvedByUser: approvedByUser,
    };
  },
});

/**
 * List all listings (for admin panel).
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const listings = await ctx.db
      .query('listings')
      .order('desc')
      .take(limit);

    // Join with tokens and owners for each listing
    const enriched = await Promise.all(
      listings.map(async (listing) => {
        const token = await ctx.db
          .query('tokens')
          .withIndex('by_listingId', (q) => q.eq('listingId', listing.id))
          .first();

        const owner = await ctx.db
          .query('appUsers')
          .withIndex('by_stable_id', (q) => q.eq('id', listing.ownerId))
          .first();

        return {
          listing,
          token: token ?? null,
          owner: owner ?? null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Insert a new listing.
 * Idempotent by id: if a listing with this id exists, update it.
 */
export const insert = mutation({
  args: listingValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('listings')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        symbol: args.symbol,
        brand: args.brand,
        story: args.story,
        details: args.details,
        provenance: args.provenance,
        value: args.value,
        reservePrice: args.reservePrice,
        hypeSentence: args.hypeSentence,
        assetType: args.assetType,
        imageGallery: args.imageGallery,
        location: args.location,
        assetDetails: args.assetDetails,
        hypePoints: args.hypePoints,
        startingBidPrice: args.startingBidPrice,
        isLive: args.isLive,
        launchDate: args.launchDate,
        ownerId: args.ownerId,
        approvedBy: args.approvedBy,
        submissionId: args.submissionId,
        showOnCanvas: args.showOnCanvas,
        isFeatured: args.isFeatured,
        showOnDrops: args.showOnDrops,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert('listings', args);
  },
});

/**
 * Update a listing by id.
 */
export const update = mutation({
  args: {
    id: v.string(),
    patch: v.object({
      title: v.optional(v.string()),
      symbol: v.optional(v.string()),
      brand: v.optional(v.string()),
      story: v.optional(v.string()),
      details: v.optional(v.string()),
      provenance: v.optional(v.string()),
      value: v.optional(v.string()),
      reservePrice: v.optional(v.string()),
      hypeSentence: v.optional(v.string()),
      assetType: v.optional(v.string()),
      imageGallery: v.optional(v.array(v.string())),
      location: v.optional(v.string()),
      assetDetails: v.optional(v.string()),
      hypePoints: v.optional(v.array(v.string())),
      startingBidPrice: v.optional(v.string()),
      launchDate: v.optional(v.string()),
      showOnCanvas: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      showOnDrops: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db
      .query('listings')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();

    if (!listing) return null;

    await ctx.db.patch(listing._id, {
      ...args.patch,
      updatedAt: Date.now(),
    });

    return listing._id;
  },
});

/**
 * Set isLive status for a listing.
 */
export const setLive = mutation({
  args: {
    id: v.string(),
    isLive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db
      .query('listings')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();

    if (!listing) return null;

    const updateData: any = {
      isLive: args.isLive,
      updatedAt: Date.now(),
    };

    // If setting live and no launchDate, set it to now
    if (args.isLive && !listing.launchDate) {
      updateData.launchDate = new Date().toISOString();
    }

    await ctx.db.patch(listing._id, updateData);

    return listing._id;
  },
});

/**
 * Delete a listing by id.
 */
export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const listing = await ctx.db
      .query('listings')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();

    if (!listing) return null;

    await ctx.db.delete(listing._id);
    return listing._id;
  },
});
