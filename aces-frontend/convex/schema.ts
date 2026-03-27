import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Users ──────────────────────────────────────────────
  users: defineTable({
    privyDid: v.string(),
    walletAddress: v.optional(v.string()),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    role: v.string(), // "TRADER" | "ADMIN"
    isActive: v.boolean(),
    sellerStatus: v.string(), // "NOT_APPLIED" | "PENDING" | "APPROVED" | "REJECTED"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_privyDid", ["privyDid"])
    .index("by_walletAddress", ["walletAddress"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // ── Admins ─────────────────────────────────────────────
  admins: defineTable({
    email: v.string(),
    role: v.string(), // "admin" | "superadmin"
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // ── RWA Submissions ────────────────────────────────────
  submissions: defineTable({
    title: v.string(),
    symbol: v.string(),
    brand: v.optional(v.string()),
    story: v.optional(v.string()),
    details: v.optional(v.string()),
    provenance: v.optional(v.string()),
    value: v.optional(v.string()),
    reservePrice: v.optional(v.string()),
    hypeSentence: v.optional(v.string()),
    assetType: v.string(), // VEHICLE | JEWELRY | COLLECTIBLE | ART | FASHION | ALCOHOL | OTHER
    imageGallery: v.array(v.string()),
    ownershipDocumentation: v.optional(v.array(v.string())),
    status: v.string(), // PENDING | APPROVED | REJECTED
    ownerId: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_symbol", ["symbol"]),

  // ── RWA Listings ───────────────────────────────────────
  listings: defineTable({
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
    assetDetails: v.optional(v.string()), // JSON string
    hypePoints: v.optional(v.number()),
    startingBidPrice: v.optional(v.string()),
    isLive: v.boolean(),
    launchDate: v.optional(v.string()),
    tokenCreationStatus: v.optional(v.string()), // AWAITING_USER_DETAILS | PENDING_ADMIN_REVIEW | READY_TO_MINT | MINTED
    tokenParameters: v.optional(v.string()), // JSON string
    submissionId: v.optional(v.id("submissions")),
    ownerId: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    showOnCanvas: v.boolean(),
    isFeatured: v.boolean(),
    showOnDrops: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_symbol", ["symbol"])
    .index("by_ownerId", ["ownerId"])
    .index("by_isLive", ["isLive"])
    .index("by_showOnCanvas", ["showOnCanvas"])
    .index("by_showOnDrops", ["showOnDrops"]),

  // ── Tokens ─────────────────────────────────────────────
  tokens: defineTable({
    contractAddress: v.string(), // lowercase normalized
    symbol: v.string(),
    name: v.string(),
    decimals: v.number(),
    chainId: v.number(), // 8453 = Base Mainnet
    listingId: v.optional(v.id("listings")),
    poolAddress: v.optional(v.string()),
    phase: v.string(), // BONDING_CURVE | DEX_TRADING
    priceSource: v.string(), // BONDING_CURVE | DEX
    currentPrice: v.optional(v.string()),
    currentPriceAces: v.optional(v.string()),
    volume24h: v.optional(v.string()),
    isActive: v.boolean(),
    dexLiveAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_contractAddress", ["contractAddress"])
    .index("by_chainId", ["chainId"])
    .index("by_isActive", ["isActive"])
    .index("by_listingId", ["listingId"])
    .index("by_symbol", ["symbol"]),

  // ── Canvas Items (denormalized for perf) ───────────────
  canvasItems: defineTable({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    symbol: v.optional(v.string()),
    ticker: v.optional(v.string()),
    date: v.optional(v.string()),
    countdownDate: v.optional(v.string()),
    image: v.optional(v.string()),
    rrp: v.optional(v.string()),
    tokenPrice: v.optional(v.string()),
    marketCap: v.optional(v.string()),
    tokenSupply: v.optional(v.string()),
    listingId: v.optional(v.id("listings")),
    showOnCanvas: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    isLive: v.optional(v.boolean()),
    showOnDrops: v.optional(v.boolean()),
  })
    .index("by_listingId", ["listingId"])
    .index("by_showOnCanvas", ["showOnCanvas"])
    .index("by_isFeatured", ["isFeatured"])
    .index("by_showOnDrops", ["showOnDrops"]),

  // ── Trades (synced from chain) ─────────────────────────
  trades: defineTable({
    txHash: v.string(),
    tokenAddress: v.string(), // lowercase
    tradeType: v.string(), // BUY | SELL
    trader: v.string(), // wallet address
    tokenAmount: v.string(), // bigint as string
    acesAmount: v.string(), // bigint as string
    pricePerToken: v.optional(v.string()),
    protocolFee: v.optional(v.string()),
    subjectFee: v.optional(v.string()),
    blockNumber: v.number(),
    timestamp: v.number(),
  })
    .index("by_tokenAddress", ["tokenAddress"])
    .index("by_timestamp", ["timestamp"])
    .index("by_txHash", ["txHash"])
    .index("by_token_time", ["tokenAddress", "timestamp"]),

  // ── OHLCV Candles (aggregated from trades) ─────────────
  candles: defineTable({
    tokenAddress: v.string(),
    timeframe: v.string(), // 1m | 5m | 15m | 1h | 4h | 1d
    openTime: v.number(), // unix timestamp (start of period)
    open: v.string(),
    high: v.string(),
    low: v.string(),
    close: v.string(),
    volume: v.string(),
    tradeCount: v.number(),
  })
    .index("by_token_timeframe", ["tokenAddress", "timeframe"])
    .index("by_token_timeframe_time", [
      "tokenAddress",
      "timeframe",
      "openTime",
    ]),

  // ── Bids ───────────────────────────────────────────────
  bids: defineTable({
    listingId: v.id("listings"),
    bidderId: v.id("users"),
    amount: v.string(),
    currency: v.string(), // USD | ACES | ETH
    message: v.optional(v.string()),
    status: v.string(), // PENDING | ACCEPTED | REJECTED | EXPIRED | WITHDRAWN
    expiresAt: v.number(),
    previousBidId: v.optional(v.id("bids")),
    respondedAt: v.optional(v.number()),
    responseMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_listingId", ["listingId"])
    .index("by_bidderId", ["bidderId"])
    .index("by_status", ["status"]),

  // ── Comments ───────────────────────────────────────────
  comments: defineTable({
    listingId: v.id("listings"),
    userId: v.id("users"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
    likes: v.number(),
    createdAt: v.number(),
  })
    .index("by_listingId", ["listingId"])
    .index("by_parentId", ["parentId"]),

  // ── Comment Likes ──────────────────────────────────────
  commentLikes: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
  })
    .index("by_commentId", ["commentId"])
    .index("by_userId_commentId", ["userId", "commentId"]),

  // ── Notifications ──────────────────────────────────────
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(), // LISTING_APPROVED | TOKEN_READY | BID_RECEIVED | etc
    title: v.string(),
    message: v.string(),
    relatedId: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isRead", ["userId", "isRead"]),

  // ── Token Metrics (populated by on-chain cron) ────────
  tokenMetrics: defineTable({
    symbol: v.string(),
    /** Current token price in USD */
    tokenPriceUsd: v.number(),
    /** Market cap = totalSupply × tokenPriceUsd */
    marketCapUsd: v.number(),
    /** Total LP pool value in USD */
    liquidityUsd: v.number(),
    /** Trade reward percentage (communityReward / eligibleValue × 100) */
    tradeRewardPct: v.number(),
    /** Tokens outside the LP pool (eligible for community reward) */
    eligibleSupply: v.optional(v.number()),
    /** Community reward pool in USD (static, passed through for client convenience) */
    communityRewardUsd: v.optional(v.number()),
    /** ACES/USD price used for this calculation */
    acesPriceUsd: v.number(),
    /** ETH/USD price from Chainlink */
    ethPriceUsd: v.number(),
    /** Last update timestamp */
    updatedAt: v.number(),
  }).index("by_symbol", ["symbol"]),

  // ── Sync Cursors (track block-scanning progress) ──────
  syncCursors: defineTable({
    key: v.string(), // e.g. "tradeSyncer"
    blockNumber: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ── ACES Price Snapshots ───────────────────────────────
  priceSnapshots: defineTable({
    priceUsd: v.string(),
    source: v.string(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});
