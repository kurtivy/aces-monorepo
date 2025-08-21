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
  default: () => listings_default
});
module.exports = __toCommonJS(listings_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));
var import_zod = require("zod");

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

// src/api/listings.ts
var listingService = new ListingService(getPrismaClient());
var toggleListingStatusSchema = import_zod.z.object({
  isLive: import_zod.z.boolean()
});
var listingParamsSchema = import_zod.z.object({
  listingId: import_zod.z.string().cuid()
});
var buildListingsApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(registerAuth);
  fastify.addHook("onRequest", async (request) => {
    request.startTime = Date.now();
    logger.info(`${request.id} ${request.method} ${request.url} ${request.headers["user-agent"]}`);
  });
  fastify.addHook("onResponse", async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    logger.info(
      `${request.id} ${request.method} ${request.url} ${reply.statusCode} ${responseTime}ms`
    );
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
  fastify.get(
    "/:listingId",
    async (request, reply) => {
      try {
        const { listingId } = listingParamsSchema.parse(request.params);
        logger.info(`Getting listing by ID: ${listingId}`);
        const listing = await listingService.getListingById(listingId);
        return reply.status(200).send({
          success: true,
          data: listing
        });
      } catch (error) {
        logger.error(`Error getting listing ${request.params.listingId}:`, error);
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
    }
  );
  fastify.post(
    "/:listingId/toggle",
    async (request, reply) => {
      try {
        const { listingId } = listingParamsSchema.parse(request.params);
        const { isLive } = toggleListingStatusSchema.parse(request.body);
        const userId = request.user?.id;
        const userRole = request.user?.role;
        if (!userId || userRole !== "ADMIN") {
          return reply.status(403).send({
            success: false,
            error: "Admin access required"
          });
        }
        logger.info(`Admin ${userId} toggling listing ${listingId} to isLive: ${isLive}`);
        const updatedListing = await listingService.updateListingStatus({
          listingId,
          isLive,
          updatedBy: userId
        });
        return reply.status(200).send({
          success: true,
          data: updatedListing,
          message: `Listing ${isLive ? "activated" : "deactivated"} successfully`
        });
      } catch (error) {
        logger.error(`Error toggling listing status for ${request.params.listingId}:`, error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: "Listing not found"
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to update listing status"
        });
      }
    }
  );
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
  return fastify;
}, "buildListingsApp");
var handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildListingsApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/listings")) {
    req.url = req.url.replace("/api/v1/listings", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var listings_default = handler;
