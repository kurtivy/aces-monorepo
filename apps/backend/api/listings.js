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

// src/api/listings.ts
var listings_exports = {};
__export(listings_exports, {
  config: () => config,
  default: () => listings_default
});
module.exports = __toCommonJS(listings_exports);
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

// src/routes/v1/listings.ts
var import_zod = require("zod");

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

// src/routes/v1/listings.ts
var listingService = new ListingService(getPrismaClient());
var toggleListingStatusSchema = import_zod.z.object({
  isLive: import_zod.z.boolean()
});
var listingParamsSchema = import_zod.z.object({
  listingId: import_zod.z.string().cuid()
});
async function listingsRoutes(fastify) {
  fastify.get("/", async (request, reply) => {
    try {
      logger.info("Getting all live listings");
      const listings = await listingService.getLiveListings();
      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length
      });
    } catch (error) {
      logger.error("Error getting live listings:", error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch live listings"
      });
    }
  });
  fastify.get("/:listingId", async (request, reply) => {
    try {
      const { listingId } = listingParamsSchema.parse(request.params);
      logger.info(`Getting listing by ID: ${listingId}`);
      const listing = await listingService.getListingById(listingId);
      return reply.status(200).send({
        success: true,
        data: listing
      });
    } catch (error) {
      logger.error(
        `Error getting listing ${request.params?.listingId}:`,
        error
      );
      if (error instanceof Error && error.message.includes("not found")) {
        return reply.status(404).send({
          success: false,
          error: "Listing not found"
        });
      }
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch listing"
      });
    }
  });
  fastify.get("/my", async (request, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required"
        });
      }
      logger.info(`User ${userId} getting their listings`);
      const listings = await listingService.getListingsByOwner(userId);
      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length
      });
    } catch (error) {
      logger.error(`Error getting listings for user ${request.user?.id}:`, error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch your listings"
      });
    }
  });
  fastify.post("/:listingId/toggle", async (request, reply) => {
    try {
      const { listingId } = listingParamsSchema.parse(request.params);
      const { isLive } = toggleListingStatusSchema.parse(request.body);
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required"
        });
      }
      if (request.user?.role !== "ADMIN") {
        return reply.status(403).send({
          success: false,
          error: "Admin access required"
        });
      }
      logger.info(
        `Admin ${userId} toggling listing ${listingId} to ${isLive ? "live" : "inactive"}`
      );
      const result = await listingService.updateListingStatus({
        listingId,
        isLive,
        updatedBy: userId
      });
      return reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error("Error toggling listing status:", error);
      return reply.status(500).send({
        success: false,
        error: "Failed to update listing status"
      });
    }
  });
  fastify.get("/admin/all", async (request, reply) => {
    try {
      const userId = request.user?.id;
      const userRole = request.user?.role;
      if (!userId || userRole !== "ADMIN") {
        return reply.status(403).send({
          success: false,
          error: "Admin access required"
        });
      }
      logger.info(`Admin ${userId} getting all listings`);
      const listings = await listingService.getAllListings();
      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length
      });
    } catch (error) {
      logger.error("Error getting all listings for admin:", error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch listings"
      });
    }
  });
}
__name(listingsRoutes, "listingsRoutes");

// src/api/listings.ts
var buildListingsApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: {
      level: "info",
      serializers: {
        req: /* @__PURE__ */ __name((req) => ({
          method: req.method,
          url: req.url,
          headers: req.headers
        }), "req"),
        res: /* @__PURE__ */ __name((res) => ({
          statusCode: res.statusCode
        }), "res")
      }
    },
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  await fastify.register(import_helmet.default);
  await fastify.register(registerAuth);
  fastify.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://www.aces.fun",
      "https://aces-monorepo-git-dev-dan-aces-fun.vercel.app",
      "https://aces-monorepo-git-main-dan-aces-fun.vercel.app"
    ];
    if (origin && (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app"))) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      reply.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      );
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header("Vary", "Origin");
    }
  });
  fastify.options("*", async (request, reply) => {
    reply.code(204).send();
  });
  await fastify.register(listingsRoutes);
  fastify.addHook("onRequest", async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers["user-agent"]);
  });
  fastify.addHook("onResponse", async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(
      {
        err: error,
        req: request,
        url: request.url,
        method: request.method,
        headers: request.headers,
        params: request.params,
        query: request.query,
        userId: request.user?.id,
        requestId: request.id
      },
      "Listings request failed"
    );
    try {
      handleError(error, reply);
    } catch (handlerError) {
      fastify.log.error(
        {
          err: handlerError,
          originalError: error,
          url: request.url,
          method: request.method,
          requestId: request.id
        },
        "Error handler failed"
      );
      if (!reply.sent) {
        reply.status(500).send({
          success: false,
          error: "Internal server error",
          requestId: request.id
        });
      }
    }
  });
  fastify.addHook("onClose", async () => {
    await disconnectDatabase();
  });
  return fastify;
}, "buildListingsApp");
var appPromise;
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    appPromise = appPromise ?? buildListingsApp();
    const app = await appPromise;
    await app.ready();
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("\u274C Listings handler error:", error);
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
var listings_default = handler;
var config = { runtime: "nodejs" };
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
