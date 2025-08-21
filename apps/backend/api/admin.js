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

// src/api/admin.ts
var admin_exports = {};
__export(admin_exports, {
  default: () => admin_default
});
module.exports = __toCommonJS(admin_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto3 = require("crypto");
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

// src/routes/v1/admin.ts
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");
var import_client5 = require("@prisma/client");
var import_boom2 = require("@hapi/boom");

// src/services/listing-service.ts
var ListingService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "ListingService");
  }
  /**
   * Automatically creates an RWAListing when an RWASubmission is approved
   * This is called when a submission status changes to APPROVED
   */
  async createListingFromApprovedSubmission({
    submissionId,
    approvedBy
  }) {
    try {
      logger.info(`Creating RWAListing from approved submission: ${submissionId}`);
      const submission = await this.prisma.rwaSubmission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true
        }
      });
      if (!submission) {
        throw new Error(`RWASubmission with id ${submissionId} not found`);
      }
      if (submission.status !== "APPROVED") {
        throw new Error(`Cannot create listing from submission with status: ${submission.status}`);
      }
      const existingListing = await this.prisma.rwaListing.findUnique({
        where: { rwaSubmissionId: submissionId }
      });
      if (existingListing) {
        logger.warn(`RWAListing already exists for submission: ${submissionId}`);
        return existingListing;
      }
      const listing = await this.prisma.rwaListing.create({
        data: {
          title: submission.title,
          symbol: submission.symbol,
          description: submission.description,
          assetType: submission.assetType,
          imageGallery: submission.imageGallery,
          contractAddress: submission.contractAddress,
          location: submission.location,
          email: submission.email,
          isLive: false,
          // Always start as not live
          rwaSubmissionId: submission.id,
          ownerId: submission.ownerId,
          updatedBy: approvedBy
        },
        include: {
          owner: true,
          rwaSubmission: true,
          approvedBy: true
        }
      });
      logger.info(
        `Successfully created RWAListing: ${listing.id} from submission: ${submissionId}`
      );
      return listing;
    } catch (error) {
      logger.error(`Error creating listing from submission ${submissionId}:`, error);
      throw error;
    }
  }
  /**
   * Updates the isLive status of an RWAListing
   * This controls whether the listing appears on the platform
   */
  async updateListingStatus({ listingId, isLive, updatedBy }) {
    try {
      logger.info(`Updating listing ${listingId} status to isLive: ${isLive}`);
      const listing = await this.prisma.rwaListing.update({
        where: { id: listingId },
        data: {
          isLive,
          updatedBy,
          updatedAt: /* @__PURE__ */ new Date()
        },
        include: {
          owner: true,
          rwaSubmission: true,
          approvedBy: true
        }
      });
      logger.info(`Successfully updated listing ${listingId} status to isLive: ${isLive}`);
      return listing;
    } catch (error) {
      logger.error(`Error updating listing ${listingId} status:`, error);
      throw error;
    }
  }
  /**
   * Get all live listings for the platform
   */
  async getLiveListings() {
    try {
      const listings = await this.prisma.rwaListing.findMany({
        where: { isLive: true },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              walletAddress: true
            }
          },
          bids: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
              bidder: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true
                }
              }
            }
          },
          token: true
        },
        orderBy: { createdAt: "desc" }
      });
      return listings;
    } catch (error) {
      logger.error("Error fetching live listings:", error);
      throw error;
    }
  }
  /**
   * Get all listings for admin view (including not live ones)
   */
  async getAllListings() {
    try {
      const listings = await this.prisma.rwaListing.findMany({
        orderBy: { createdAt: "desc" }
      });
      const listingsWithRelations = await Promise.all(
        listings.map(async (listing) => {
          let owner = null;
          try {
            owner = await this.prisma.user.findUnique({
              where: { id: listing.ownerId },
              select: {
                id: true,
                displayName: true,
                avatar: true,
                walletAddress: true
              }
            });
            if (owner) {
              try {
                const verification = await this.prisma.accountVerification.findUnique({
                  where: { userId: listing.ownerId },
                  select: {
                    firstName: true,
                    lastName: true,
                    status: true
                  }
                });
                owner.accountVerification = verification;
              } catch (verificationError) {
                logger.warn(
                  `Failed to fetch verification for owner ${listing.ownerId}:`,
                  verificationError
                );
              }
            }
          } catch (error) {
            logger.warn(
              `Failed to fetch owner ${listing.ownerId} for listing ${listing.id}:`,
              error
            );
          }
          let rwaSubmission = null;
          try {
            rwaSubmission = await this.prisma.rwaSubmission.findUnique({
              where: { id: listing.rwaSubmissionId },
              select: {
                id: true,
                status: true,
                createdAt: true
              }
            });
          } catch (error) {
            logger.warn(
              `Failed to fetch submission ${listing.rwaSubmissionId} for listing ${listing.id}:`,
              error
            );
          }
          let bids = [];
          try {
            bids = await this.prisma.bid.findMany({
              where: { listingId: listing.id },
              take: 5,
              orderBy: { createdAt: "desc" },
              include: {
                bidder: {
                  select: {
                    id: true,
                    displayName: true,
                    avatar: true
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
          } catch (error) {
            logger.warn(`Failed to fetch bids for listing ${listing.id}:`, error);
          }
          let token = null;
          try {
            token = await this.prisma.token.findUnique({
              where: { rwaListingId: listing.id }
            });
          } catch (error) {
            logger.warn(`Failed to fetch token for listing ${listing.id}:`, error);
          }
          return {
            ...listing,
            owner,
            rwaSubmission,
            bids,
            token
          };
        })
      );
      return listingsWithRelations;
    } catch (error) {
      logger.error("Error fetching all listings:", error);
      throw error;
    }
  }
  /**
   * Get a specific listing by ID
   */
  async getListingById(listingId) {
    try {
      const listing = await this.prisma.rwaListing.findUnique({
        where: { id: listingId },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              walletAddress: true
            }
          },
          rwaSubmission: true,
          bids: {
            orderBy: { createdAt: "desc" },
            include: {
              bidder: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true
                }
              },
              verification: {
                select: {
                  id: true,
                  status: true
                }
              }
            }
          },
          token: true,
          approvedBy: {
            select: {
              id: true,
              displayName: true
            }
          }
        }
      });
      if (!listing) {
        throw new Error(`RWAListing with id ${listingId} not found`);
      }
      return listing;
    } catch (error) {
      logger.error(`Error fetching listing ${listingId}:`, error);
      throw error;
    }
  }
  /**
   * Get listings by owner
   */
  async getListingsByOwner(ownerId) {
    try {
      const listings = await this.prisma.rwaListing.findMany({
        where: { ownerId },
        include: {
          rwaSubmission: {
            select: {
              id: true,
              status: true,
              createdAt: true
            }
          },
          bids: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
              bidder: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true
                }
              },
              verification: {
                select: {
                  id: true,
                  status: true
                }
              }
            }
          },
          token: true
        },
        orderBy: { createdAt: "desc" }
      });
      return listings;
    } catch (error) {
      logger.error(`Error fetching listings for owner ${ownerId}:`, error);
      throw error;
    }
  }
};

