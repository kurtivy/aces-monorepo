import { getAuthUserId } from '@convex-dev/auth/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { internal } from './_generated/api';
import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Require the current identity to be an admin (present in admins table by email).
 * Use in Convex query/mutation handlers. Throws if not authenticated or not authorized.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<'admins'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error('Not authenticated');
  }

  const user = await ctx.db.get(userId);
  if (!user?.email) {
    throw new Error('Not authenticated');
  }

  const admin = await ctx.db
    .query('admins')
    .withIndex('by_email', (q) => q.eq('email', user.email!))
    .unique();

  if (!admin) {
    throw new Error('Not authorized');
  }

  return admin;
}

/**
 * Get the current admin if the authenticated user is in the admins table; otherwise null.
 * Use for client-side "is admin logged in" checks.
 */
export const getCurrentAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await requireAdmin(ctx);
    } catch {
      return null;
    }
  },
});

/**
 * Seed an admin by email. Run once per admin (e.g. from Convex dashboard).
 * The user must have already signed up with Convex Auth (same email) to log in.
 */
export const seedAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await ctx.db
      .query('admins')
      .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
      .unique();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert('admins', {
      email: normalizedEmail,
      role: 'superadmin',
      createdAt: Date.now(),
    });
  },
});

/**
 * Reset the Convex Auth password for an admin email.
 * Use when you've forgotten the password and need to set a new one.
 *
 * Run from the Convex Dashboard (Dashboard → Functions → admin:resetAdminPassword → Run)
 * with JSON args: { "email": "your@email.com", "newPassword": "your-new-password" }
 *
 * Password must be at least 8 characters. The account must already exist (user must have
 * signed up once). After running, sign in at /admin/login with the same email and new password.
 */
export const resetAdminPassword = internalMutation({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { email, newPassword }) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    await ctx.runMutation(internal.auth.store, {
      args: {
        type: 'modifyAccount',
        provider: 'password',
        account: { id: normalizedEmail, secret: newPassword },
      },
    });
    return { success: true };
  },
});
