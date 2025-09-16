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
  default: () => listings_default
});
module.exports = __toCommonJS(listings_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
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
  timestamp: /* @__PURE__ */ __name(() => `,"time":"${(/* @__PURE__ */ new Date()).toISOString()}"`, "timestamp"),
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
var prisma = null;
var createPrismaClient = /* @__PURE__ */ __name(() => {
  console.log("\u{1F527} Creating Prisma client...");
  console.log("Database URL exists:", !!process.env.DATABASE_URL);
  try {
    const prisma2 = new import_client.PrismaClient({
      log: false ? [
        {
          emit: "event",
          level: "error"
        },
        {
          emit: "event",
          level: "warn"
        }
      ] : [],
      errorFormat: "pretty",
      // Optimize for Supabase connection pooling
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
    prisma2.$on("error", (e) => {
      logger.error(
        {
          type: "database",
          error: e
        },
        "Database error occurred"
      );
    });
    prisma2.$use(async (params, next) => {
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
    });
    console.log("\u2705 Prisma client created successfully");
    return prisma2;
  } catch (error) {
    console.error("\u274C Failed to create Prisma client:", error);
    throw error;
  }
}, "createPrismaClient");
var getPrismaClient = /* @__PURE__ */ __name(() => {
  try {
    if (!prisma) {
      prisma = createPrismaClient();
    }
    return prisma;
  } catch (error) {
    console.error("\u274C Failed to create Prisma client:", error);
    logger.error({ error }, "Failed to create Prisma client");
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
      logger.error({ error }, "Error disconnecting from database");
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
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var registerAuthPlugin = /* @__PURE__ */ __name(async (fastify) => {
  console.log("\u{1F527} Registering simplified auth plugin...");
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
        "/api/v1/tokens",
        // Token data and chart data endpoints
        "/api/v1/cron/trigger",
        // Cron trigger endpoint for manual testing
        "/api/v1/cron/status",
        // Cron status endpoint
        "/api/cron/sync-tokens",
        // Vercel cron endpoint
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
        request.auth = {
          user: null,
          isAuthenticated: false,
          hasRole: /* @__PURE__ */ __name(() => false, "hasRole")
        };
        return;
      }
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.log("\u274C No valid auth header for route:", request.url);
        request.user = null;
        request.auth = {
          user: null,
          isAuthenticated: false,
          hasRole: /* @__PURE__ */ __name(() => false, "hasRole")
        };
        const protectedRoutes = ["/my", "/create", "/me"];
        if (protectedRoutes.some((route) => request.url.startsWith(route))) {
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
        const slowQueryTime = Date.now() - dbStart;
        if (slowQueryTime > 2e3) {
          console.warn("\u26A0\uFE0F Slow database query detected:", slowQueryTime, "ms");
        } else {
          console.log("\u2705 Database connection successful in", slowQueryTime, "ms");
        }
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
            where: { privyDid },
            select: {
              id: true,
              privyDid: true,
              walletAddress: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true,
              updatedAt: true
            }
          });
          if (!user) {
            console.log("\u{1F195} Creating new user for Privy DID:", privyDid);
            const walletAddress = decoded.wallet_address || null;
            const email = decoded.email || null;
            user = await prisma2.user.create({
              data: {
                privyDid,
                walletAddress,
                email,
                role: "TRADER",
                // Using string literal to match enum
                isActive: true
              },
              select: {
                id: true,
                privyDid: true,
                walletAddress: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
              }
            });
            console.log("\u2705 User created successfully:", user.id);
          } else {
            console.log("\u2705 Existing user found:", user.id);
            const walletAddress = decoded.wallet_address || null;
            const email = decoded.email || null;
            const needsUpdate = walletAddress && user.walletAddress !== walletAddress || email && user.email !== email && !user.email;
            if (needsUpdate) {
              console.log("\u{1F504} Updating user info...");
              const updateData = {};
              if (walletAddress && user.walletAddress !== walletAddress) {
                updateData.walletAddress = walletAddress;
              }
              if (email && !user.email) {
                updateData.email = email;
              }
              updateData.updatedAt = /* @__PURE__ */ new Date();
              user = await prisma2.user.update({
                where: { id: user.id },
                data: updateData,
                select: {
                  id: true,
                  privyDid: true,
                  walletAddress: true,
                  email: true,
                  role: true,
                  isActive: true,
                  createdAt: true,
                  updatedAt: true
                }
              });
              console.log("\u2705 User updated successfully:", user.id);
            }
          }
          request.user = user;
          request.auth = {
            user,
            isAuthenticated: !!user && user.isActive,
            hasRole: /* @__PURE__ */ __name((role) => {
              if (!user) return false;
              const roles = Array.isArray(role) ? role : [role];
              return roles.includes(user.role);
            }, "hasRole")
          };
          console.log("\u2705 Auth context created successfully for user:", user.id);
        } catch (jwtError) {
          console.error("\u274C JWT verification failed:", jwtError);
          request.user = null;
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: /* @__PURE__ */ __name(() => false, "hasRole")
          };
        }
        console.log("\u2705 Auth hook completed in", Date.now() - startTime, "ms");
      } catch (dbError) {
        console.error("\u274C Database connection failed:", dbError);
        request.user = null;
        request.auth = {
          user: null,
          isAuthenticated: false,
          hasRole: /* @__PURE__ */ __name(() => false, "hasRole")
        };
        console.log("\u26A0\uFE0F Continuing without database connection");
      }
    } catch (error) {
      console.error("\u274C Unexpected auth hook error:", error);
      request.user = null;
      request.auth = {
        user: null,
        isAuthenticated: false,
        hasRole: /* @__PURE__ */ __name(() => false, "hasRole")
      };
      console.log("\u{1F527} Continuing with fallback auth due to error");
    }
  });
  console.log("\u2705 Simplified auth plugin registered");
}, "registerAuthPlugin");
var registerAuth = (0, import_fastify_plugin.default)(registerAuthPlugin, {
  name: "auth-plugin"
});

