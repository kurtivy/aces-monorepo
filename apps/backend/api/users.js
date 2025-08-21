// Prisma runtime polyfill for serverless
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = require('node-fetch');
}
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/api/users.ts
var users_exports = {};
__export(users_exports, {
  default: () => users_default
});
module.exports = __toCommonJS(users_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));

// src/lib/logger.ts
var import_pino = require("pino");
var logger = (0, import_pino.pino)({
  level: process.env.LOG_LEVEL || "info",
  transport: false ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname"
    }
  } : void 0,
  formatters: {
    level: /* @__PURE__ */ __name((label) => ({ level: label }), "level")
  },
  timestamp: import_pino.pino.stdTimeFunctions.isoTime,
  base: {
    service: "aces-backend",
    version: process.env.npm_package_version || "1.0.0"
  }
});
var loggers = {
  request: /* @__PURE__ */ __name((requestId, method, url, userAgent) => logger.info(
    {
      type: "request",
      requestId,
      method,
      url,
      userAgent
    },
    "Request received"
  ), "request"),
  response: /* @__PURE__ */ __name((requestId, method, url, statusCode, responseTime) => logger.info(
    {
      type: "response",
      requestId,
      method,
      url,
      statusCode,
      responseTime
    },
    "Request completed"
  ), "response"),
  auth: /* @__PURE__ */ __name((userId, walletAddress, action) => logger.info(
    {
      type: "auth",
      userId,
      walletAddress,
      action
    },
    `User ${action}`
  ), "auth"),
  blockchain: /* @__PURE__ */ __name((txHash, action, contractAddress) => logger.info(
    {
      type: "blockchain",
      txHash,
      action,
      contractAddress
    },
    `Blockchain ${action}`
  ), "blockchain"),
  database: /* @__PURE__ */ __name((operation, table, recordId, duration) => logger.info(
    {
      type: "database",
      operation,
      table,
      recordId,
      duration
    },
    `Database ${operation}`
  ), "database"),
  error: /* @__PURE__ */ __name((error, context = {}) => logger.error(
    {
      type: "error",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...context
    },
    error.message
  ), "error")
};

// src/lib/database.ts
var import_client = require("@prisma/client");
var createPrismaClient = /* @__PURE__ */ __name(() => {
  console.log("\u{1F527} Creating Prisma client...");
  console.log("Database URL exists:", !!process.env.DATABASE_URL);
  const prisma2 = new import_client.PrismaClient({
    log: [
      {
        emit: "event",
        level: "query"
      },
      {
        emit: "event",
        level: "error"
      },
      {
        emit: "event",
        level: "info"
      },
      {
        emit: "event",
        level: "warn"
      }
    ],
    errorFormat: "pretty"
  });
  if (false) {
    prisma2.$on("query", (e) => {
      logger.debug(
        {
          type: "database",
          query: e.query,
          params: e.params,
          duration: e.duration
        },
        "Database query executed"
      );
    });
  }
  prisma2.$on("error", (e) => {
    logger.error(
      {
        type: "database",
        error: e
      },
      "Database error occurred"
    );
  });
  prisma2.$use(
    async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;
      if (duration > 1e3) {
        logger.warn(
          {
            type: "database",
            action: params.action,
            model: params.model,
            duration
          },
          "Slow database query detected"
        );
      }
      return result;
    }
  );
  console.log("\u2705 Prisma client created successfully");
  return prisma2;
}, "createPrismaClient");
var prisma = null;
var getPrismaClient = /* @__PURE__ */ __name(() => {
  try {
    if (!prisma) {
      prisma = createPrismaClient();
    }
    return prisma;
  } catch (error) {
    console.error("\u274C Failed to create Prisma client:", error);
    logger.error("Failed to create Prisma client", error);
    throw error;
  }
}, "getPrismaClient");
var disconnectDatabase = /* @__PURE__ */ __name(async (timeoutMs = 5e3) => {
  if (prisma) {
    try {
      console.log("\u{1F527} Disconnecting from database...");
      const disconnectPromise = prisma.$disconnect();
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Database disconnect timeout")), timeoutMs)
      );
      await Promise.race([disconnectPromise, timeoutPromise]);
      prisma = null;
      console.log("\u2705 Database disconnected successfully");
      logger.info("Database connection closed");
    } catch (error) {
      console.error("\u274C Error disconnecting from database:", error);
      logger.error("Error disconnecting from database", error);
      prisma = null;
    }
  }
}, "disconnectDatabase");

