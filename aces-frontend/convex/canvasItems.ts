import { query } from "./_generated/server";

export const listForCanvas = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("canvasItems")
      .withIndex("by_showOnCanvas", (q) => q.eq("showOnCanvas", true))
      .collect();
  },
});

export const listForDrops = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("canvasItems")
      .withIndex("by_showOnDrops", (q) => q.eq("showOnDrops", true))
      .collect();
  },
});

export const getFeatured = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("canvasItems")
      .withIndex("by_isFeatured", (q) => q.eq("isFeatured", true))
      .first();
  },
});