// src/routes/v1/listings.ts
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");

// src/lib/prisma-enums.ts
var SubmissionStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};

// src/lib/product-storage-utils.ts
var import_storage = require("@google-cloud/storage");
var hasGoogleCloudCredentials = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY);
var productStorage = null;
var productBucket = null;
var productBucketName = "";
if (hasGoogleCloudCredentials) {
  let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || "";
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n");
  console.log("[DEBUG] Private key processing:");
  console.log(`[DEBUG] - Original length: ${process.env.GOOGLE_CLOUD_PRIVATE_KEY?.length}`);
  console.log(`[DEBUG] - Processed length: ${privateKey.length}`);
  console.log(`[DEBUG] - Starts with BEGIN: ${privateKey.startsWith("-----BEGIN")}`);
  console.log(`[DEBUG] - Ends with END: ${privateKey.endsWith("-----")}`);
  console.log(`[DEBUG] - Contains newlines: ${privateKey.includes("\n")}`);
  productStorage = new import_storage.Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey
    }
  });
  productBucketName = process.env.GOOGLE_CLOUD_PRODUCT_BUCKET_NAME || "aces-product-images";
  productBucket = productStorage.bucket(productBucketName);
} else {
  console.warn(
    "Google Cloud Storage credentials not configured. Product image access will be disabled for testing."
  );
}
var ProductStorageService = class {
  static {
    __name(this, "ProductStorageService");
  }
  /**
   * Get the product bucket instance for direct operations
   */
  static getProductBucket() {
    if (!hasGoogleCloudCredentials || !productBucket) {
      throw new Error("Google Cloud Storage not configured");
    }
    return productBucket;
  }
  /**
   * Get a public URL for a product image
   */
  static getProductUrl(fileName) {
    if (!productBucketName) {
      throw new Error("Google Cloud Storage not initialized. Check credentials.");
    }
    return `https://storage.googleapis.com/${productBucketName}/${fileName}`;
  }
  /**
   * Generate a signed URL for product image access (temporary access)
   */
  static async getSignedProductUrl(fileName, expiresInMinutes = 60) {
    if (!hasGoogleCloudCredentials || !productBucket) {
      return `mock-signed://${fileName}?expires=${Date.now() + expiresInMinutes * 60 * 1e3}`;
    }
    const options = {
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1e3
    };
    const [url] = await productBucket.file(fileName).getSignedUrl(options);
    return url;
  }
  /**
   * Extract filename from a product image URL
   */
  static extractFileName(imageUrl) {
    if (!productBucketName) {
      console.warn("Product bucket name not configured, cannot extract filename");
      throw new Error("Product storage not configured");
    }
    const bucketPrefix = `https://storage.googleapis.com/${productBucketName}/`;
    if (!imageUrl.startsWith(bucketPrefix)) {
      throw new Error(`Invalid product storage URL format. Expected prefix: ${bucketPrefix}`);
    }
    return imageUrl.replace(bucketPrefix, "");
  }
  /**
   * Convert product image URLs to signed URLs for secure access
   */
  static async convertToSignedUrls(imageUrls, expiresInMinutes = 60) {
    const signedUrls = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          if (url.includes("storage.googleapis.com") && url.includes(productBucketName)) {
            const fileName = this.extractFileName(url);
            return await this.getSignedProductUrl(fileName, expiresInMinutes);
          }
          return url;
        } catch (error) {
          console.error(`Failed to generate signed URL for ${url}:`, error);
          return url;
        }
      })
    );
    return signedUrls;
  }
  /**
   * Check if file exists in product bucket
   */
  static async fileExists(fileName) {
    if (!hasGoogleCloudCredentials || !productBucket) {
      return false;
    }
    try {
      const [exists] = await productBucket.file(fileName).exists();
      return exists;
    } catch (error) {
      console.error(`Error checking if file exists: ${fileName}`, error);
      return false;
    }
  }
};