// src/lib/errors.ts
var import_boom = require("@hapi/boom");
var AppError = class extends Error {
  constructor(message, code, meta) {
    super(message);
    this.code = code;
    this.meta = meta;
    this.name = "AppError";
  }
  static {
    __name(this, "AppError");
  }
};
async function handleError(error, reply) {
  if (error instanceof AppError) {
    await reply.status(400).send({
      error: error.code,
      message: error.message,
      meta: error.meta
    });
    return;
  }
  if (error instanceof import_boom.Boom) {
    await reply.status(error.output.statusCode).send(error.output.payload);
    return;
  }
  const internalError = (0, import_boom.internal)("An unexpected error occurred");
  await reply.status(internalError.output.statusCode).send(internalError.output.payload);
}
__name(handleError, "handleError");
var errors = {
  unauthorized: /* @__PURE__ */ __name((message) => (0, import_boom.unauthorized)(message || "Unauthorized"), "unauthorized"),
  forbidden: /* @__PURE__ */ __name((message) => (0, import_boom.forbidden)(message || "Forbidden"), "forbidden"),
  notFound: /* @__PURE__ */ __name((resource) => (0, import_boom.notFound)(resource ? `${resource} not found` : "Not found"), "notFound"),
  validation: /* @__PURE__ */ __name((message, meta) => new AppError(message, "VALIDATION_ERROR", meta), "validation"),
  conflict: /* @__PURE__ */ __name((message) => (0, import_boom.conflict)(message), "conflict"),
  badRequest: /* @__PURE__ */ __name((message) => (0, import_boom.badRequest)(message), "badRequest"),
  tooManyRequests: /* @__PURE__ */ __name((message) => new import_boom.Boom(message, { statusCode: 429 }), "tooManyRequests"),
  internal: /* @__PURE__ */ __name((message, { cause } = {}) => {
    const error = (0, import_boom.internal)(message);
    if (cause) error.data = { cause };
    return error;
  }, "internal")
};

// src/plugins/auth.ts
var import_fastify_plugin = __toESM(require("fastify-plugin"));

// src/lib/auth-middleware.ts
var import_client2 = require("@prisma/client");
function createAuthContext(user) {
  try {
    console.log("\u{1F50D} createAuthContext called with:", {
      userExists: !!user,
      userActive: user?.isActive,
      sellerStatus: user?.sellerStatus,
      enumsAvailable: {
        SellerStatus: typeof import_client2.SellerStatus,
        UserRole: typeof import_client2.UserRole
      }
    });
    if (!user) {
      return {
        user: null,
        isAuthenticated: false,
        hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
        isSellerVerified: false,
        canAccessSellerDashboard: false
      };
    }
    const isAuthenticated = !!user && user.isActive;
    let isSellerVerified = false;
    if (user.sellerStatus) {
      isSellerVerified = user.sellerStatus === "APPROVED";
      if (!isSellerVerified && typeof import_client2.SellerStatus !== "undefined") {
        try {
          isSellerVerified = user.sellerStatus === import_client2.SellerStatus.APPROVED;
        } catch (enumError) {
          console.warn("Prisma SellerStatus enum not available:", enumError);
        }
      }
    }
    const canAccessSellerDashboard = isSellerVerified && !!user?.verifiedAt;
    console.log("\u2705 Auth context created:", {
      isAuthenticated,
      isSellerVerified,
      canAccessSellerDashboard,
      userRole: user.role
    });
    return {
      user,
      isAuthenticated,
      hasRole: /* @__PURE__ */ __name((role) => {
        if (!user) return false;
        try {
          const roles = Array.isArray(role) ? role : [role];
          return roles.some((r) => {
            return user.role === r;
          });
        } catch (error) {
          console.error("Error checking user role:", error);
          return false;
        }
      }, "hasRole"),
      isSellerVerified,
      canAccessSellerDashboard
    };
  } catch (error) {
    console.error("\u274C Critical error in createAuthContext:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : void 0,
      userProvided: !!user
    });
    return {
      user,
      isAuthenticated: false,
      hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
      isSellerVerified: false,
      canAccessSellerDashboard: false
    };
  }
}
__name(createAuthContext, "createAuthContext");
async function requireAuth(request, _reply) {
  if (!request.auth) {
    console.error("\u274C request.auth is null/undefined");
    throw errors.unauthorized("Authentication not initialized");
  }
  if (!request.auth.isAuthenticated) {
    console.error("\u274C User not authenticated");
    throw errors.unauthorized("Authentication required");
  }
}
__name(requireAuth, "requireAuth");
async function optionalAuth(_request) {
}
__name(optionalAuth, "optionalAuth");
function canAccessResource(user, resourceOwnerId, requiredRole) {
  if (!user) return false;
  if (user.id === resourceOwnerId) return true;
  if (requiredRole) {
    try {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      return roles.some((role) => user.role === role);
    } catch (error) {
      console.error("Error checking resource access role:", error);
      return false;
    }
  }
  return false;
}
__name(canAccessResource, "canAccessResource");

