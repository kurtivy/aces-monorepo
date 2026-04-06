/**
 * File storage helpers for Convex.
 *
 * Convex has built-in file storage — files are uploaded via a two-step flow:
 * 1. Client calls generateUploadUrl to get a short-lived signed URL
 * 2. Client POSTs the file directly to that URL, receives a storageId
 * 3. Client passes the storageId to a mutation that saves it in a document
 *
 * getUrl converts a storageId back to a public URL for display.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate a short-lived upload URL.
 * The client calls this, then POSTs the file to the returned URL.
 * No auth required — the URL itself is the credential and expires quickly.
 */
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

/**
 * Get a public URL for a stored file by its storageId.
 * Returns null if the file doesn't exist.
 */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
