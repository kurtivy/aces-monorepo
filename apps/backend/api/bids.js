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

// src/api/bids.ts
var bids_exports = {};
__export(bids_exports, {
  default: () => bids_default
});
module.exports = __toCommonJS(bids_exports);
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
var withTransaction = /* @__PURE__ */ __name(async (callback) => {
  const client = getPrismaClient();
  try {
    console.log("\u{1F527} Starting database transaction...");
    const start = Date.now();
    const result = await client.$transaction(callback);
    const duration = Date.now() - start;
    console.log(`\u2705 Transaction completed in ${duration}ms`);
    return result;
  } catch (error) {
    console.error("\u274C Transaction failed:", error);
    logger.error("Database transaction failed", error);
    throw error;
  }
}, "withTransaction");

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
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

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
        await prisma2.$queryRaw`SELECT 1 as test`;
        console.log("\u2705 Database connection successful in", Date.now() - dbStart, "ms");
        console.log("\u{1F50D} Verifying Privy JWT token...");
        const token = authHeader.replace("Bearer ", "");
        try {
          const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
          if (!privyAppId) {
            console.error("\u274C NEXT_PUBLIC_PRIVY_APP_ID not set");
            throw new Error("Privy App ID not configured");
          }
          const decoded = import_jsonwebtoken.default.decode(token);
          if (!decoded || !decoded.sub) {
            console.error("\u274C Invalid JWT token structure");
            throw new Error("Invalid token");
          }
          const privyDid = decoded.sub;
          console.log("\u{1F50D} Privy DID from token:", privyDid);
          let user = await prisma2.user.findUnique({
            where: { privyDid }
          });
          if (!user) {
            console.log("\u{1F195} Creating new user for Privy DID:", privyDid);
            const walletAddress = decoded.wallet_address || null;
            user = await prisma2.user.create({
              data: {
                privyDid,
                walletAddress,
                email: decoded.email || null,
                displayName: decoded.email?.split("@")[0] || "User",
                role: "TRADER",
                isActive: true,
                sellerStatus: "NOT_APPLIED"
              }
            });
            console.log("\u2705 User created successfully:", user.id);
          } else {
            console.log("\u2705 Existing user found:", user.id);
            const walletAddress = decoded.wallet_address || null;
            if (walletAddress && user.walletAddress !== walletAddress) {
              await prisma2.user.update({
                where: { id: user.id },
                data: { walletAddress }
              });
              user.walletAddress = walletAddress;
              console.log("\u2705 Updated wallet address for user:", user.id);
            }
          }
          request.user = user;
          request.auth = createAuthContext(user);
          console.log("\u2705 Auth context created successfully for user:", user.id);
        } catch (jwtError) {
          console.error("\u274C JWT verification failed:", jwtError);
          request.user = null;
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

// src/routes/v1/bids.ts
var import_zod = require("zod");
var import_zod_to_json_schema = __toESM(require("zod-to-json-schema"));

// src/services/bidding-service.ts
var BiddingService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "BiddingService");
  }
  async createOrUpdateBid(userId, data, correlationId) {
    try {
      const result = await withTransaction(async (tx) => {
        const listing = await tx.rwaListing.findUnique({
          where: { id: data.listingId },
          include: {
            owner: true,
            rwaSubmission: true
          }
        });
        if (!listing) {
          throw errors.notFound("Listing not found");
        }
        if (!listing.isLive) {
          throw errors.validation("Cannot bid on inactive listing");
        }
        if (listing.ownerId === userId) {
          throw errors.validation("Cannot bid on your own listing");
        }
        const userVerification = await tx.accountVerification.findUnique({
          where: { userId }
        });
        if (!userVerification || userVerification.status !== "APPROVED") {
          throw errors.validation("Account verification required to place bids");
        }
        const existingBid = await tx.bid.findUnique({
          where: {
            bidderId_listingId: {
              bidderId: userId,
              listingId: data.listingId
            }
          }
        });
        let bid;
        if (existingBid) {
          bid = await tx.bid.update({
            where: { id: existingBid.id },
            data: {
              amount: data.amount,
              currency: data.currency,
              expiresAt: data.expiresAt,
              createdAt: /* @__PURE__ */ new Date()
              // Update timestamp for new bid
            },
            include: {
              bidder: {
                select: {
                  id: true,
                  displayName: true,
                  walletAddress: true
                }
              },
              listing: {
                include: {
                  owner: {
                    select: {
                      id: true,
                      displayName: true,
                      walletAddress: true
                    }
                  }
                }
              },
              verification: {
                select: {
                  id: true,
                  status: true
                }
              }
            }
          });
        } else {
          bid = await tx.bid.create({
            data: {
              bidderId: userId,
              listingId: data.listingId,
              verificationId: userVerification.id,
              amount: data.amount,
              currency: data.currency,
              expiresAt: data.expiresAt
            },
            include: {
              bidder: {
                select: {
                  id: true,
                  displayName: true,
                  walletAddress: true
                }
              },
              listing: {
                include: {
                  owner: {
                    select: {
                      id: true,
                      displayName: true,
                      walletAddress: true
                    }
                  }
                }
              },
              verification: {
                select: {
                  id: true,
                  status: true
                }
              }
            }
          });
        }
        return bid;
      });
      loggers.database("bid_created_or_updated", "bids", result.id);
      return result;
    } catch (error) {
      loggers.error(error, {
        userId,
        listingId: data.listingId,
        correlationId,
        operation: "createOrUpdateBid"
      });
      throw error;
    }
  }
  async getBidsForListing(listingId) {
    try {
      const listing = await this.prisma.rwaListing.findUnique({
        where: { id: listingId }
      });
      if (!listing) {
        throw errors.notFound("Listing not found");
      }
      const bids = await this.prisma.bid.findMany({
        where: { listingId },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true
            }
          },
          verification: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: [
          { amount: "desc" },
          // Highest bids first
          { createdAt: "asc" }
          // Then by time for same amounts
        ]
      });
      return bids;
    } catch (error) {
      loggers.error(error, { listingId, operation: "getBidsForListing" });
      throw error;
    }
  }
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
              isLive: true,
              owner: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          },
          verification: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return bids;
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserBids" });
      throw error;
    }
  }
  async getOffersForUserListings(userId) {
    try {
      const offers = await this.prisma.bid.findMany({
        where: {
          listing: {
            ownerId: userId
          }
        },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              imageGallery: true,
              isLive: true
            }
          },
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true
            }
          },
          verification: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return offers;
    } catch (error) {
      loggers.error(error, { userId, operation: "getOffersForUserListings" });
      throw error;
    }
  }
  async deleteBid(bidId, userId) {
    try {
      await withTransaction(async (tx) => {
        const bid = await tx.bid.findUnique({
          where: { id: bidId },
          include: { listing: true }
        });
        if (!bid) {
          throw errors.notFound("Bid not found");
        }
        if (bid.bidderId !== userId) {
          throw errors.forbidden("Cannot delete bid that is not yours");
        }
        if (!bid.listing.isLive) {
          throw errors.validation("Cannot delete bid on inactive listing");
        }
        await tx.bid.delete({
          where: { id: bidId }
        });
      });
      loggers.database("bid_deleted", "bids", bidId);
    } catch (error) {
      loggers.error(error, { bidId, userId, operation: "deleteBid" });
      throw error;
    }
  }
  async getBidById(bidId) {
    try {
      const bid = await this.prisma.bid.findUnique({
        where: { id: bidId },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true
            }
          },
          listing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  walletAddress: true
                }
              }
            }
          },
          verification: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });
      return bid;
    } catch (error) {
      loggers.error(error, { bidId, operation: "getBidById" });
      throw error;
    }
  }
  async getHighestBidForListing(listingId) {
    try {
      const bid = await this.prisma.bid.findFirst({
        where: { listingId },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true
            }
          },
          verification: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: [
          { amount: "desc" },
          { createdAt: "asc" }
          // First bid wins in case of tie
        ]
      });
      return bid;
    } catch (error) {
      loggers.error(error, { listingId, operation: "getHighestBidForListing" });
      throw error;
    }
  }
  async getBidsForOwner(ownerId) {
    try {
      const bids = await this.prisma.bid.findMany({
        where: {
          listing: {
            ownerId
          }
        },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              imageGallery: true,
              isLive: true
            }
          },
          verification: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: [{ listing: { title: "asc" } }, { amount: "desc" }, { createdAt: "asc" }]
      });
      return bids;
    } catch (error) {
      loggers.error(error, { ownerId, operation: "getBidsForOwner" });
      throw error;
    }
  }
  async getBiddingStats() {
    try {
      const [totalBids, bidderGroups] = await Promise.all([
        this.prisma.bid.count(),
        this.prisma.bid.groupBy({
          by: ["bidderId"]
        })
      ]);
      const totalBidders = bidderGroups.length;
      return {
        totalBids,
        totalBidders
      };
    } catch (error) {
      loggers.error(error, { operation: "getBiddingStats" });
      throw error;
    }
  }
  /**
   * Get all bids for admin view (with orphaned relationship handling)
   */
  async getAllBids() {
    try {
      const bids = await this.prisma.bid.findMany({
        orderBy: { createdAt: "desc" }
      });
      const bidsWithRelations = await Promise.all(
        bids.map(async (bid) => {
          let bidder = null;
          try {
            bidder = await this.prisma.user.findUnique({
              where: { id: bid.bidderId },
              select: {
                id: true,
                displayName: true,
                walletAddress: true,
                email: true
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch bidder ${bid.bidderId} for bid ${bid.id}:`, error);
          }
          let listing = null;
          try {
            listing = await this.prisma.rwaListing.findUnique({
              where: { id: bid.listingId },
              select: {
                id: true,
                title: true,
                symbol: true,
                imageGallery: true,
                isLive: true
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch listing ${bid.listingId} for bid ${bid.id}:`, error);
          }
          let verification = null;
          try {
            verification = await this.prisma.accountVerification.findUnique({
              where: { id: bid.verificationId },
              select: {
                id: true,
                status: true
              }
            });
          } catch (error) {
            console.warn(
              `Failed to fetch verification ${bid.verificationId} for bid ${bid.id}:`,
              error
            );
          }
          return {
            ...bid,
            bidder,
            listing,
            verification
          };
        })
      );
      return bidsWithRelations;
    } catch (error) {
      loggers.error(error, { operation: "getAllBids" });
      throw error;
    }
  }
};

// src/routes/v1/bids.ts
var BidCreateSchema = import_zod.z.object({
  listingId: import_zod.z.string().cuid(),
  amount: import_zod.z.string(),
  currency: import_zod.z.enum(["ETH", "ACES"]),
  expiresAt: import_zod.z.string().datetime().optional()
});
var IdParamSchema = import_zod.z.object({
  id: import_zod.z.string().cuid({ message: "Invalid ID" })
});
var ListingIdParamSchema = import_zod.z.object({
  listingId: import_zod.z.string().cuid({ message: "Invalid Listing ID" })
});
var TopBidsQuerySchema = import_zod.z.object({
  limit: import_zod.z.coerce.number().int().min(1).max(10).default(5)
});
async function bidsRoutes(fastify) {
  const biddingService = new BiddingService(fastify.prisma);
  fastify.post(
    "/",
    {
      schema: {
        body: (0, import_zod_to_json_schema.default)(BidCreateSchema)
      }
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized("Authentication required");
      }
      const parsedBody = BidCreateSchema.parse(request.body);
      const correlationId = request.id;
      const body = {
        listingId: parsedBody.listingId,
        amount: parsedBody.amount,
        currency: parsedBody.currency,
        expiresAt: parsedBody.expiresAt ? new Date(parsedBody.expiresAt) : void 0
      };
      const bid = await biddingService.createOrUpdateBid(request.user.id, body, correlationId);
      return reply.status(201).send({
        success: true,
        data: bid,
        message: "Bid placed successfully"
      });
    }
  );
  fastify.get("/my", async (request, reply) => {
    if (!request.user) {
      throw errors.unauthorized("Authentication required");
    }
    const bids = await biddingService.getUserBids(request.user.id);
    return reply.send({
      success: true,
      data: bids
    });
  });
  fastify.get("/my-listings-offers", async (request, reply) => {
    if (!request.user) {
      throw errors.unauthorized("Authentication required");
    }
    const offers = await biddingService.getOffersForUserListings(request.user.id);
    return reply.send({
      success: true,
      data: offers
    });
  });
  fastify.get(
    "/:id",
    {
      schema: {
        params: (0, import_zod_to_json_schema.default)(IdParamSchema)
      }
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized("Authentication required");
      }
      const { id } = request.params;
      const bidResult = await biddingService.getBidById(id);
      if (!bidResult) {
        throw errors.notFound("Bid not found");
      }
      const bid = bidResult;
      return reply.send({
        success: true,
        data: {
          id: bid.id,
          amount: bid.amount,
          currency: bid.currency,
          createdAt: bid.createdAt,
          listing: {
            id: bid.listing.id,
            title: bid.listing.title,
            symbol: bid.listing.symbol,
            isLive: bid.listing.isLive
          }
        }
      });
    }
  );
  fastify.delete(
    "/:id",
    {
      schema: {
        params: (0, import_zod_to_json_schema.default)(IdParamSchema)
      }
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized("Authentication required");
      }
      const { id } = request.params;
      await biddingService.deleteBid(id, request.user.id);
      return reply.send({
        success: true,
        message: "Bid deleted successfully"
      });
    }
  );
  fastify.get(
    "/listing/:listingId/highest",
    {
      schema: {
        params: (0, import_zod_to_json_schema.default)(ListingIdParamSchema)
      }
    },
    async (request, reply) => {
      const { listingId } = request.params;
      const bid = await biddingService.getHighestBidForListing(listingId);
      return reply.send({
        success: true,
        data: bid
      });
    }
  );
  fastify.get("/stats", async (request, reply) => {
    const stats = await biddingService.getBiddingStats();
    return reply.send({
      success: true,
      data: stats
    });
  });
  fastify.get(
    "/listing/:listingId",
    {
      schema: {
        params: (0, import_zod_to_json_schema.default)(ListingIdParamSchema)
      }
    },
    async (request, reply) => {
      const { listingId } = request.params;
      const bids = await biddingService.getBidsForListing(listingId);
      return reply.send({
        success: true,
        data: bids
      });
    }
  );
}
__name(bidsRoutes, "bidsRoutes");

// src/api/bids.ts
var buildBidsApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(registerAuth);
  fastify.register(bidsRoutes);
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
}, "buildBidsApp");
var appPromise;
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    appPromise = appPromise ?? buildBidsApp();
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
    if (req.url?.startsWith("/api/v1/bids")) {
      req.url = req.url.replace("/api/v1/bids", "") || "/";
    }
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("\u274C Bids handler error:", error);
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
var bids_default = handler;