// src/plugins/auth.ts
var registerAuthPlugin = /* @__PURE__ */ __name(async (fastify) => {
  console.log("\u{1F527} Registering enhanced auth plugin...");
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("auth", null);
  fastify.addHook("preHandler", async (request, reply) => {
    const startTime = Date.now();
    try {
      console.log("\u{1F50D} Auth hook triggered for:", {
        url: request.url,
        method: request.method,
        hasAuthHeader: !!request.headers.authorization
      });
      const authHeader = request.headers.authorization;
      const publicPaths = [
        "/health",
        "/api/health",
        "/live",
        "/search",
        "/stats",
        "/test",
        "/get-upload-url",
        "/upload-image",
        "/"
        // Root path for listings, contact, etc.
      ];
      const isPublicPath = publicPaths.some((path) => {
        if (request.url === path) return true;
        if (path === "/health" && request.url.startsWith("/health")) return true;
        return false;
      }) || request.method === "GET" && ["/live", "/search", "/stats", "/"].includes(request.url);
      if (isPublicPath) {
        console.log("\u2705 Public path, skipping auth:", request.url);
        request.user = null;
        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error("\u274C Error creating auth context for public path:", authError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
            isSellerVerified: false,
            canAccessSellerDashboard: false
          };
        }
        return;
      }
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.log("\u274C No valid auth header for route:", request.url);
        request.user = null;
        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error("\u274C Error creating auth context for unauthenticated user:", authError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
            isSellerVerified: false,
            canAccessSellerDashboard: false
          };
        }
        const protectedRoutes = ["/my", "/create", "/me"];
        if (protectedRoutes.includes(request.url)) {
          return reply.status(401).send({
            success: false,
            error: "Authentication required",
            code: "UNAUTHORIZED"
          });
        }
        return;
      }
      console.log("\u{1F50D} Auth header found, testing database connection...");
      try {
        const prisma2 = getPrismaClient();
        const dbStart = Date.now();
        const result = await prisma2.$queryRaw`SELECT 1 as test`;
        console.log("\u2705 Database connection successful in", Date.now() - dbStart, "ms");
        console.log("\u{1F50D} Creating auth context...");
        request.user = null;
        try {
          request.auth = createAuthContext(null);
          console.log("\u2705 Auth context created successfully");
        } catch (authContextError) {
          console.error("\u274C Error in createAuthContext:", authContextError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
            isSellerVerified: false,
            canAccessSellerDashboard: false
          };
        }
        console.log("\u2705 Auth hook completed in", Date.now() - startTime, "ms");
      } catch (dbError) {
        console.error("\u274C Database connection failed:", dbError);
        request.user = null;
        request.auth = {
          user: null,
          isAuthenticated: false,
          hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
          isSellerVerified: false,
          canAccessSellerDashboard: false
        };
        console.log("\u26A0\uFE0F Continuing without database connection");
      }
    } catch (error) {
      console.error("\u274C Unexpected auth hook error:", error);
      request.user = null;
      request.auth = {
        user: null,
        isAuthenticated: false,
        hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
        isSellerVerified: false,
        canAccessSellerDashboard: false
      };
      console.log("\u{1F527} Continuing with fallback auth due to error");
    }
  });
  console.log("\u2705 Enhanced auth plugin registered");
}, "registerAuthPlugin");
var registerAuth = (0, import_fastify_plugin.default)(registerAuthPlugin, {
  name: "auth-plugin"
});

// src/routes/v1/users.ts
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");