// src/services/approval-service.ts
var ApprovalService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "ApprovalService");
  }
  /**
   * Admin approval - updates database status and automatically creates RWAListing
   */
  async adminApproveSubmission(submissionId, adminId) {
    try {
      let listingId;
      await withTransaction(async (tx) => {
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId }
        });
        if (!submission) {
          throw errors.notFound("Submission not found");
        }
        if (submission.status !== "PENDING") {
          throw errors.validation(`Submission status is ${submission.status}, cannot approve`);
        }
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: "APPROVED",
            approvedAt: /* @__PURE__ */ new Date(),
            updatedBy: adminId
          }
        });
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: "PENDING",
            toStatus: "APPROVED",
            actorId: adminId,
            actorType: "ADMIN",
            notes: "Admin approval - RWAListing created automatically"
          }
        });
      });
      try {
        const listingService = new ListingService(this.prisma);
        const listing = await listingService.createListingFromApprovedSubmission({
          submissionId,
          approvedBy: adminId
        });
        listingId = listing.id;
        loggers.auth(adminId, null, "admin_validated");
      } catch (listingError) {
        loggers.error(listingError, {
          submissionId,
          adminId,
          operation: "createListingFromApprovedSubmission",
          errorMessage: listingError instanceof Error ? listingError.message : "Unknown error",
          errorStack: listingError instanceof Error ? listingError.stack : void 0
        });
      }
      return { success: true, submissionId, listingId };
    } catch (error) {
      loggers.error(error, { submissionId, adminId, operation: "adminApproveSubmission" });
      throw error;
    }
  }
  async approveSubmission(submissionId, adminId, correlationId) {
    try {
      return await this.adminApproveSubmission(submissionId, adminId);
    } catch (error) {
      loggers.error(error, {
        submissionId,
        adminId,
        correlationId,
        operation: "approveSubmission"
      });
      throw errors.internal("Failed to approve submission", { cause: error });
    }
  }
  async rejectSubmission(submissionId, adminId, reason, correlationId) {
    try {
      const result = await withTransaction(async (tx) => {
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId }
        });
        if (!submission) {
          throw errors.notFound("Submission not found");
        }
        if (submission.status !== "PENDING") {
          throw errors.validation(`Submission status is ${submission.status}, cannot reject`);
        }
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: "REJECTED",
            rejectionReason: reason,
            updatedBy: adminId
          }
        });
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: "PENDING",
            toStatus: "REJECTED",
            actorId: adminId,
            actorType: "ADMIN",
            notes: `Rejected: ${reason}`
          }
        });
        return true;
      });
      loggers.auth(adminId, null, "admin_rejected");
      return result;
    } catch (error) {
      loggers.error(error, {
        submissionId,
        adminId,
        reason,
        correlationId,
        operation: "rejectSubmission"
      });
      throw error;
    }
  }
  async validateAdminPermissions(userId, walletAddress) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user) {
        return false;
      }
      return user.role === "ADMIN";
    } catch (error) {
      loggers.error(error, { userId, operation: "validateAdminPermissions" });
      return false;
    }
  }
  async getSubmissionsByStatus(status, options = {}) {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const offset = options.offset || 0;
      return await this.prisma.rwaSubmission.findMany({
        where: { status },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
              email: true
            }
          },
          rwaListing: true
          // Changed from token to rwaListing
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      });
    } catch (error) {
      loggers.error(error, { status, options, operation: "getSubmissionsByStatus" });
      throw error;
    }
  }
  async getSubmissionById(submissionId) {
    try {
      return await this.prisma.rwaSubmission.findUnique({
        where: { id: submissionId },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
              email: true
            }
          },
          rwaListing: true
          // Changed from token to rwaListing
        }
      });
    } catch (error) {
      loggers.error(error, { submissionId, operation: "getSubmissionById" });
      throw error;
    }
  }
};

// src/services/submission-service.ts
var SubmissionService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "SubmissionService");
  }
  async createSubmission(userId, data, correlationId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });
      const submissionData = {
        title: data.title,
        // Use title directly
        symbol: data.symbol,
        description: data.description,
        assetType: data.assetType,
        imageGallery: data.imageGallery || [],
        // Use imageGallery directly
        proofOfOwnership: data.proofOfOwnership,
        typeOfOwnership: data.typeOfOwnership || "General",
        // Use provided typeOfOwnership
        location: data.location || null,
        contractAddress: data.contractAddress || null,
        ownerId: userId,
        email: user?.email || null,
        // Use user's existing email instead of submitted email
        status: "PENDING"
      };
      const submission = await this.prisma.rwaSubmission.create({
        data: submissionData,
        include: {
          owner: true,
          rwaListing: true
          // Changed from token to rwaListing
        }
      });
      await this.prisma.submissionAuditLog.create({
        data: {
          submissionId: submission.id,
          actorId: userId,
          actorType: "USER",
          toStatus: "PENDING",
          notes: "Initial submission"
        }
      });
      return submission;
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error in createSubmission:", err);
        console.error("Error details:", {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
      } else {
        console.error("Unknown error in createSubmission:", err);
      }
      throw err;
    }
  }
  async getUserSubmissions(userId, filter, options = {}) {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where = {
        ownerId: userId,
        ...filter?.status && { status: filter.status }
      };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const submissions = await this.prisma.rwaSubmission.findMany({
        where,
        include: {
          owner: true,
          rwaListing: true
          // Changed from token to rwaListing
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
        // Take one extra to check for more
      });
      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserSubmissions" });
      throw error;
    }
  }
  async getSubmissionById(submissionId, userId) {
    try {
      const where = { id: submissionId };
      if (userId) {
        where.ownerId = userId;
      }
      const submission = await this.prisma.rwaSubmission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true,
          rwaListing: true
          // Changed from token to rwaListing
        }
      });
      return submission;
    } catch (error) {
      loggers.error(error, { submissionId, userId, operation: "getSubmissionById" });
      throw error;
    }
  }
  async deleteSubmission(submissionId, userId) {
    try {
      await withTransaction(async (tx) => {
        const submission = await tx.rwaSubmission.findUnique({
          where: {
            id: submissionId,
            ownerId: userId
            // Ensure user can only delete their own submissions
          }
        });
        if (!submission) {
          throw errors.notFound("Submission not found or access denied");
        }
        if (submission.status !== "PENDING") {
          throw errors.validation(
            `Cannot delete submission with status: ${submission.status}. Only pending submissions can be deleted.`
          );
        }
        await tx.rwaSubmission.delete({
          where: { id: submissionId }
        });
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: submission.status,
            toStatus: "REJECTED",
            // Use REJECTED as closest equivalent to deleted
            actorId: userId,
            actorType: "USER",
            notes: "Submission deleted by user"
          }
        });
      });
      loggers.database("deleted", "rwa_submissions", submissionId);
    } catch (error) {
      loggers.error(error, { submissionId, userId, operation: "deleteSubmission" });
      throw error;
    }
  }
  async getAllSubmissions(adminId, filter, options = {}) {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where = {
        ...filter?.status && { status: filter.status }
      };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const submissions = await this.prisma.rwaSubmission.findMany({
        where,
        include: {
          owner: true,
          rwaListing: true
          // Changed from token to rwaListing
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });
      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error, { adminId, operation: "getAllSubmissions" });
      throw error;
    }
  }
  async getSubmissionByIds(submissionIds) {
    try {
      return await this.prisma.rwaSubmission.findMany({
        where: {
          id: { in: submissionIds }
        },
        include: {
          owner: true,
          rwaListing: true
          // Changed from token to rwaListing
        }
      });
    } catch (error) {
      loggers.error(error, { submissionIds, operation: "getSubmissionByIds" });
      throw error;
    }
  }
};