// src/services/listing-service.ts
var ListingService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "ListingService");
  }
  /**
   * Create a listing from an approved submission
   */
  async createListingFromSubmission(submissionId, adminId) {
    try {
      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true
        }
      });
      if (!submission) {
        throw errors.notFound("Submission not found");
      }
      if (submission.status !== SubmissionStatus.APPROVED) {
        throw errors.validation(
          `Cannot create listing from submission with status: ${submission.status}. Submission must be approved first.`
        );
      }
      const existingListing = await this.prisma.listing.findUnique({
        where: { submissionId }
      });
      if (existingListing) {
        throw errors.validation("Listing already exists for this submission");
      }
      const listing = await this.prisma.listing.create({
        data: {
          title: submission.title,
          symbol: submission.symbol,
          description: submission.description,
          assetType: submission.assetType,
          imageGallery: submission.imageGallery,
          location: submission.location,
          email: submission.email,
          isLive: false,
          // Always start as not live
          submissionId: submission.id,
          ownerId: submission.ownerId,
          approvedBy: adminId
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true
        }
      });
      return listing;
    } catch (error) {
      console.error("Error creating listing from submission:", error);
      throw error;
    }
  }
  /**
   * Update listing details (admin only)
   */
  async updateListing(listingId, data, _adminId) {
    try {
      const listing = await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          ...data,
          updatedAt: /* @__PURE__ */ new Date()
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true
        }
      });
      return listing;
    } catch (error) {
      console.error("Error updating listing:", error);
      throw error;
    }
  }
  /**
   * Set listing live status (admin only)
   */
  async setListingLive(listingId, isLive, _adminId) {
    try {
      const listing = await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          isLive,
          updatedAt: /* @__PURE__ */ new Date()
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true
        }
      });
      return listing;
    } catch (error) {
      console.error("Error updating listing live status:", error);
      throw error;
    }
  }
  /**
   * Set listing launch date (admin only)
   */
  async setListingLaunchDate(listingId, launchDate, _adminId) {
    try {
      const listing = await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          launchDate,
          updatedAt: /* @__PURE__ */ new Date()
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true
        }
      });
      return listing;
    } catch (error) {
      console.error("Error updating listing launch date:", error);
      throw error;
    }
  }
  /**
   * Get all live listings (public endpoint)
   */
  async getLiveListings(options = {}) {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where = { isLive: true };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const listings = await this.prisma.listing.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              privyDid: true,
              walletAddress: true,
              email: true
            }
          },
          submission: {
            select: {
              id: true,
              status: true,
              createdAt: true
            }
          },
          approvedByUser: {
            select: {
              id: true,
              privyDid: true
            }
          },
          // Include token relationship
          token: {
            select: {
              id: true,
              contractAddress: true,
              symbol: true,
              name: true,
              decimals: true,
              currentPrice: true,
              currentPriceACES: true,
              volume24h: true,
              phase: true,
              isActive: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
        // Take one extra to check for more
      });
      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery)
        }))
      );
      return { data: dataWithSignedUrls, nextCursor, hasMore };
    } catch (error) {
      console.error("Error fetching live listings:", error);
      throw error;
    }
  }
  /**
   * Get all listings (admin only)
   */
  async getAllListings(options = {}) {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where = {};
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const listings = await this.prisma.listing.findMany({
        where,
        include: {
          owner: true,
          submission: true,
          approvedByUser: true
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });
      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery)
        }))
      );
      return { data: dataWithSignedUrls, nextCursor, hasMore };
    } catch (error) {
      console.error("Error fetching all listings:", error);
      throw error;
    }
  }
  /**
   * Get pending listings (not live yet)
   */
  async getPendingListings(options = {}) {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where = { isLive: false };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const listings = await this.prisma.listing.findMany({
        where,
        include: {
          owner: true,
          submission: true,
          approvedByUser: true
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });
      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery)
        }))
      );
      return { data: dataWithSignedUrls, nextCursor, hasMore };
    } catch (error) {
      console.error("Error fetching pending listings:", error);
      throw error;
    }
  }
  /**
   * Get listing by ID
   */
  async getListingById(listingId) {
    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true
        }
      });
      if (!listing) {
        return null;
      }
      const listingWithSignedUrls = {
        ...listing,
        imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery)
      };
      return listingWithSignedUrls;
    } catch (error) {
      console.error("Error fetching listing by ID:", error);
      throw error;
    }
  }
  /**
   * Get listings by owner
   */
  async getListingsByOwner(ownerId, options = {}) {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where = { ownerId };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const listings = await this.prisma.listing.findMany({
        where,
        include: {
          owner: true,
          submission: {
            select: {
              id: true,
              status: true,
              createdAt: true
            }
          },
          approvedByUser: true
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });
      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery)
        }))
      );
      return { data: dataWithSignedUrls, nextCursor, hasMore };
    } catch (error) {
      console.error("Error fetching listings by owner:", error);
      throw error;
    }
  }
  /**
   * Delete listing (admin only)
   */
  async deleteListing(listingId) {
    try {
      await this.prisma.listing.delete({
        where: { id: listingId }
      });
    } catch (error) {
      console.error("Error deleting listing:", error);
      throw error;
    }
  }
  /**
   * Get all listings for admin dashboard
   */
  async getAllListingsForAdmin() {
    try {
      const listings = await this.prisma.listing.findMany({
        include: {
          owner: {
            include: {
              accountVerification: true
            }
          },
          submission: true,
          approvedByUser: true
        },
        orderBy: { createdAt: "desc" }
      });
      const dataWithSignedUrls = await Promise.all(
        listings.map(async (listing) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery)
        }))
      );
      return dataWithSignedUrls;
    } catch (error) {
      console.error("Error fetching all listings for admin:", error);
      throw error;
    }
  }
};