// src/services/users-service.ts
var import_client3 = require("@prisma/client");
var UsersService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "UsersService");
  }
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          walletAddress: true,
          email: true,
          role: true,
          sellerStatus: true,
          displayName: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true
        }
      });
      if (!user) {
        throw errors.notFound("User not found");
      }
      const isVerifiedSeller = user.sellerStatus === import_client3.SellerStatus.APPROVED;
      return {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        role: user.role,
        sellerStatus: user.sellerStatus,
        displayName: user.displayName,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        verifiedAt: user.verifiedAt,
        rejectedAt: user.rejectedAt,
        rejectionReason: user.rejectionReason,
        isVerifiedSeller
      };
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserProfile" });
      throw error;
    }
  }
  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId) {
    try {
      const [submissionsCount, listingsCount, bidsCount, tokensCount] = await Promise.all([
        this.prisma.rwaSubmission.count({
          where: { ownerId: userId }
        }),
        this.prisma.rwaListing.count({
          where: { ownerId: userId }
        }),
        this.prisma.bid.count({
          where: { bidderId: userId }
        }),
        this.prisma.token.count({
          where: { userId }
        })
      ]);
      return {
        submissionsCount,
        listingsCount,
        bidsCount,
        tokensCount
      };
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserActivitySummary" });
      throw error;
    }
  }
  /**
   * Get user submissions
   */
  async getUserSubmissions(userId) {
    try {
      const submissions = await this.prisma.rwaSubmission.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          symbol: true,
          status: true,
          createdAt: true,
          imageGallery: true,
          rwaListing: {
            select: {
              id: true,
              isLive: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return submissions.map((sub) => ({
        id: sub.id,
        title: sub.title,
        symbol: sub.symbol,
        status: sub.status,
        imageUrl: sub.imageGallery[0] || "/placeholder.svg",
        createdAt: sub.createdAt,
        hasListing: !!sub.rwaListing,
        listingIsLive: sub.rwaListing?.isLive || false
      }));
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserSubmissions" });
      throw error;
    }
  }
  /**
   * Get user listings
   */
  async getUserListings(userId) {
    try {
      const listings = await this.prisma.rwaListing.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          symbol: true,
          imageGallery: true,
          isLive: true,
          createdAt: true,
          rwaSubmission: {
            select: {
              id: true,
              status: true
            }
          },
          bids: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              currency: true,
              createdAt: true,
              bidder: {
                select: {
                  displayName: true
                }
              }
            }
          },
          token: {
            select: {
              id: true,
              contractAddress: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        symbol: listing.symbol,
        imageUrl: listing.imageGallery[0] || "/placeholder.svg",
        isLive: listing.isLive,
        createdAt: listing.createdAt,
        submissionId: listing.rwaSubmission.id,
        submissionStatus: listing.rwaSubmission.status,
        bidsCount: listing.bids.length,
        latestBid: listing.bids[0] || null,
        hasToken: !!listing.token,
        tokenAddress: listing.token?.contractAddress || null
      }));
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserListings" });
      throw error;
    }
  }
  /**
   * Get user bids
   */
  async getUserBids(userId) {
    try {
      const bids = await this.prisma.bid.findMany({
        where: { bidderId: userId },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              imageGallery: true,
              isLive: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return bids.map((bid) => ({
        id: bid.id,
        amount: bid.amount,
        currency: bid.currency,
        createdAt: bid.createdAt,
        listing: {
          id: bid.listing.id,
          title: bid.listing.title,
          symbol: bid.listing.symbol,
          imageUrl: bid.listing.imageGallery[0] || "/placeholder.svg",
          isLive: bid.listing.isLive
        }
      }));
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserBids" });
      throw error;
    }
  }
  /**
   * Get user tokens/portfolio
   */
  async getUserTokens(userId) {
    try {
      const tokens = await this.prisma.token.findMany({
        where: { userId },
        include: {
          rwaListing: {
            select: {
              title: true,
              symbol: true,
              imageGallery: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return tokens.map((token) => ({
        id: token.id,
        contractAddress: token.contractAddress,
        title: token.rwaListing?.title || "Unknown",
        ticker: token.rwaListing?.symbol || "UNK",
        image: token.rwaListing?.imageGallery[0] || "/placeholder.svg",
        value: "0",
        // Would need pricing data
        category: this.getCategoryFromTitle(token.rwaListing?.title || "")
      }));
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserTokens" });
      throw error;
    }
  }
  /**
   * Get user portfolio summary
   */
  async getUserPortfolioSummary(userId) {
    try {
      const tokens = await this.getUserTokens(userId);
      return {
        tokenSymbols: tokens.map((t) => t.ticker),
        totalValueEstimate: "0",
        // Would need pricing integration
        tokens
      };
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserPortfolioSummary" });
      throw error;
    }
  }
  /**
   * Get public user profile (for other users to view)
   */
  async getPublicUserProfile(userId) {
    try {
      let user = null;
      let verificationStatus = null;
      try {
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            displayName: true,
            avatar: true,
            role: true,
            sellerStatus: true,
            createdAt: true,
            accountVerification: {
              select: {
                status: true
              }
            }
          }
        });
        verificationStatus = user?.accountVerification?.status || null;
      } catch (relationError) {
        console.warn(
          "Failed to fetch user with accountVerification relationship, falling back to basic query:",
          relationError
        );
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            displayName: true,
            avatar: true,
            role: true,
            sellerStatus: true,
            createdAt: true
          }
        });
        try {
          const verification = await this.prisma.accountVerification.findUnique({
            where: { userId },
            select: { status: true }
          });
          verificationStatus = verification?.status || null;
        } catch (verificationError) {
          console.warn("Could not fetch separate verification:", verificationError);
          verificationStatus = null;
        }
      }
      if (!user) {
        throw errors.notFound("User not found");
      }
      return {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        sellerStatus: user.sellerStatus,
        memberSince: user.createdAt,
        verificationStatus
      };
    } catch (error) {
      loggers.error(error, { userId, operation: "getPublicUserProfile" });
      throw error;
    }
  }
  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: /* @__PURE__ */ new Date()
        },
        select: {
          id: true,
          walletAddress: true,
          email: true,
          role: true,
          sellerStatus: true,
          displayName: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true
        }
      });
      const isVerifiedSeller = updatedUser.sellerStatus === import_client3.SellerStatus.APPROVED;
      return {
        ...updatedUser,
        isVerifiedSeller
      };
    } catch (error) {
      loggers.error(error, { userId, updates, operation: "updateUserProfile" });
      throw error;
    }
  }
  /**
   * Helper method to categorize assets
   */
  getCategoryFromTitle(title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("car") || titleLower.includes("vehicle") || titleLower.includes("porsche")) {
      return "Vehicle";
    }
    if (titleLower.includes("house") || titleLower.includes("property") || titleLower.includes("real estate")) {
      return "Real Estate";
    }
    if (titleLower.includes("art") || titleLower.includes("painting") || titleLower.includes("sculpture")) {
      return "Art";
    }
    if (titleLower.includes("watch") || titleLower.includes("jewelry") || titleLower.includes("gold")) {
      return "Luxury";
    }
    return "Other";
  }
};