// src/services/recovery-service.ts
var RecoveryService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "RecoveryService");
  }
  /**
   * Retry submission approval (for failed approvals)
   */
  async retrySubmissionApproval(submissionId, adminId, correlationId) {
    try {
      const result = await withTransaction(async (tx) => {
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId },
          include: { owner: true }
        });
        if (!submission) {
          throw errors.notFound("Submission not found");
        }
        if (submission.status !== "REJECTED") {
          throw errors.validation(`Cannot retry submission with status: ${submission.status}`);
        }
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: "PENDING",
            rejectionReason: null,
            updatedBy: adminId,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: "REJECTED",
            toStatus: "PENDING",
            actorId: adminId,
            actorType: "ADMIN",
            notes: "Submission reset for retry approval"
          }
        });
        return true;
      });
      loggers.database("retry_approval", "rwa_submission", submissionId);
      return { success: result, submissionId };
    } catch (error) {
      loggers.error(error, {
        submissionId,
        adminId,
        correlationId,
        operation: "retrySubmissionApproval"
      });
      throw error;
    }
  }
  /**
   * Recover webhook processing (replay webhook)
   */
  async replayWebhook(webhookLogId, adminId, correlationId) {
    try {
      const webhookLog = await this.prisma.webhookLog.findUnique({
        where: { id: webhookLogId }
      });
      if (!webhookLog) {
        throw errors.notFound("Webhook log not found");
      }
      if (webhookLog.processedAt) {
        loggers.database("webhook_already_processed", "webhook_logs", webhookLogId);
        return { success: true, processed: true };
      }
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          processedAt: /* @__PURE__ */ new Date(),
          error: null
          // Clear any previous error
        }
      });
      loggers.database("webhook_replayed", "webhook_logs", webhookLogId);
      return { success: true, processed: false };
    } catch (error) {
      loggers.error(error, {
        webhookLogId,
        adminId,
        correlationId,
        operation: "replayWebhook"
      });
      throw error;
    }
  }
  /**
   * Get failed webhook logs for retry
   */
  async getFailedWebhooks(limit = 50, options = {}) {
    try {
      const where = {
        error: { not: null }
      };
      if (!options.includeProcessed) {
        where.processedAt = null;
      }
      if (options.olderThan) {
        where.createdAt = {
          lt: options.olderThan
        };
      }
      where.error = {
        not: null
      };
      const webhooks = await this.prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit
      });
      return webhooks;
    } catch (error) {
      loggers.error(error, { operation: "getFailedWebhooks" });
      throw error;
    }
  }
  /**
   * Get submissions that need recovery (stuck in pending too long)
   */
  async getStuckSubmissions(options = {}) {
    try {
      const hoursAgo = options.olderThanHours || 24;
      const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1e3);
      const submissions = await this.prisma.rwaSubmission.findMany({
        where: {
          status: "PENDING",
          createdAt: {
            lt: cutoffDate
          }
        },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true
            }
          },
          rwaListing: true
        },
        orderBy: { createdAt: "asc" }
      });
      return submissions;
    } catch (error) {
      loggers.error(error, { operation: "getStuckSubmissions" });
      throw error;
    }
  }
  /**
   * Bulk retry stuck submissions
   */
  async bulkRetryStuckSubmissions(adminId, maxAge = 24, dryRun = true) {
    try {
      const stuckSubmissions = await this.getStuckSubmissions({
        olderThanHours: maxAge
      });
      if (dryRun) {
        return {
          found: stuckSubmissions.length,
          processed: 0,
          errors: []
        };
      }
      let processed = 0;
      const errors2 = [];
      for (const submission of stuckSubmissions) {
        try {
          await this.retrySubmissionApproval(submission.id, adminId, `bulk-retry-${Date.now()}`);
          processed++;
        } catch (error) {
          errors2.push(
            `${submission.id}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
      loggers.database(
        "bulk_retry_completed",
        "recovery",
        `${processed}/${stuckSubmissions.length}`
      );
      return {
        found: stuckSubmissions.length,
        processed,
        errors: errors2
      };
    } catch (error) {
      loggers.error(error, { adminId, maxAge, operation: "bulkRetryStuckSubmissions" });
      throw error;
    }
  }
  /**
   * Get recovery statistics
   */
  async getRecoveryStats() {
    try {
      const [stuckSubmissions, failedWebhooks, totalRecoveryActions] = await Promise.all([
        this.prisma.rwaSubmission.count({
          where: {
            status: "PENDING",
            createdAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1e3)
              // Older than 24 hours
            }
          }
        }),
        this.prisma.webhookLog.count({
          where: {
            processedAt: null,
            error: {
              not: null
            }
          }
        }),
        this.prisma.submissionAuditLog.count({
          where: {
            notes: {
              contains: "retry"
            }
          }
        })
      ]);
      return {
        stuckSubmissions,
        failedWebhooks,
        totalRecoveryActions
      };
    } catch (error) {
      loggers.error(error, { operation: "getRecoveryStats" });
      throw error;
    }
  }
};

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

// src/services/account-verification-service.ts
var import_client3 = require("@prisma/client");

// src/lib/secure-storage-utils.ts
var import_storage = require("@google-cloud/storage");
var import_crypto = require("crypto");
var hasGoogleCloudCredentials = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY);
var secureStorage = null;
var secureBucket = null;
var secureBucketName = "";
if (hasGoogleCloudCredentials) {
  secureStorage = new import_storage.Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    }
  });
  secureBucketName = process.env.GOOGLE_CLOUD_SECURE_BUCKET_NAME || "aces-secure-documents";
  secureBucket = secureStorage.bucket(secureBucketName);
} else {
  console.warn(
    "Google Cloud Storage credentials not configured. Document upload will be disabled for testing."
  );
}
var SecureStorageService = class {
  static {
    __name(this, "SecureStorageService");
  }
  /**
   * Get the secure bucket instance for direct operations
   */
  static getSecureBucket() {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      throw new Error("Google Cloud Storage not configured");
    }
    return secureBucket;
  }
  /**
   * Upload a verification document to secure storage
   */
  static async uploadSecureDocument(file, userId, documentType) {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.error("Google Cloud Storage not configured:", {
        hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
        hasSecureEmail: !!process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
        hasSecureKey: !!process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY,
        secureBucket: !!secureBucket
      });
      throw new Error(
        "Google Cloud Storage not configured. Please check environment variables and bucket setup."
      );
    }
    try {
      const buffer = file.buffer || await file.toBuffer();
      const fileExt = file.filename?.split(".").pop() || "jpg";
      const fileName = `verification/${userId}/${documentType}/${(0, import_crypto.randomUUID)()}.${fileExt}`;
      await secureBucket.file(fileName).save(buffer, {
        contentType: file.mimetype,
        metadata: {
          userId,
          documentType,
          uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      return this.getSecureUrl(fileName);
    } catch (error) {
      console.error("Error uploading secure document:", error);
      throw error;
    }
  }
  /**
   * Get a secure URL for an uploaded document (requires authentication)
   */
  static getSecureUrl(fileName) {
    if (!hasGoogleCloudCredentials || !secureBucketName) {
      return fileName;
    }
    return `https://storage.googleapis.com/${secureBucketName}/${fileName}`;
  }
  /**
   * Generate a signed URL for secure document access (temporary access)
   */
  static async getSignedSecureUrl(fileName, expiresInMinutes = 15) {
    const options = {
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1e3
    };
    if (!hasGoogleCloudCredentials || !secureBucket) {
      return `mock-signed://${fileName}?expires=${options.expires}`;
    }
    const [url] = await secureBucket.file(fileName).getSignedUrl(options);
    return url;
  }
  /**
   * Delete a secure document
   */
  static async deleteSecureDocument(fileName) {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.error("Google Cloud Storage not configured, skipping document deletion for testing");
      return;
    }
    try {
      await secureBucket.file(fileName).delete();
    } catch (error) {
      console.error("Error deleting secure document:", error);
      throw error;
    }
  }
  /**
   * Delete a secure document by URL
   */
  static async deleteSecureDocumentByUrl(url) {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log("Google Cloud Storage not configured, skipping document deletion for testing");
      return;
    }
    try {
      if (url.startsWith("mock://")) {
        console.log("Mock URL detected, skipping deletion for testing");
        return;
      }
      const fileName = url.split(`${secureBucketName}/`)[1];
      if (!fileName) {
        throw new Error("Invalid secure file URL");
      }
      await this.deleteSecureDocument(fileName);
    } catch (error) {
      console.error("Error deleting secure document by URL:", error);
      throw error;
    }
  }
  /**
   * List all documents for a user (admin only)
   */
  static async listUserDocuments(userId) {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log("Google Cloud Storage not configured, returning empty list for testing");
      return [];
    }
    try {
      const [files] = await secureBucket.getFiles({
        prefix: `verification/${userId}/`
      });
      return files.map((file) => file.name);
    } catch (error) {
      console.error("Error listing user documents:", error);
      throw error;
    }
  }
  /**
   * Get document metadata
   */
  static async getDocumentMetadata(fileName) {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log("Google Cloud Storage not configured, returning mock metadata for testing");
      return { fileName, mockMetadata: true };
    }
    try {
      const [metadata] = await secureBucket.file(fileName).getMetadata();
      return metadata;
    } catch (error) {
      console.error("Error getting document metadata:", error);
      throw error;
    }
  }
};
var uploadSecureDocument = SecureStorageService.uploadSecureDocument.bind(SecureStorageService);
var deleteSecureDocument = SecureStorageService.deleteSecureDocument.bind(SecureStorageService);
var deleteSecureDocumentByUrl = SecureStorageService.deleteSecureDocumentByUrl.bind(SecureStorageService);
var getSignedSecureUrl = SecureStorageService.getSignedSecureUrl.bind(SecureStorageService);

