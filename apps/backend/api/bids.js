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
  transport: process.env.NODE_ENV === "development" ? {
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
    ]
  });
  if (process.env.NODE_ENV === "development") {
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
  return prisma2;
}, "createPrismaClient");
var prisma;
var getPrismaClient = /* @__PURE__ */ __name(() => {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}, "getPrismaClient");
var disconnectDatabase = /* @__PURE__ */ __name(async () => {
  if (prisma) {
    await prisma.$disconnect();
    logger.info("Database connection closed");
  }
}, "disconnectDatabase");
var withTransaction = /* @__PURE__ */ __name(async (callback) => {
  const client = getPrismaClient();
  return await client.$transaction(callback);
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
  const isAuthenticated = !!user && user.isActive;
  const isSellerVerified = user?.sellerStatus === import_client2.SellerStatus.APPROVED;
  const canAccessSellerDashboard = isSellerVerified && !!user?.verifiedAt;
  return {
    user,
    isAuthenticated,
    hasRole: /* @__PURE__ */ __name((role) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    }, "hasRole"),
    isSellerVerified,
    canAccessSellerDashboard
  };
}
__name(createAuthContext, "createAuthContext");

// src/plugins/auth.ts
var import_server_auth = require("@privy-io/server-auth");
var registerAuthPlugin = /* @__PURE__ */ __name(async (fastify) => {
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("auth", null);
  const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
  if (!PRIVY_APP_ID) {
    throw new Error("PRIVY_APP_ID is required");
  }
  if (!PRIVY_APP_SECRET) {
    throw new Error("PRIVY_APP_SECRET is required");
  }
  const privyClient = new import_server_auth.PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  fastify.addHook("preHandler", async (request) => {
    const authHeader = request.headers.authorization;
    const walletAddressHeader = request.headers["x-wallet-address"];
    const publicPaths = ["/health", "/api/health"];
    if (publicPaths.includes(request.url)) {
      request.user = null;
      request.auth = createAuthContext(null);
      return;
    }
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      request.user = null;
      request.auth = createAuthContext(null);
      return;
    }
    const token = authHeader.substring(7);
    try {
      const verifiedClaims = await privyClient.verifyAuthToken(token);
      const privyDid = verifiedClaims.userId;
      const walletAddress = walletAddressHeader;
      const prisma2 = getPrismaClient();
      let user = await prisma2.user.findFirst({
        where: {
          OR: [{ privyDid }, { walletAddress: walletAddress || "" }]
        }
      });
      if (!user && privyDid) {
        user = await prisma2.user.create({
          data: {
            privyDid,
            walletAddress: walletAddress || "",
            email: "",
            // We'll get email from Privy API separately if needed
            role: "TRADER",
            isActive: true,
            displayName: "User"
          }
        });
        logger.info(`Created new user: ${user.id} with Privy DID: ${privyDid}`);
      } else if (user && walletAddress && user.walletAddress !== walletAddress) {
        user = await prisma2.user.update({
          where: { id: user.id },
          data: { walletAddress }
        });
      }
      request.user = user;
      request.auth = createAuthContext(user);
    } catch (error) {
      logger.error("JWT verification failed:", error);
      request.user = null;
      request.auth = createAuthContext(null);
    }
  });
}, "registerAuthPlugin");
var registerAuth = (0, import_fastify_plugin.default)(registerAuthPlugin);

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
var handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildBidsApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/bids")) {
    req.url = req.url.replace("/api/v1/bids", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var bids_default = handler;
//# sourceMappingURL=bids.js.map