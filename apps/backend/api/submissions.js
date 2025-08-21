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

// src/api/submissions.ts
var submissions_exports = {};
__export(submissions_exports, {
  config: () => config,
  default: () => submissions_default
});
module.exports = __toCommonJS(submissions_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto2 = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));
var import_multipart = __toESM(require("@fastify/multipart"));

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

// src/routes/v1/submissions.ts
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");
var import_utils = require("@aces/utils");

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

// src/lib/storage-utils.ts
var import_storage = require("@google-cloud/storage");
var import_crypto = require("crypto");
var hasGoogleCloudCredentials = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY);
var storage = null;
var bucket = null;
var bucketName = "";
if (hasGoogleCloudCredentials) {
  storage = new import_storage.Storage({
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
    const fileName = `${folder}/${(0, import_crypto.randomUUID)()}-${Date.now()}`;
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
      const fileName = `verification/${userId}/${(0, import_crypto.randomUUID)()}.${fileExt}`;
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

// src/routes/v1/submissions.ts
async function submissionsRoutes(fastify) {
  let submissionService;
  let biddingService;
  try {
    submissionService = new SubmissionService(fastify.prisma);
    biddingService = new BiddingService(fastify.prisma);
  } catch (error) {
    console.error("\u274C Failed to initialize services:", error);
    throw error;
  }
  fastify.post("/upload-image", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: "No file provided"
        });
      }
      if (!data.mimetype.startsWith("image/")) {
        return reply.status(400).send({
          success: false,
          error: "File must be an image"
        });
      }
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          error: "File size too large (max 5MB)"
        });
      }
      const fileName = `submissions/${Date.now()}-${data.filename}`;
      const bucket2 = StorageService.getBucket();
      const file = bucket2.file(fileName);
      await file.save(buffer, {
        metadata: {
          contentType: data.mimetype
        }
      });
      const publicUrl = StorageService.getPublicUrl(fileName);
      return reply.send({
        success: true,
        data: { publicUrl }
      });
    } catch (error) {
      fastify.log.error({ error, operation: "uploadImage" }, "Failed to upload image");
      return reply.status(500).send({
        success: false,
        error: "Failed to upload image",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  fastify.post(
    "/get-upload-url",
    {
      schema: {
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            fileType: import_zod.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { fileType } = request.body;
        const { url, fileName } = await StorageService.getSignedUploadUrl(fileType);
        const publicUrl = StorageService.getPublicUrl(fileName);
        return reply.send({
          success: true,
          data: { url, fileName, publicUrl }
        });
      } catch (error) {
        fastify.log.error({ error, operation: "getUploadUrl" }, "Failed to generate signed URL");
        return reply.status(500).send({
          success: false,
          error: "Failed to generate signed URL",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.post(
    "/test",
    {
      schema: {
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(import_utils.CreateSubmissionSchema)
      }
    },
    async (request, reply) => {
      try {
        const body = request.body;
        const correlationId = request.id;
        console.log("\u{1F9EA} Test submission received:", { body, correlationId });
        const testUser = await fastify.prisma.user.upsert({
          where: { privyDid: "test-user" },
          update: {},
          create: {
            privyDid: "test-user",
            walletAddress: "0xTestUser",
            email: "test@example.com"
          }
        });
        const submission = await submissionService.createSubmission(
          testUser.id,
          body,
          correlationId
        );
        return { success: true, data: submission };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error({ err, operation: "testSubmission" }, "Failed to create test submission");
        return reply.status(500).send({
          success: false,
          error: "Failed to create test submission",
          details: err.message
        });
      }
    }
  );
  fastify.post(
    "/create",
    {
      schema: {
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(import_utils.CreateSubmissionSchema)
      }
    },
    async (request, reply) => {
      try {
        const body = request.body;
        const correlationId = request.id;
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: "Authentication required"
          });
        }
        const submission = await submissionService.createSubmission(
          request.user.id,
          body,
          correlationId
        );
        return { success: true, data: submission };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error({ err, operation: "createSubmission" }, "Failed to create submission");
        return reply.status(500).send({
          success: false,
          error: "Failed to create submission",
          details: err.message
        });
      }
    }
  );
  fastify.get(
    "/my",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(import_utils.PaginationSchema)
      }
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          throw errors.unauthorized("Authentication required");
        }
        const { limit, cursor } = request.query;
        const result = await submissionService.getUserSubmissions(
          request.user.id,
          void 0,
          // no status filter
          { limit, cursor }
        );
        return reply.send({
          success: true,
          ...result
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: "Failed to get user submissions",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/:id",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ id: import_zod.z.string().cuid() }))
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const submission = await submissionService.getSubmissionById(id);
        if (!submission) {
          return reply.status(404).send({
            success: false,
            error: "Submission not found"
          });
        }
        const hasLiveListing = submission.rwaListing && submission.rwaListing.isLive;
        if (!hasLiveListing && (!request.user || submission.ownerId !== request.user.id)) {
          return reply.status(403).send({
            success: false,
            error: "Cannot view this submission"
          });
        }
        return reply.send({
          success: true,
          data: submission
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: "Failed to get submission",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/live",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(import_utils.PaginationSchema)
      }
    },
    async (request, reply) => {
      try {
        console.log("\u{1F50D} Getting live submissions...");
        const { limit, cursor } = request.query;
        const limitValue = Math.min(limit || 20, 100);
        const where = { isLive: true };
        if (cursor) {
          where.id = { lt: cursor };
        }
        const listings = await fastify.prisma.rwaListing.findMany({
          where,
          include: {
            owner: {
              select: {
                id: true,
                walletAddress: true,
                displayName: true
              }
            },
            rwaSubmission: {
              select: {
                id: true,
                status: true,
                createdAt: true
              }
            },
            token: true
          },
          orderBy: { createdAt: "desc" },
          take: limitValue + 1
        });
        const hasMore = listings.length > limitValue;
        const data = hasMore ? listings.slice(0, -1) : listings;
        const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
        console.log("\u2705 Live submissions retrieved:", { count: data.length, hasMore });
        return reply.send({
          success: true,
          data,
          nextCursor,
          hasMore
        });
      } catch (error) {
        console.error("\u274C Error getting live submissions:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to get live submissions",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/search",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_utils.PaginationSchema.extend({
            q: import_zod.z.string().min(3)
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { q, limit } = request.query;
        const listings = await fastify.prisma.rwaListing.findMany({
          where: {
            isLive: true,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { symbol: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } }
            ]
          },
          include: {
            owner: {
              select: {
                id: true,
                walletAddress: true,
                displayName: true
              }
            },
            rwaSubmission: {
              select: {
                id: true,
                status: true
              }
            },
            token: true
          },
          orderBy: { createdAt: "desc" },
          take: Math.min(limit || 20, 100)
        });
        return reply.send({
          success: true,
          data: listings,
          hasMore: listings.length === (limit || 20)
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: "Failed to search submissions",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get("/stats", async (request, reply) => {
    try {
      const [totalLive, totalPending, totalUsers] = await Promise.all([
        fastify.prisma.rwaListing.count({
          where: { isLive: true }
        }),
        fastify.prisma.rwaSubmission.count({
          where: { status: "PENDING" }
        }),
        fastify.prisma.user.count()
      ]);
      return reply.send({
        success: true,
        data: {
          totalLiveTokens: totalLive,
          totalPendingSubmissions: totalPending,
          totalUsers
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: "Failed to get submission statistics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  fastify.delete(
    "/:id",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ id: import_zod.z.string().cuid() }))
      }
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: "Authentication required"
          });
        }
        const { id } = request.params;
        await submissionService.deleteSubmission(id, request.user.id);
        return reply.send({
          success: true,
          message: "Submission deleted successfully"
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: "Failed to delete submission",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/:id/bids",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(import_zod.z.object({ id: import_zod.z.string().cuid() })),
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(import_utils.PaginationSchema)
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { limit, cursor } = request.query;
        const submission = await submissionService.getSubmissionById(id);
        if (!submission) {
          return reply.status(404).send({
            success: false,
            error: "Submission not found"
          });
        }
        const hasLiveListing = submission.rwaListing && submission.rwaListing.isLive;
        if (!hasLiveListing && (!request.user || submission.ownerId !== request.user.id)) {
          return reply.status(403).send({
            success: false,
            error: "Cannot view bids for this submission"
          });
        }
        if (!submission.rwaListing) {
          return reply.send({
            success: true,
            data: [],
            hasMore: false
          });
        }
        const bids = await biddingService.getBidsForListing(submission.rwaListing.id);
        const limitValue = Math.min(limit || 20, 100);
        const startIndex = cursor ? bids.findIndex((bid) => bid.id === cursor) + 1 : 0;
        const endIndex = startIndex + limitValue;
        const paginatedBids = bids.slice(startIndex, endIndex);
        const hasMore = endIndex < bids.length;
        const nextCursor = hasMore ? paginatedBids[paginatedBids.length - 1]?.id : void 0;
        return reply.send({
          success: true,
          data: paginatedBids,
          nextCursor,
          hasMore
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: "Failed to get submission bids",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
}
__name(submissionsRoutes, "submissionsRoutes");

// src/api/submissions.ts
var buildSubmissionsApp = /* @__PURE__ */ __name(async () => {
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
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto2.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  await fastify.register(import_helmet.default);
  await fastify.register(import_multipart.default, {
    limits: { fileSize: 5 * 1024 * 1024 }
    // 5MB
  });
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
  await fastify.register(submissionsRoutes);
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
      "Submissions request failed"
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
}, "buildSubmissionsApp");
var appPromise;
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    appPromise = appPromise ?? buildSubmissionsApp();
    const app = await appPromise;
    await app.ready();
    if (req.url?.startsWith("/api/v1/submissions")) {
      req.url = req.url.replace("/api/v1/submissions", "") || "/";
    }
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("\u274C Submissions handler error:", error);
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
var submissions_default = handler;
var config = { runtime: "nodejs" };
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