// src/services/account-verification-service.ts
var AccountVerificationService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "AccountVerificationService");
  }
  async submitVerification(userId, data, documentFile) {
    try {
      let user = null;
      let accountVerification = null;
      try {
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { accountVerification: true }
        });
        accountVerification = user?.accountVerification;
      } catch (relationError) {
        console.warn(
          "Failed to fetch user with accountVerification in canSubmit, falling back to separate queries:",
          relationError
        );
        user = await this.prisma.user.findUnique({
          where: { id: userId }
        });
        if (user) {
          try {
            accountVerification = await this.prisma.accountVerification.findUnique({
              where: { userId }
            });
          } catch (verificationError) {
            console.warn(
              "Could not fetch separate accountVerification in canSubmit:",
              verificationError
            );
            accountVerification = null;
          }
        }
      }
      if (user) {
        user.accountVerification = accountVerification;
      }
      if (!user) throw errors.notFound("User not found");
      if (user.verificationAttempts >= 3) {
        const lastAttempt = user.lastVerificationAttempt;
        if (lastAttempt && Date.now() - lastAttempt.getTime() < 24 * 60 * 60 * 1e3) {
          throw errors.badRequest("Too many verification attempts. Please try again in 24 hours.");
        }
        await this.prisma.user.update({
          where: { id: userId },
          data: { verificationAttempts: 0 }
        });
      }
      if (accountVerification?.documentImageUrl) {
        await this.deleteVerificationDocument(userId);
      }
      let documentImageUrl = null;
      if (documentFile) {
        documentImageUrl = await SecureStorageService.uploadSecureDocument(
          documentFile,
          userId,
          data.documentType
        );
        console.log(
          "Document uploaded successfully to Google Cloud Secure Storage:",
          documentImageUrl
        );
      } else {
        console.log("No document file provided - skipping upload");
      }
      const result = await this.prisma.$transaction(async (tx) => {
        const verification = await tx.accountVerification.upsert({
          where: { userId },
          create: {
            ...data,
            userId,
            documentImageUrl,
            status: import_client3.VerificationStatus.PENDING,
            attempts: 1
          },
          update: {
            ...data,
            documentImageUrl,
            status: import_client3.VerificationStatus.PENDING,
            attempts: { increment: 1 },
            lastAttemptAt: /* @__PURE__ */ new Date()
          }
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            verificationAttempts: { increment: 1 },
            lastVerificationAttempt: /* @__PURE__ */ new Date(),
            sellerStatus: import_client3.SellerStatus.PENDING
          }
        });
        await tx.verificationAuditLog.create({
          data: {
            verificationId: verification.id,
            action: "SUBMITTED",
            actorId: userId,
            timestamp: /* @__PURE__ */ new Date(),
            details: { documentType: data.documentType }
          }
        });
        return verification;
      });
      return result;
    } catch (error) {
      console.error("Error in submitVerification:", error);
      if (documentFile) {
        try {
          await this.deleteVerificationDocument(userId);
        } catch (cleanupError) {
          console.error("Error cleaning up document:", cleanupError);
        }
      }
      throw error;
    }
  }
  async reviewVerification(verificationId, reviewerId, decision, rejectionReason) {
    if (decision === import_client3.VerificationStatus.PENDING) {
      throw errors.badRequest("Cannot set verification status to pending during review");
    }
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const verification = await tx.accountVerification.findUnique({
          where: { id: verificationId },
          include: { user: true }
        });
        if (!verification) {
          throw errors.notFound("Verification not found");
        }
        if (verification.status !== import_client3.VerificationStatus.PENDING) {
          throw errors.badRequest("Verification has already been reviewed");
        }
        const updatedVerification = await tx.accountVerification.update({
          where: { id: verificationId },
          data: {
            status: decision,
            reviewedAt: /* @__PURE__ */ new Date(),
            reviewedBy: reviewerId,
            rejectionReason: decision === import_client3.VerificationStatus.REJECTED ? rejectionReason : null
          }
        });
        const newSellerStatus = decision === import_client3.VerificationStatus.APPROVED ? import_client3.SellerStatus.APPROVED : import_client3.SellerStatus.REJECTED;
        await tx.user.update({
          where: { id: verification.userId },
          data: {
            sellerStatus: newSellerStatus,
            verifiedAt: decision === import_client3.VerificationStatus.APPROVED ? /* @__PURE__ */ new Date() : null,
            rejectedAt: decision === import_client3.VerificationStatus.REJECTED ? /* @__PURE__ */ new Date() : null,
            rejectionReason: decision === import_client3.VerificationStatus.REJECTED ? rejectionReason : null
          }
        });
        await tx.verificationAuditLog.create({
          data: {
            verificationId: verification.id,
            action: decision === import_client3.VerificationStatus.APPROVED ? "APPROVED" : "REJECTED",
            actorId: reviewerId,
            timestamp: /* @__PURE__ */ new Date(),
            details: {
              rejectionReason,
              previousStatus: import_client3.VerificationStatus.PENDING,
              newStatus: decision
            }
          }
        });
        return updatedVerification;
      });
      return result;
    } catch (error) {
      console.error("Error in reviewVerification:", error);
      throw error;
    }
  }
  async getVerificationByUserId(userId) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              sellerStatus: true,
              verificationAttempts: true,
              lastVerificationAttempt: true
            }
          }
        }
      });
      return verification;
    } catch (error) {
      console.error("Error getting verification:", error);
      throw error;
    }
  }
  async deleteVerificationDocument(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { accountVerification: true }
      });
      if (!user?.accountVerification?.documentImageUrl) {
        return false;
      }
      await SecureStorageService.deleteSecureDocumentByUrl(
        user.accountVerification.documentImageUrl
      );
      await this.prisma.accountVerification.update({
        where: { userId },
        data: { documentImageUrl: null }
      });
      return true;
    } catch (error) {
      console.error("Error deleting verification document:", error);
      throw error;
    }
  }
  async getUserVerificationStatus(userId) {
    try {
      let user = null;
      let accountVerification = null;
      try {
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { accountVerification: true }
        });
        accountVerification = user?.accountVerification;
      } catch (relationError) {
        console.warn(
          "Failed to fetch user with accountVerification relationship, falling back to separate queries:",
          relationError
        );
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            sellerStatus: true,
            verificationAttempts: true,
            lastVerificationAttempt: true
          }
        });
        try {
          accountVerification = await this.prisma.accountVerification.findUnique({
            where: { userId }
          });
        } catch (verificationError) {
          console.warn("Could not fetch separate verification:", verificationError);
          accountVerification = null;
        }
      }
      if (!user) throw errors.notFound("User not found");
      return {
        sellerStatus: user.sellerStatus,
        verificationAttempts: user.verificationAttempts,
        lastVerificationAttempt: user.lastVerificationAttempt,
        verificationDetails: accountVerification
      };
    } catch (error) {
      console.error("Error getting user verification status:", error);
      throw error;
    }
  }
  async getAllPendingVerifications() {
    try {
      const verifications = await this.prisma.accountVerification.findMany({
        where: { status: import_client3.VerificationStatus.PENDING },
        orderBy: { submittedAt: "asc" }
        // FIFO order
      });
      const verificationsWithUsers = await Promise.all(
        verifications.map(async (verification) => {
          let user = null;
          try {
            user = await this.prisma.user.findUnique({
              where: { id: verification.userId },
              select: {
                id: true,
                displayName: true,
                email: true,
                createdAt: true
              }
            });
          } catch (error) {
            console.warn(
              `Failed to fetch user ${verification.userId} for verification ${verification.id}:`,
              error
            );
          }
          return {
            ...verification,
            user
          };
        })
      );
      return verificationsWithUsers;
    } catch (error) {
      console.error("Error getting pending verifications:", error);
      throw error;
    }
  }
  async getAllVerifications() {
    try {
      const verifications = await this.prisma.accountVerification.findMany({
        orderBy: { submittedAt: "desc" }
      });
      const verificationsWithRelations = await Promise.all(
        verifications.map(async (verification) => {
          let user = null;
          try {
            user = await this.prisma.user.findUnique({
              where: { id: verification.userId },
              select: {
                id: true,
                displayName: true,
                email: true,
                createdAt: true
              }
            });
          } catch (error) {
            console.warn(
              `Failed to fetch user ${verification.userId} for verification ${verification.id}:`,
              error
            );
          }
          let reviewer = null;
          if (verification.reviewedBy) {
            try {
              reviewer = await this.prisma.user.findUnique({
                where: { id: verification.reviewedBy },
                select: {
                  id: true,
                  displayName: true,
                  email: true
                }
              });
            } catch (error) {
              console.warn(
                `Failed to fetch reviewer ${verification.reviewedBy} for verification ${verification.id}:`,
                error
              );
            }
          }
          return {
            ...verification,
            user,
            reviewer
          };
        })
      );
      return verificationsWithRelations;
    } catch (error) {
      console.error("Error getting all verifications:", error);
      throw error;
    }
  }
  /**
   * Create a verification record (used for testing)
   */
  async createVerification(userId, data) {
    try {
      const existingVerification = await this.prisma.accountVerification.findUnique({
        where: { userId }
      });
      if (existingVerification) {
        if (data.documentImageUrl) {
          const updatedVerification = await this.prisma.accountVerification.update({
            where: { id: existingVerification.id },
            data: {
              documentImageUrl: data.documentImageUrl,
              status: import_client3.VerificationStatus.PENDING
            }
          });
          await this.prisma.user.update({
            where: { id: userId },
            data: { sellerStatus: import_client3.SellerStatus.PENDING }
          });
          return updatedVerification;
        }
        return existingVerification;
      }
      const verification = await this.prisma.accountVerification.create({
        data: {
          userId,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          countryOfIssue: data.countryOfIssue,
          state: data.state,
          address: data.address,
          emailAddress: data.emailAddress,
          twitter: data.twitter,
          website: data.website,
          documentImageUrl: data.documentImageUrl,
          status: import_client3.VerificationStatus.PENDING
        }
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          sellerStatus: import_client3.SellerStatus.PENDING
        }
      });
      return verification;
    } catch (error) {
      console.error("Error creating verification:", error);
      throw error;
    }
  }
  /**
   * Upload selfie image to Google Cloud Secure Storage
   */
  async uploadSelfieImage(selfieFile, userId) {
    try {
      const selfieImageUrl = await SecureStorageService.uploadSecureDocument(
        selfieFile,
        userId,
        "selfie"
      );
      return selfieImageUrl;
    } catch (error) {
      console.error("Error uploading selfie image:", error);
      throw error;
    }
  }
  /**
   * Update facial verification data for a verification record
   */
  async updateFacialVerification(verificationId, facialData) {
    try {
      const updatedVerification = await this.prisma.accountVerification.update({
        where: { id: verificationId },
        data: facialData
      });
      return updatedVerification;
    } catch (error) {
      console.error("Error updating facial verification:", error);
      throw error;
    }
  }
  /**
   * Get verification by ID (needed for facial verification)
   */
  async getVerificationById(verificationId) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { id: verificationId },
        include: {
          user: true,
          reviewer: true
        }
      });
      return verification;
    } catch (error) {
      console.error("Error getting verification by ID:", error);
      throw error;
    }
  }
};