// src/routes/v1/users.ts
var import_client4 = require("@prisma/client");
var UserProfileUpdateSchema = import_zod.z.object({
  firstName: import_zod.z.string().min(1).max(50).optional(),
  lastName: import_zod.z.string().min(1).max(50).optional(),
  displayName: import_zod.z.string().min(1).max(30).optional(),
  bio: import_zod.z.string().max(500).optional(),
  website: import_zod.z.string().url().optional(),
  twitterHandle: import_zod.z.string().regex(/^@?[A-Za-z0-9_]{1,15}$/).optional(),
  avatar: import_zod.z.string().url().optional(),
  notifications: import_zod.z.boolean().optional(),
  newsletter: import_zod.z.boolean().optional(),
  darkMode: import_zod.z.boolean().optional()
});
var PaginationSchema = import_zod.z.object({
  limit: import_zod.z.coerce.number().min(1).max(100).default(20),
  cursor: import_zod.z.string().optional()
});
var UserSearchSchema = import_zod.z.object({
  q: import_zod.z.string().min(1, "Search query is required"),
  limit: import_zod.z.coerce.number().min(1).max(50).default(10)
});
async function usersRoutes(fastify) {
  const profileService = new UsersService(fastify.prisma);
  fastify.get(
    "/me",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const profile = await profileService.getUserProfile(request.user.id);
        return reply.send({
          success: true,
          data: profile
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, operation: "getCurrentUserProfile" },
          "Failed to get current user profile"
        );
        throw error;
      }
    }
  );
  fastify.put(
    "/me",
    {
      preHandler: [requireAuth],
      schema: {
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(UserProfileUpdateSchema)
      }
    },
    async (request, reply) => {
      const updates = request.body;
      const correlationId = request.id;
      try {
        const updatedProfile = await profileService.updateUserProfile(request.user.id, updates);
        return reply.send({
          success: true,
          data: updatedProfile
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, correlationId, operation: "updateCurrentUserProfile" },
          "Failed to update current user profile"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/:userId",
    {
      preHandler: [optionalAuth],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            userId: import_zod.z.string().min(1)
          })
        )
      }
    },
    async (request, reply) => {
      const { userId } = request.params;
      try {
        if (request.auth.isAuthenticated && request.user.id === userId) {
          const profile = await profileService.getUserProfile(userId);
          return reply.send({
            success: true,
            data: profile
          });
        }
        const publicProfile = await profileService.getPublicUserProfile(userId);
        return reply.send({
          success: true,
          data: publicProfile
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, userId, operation: "getUserProfileById" },
          "Failed to get user profile"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/me/transactions",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(PaginationSchema)
      }
    },
    async (request, reply) => {
      const { limit, cursor } = request.query;
      try {
        const activity = await profileService.getUserActivitySummary(request.user.id);
        const submissions = await profileService.getUserSubmissions(request.user.id);
        const bids = await profileService.getUserBids(request.user.id);
        const startIndex = cursor ? submissions.findIndex((s) => s.id === cursor) + 1 : 0;
        const endIndex = startIndex + limit;
        const paginatedSubmissions = submissions.slice(startIndex, endIndex);
        const hasMore = endIndex < submissions.length;
        const nextCursor = hasMore ? paginatedSubmissions[paginatedSubmissions.length - 1]?.id : void 0;
        return reply.send({
          success: true,
          data: {
            activity,
            submissions: paginatedSubmissions,
            bids: bids.slice(0, limit),
            nextCursor,
            hasMore
          }
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, operation: "getUserTransactionHistory" },
          "Failed to get user transaction history"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/:userId/transactions",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            userId: import_zod.z.string().min(1)
          })
        ),
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(PaginationSchema)
      }
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { limit, cursor } = request.query;
      try {
        if (!canAccessResource(request.user, userId, [import_client4.UserRole.ADMIN])) {
          throw errors.forbidden("Access denied");
        }
        const activity = await profileService.getUserActivitySummary(userId);
        const submissions = await profileService.getUserSubmissions(userId);
        const bids = await profileService.getUserBids(userId);
        const startIndex = cursor ? submissions.findIndex((s) => s.id === cursor) + 1 : 0;
        const endIndex = startIndex + limit;
        const paginatedSubmissions = submissions.slice(startIndex, endIndex);
        const hasMore = endIndex < submissions.length;
        const nextCursor = hasMore ? paginatedSubmissions[paginatedSubmissions.length - 1]?.id : void 0;
        const transactions = {
          activity,
          submissions: paginatedSubmissions,
          bids: bids.slice(0, limit),
          nextCursor,
          hasMore
        };
        return reply.send({
          success: true,
          data: transactions
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, userId, operation: "getUserTransactionHistoryById" },
          "Failed to get user transaction history"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/me/assets",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const portfolio = await profileService.getUserPortfolioSummary(request.user.id);
        const tokens = await profileService.getUserTokens(request.user.id);
        return reply.send({
          success: true,
          data: {
            portfolio,
            tokens,
            totalValue: portfolio.totalValueEstimate
          }
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, operation: "getUserOnChainAssets" },
          "Failed to get user on-chain assets"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/:userId/assets",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            userId: import_zod.z.string().min(1)
          })
        )
      }
    },
    async (request, reply) => {
      const { userId } = request.params;
      try {
        if (!canAccessResource(request.user, userId, [import_client4.UserRole.ADMIN])) {
          throw errors.forbidden("Access denied");
        }
        const user = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { walletAddress: true }
        });
        if (!user) {
          throw errors.notFound("User not found");
        }
        const portfolio = await profileService.getUserPortfolioSummary(userId);
        const tokens = await profileService.getUserTokens(userId);
        const assets = {
          portfolio,
          tokens,
          totalValue: portfolio.totalValueEstimate
        };
        return reply.send({
          success: true,
          data: assets
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, userId, operation: "getUserOnChainAssetsById" },
          "Failed to get user on-chain assets"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/search",
    {
      preHandler: [optionalAuth],
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(UserSearchSchema)
      }
    },
    async (request, reply) => {
      const { q, limit } = request.query;
      try {
        const users = await fastify.prisma.user.findMany({
          where: {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { walletAddress: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } }
            ],
            isActive: true
          },
          select: {
            id: true,
            displayName: true,
            walletAddress: true,
            avatar: true,
            role: true,
            sellerStatus: true,
            createdAt: true
          },
          take: limit,
          orderBy: { createdAt: "desc" }
        });
        return reply.send({
          success: true,
          data: {
            users,
            query: q,
            total: users.length
          }
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error({ err, query: q, operation: "searchUsers" }, "Failed to search users");
        throw error;
      }
    }
  );
  fastify.get(
    "/:userId/stats",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            userId: import_zod.z.string().min(1)
          })
        )
      }
    },
    async (request, reply) => {
      const { userId } = request.params;
      try {
        if (!canAccessResource(request.user, userId, [import_client4.UserRole.ADMIN])) {
          throw errors.forbidden("Access denied");
        }
        const [profile, activity, portfolio, tokens] = await Promise.all([
          profileService.getUserProfile(userId),
          profileService.getUserActivitySummary(userId),
          profileService.getUserPortfolioSummary(userId),
          profileService.getUserTokens(userId)
        ]);
        const stats = {
          profile: {
            id: profile.id,
            role: profile.role,
            sellerStatus: profile.sellerStatus,
            createdAt: profile.createdAt,
            isVerifiedSeller: profile.isVerifiedSeller
          },
          activity: {
            totalSubmissions: activity.submissionsCount,
            totalListings: activity.listingsCount,
            totalBids: activity.bidsCount,
            totalTokens: activity.tokensCount
          },
          assets: {
            totalTokens: tokens.length,
            totalValue: portfolio.totalValueEstimate,
            tokenSymbols: portfolio.tokenSymbols
          }
        };
        return reply.send({
          success: true,
          data: stats
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, userId, operation: "getUserStats" },
          "Failed to get user statistics"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/:userId/tokens",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            userId: import_zod.z.string().min(1)
          })
        )
      }
    },
    async (request, reply) => {
      const { userId } = request.params;
      try {
        if (!canAccessResource(request.user, userId, [import_client4.UserRole.ADMIN])) {
          throw errors.forbidden("Access denied");
        }
        const tokens = await profileService.getUserTokens(userId);
        return reply.send({
          success: true,
          data: tokens
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error({ err, userId, operation: "getUserTokens" }, "Failed to get user tokens");
        throw error;
      }
    }
  );
  fastify.get(
    "/me/tokens",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const tokens = await profileService.getUserTokens(request.user.id);
        return reply.send({
          success: true,
          data: tokens
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, operation: "getCurrentUserTokens" },
          "Failed to get current user tokens"
        );
        throw error;
      }
    }
  );
}
__name(usersRoutes, "usersRoutes");

// src/api/users.ts
var buildUsersApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(registerAuth);
  fastify.register(usersRoutes);
  fastify.addHook("onRequest", async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers["user-agent"]);
  });
  fastify.addHook("onResponse", async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });
  fastify.setErrorHandler((error, request, reply) => {
    try {
      handleError(error, reply);
    } catch (error2) {
      handleError(error2, reply);
    }
  });
  fastify.addHook("onClose", async () => {
    await disconnectDatabase();
  });
  return fastify;
}, "buildUsersApp");
var appPromise;
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    appPromise = appPromise ?? buildUsersApp();
    const app = await appPromise;
    await app.ready();
    const origin = req.headers.origin;
    const isOriginAllowed = /* @__PURE__ */ __name((origin2) => {
      if (!origin2) return false;
      if (origin2.endsWith(".vercel.app")) return true;
      return [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://www.aces.fun",
        "https://aces.fun"
      ].includes(origin2);
    }, "isOriginAllowed");
    if (isOriginAllowed(origin) && origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.url?.startsWith("/api/v1/users")) {
      req.url = req.url.replace("/api/v1/users", "") || "/";
    }
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("\u274C Users handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
}, "handler");
var users_default = handler;
