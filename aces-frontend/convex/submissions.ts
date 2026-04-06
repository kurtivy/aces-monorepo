import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * ── Submissions Mutation ─────────────────────────────────
 *
 * Public mutation for the "Apply to List" form.
 * Handles two concerns in a single call:
 *   1. Upsert the submitter — look up or create a user record
 *      so we always have a valid ownerId for the submission.
 *   2. Insert the submission — persists the form data with a
 *      PENDING status for admin review.
 *
 * The walletAddress arg is the submitter's connected wallet.
 * We use the by_walletAddress index on the users table to
 * check for an existing record before creating a new one.
 *
 * Note: The user record created here uses a placeholder
 * privyDid derived from the wallet address. Once the user
 * authenticates through Privy, the real DID can be linked.
 */
export const create = mutation({
  args: {
    // ── Required fields ──
    title: v.string(),
    symbol: v.string(),
    assetType: v.string(),

    // ── Optional descriptive fields ──
    brand: v.optional(v.string()),
    value: v.optional(v.string()),
    reservePrice: v.optional(v.string()),
    story: v.optional(v.string()),
    details: v.optional(v.string()),
    provenance: v.optional(v.string()),
    hypeSentence: v.optional(v.string()),

    // ── Media — Convex storage IDs from file uploads ──
    imageStorageIds: v.array(v.string()),

    // ── Submitter identity + contact ──
    walletAddress: v.string(),
    contactEmail: v.optional(v.string()),
    contactTelegram: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const now = Date.now();

    // ── Step 1: Resolve the submitter ──────────────────────
    // Look up an existing user by their wallet address.
    // If none exists, create a minimal user record so the
    // submission has a valid ownerId foreign key.
    let user = await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) =>
        q.eq("walletAddress", args.walletAddress),
      )
      .first();

    if (!user) {
      // No existing user — create one with default TRADER role.
      // privyDid is set to a placeholder; it will be updated
      // when the user authenticates via Privy's login flow.
      const userId = await ctx.db.insert("users", {
        privyDid: `wallet:${args.walletAddress}`,
        walletAddress: args.walletAddress,
        role: "TRADER",
        isActive: true,
        sellerStatus: "NOT_APPLIED",
        createdAt: now,
        updatedAt: now,
      });

      // Fetch the newly created user so we have the full doc
      user = await ctx.db.get(userId);
    }

    // Safety check — should never happen, but satisfies TS
    if (!user) {
      throw new Error("Failed to resolve user for submission");
    }

    // ── Step 2: Insert the submission ──────────────────────
    // Status starts as PENDING — an admin will review and
    // either approve (promoting to a listing) or reject.
    const submissionId = await ctx.db.insert("submissions", {
      title: args.title,
      symbol: args.symbol,
      assetType: args.assetType,
      brand: args.brand,
      story: args.story,
      details: args.details,
      provenance: args.provenance,
      value: args.value,
      reservePrice: args.reservePrice,
      hypeSentence: args.hypeSentence,

      // Storage IDs from file uploads — stored as strings in imageGallery.
      // Admin can resolve these to URLs via ctx.storage.getUrl() later.
      imageGallery: args.imageStorageIds,

      // Submission lifecycle fields
      status: "PENDING",
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    // Return the new submission ID so the client can
    // confirm success or navigate to a status page later.
    return submissionId;
  },
});