// src/services/seller-service.ts
var import_client4 = require("@prisma/client");
var SellerService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "SellerService");
  }
  /**
   * Get all sellers on the platform (users who have applied for seller status)
   */
  async getAllSellers() {
    try {
      const sellers = await this.prisma.user.findMany({
        where: {
          sellerStatus: {
            not: import_client4.SellerStatus.NOT_APPLIED
          }
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          walletAddress: true,
          sellerStatus: true,
          appliedAt: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { appliedAt: "desc" }
      });
      const sellersWithData = await Promise.all(
        sellers.map(async (seller) => {
          let accountVerification = null;
          try {
            accountVerification = await this.prisma.accountVerification.findUnique({
              where: { userId: seller.id },
              select: {
                id: true,
                status: true,
                submittedAt: true,
                reviewedAt: true,
                attempts: true,
                firstName: true,
                lastName: true,
                documentType: true
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch verification for seller ${seller.id}:`, error);
          }
          let listings = [];
          try {
            listings = await this.prisma.rwaListing.findMany({
              where: { ownerId: seller.id },
              select: {
                id: true,
                title: true,
                symbol: true,
                isLive: true,
                createdAt: true
              },
              orderBy: { createdAt: "desc" }
            });
          } catch (error) {
            console.warn(`Failed to fetch listings for seller ${seller.id}:`, error);
          }
          let bidStats = { totalBids: 0, totalBidValue: 0 };
          try {
            if (listings.length > 0) {
              const listingIds = listings.map((l) => l.id);
              const bids = await this.prisma.bid.findMany({
                where: { listingId: { in: listingIds } },
                select: {
                  amount: true,
                  currency: true
                }
              });
              bidStats = {
                totalBids: bids.length,
                totalBidValue: bids.reduce((sum, bid) => sum + parseFloat(bid.amount), 0)
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch bid stats for seller ${seller.id}:`, error);
          }
          return {
            ...seller,
            accountVerification,
            listings: {
              total: listings.length,
              live: listings.filter((l) => l.isLive).length,
              recent: listings.slice(0, 3)
              // Most recent 3 listings
            },
            bidStats
          };
        })
      );
      return sellersWithData;
    } catch (error) {
      loggers.error(error, { operation: "getAllSellers" });
      throw error;
    }
  }
  /**
   * Get pending seller applications
   */
  async getPendingSellers() {
    try {
      const sellers = await this.prisma.user.findMany({
        where: {
          sellerStatus: import_client4.SellerStatus.PENDING
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          walletAddress: true,
          sellerStatus: true,
          appliedAt: true,
          createdAt: true
        },
        orderBy: { appliedAt: "asc" }
        // FIFO order
      });
      const sellersWithVerification = await Promise.all(
        sellers.map(async (seller) => {
          let accountVerification = null;
          try {
            accountVerification = await this.prisma.accountVerification.findUnique({
              where: { userId: seller.id },
              select: {
                id: true,
                status: true,
                submittedAt: true,
                attempts: true,
                documentType: true,
                firstName: true,
                lastName: true
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch verification for pending seller ${seller.id}:`, error);
          }
          return {
            ...seller,
            accountVerification
          };
        })
      );
      return sellersWithVerification;
    } catch (error) {
      loggers.error(error, { operation: "getPendingSellers" });
      throw error;
    }
  }
  /**
   * Get seller statistics
   */
  async getSellerStats() {
    try {
      const [totalSellers, statusGroups] = await Promise.all([
        this.prisma.user.count({
          where: {
            sellerStatus: {
              not: import_client4.SellerStatus.NOT_APPLIED
            }
          }
        }),
        this.prisma.user.groupBy({
          by: ["sellerStatus"],
          _count: { sellerStatus: true },
          where: {
            sellerStatus: {
              not: import_client4.SellerStatus.NOT_APPLIED
            }
          }
        })
      ]);
      const statusBreakdown = statusGroups.reduce(
        (acc, item) => {
          acc[item.sellerStatus] = item._count.sellerStatus;
          return acc;
        },
        {}
      );
      return {
        totalSellers,
        byStatus: statusBreakdown
      };
    } catch (error) {
      loggers.error(error, { operation: "getSellerStats" });
      throw error;
    }
  }
};

// src/lib/storage-utils.ts
var import_storage2 = require("@google-cloud/storage");
var import_crypto2 = require("crypto");
var hasGoogleCloudCredentials2 = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY);
var storage = null;
var bucket = null;
var bucketName = "";
if (hasGoogleCloudCredentials2) {
  storage = new import_storage2.Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n")
    }
  });
  bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || "aces-rwa-images";
  bucket = storage.bucket(bucketName);
} else {
  console.warn(
    "Google Cloud Storage credentials not configured. File upload will be disabled for testing."
  );
}
var StorageService = class {
  static {
    __name(this, "StorageService");
  }
  /**
   * Get the bucket instance for direct operations
   */
  static getBucket() {
    if (!bucket) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    return bucket;
  }
  /**
   * Generate a signed URL for uploading an image
   */
  static async getSignedUploadUrl(fileType, folder = "submissions") {
    if (!bucket) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    const fileName = `${folder}/${(0, import_crypto2.randomUUID)()}-${Date.now()}`;
    const options = {
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1e3,
      // 15 minutes
      contentType: fileType
    };
    const [url] = await bucket.file(fileName).getSignedUrl(options);
    return { url, fileName };
  }
  /**
   * Get a public URL for an uploaded image
   */
  static getPublicUrl(fileName) {
    if (!bucketName) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  }
  /**
   * Generate a signed URL for reading an image (temporary access)
   */
  static async getSignedReadUrl(fileName, expiresInMinutes = 60) {
    if (!bucket) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    const options = {
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1e3
    };
    const [url] = await bucket.file(fileName).getSignedUrl(options);
    return url;
  }
  /**
   * Delete an image from storage
   */
  static async deleteImage(fileName) {
    if (!bucket) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    try {
      await bucket.file(fileName).delete();
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }
  /**
   * Upload a verification document
   */
  static async uploadVerificationDocument(file, userId) {
    if (!bucket) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    try {
      const buffer = file.buffer || await file.toBuffer();
      const fileExt = file.filename.split(".").pop() || "jpg";
      const fileName = `verification/${userId}/${(0, import_crypto2.randomUUID)()}.${fileExt}`;
      await bucket.file(fileName).save(buffer, {
        contentType: file.mimetype
      });
      return this.getPublicUrl(fileName);
    } catch (error) {
      console.error("Error uploading verification document:", error);
      throw error;
    }
  }
  /**
   * Delete a verification document
   */
  static async deleteVerificationDocument(url) {
    if (!bucketName) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    try {
      const fileName = url.split(`${bucketName}/`)[1];
      if (!fileName) {
        throw new Error("Invalid file URL");
      }
      await this.deleteImage(fileName);
    } catch (error) {
      console.error("Error deleting verification document:", error);
      throw error;
    }
  }
};
var uploadVerificationDocument = StorageService.uploadVerificationDocument.bind(StorageService);
var deleteVerificationDocument = StorageService.deleteVerificationDocument.bind(StorageService);

// src/routes/v1/admin.ts
var PaginationSchema = import_zod.z.object({
  limit: import_zod.z.coerce.number().min(1).max(100).default(20),
  cursor: import_zod.z.string().optional()
});
var ApprovalSchema = import_zod.z.object({
  submissionId: import_zod.z.string().cuid()
});
var RejectionSchema = import_zod.z.object({
  submissionId: import_zod.z.string().cuid(),
  rejectionReason: import_zod.z.string().min(1).max(500)
});
var RecoverySchema = import_zod.z.object({
  submissionId: import_zod.z.string().cuid()
});
var WebhookReplaySchema = import_zod.z.object({
  webhookLogId: import_zod.z.string().cuid()
});
var SubmissionStatusEnum = import_zod.z.nativeEnum(import_client5.SubmissionStatus);
async function adminRoutes(fastify) {
  const prisma2 = getPrismaClient();
  const approvalService = new ApprovalService(prisma2);
  const submissionService = new SubmissionService(prisma2);
  const recoveryService = new RecoveryService(prisma2);
  const biddingService = new BiddingService(prisma2);
  const verificationService = new AccountVerificationService(prisma2);
  const sellerService = new SellerService(prisma2);
  fastify.addHook("preHandler", async (request) => {
    if (!request.user) {
      throw errors.unauthorized("Authentication required");
    }
    if (request.user.role !== "ADMIN") {
      throw errors.forbidden("Admin access required");
    }
  });
  fastify.get(
    "/submissions",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(PaginationSchema)
      }
    },
    async (request, reply) => {
      const { limit, cursor } = request.query;
      const submissions = await approvalService.getSubmissionsByStatus("PENDING", {
        limit,
        offset: cursor ? 1 : 0
      });
      return reply.send({
        success: true,
        data: submissions,
        hasMore: submissions.length === limit,
        nextCursor: submissions.length === limit ? submissions[submissions.length - 1]?.id : void 0
      });
    }
  );
  fastify.get(
    "/submissions/all",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(
          PaginationSchema.extend({
            status: SubmissionStatusEnum.optional()
          })
        )
      }
    },
    async (request, reply) => {
      const { status, limit, cursor } = request.query;
      const result = await submissionService.getAllSubmissions(
        request.user.id,
        status ? { status } : void 0,
        { limit, cursor }
      );
      return reply.send({
        success: true,
        ...result
      });
    }
  );
  fastify.get(
    "/submissions/:id",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ id: import_zod.z.string().cuid() }))
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const submission = await approvalService.getSubmissionById(id);
      if (!submission) {
        throw errors.notFound("Submission not found");
      }
      return reply.send({
        success: true,
        data: submission
      });
    }
  );
  fastify.post(
    "/approve/:submissionId",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(ApprovalSchema)
      }
    },
    async (request, reply) => {
      try {
        const { submissionId } = request.params;
        const adminId = request.user.id;
        const result = await approvalService.adminApproveSubmission(submissionId, adminId);
        return reply.send({
          success: true,
          data: result,
          message: "Submission approved successfully"
        });
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error("Unknown error");
        loggers.error(errorObj, {
          submissionId: request.params?.submissionId,
          adminId: request.user?.id
        });
        if (error instanceof import_boom2.Boom) {
          return reply.status(error.output.statusCode).send({
            success: false,
            error: error.message
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to approve submission"
        });
      }
    }
  );
  fastify.post(
    "/reject/:submissionId",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(RejectionSchema),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ rejectionReason: import_zod.z.string().min(1).max(500) }))
      }
    },
    async (request, reply) => {
      try {
        const { submissionId } = request.params;
        const { rejectionReason } = request.body;
        const adminId = request.user.id;
        await approvalService.rejectSubmission(submissionId, adminId, rejectionReason, request.id);
        return reply.send({
          success: true,
          message: "Submission rejected successfully"
        });
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error("Unknown error");
        loggers.error(errorObj, {
          submissionId: request.params?.submissionId,
          adminId: request.user?.id
        });
        if (error instanceof import_boom2.Boom) {
          return reply.status(error.output.statusCode).send({
            success: false,
            error: error.message
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to reject submission"
        });
      }
    }
  );
  fastify.get(
    "/submissions/:submissionId/images",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ submissionId: import_zod.z.string().cuid() }))
      }
    },
    async (request, reply) => {
      const { submissionId } = request.params;
      try {
        const submission = await submissionService.getSubmissionById(submissionId);
        if (!submission) {
          throw errors.notFound("Submission not found");
        }
        const signedUrls = await Promise.all(
          submission.imageGallery.map(async (imageUrl) => {
            const urlParts = imageUrl.split("/");
            const fileName = urlParts.slice(-2).join("/");
            try {
              const signedUrl = await StorageService.getSignedReadUrl(fileName, 60);
              return {
                originalUrl: imageUrl,
                signedUrl,
                expiresIn: 60 * 60
                // 1 hour in seconds
              };
            } catch (error) {
              return {
                originalUrl: imageUrl,
                signedUrl: imageUrl,
                expiresIn: 0,
                error: "Failed to generate signed URL"
              };
            }
          })
        );
        return reply.send({
          success: true,
          data: {
            submissionId,
            images: signedUrls
          }
        });
      } catch (error) {
        throw errors.internal("Failed to generate signed URLs for submission images", {
          cause: error
        });
      }
    }
  );
  fastify.post(
    "/recover/retry/:submissionId",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(RecoverySchema)
      }
    },
    async (request, reply) => {
      const { submissionId } = request.params;
      const adminId = request.user.id;
      const correlationId = request.id;
      const result = await recoveryService.retrySubmissionApproval(
        submissionId,
        adminId,
        correlationId
      );
      return reply.send({
        success: true,
        data: result,
        message: "Submission retry initiated successfully"
      });
    }
  );
  fastify.post(
    "/recover/replay-webhook/:webhookLogId",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(WebhookReplaySchema)
      }
    },
    async (request, reply) => {
      const { webhookLogId } = request.params;
      const adminId = request.user.id;
      const correlationId = request.id;
      const result = await recoveryService.replayWebhook(webhookLogId, adminId, correlationId);
      return reply.send({
        success: true,
        data: result,
        message: result.processed ? "Webhook was already processed" : "Webhook replayed successfully"
      });
    }
  );
  fastify.get(
    "/recovery/stuck-submissions",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(PaginationSchema)
      }
    },
    async (request, reply) => {
      const { limit } = request.query;
      const submissions = await recoveryService.getStuckSubmissions({
        olderThanHours: 24
      });
      return reply.send({
        success: true,
        data: submissions.slice(0, limit),
        total: submissions.length
      });
    }
  );
  fastify.get(
    "/recovery/failed-webhooks",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(PaginationSchema)
      }
    },
    async (request, reply) => {
      const { limit } = request.query;
      const webhooks = await recoveryService.getFailedWebhooks(limit);
      return reply.send({
        success: true,
        data: webhooks,
        total: webhooks.length
      });
    }
  );
  fastify.get("/stats", async (request, reply) => {
    const [totalSubmissions, totalBids, recoveryStats, biddingStats] = await Promise.all([
      prisma2.rwaSubmission.count(),
      prisma2.bid.count(),
      recoveryService.getRecoveryStats(),
      biddingService.getBiddingStats()
    ]);
    const submissionStatuses = await prisma2.rwaSubmission.groupBy({
      by: ["status"],
      _count: { status: true }
    });
    const statusBreakdown = submissionStatuses.reduce(
      (acc, item) => {
        if (item._count && typeof item._count === "object" && "status" in item._count) {
          acc[item.status] = item._count.status;
        }
        return acc;
      },
      {}
    );
    return reply.send({
      success: true,
      data: {
        submissions: {
          total: totalSubmissions,
          byStatus: statusBreakdown
        },
        bids: {
          total: totalBids,
          uniqueBidders: biddingStats.totalBidders
        },
        recovery: recoveryStats
      }
    });
  });
  fastify.get("/verifications/pending", async (request, reply) => {
    const verifications = await verificationService.getAllPendingVerifications();
    return reply.send({
      success: true,
      data: verifications
    });
  });
  fastify.get("/verifications", async (request, reply) => {
    const verifications = await verificationService.getAllVerifications();
    return reply.send({
      success: true,
      data: verifications
    });
  });
  fastify.get(
    "/users/:userId/verification",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ userId: import_zod.z.string().cuid() }))
      }
    },
    async (request, reply) => {
      try {
        const { userId } = request.params;
        const verification = await verificationService.getVerificationByUserId(userId);
        if (!verification) {
          return reply.send({
            success: true,
            data: null,
            message: "No verification found for this user"
          });
        }
        return reply.send({
          success: true,
          data: verification
        });
      } catch (error) {
        if (error instanceof import_boom2.Boom) {
          return reply.status(error.output.statusCode).send({
            success: false,
            error: error.message
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch user verification details"
        });
      }
    }
  );
  fastify.post(
    "/verifications/:verificationId/review",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ verificationId: import_zod.z.string().cuid() })),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            approved: import_zod.z.boolean(),
            rejectionReason: import_zod.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      const { verificationId } = request.params;
      const { approved, rejectionReason } = request.body;
      const adminId = request.user.id;
      const decision = approved ? "APPROVED" : "REJECTED";
      const result = await verificationService.reviewVerification(
        verificationId,
        adminId,
        decision,
        rejectionReason
      );
      return reply.send({
        success: true,
        data: result,
        message: `Verification ${approved ? "approved" : "rejected"} successfully`
      });
    }
  );
  fastify.get("/bids", async (request, reply) => {
    const bids = await biddingService.getAllBids();
    return reply.send({
      success: true,
      data: bids
    });
  });
  fastify.get("/sellers", async (request, reply) => {
    const sellers = await sellerService.getAllSellers();
    return reply.send({
      success: true,
      data: sellers
    });
  });
  fastify.get("/sellers/pending", async (request, reply) => {
    const sellers = await sellerService.getPendingSellers();
    return reply.send({
      success: true,
      data: sellers
    });
  });
}
__name(adminRoutes, "adminRoutes");

// src/api/admin.ts
var buildAdminApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto3.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(registerAuth);
  fastify.register(adminRoutes);
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
}, "buildAdminApp");
var appPromise;
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    appPromise = appPromise ?? buildAdminApp();
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
    if (req.url?.startsWith("/api/v1/admin")) {
      req.url = req.url.replace("/api/v1/admin", "") || "/";
    }
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("\u274C Admin handler error:", error);
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
var admin_default = handler;
