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

// src/api/webhooks.ts
var webhooks_exports = {};
__export(webhooks_exports, {
  default: () => webhooks_default
});
module.exports = __toCommonJS(webhooks_exports);
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

// src/routes/v1/webhooks.ts
var import_zod_to_json_schema = require("zod-to-json-schema");
var import_utils = require("@aces/utils");

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

// src/routes/v1/webhooks.ts
async function webhooksRoutes(fastify) {
  const approvalService = new ApprovalService(fastify.prisma);
  fastify.post(
    "/chain-event",
    {
      schema: {
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(import_utils.ChainEventWebhookSchema)
      }
    },
    async (request, reply) => {
      const body = request.body;
      const correlationId = request.id;
      const headers = request.headers;
      let webhookLogId = null;
      try {
        const webhookLog = await fastify.prisma.webhookLog.create({
          data: {
            payload: JSON.parse(JSON.stringify(body)),
            headers: JSON.parse(JSON.stringify(headers))
          }
        });
        webhookLogId = webhookLog.id;
        loggers.blockchain(body.txHash, "webhook_received", `log_id: ${webhookLogId}`);
        await fastify.prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: { processedAt: /* @__PURE__ */ new Date() }
        });
        loggers.blockchain(
          body.txHash,
          "webhook_received",
          `status: ${body.status} - acknowledged`
        );
        return reply.send({
          success: true,
          message: "Webhook acknowledged (blockchain processing not implemented)"
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        loggers.error(error, {
          txHash: body.txHash,
          correlationId,
          webhookLogId,
          operation: "processWebhook"
        });
        if (webhookLogId) {
          try {
            await fastify.prisma.webhookLog.update({
              where: { id: webhookLogId },
              data: { error: errorMessage }
            });
          } catch (logError) {
            loggers.error(logError, {
              webhookLogId,
              originalError: errorMessage,
              operation: "updateWebhookLogError"
            });
          }
        }
        return reply.send({
          success: true,
          message: "Webhook received but processing failed - logged for manual review"
        });
      }
    }
  );
  fastify.get("/health", async (request, reply) => {
    return reply.send({
      success: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      service: "webhook-processor"
    });
  });
  fastify.post(
    "/test",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
            status: { type: "string", enum: ["MINED", "FAILED", "DROPPED"] },
            blockNumber: { type: "number" },
            gasUsed: { type: "string" }
          },
          required: ["txHash", "status"]
        }
      }
    },
    async (request, reply) => {
      if (true) {
        throw errors.notFound("Test endpoint not available in production");
      }
      const body = request.body;
      loggers.blockchain(body.txHash, "test_webhook", `status: ${body.status}`);
      return reply.send({
        success: true,
        message: "Test webhook acknowledged (blockchain processing not implemented)",
        processed: true
      });
    }
  );
  fastify.get("/stats", async (request, reply) => {
    const [totalWebhooks, processedWebhooks, errorWebhooks, recentErrors] = await Promise.all([
      fastify.prisma.webhookLog.count(),
      fastify.prisma.webhookLog.count({ where: { processedAt: { not: null } } }),
      fastify.prisma.webhookLog.count({ where: { error: { not: null } } }),
      fastify.prisma.webhookLog.findMany({
        where: { error: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          error: true
        }
      })
    ]);
    return reply.send({
      success: true,
      data: {
        total: totalWebhooks,
        processed: processedWebhooks,
        errors: errorWebhooks,
        successRate: totalWebhooks > 0 ? ((processedWebhooks - errorWebhooks) / totalWebhooks * 100).toFixed(2) : 100,
        recentErrors
      }
    });
  });
}
__name(webhooksRoutes, "webhooksRoutes");

// src/api/webhooks.ts
var buildWebhooksApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.decorateRequest("user", null);
  fastify.register(import_helmet.default);
  fastify.register(webhooksRoutes);
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
}, "buildWebhooksApp");
var handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildWebhooksApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/webhooks")) {
    req.url = req.url.replace("/api/v1/webhooks", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var webhooks_default = handler;