// src/lib/auth-middleware.ts
async function requireAuth(request, _reply) {
  if (!request.auth) {
    console.error("request.auth is null/undefined");
    throw errors.unauthorized("Authentication not initialized");
  }
  if (!request.auth.isAuthenticated || !request.user) {
    console.error("User not authenticated");
    throw errors.unauthorized("Authentication required");
  }
}
__name(requireAuth, "requireAuth");
async function requireAdmin(request, _reply) {
  if (!request.auth?.isAuthenticated || !request.user) {
    throw errors.unauthorized("Authentication required");
  }
  if (!request.auth.hasRole("ADMIN")) {
    throw errors.forbidden("Admin access required");
  }
}
__name(requireAdmin, "requireAdmin");

// src/routes/v1/listings.ts
var CreateListingFromSubmissionSchema = import_zod.z.object({
  submissionId: import_zod.z.string()
});
var UpdateListingSchema = import_zod.z.object({
  title: import_zod.z.string().min(1).max(200).optional(),
  symbol: import_zod.z.string().min(1).max(10).optional(),
  description: import_zod.z.string().min(1).max(2e3).optional(),
  assetType: import_zod.z.enum(["VEHICLE", "JEWELRY", "COLLECTIBLE", "ART", "FASHION", "ALCOHOL", "OTHER"]).optional(),
  imageGallery: import_zod.z.array(import_zod.z.string().url()).optional(),
  location: import_zod.z.string().max(200).optional(),
  email: import_zod.z.string().email().optional()
});
var SetListingLiveSchema = import_zod.z.object({
  isLive: import_zod.z.boolean()
});
var SetListingLaunchDateSchema = import_zod.z.object({
  launchDate: import_zod.z.string().datetime().nullable()
});
async function listingRoutes(fastify) {
  const listingService = new ListingService(fastify.prisma);
  fastify.get(
    "/live",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            limit: import_zod.z.string().transform(Number).optional(),
            cursor: import_zod.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query;
        const result = await listingService.getLiveListings({ limit, cursor });
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting live listings:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/:id",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const listing = await listingService.getListingById(id);
        if (!listing) {
          throw errors.notFound("Listing not found");
        }
        return reply.send({
          success: true,
          data: listing
        });
      } catch (error) {
        console.error("Error getting listing:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/my-listings",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            limit: import_zod.z.string().transform(Number).optional(),
            cursor: import_zod.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query;
        const result = await listingService.getListingsByOwner(request.user.id, { limit, cursor });
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting user listings:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/admin/create-from-submission",
    {
      preHandler: [requireAdmin],
      schema: {
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(CreateListingFromSubmissionSchema)
      }
    },
    async (request, reply) => {
      try {
        const { submissionId } = request.body;
        const listing = await listingService.createListingFromSubmission(
          submissionId,
          request.user.id
        );
        return reply.status(201).send({
          success: true,
          data: listing,
          message: "Listing created successfully from submission"
        });
      } catch (error) {
        console.error("Error creating listing from submission:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/admin/all",
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            limit: import_zod.z.string().transform(Number).optional(),
            cursor: import_zod.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query;
        const result = await listingService.getAllListings({ limit, cursor });
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting all listings:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/admin/pending",
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            limit: import_zod.z.string().transform(Number).optional(),
            cursor: import_zod.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query;
        const result = await listingService.getPendingListings({ limit, cursor });
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting pending listings:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(UpdateListingSchema)
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const data = request.body;
        const listing = await listingService.updateListing(id, data, request.user.id);
        return reply.send({
          success: true,
          data: listing,
          message: "Listing updated successfully"
        });
      } catch (error) {
        console.error("Error updating listing:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id/go-live",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(SetListingLiveSchema)
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { isLive } = request.body;
        const listing = await listingService.setListingLive(id, isLive, request.user.id);
        return reply.send({
          success: true,
          data: listing,
          message: `Listing ${isLive ? "made live" : "taken offline"} successfully`
        });
      } catch (error) {
        console.error("Error setting listing live status:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id/launch-date",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(SetListingLaunchDateSchema)
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { launchDate } = request.body;
        const parsedLaunchDate = launchDate ? new Date(launchDate) : null;
        const listing = await listingService.setListingLaunchDate(
          id,
          parsedLaunchDate,
          request.user.id
        );
        return reply.send({
          success: true,
          data: listing,
          message: `Listing launch date ${parsedLaunchDate ? "set to " + parsedLaunchDate.toISOString() : "cleared"} successfully`
        });
      } catch (error) {
        console.error("Error setting listing launch date:", error);
        throw error;
      }
    }
  );
  fastify.delete(
    "/admin/:id",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        await listingService.deleteListing(id);
        return reply.send({
          success: true,
          message: "Listing deleted successfully"
        });
      } catch (error) {
        console.error("Error deleting listing:", error);
        throw error;
      }
    }
  );
}
__name(listingRoutes, "listingRoutes");

// src/api/listings.ts
var buildListingsApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(import_multipart.default, {
    limits: {
      fileSize: 10 * 1024 * 1024
      // 10MB for listing images
    }
  });
  fastify.register(registerAuth);
  fastify.register(listingRoutes);
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
    } catch (handlerError) {
      handleError(handlerError, reply);
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
    const origin = req.headers.origin;
    const isOriginAllowed = /* @__PURE__ */ __name((origin2) => {
      if (!origin2) return false;
      if (origin2.endsWith(".vercel.app")) return true;
      return [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://www.aces.fun",
        "https://aces.fun",
        "https://aces-monorepo-git-feat-ui-updates-dan-aces-fun.vercel.app",
        "https://aces-monorepo-git-dev-dan-aces-fun.vercel.app"
      ].includes(origin2);
    }, "isOriginAllowed");
    if (req.method === "OPTIONS") {
      if (isOriginAllowed(origin) && origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, Accept, Origin, X-Requested-With"
        );
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "86400");
        res.setHeader("Vary", "Origin");
      }
      res.status(204).end();
      return;
    }
    if (isOriginAllowed(origin) && origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    if (req.url?.startsWith("/api/v1/listings")) {
      req.url = req.url.replace("/api/v1/listings", "") || "/";
    }
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("\u26A0 Listings handler error:", error);
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
