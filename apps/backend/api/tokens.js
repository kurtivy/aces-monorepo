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

// src/api/tokens.ts
var tokens_exports = {};
__export(tokens_exports, {
  default: () => tokens_default
});
module.exports = __toCommonJS(tokens_exports);
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

// src/services/token-service.ts
var TokenService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "TokenService");
  }
  /**
   * Create a token from an approved and live listing
   */
  async createTokenFromListing({
    listingId,
    contractAddress,
    userId
  }) {
    try {
      logger.info(`Creating token from listing: ${listingId}`);
      const listing = await this.prisma.rwaListing.findUnique({
        where: { id: listingId },
        include: {
          owner: true,
          rwaSubmission: true,
          token: true
          // Check if token already exists
        }
      });
      if (!listing) {
        throw errors.notFound(`Listing with id ${listingId} not found`);
      }
      if (!listing.isLive) {
        throw errors.validation("Cannot create token from inactive listing");
      }
      if (listing.token) {
        throw errors.validation("Token already exists for this listing");
      }
      const existingToken = await this.prisma.token.findUnique({
        where: { contractAddress }
      });
      if (existingToken) {
        throw errors.validation("Contract address already in use");
      }
      const token = await this.prisma.token.create({
        data: {
          contractAddress,
          rwaListingId: listingId,
          userId
          // User creating the token (could be admin or owner)
        },
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          }
        }
      });
      logger.info(`Successfully created token: ${token.id} for listing: ${listingId}`);
      return token;
    } catch (error) {
      logger.error(`Error creating token from listing ${listingId}:`, error);
      throw error;
    }
  }
  /**
   * Get token by ID with listing details
   */
  async getTokenById(tokenId) {
    try {
      const token = await this.prisma.token.findUnique({
        where: { id: tokenId },
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          }
        }
      });
      return token;
    } catch (error) {
      logger.error(`Error fetching token ${tokenId}:`, error);
      throw error;
    }
  }
  /**
   * Get token by contract address
   */
  async getTokenByContractAddress(contractAddress) {
    try {
      const token = await this.prisma.token.findUnique({
        where: { contractAddress },
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          }
        }
      });
      return token;
    } catch (error) {
      logger.error(`Error fetching token by contract address ${contractAddress}:`, error);
      throw error;
    }
  }
  /**
   * Get all tokens (admin endpoint)
   */
  async getAllTokens() {
    try {
      const tokens = await this.prisma.token.findMany({
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return tokens;
    } catch (error) {
      logger.error("Error fetching all tokens:", error);
      throw error;
    }
  }
  /**
   * Get tokens by user
   */
  async getTokensByUser(userId) {
    try {
      const tokens = await this.prisma.token.findMany({
        where: { userId },
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return tokens;
    } catch (error) {
      logger.error(`Error fetching tokens for user ${userId}:`, error);
      throw error;
    }
  }
  /**
   * Delete token (admin only)
   */
  async deleteToken(tokenId) {
    try {
      await this.prisma.token.delete({
        where: { id: tokenId }
      });
      logger.info(`Successfully deleted token: ${tokenId}`);
    } catch (error) {
      logger.error(`Error deleting token ${tokenId}:`, error);
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
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var registerAuthPlugin = /* @__PURE__ */ __name(async (fastify) => {
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("auth", null);
  const PRIVY_PUBLIC_KEY = process.env.PRIVY_PUBLIC_KEY;
  const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
  if (!PRIVY_APP_ID) {
    throw new Error("PRIVY_APP_ID is required");
  }
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
      let decoded;
      if (PRIVY_PUBLIC_KEY) {
        const publicKey = Buffer.from(PRIVY_PUBLIC_KEY, "base64").toString("ascii");
        decoded = import_jsonwebtoken.default.verify(token, publicKey, {
          algorithms: ["ES256"],
          // Privy uses ES256
          issuer: "privy.io",
          audience: PRIVY_APP_ID
        });
        logger.info("JWT verified successfully with Privy public key");
      } else {
        logger.warn("PRIVY_PUBLIC_KEY not set - using decode only (INSECURE)");
        decoded = import_jsonwebtoken.default.decode(token);
        if (!decoded) {
          throw new Error("Invalid token format");
        }
      }
      const privyDid = decoded.sub;
      const walletAddress = walletAddressHeader;
      if (!privyDid) {
        throw new Error("No user ID in token");
      }
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
            email: decoded.email || "",
            role: "TRADER",
            isActive: true,
            displayName: decoded.name || "User"
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

// src/api/tokens.ts
var tokenService = new TokenService(getPrismaClient());
var createTokenSchema = import_zod.z.object({
  listingId: import_zod.z.string().cuid(),
  contractAddress: import_zod.z.string().min(1)
});
var tokenParamsSchema = import_zod.z.object({
  tokenId: import_zod.z.string().cuid()
});
var contractAddressParamsSchema = import_zod.z.object({
  contractAddress: import_zod.z.string().min(1)
});
var buildTokensApp = /* @__PURE__ */ __name(async () => {
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
  fastify.post(
    "/",
    async (request, reply) => {
      try {
        const { listingId, contractAddress } = createTokenSchema.parse(request.body);
        const userId = request.user?.id;
        const userRole = request.user?.role;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Authentication required"
          });
        }
        if (userRole !== "ADMIN") {
          const listing = await getPrismaClient().rwaListing.findUnique({
            where: { id: listingId },
            select: { ownerId: true }
          });
          if (!listing || listing.ownerId !== userId) {
            return reply.status(403).send({
              success: false,
              error: "Only listing owners or admins can create tokens"
            });
          }
        }
        logger.info(`User ${userId} creating token for listing ${listingId}`);
        const token = await tokenService.createTokenFromListing({
          listingId,
          contractAddress,
          userId
        });
        return reply.status(201).send({
          success: true,
          data: token,
          message: "Token created successfully"
        });
      } catch (error) {
        logger.error("Error creating token:", error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: "Listing not found"
          });
        }
        if (error instanceof Error && error.message.includes("validation")) {
          return reply.status(400).send({
            success: false,
            error: error.message
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to create token"
        });
      }
    }
  );
  fastify.get(
    "/:tokenId",
    async (request, reply) => {
      try {
        const { tokenId } = tokenParamsSchema.parse(request.params);
        logger.info(`Getting token by ID: ${tokenId}`);
        const token = await tokenService.getTokenById(tokenId);
        return reply.status(200).send({
          success: true,
          data: token
        });
      } catch (error) {
        logger.error(`Error getting token ${request.params.tokenId}:`, error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: "Token not found"
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch token"
        });
      }
    }
  );
  fastify.get(
    "/contract/:contractAddress",
    async (request, reply) => {
      try {
        const { contractAddress } = contractAddressParamsSchema.parse(request.params);
        logger.info(`Getting token by contract address: ${contractAddress}`);
        const token = await tokenService.getTokenByContractAddress(contractAddress);
        return reply.status(200).send({
          success: true,
          data: token
        });
      } catch (error) {
        logger.error(
          `Error getting token by contract address ${request.params.contractAddress}:`,
          error
        );
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: "Token not found"
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch token"
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
      logger.info(`Admin ${userId} getting all tokens`);
      const tokens = await tokenService.getAllTokens();
      return reply.status(200).send({
        success: true,
        data: tokens,
        count: tokens.length
      });
    } catch (error) {
      logger.error("Error getting all tokens for admin:", error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch tokens"
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
      logger.info(`User ${userId} getting their tokens`);
      const tokens = await tokenService.getTokensByUser(userId);
      return reply.status(200).send({
        success: true,
        data: tokens,
        count: tokens.length
      });
    } catch (error) {
      logger.error(`Error getting tokens for user ${request.user?.id}:`, error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch your tokens"
      });
    }
  });
  fastify.delete(
    "/:tokenId",
    async (request, reply) => {
      try {
        const { tokenId } = tokenParamsSchema.parse(request.params);
        const userId = request.user?.id;
        const userRole = request.user?.role;
        if (!userId || userRole !== "ADMIN") {
          return reply.status(403).send({
            success: false,
            error: "Admin access required"
          });
        }
        logger.info(`Admin ${userId} deleting token ${tokenId}`);
        await tokenService.deleteToken(tokenId);
        return reply.status(200).send({
          success: true,
          message: "Token deleted successfully"
        });
      } catch (error) {
        logger.error(`Error deleting token ${request.params.tokenId}:`, error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: "Token not found"
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to delete token"
        });
      }
    }
  );
  return fastify;
}, "buildTokensApp");
var handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildTokensApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/tokens")) {
    req.url = req.url.replace("/api/v1/tokens", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var tokens_default = handler;
