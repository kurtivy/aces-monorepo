import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/** Generate a unique id for new users (Convex runtime supports crypto.randomUUID). */
function generateId(): string {
  return crypto.randomUUID();
}

const appUserValidator = {
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
};

/**
 * Get app user by stable id (cuid). For admin resolution and sync checks.
 */
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('appUsers')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();
  },
});

/**
 * Get app user by Privy DID.
 */
export const getByPrivyDid = query({
  args: { privyDid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('appUsers')
      .withIndex('by_privyDid', (q) => q.eq('privyDid', args.privyDid))
      .first();
  },
});

/**
 * Get or create user by Privy DID. Updates wallet/email/username if provided and different.
 * Returns user doc so callers can sync to Prisma. New users get a new cuid for id.
 */
export const getOrCreateUser = mutation({
  args: {
    privyDid: v.string(),
    walletAddress: v.optional(v.string()),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('appUsers')
      .withIndex('by_privyDid', (q) => q.eq('privyDid', args.privyDid))
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (args.walletAddress !== undefined && existing.walletAddress !== args.walletAddress) {
        updates.walletAddress = args.walletAddress || undefined;
      }
      if (args.email !== undefined && existing.email !== args.email) {
        updates.email = args.email || undefined;
      }
      if (args.username !== undefined && existing.username !== args.username) {
        updates.username = args.username || undefined;
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        await ctx.db.patch(existing._id, updates as Partial<typeof existing>);
        const updated = await ctx.db.get(existing._id);
        return updated!;
      }
      return existing;
    }

    const id = generateId();
    await ctx.db.insert('appUsers', {
      id,
      privyDid: args.privyDid,
      walletAddress: args.walletAddress ?? undefined,
      email: args.email ?? undefined,
      username: args.username ?? undefined,
      role: args.role ?? 'TRADER',
      isActive: true,
      sellerStatus: 'NOT_APPLIED',
      createdAt: now,
      updatedAt: now,
    });
    const created = await ctx.db
      .query('appUsers')
      .withIndex('by_stable_id', (q) => q.eq('id', id))
      .first();
    return created!;
  },
});

/**
 * Update user by id. Partial updates for wallet, email, username.
 */
export const updateUser = mutation({
  args: {
    id: v.string(),
    walletAddress: v.optional(v.string()),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('appUsers')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();
    if (!existing) return null;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.walletAddress !== undefined) updates.walletAddress = args.walletAddress || undefined;
    if (args.email !== undefined) updates.email = args.email || undefined;
    if (args.username !== undefined) updates.username = args.username || undefined;
    await ctx.db.patch(existing._id, updates as Partial<typeof existing>);
    return await ctx.db.get(existing._id);
  },
});

/**
 * Minimal test mutation: insert/update with required fields only.
 * Run from Convex dashboard with: {"id":"t1","privyDid":"did:test","role":"TRADER","isActive":true,"createdAt":1,"updatedAt":1}
 * to verify appUsers table works.
 */
export const insertOneTest = mutation({
  args: {
    id: v.string(),
    privyDid: v.string(),
    role: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('appUsers')
      .withIndex('by_stable_id', (q) => q.eq('id', args.id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role, updatedAt: args.updatedAt });
      return existing._id;
    }
    return await ctx.db.insert('appUsers', {
      id: args.id,
      privyDid: args.privyDid,
      role: args.role,
      isActive: args.isActive,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});

/** Build a doc for appUsers with only defined fields (no undefined keys). */
function toAppUserDoc(args: {
  id: string;
  privyDid: string;
  walletAddress?: string;
  email?: string;
  username?: string;
  role: string;
  isActive: boolean;
  sellerStatus?: string;
  createdAt: number;
  updatedAt: number;
}) {
  const doc: Record<string, unknown> = {
    id: args.id,
    privyDid: args.privyDid,
    role: args.role,
    isActive: args.isActive,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
  };
  if (args.walletAddress != null && args.walletAddress !== '')
    doc.walletAddress = args.walletAddress;
  if (args.email != null && args.email !== '') doc.email = args.email;
  if (args.username != null && args.username !== '') doc.username = args.username;
  if (args.sellerStatus != null && args.sellerStatus !== '') doc.sellerStatus = args.sellerStatus;
  return doc;
}

export const upsertForBackfill = mutation({
  args: appUserValidator,
  handler: async (ctx, args) => {
    try {
      const existing = await ctx.db
        .query('appUsers')
        .withIndex('by_stable_id', (q) => q.eq('id', args.id))
        .first();
      const doc = toAppUserDoc(args);
      if (existing) {
        const patch: Record<string, unknown> = {
          privyDid: args.privyDid,
          role: args.role,
          isActive: args.isActive,
          updatedAt: args.updatedAt,
        };
        if (args.walletAddress != null) patch.walletAddress = args.walletAddress;
        if (args.email != null) patch.email = args.email;
        if (args.username != null) patch.username = args.username;
        if (args.sellerStatus != null) patch.sellerStatus = args.sellerStatus;
        await ctx.db.patch(existing._id, patch);
        return existing._id;
      }
      return await ctx.db.insert('appUsers', doc);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`BACKFILL_ERROR: ${message}`);
    }
  },
});
