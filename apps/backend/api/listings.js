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

// src/plugins/auth.ts
var registerAuthPlugin = /* @__PURE__ */ __name(async (fastify) => {
  console.log("\u{1F527} Registering simplified auth plugin...");
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("auth", null);
  fastify.decorate("authenticate", requireAuth);
  fastify.addHook("preHandler", async (request, reply) => {
    const startTime = Date.now();
    try {
      const isLikelyPublic = request.url.startsWith("/api/v1/tokens") || request.url.startsWith("/health") || request.url.startsWith("/api/health");
      if (!isLikelyPublic) {
        console.log("\u{1F50D} Auth hook triggered for:", {
          url: request.url,
          method: request.method,
          hasAuthHeader: !!request.headers.authorization
        });
      }
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
        "/api/v1/dex",
        // DEX quote/pool endpoints
        "/api/v1/twitch",
        // Twitch stream endpoints
        "/api/v1/cron/trigger",
        // Cron trigger endpoint for manual testing
        "/api/v1/cron/status",
        // Cron status endpoint
        "/api/cron/sync-tokens",
        // Vercel cron endpoint
        "/api/cron/sync-liquidity",
        "/"
        // Root path for listings, contact, etc.
      ];
      const isPublicPath = publicPaths.some((path) => {
        if (request.url === path) return true;
        if (path === "/health" && request.url.startsWith("/health")) return true;
        if (path === "/api/v1/tokens" && request.url.startsWith("/api/v1/tokens")) return true;
        if (path === "/api/v1/dex" && request.url.startsWith("/api/v1/dex")) return true;
        return false;
      }) || request.method === "GET" && ["/live", "/search", "/stats", "/"].includes(request.url);
      if (isPublicPath) {
        if (!request.url.startsWith("/api/v1/tokens")) {
          console.log("\u2705 Public path, skipping auth:", request.url);
        }
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
var import_dotenv = require("dotenv");
var import_path = require("path");
var envPath = (0, import_path.join)(process.cwd(), ".env");
(0, import_dotenv.config)({ path: envPath });
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
  console.log("[ProductStorage] Initializing Google Cloud Storage for product images...");
  console.log(`[ProductStorage] - Project ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
  console.log(`[ProductStorage] - Client Email: ${process.env.GOOGLE_CLOUD_CLIENT_EMAIL}`);
  console.log(`[ProductStorage] - Private key length: ${privateKey.length}`);
  console.log(
    `[ProductStorage] - Private key format valid: ${privateKey.startsWith("-----BEGIN") && privateKey.endsWith("-----")}`
  );
  productStorage = new import_storage.Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey
    }
  });
  productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || "aces-product-images";
  productBucket = productStorage.bucket(productBucketName);
  console.log(`[ProductStorage] \u2705 Initialized successfully for bucket: ${productBucketName}`);
} else {
  console.warn(
    "[ProductStorage] \u26A0\uFE0F  Google Cloud Storage credentials not configured. Product image access will be disabled."
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
    try {
      const hasCredentials = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY);
      if (!hasCredentials) {
        console.error(`[ProductStorage] Missing credentials for: ${fileName}`);
        throw new Error("Google Cloud Storage credentials not configured");
      }
      if (!productStorage) {
        console.log(`[ProductStorage] Initializing storage for: ${fileName}`);
        let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || "";
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, "\n");
        if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
          console.error(`[ProductStorage] Invalid private key format for: ${fileName}`);
          throw new Error("Invalid private key format");
        }
        productStorage = new import_storage.Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: {
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
            private_key: privateKey
          }
        });
        console.log(`[ProductStorage] Storage initialized successfully for: ${fileName}`);
      }
      if (!productBucket) {
        productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || "aces-product-images";
        productBucket = productStorage.bucket(productBucketName);
        console.log(`[ProductStorage] Bucket initialized: ${productBucketName} for: ${fileName}`);
      }
      const options = {
        version: "v4",
        action: "read",
        expires: Date.now() + expiresInMinutes * 60 * 1e3
      };
      console.log(
        `[ProductStorage] Generating signed URL for: ${fileName} with ${expiresInMinutes}min expiry`
      );
      const [url] = await productBucket.file(fileName).getSignedUrl(options);
      if (!url || !url.includes("X-Goog-Signature")) {
        console.error(`[ProductStorage] Generated URL is not a valid signed URL for: ${fileName}`);
        console.error(`[ProductStorage] URL: ${url}`);
        throw new Error("Failed to generate valid signed URL");
      }
      console.log(
        `[ProductStorage] \u2705 Generated valid signed URL for: ${fileName} (length: ${url.length})`
      );
      return url;
    } catch (error) {
      console.error(`[ProductStorage] \u274C Error generating signed URL for ${fileName}:`, error);
      console.error(`[ProductStorage] Error details:`, {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace"
      });
      throw new Error(
        `Failed to generate signed URL for ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
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
    console.log(`[ProductStorage] Converting ${imageUrls.length} URLs to signed URLs...`);
    console.log(
      `[ProductStorage] Current bucket name: ${productBucketName || "aces-product-images"}`
    );
    const signedUrls = await Promise.all(
      imageUrls.map(async (url, index) => {
        try {
          console.log(`[ProductStorage] Processing URL ${index + 1}/${imageUrls.length}: ${url}`);
          if (url.includes("storage.googleapis.com") && url.includes("aces-product-images")) {
            const fileName = this.extractFileName(url);
            console.log(`[ProductStorage] Extracted filename: ${fileName}`);
            const signedUrl = await this.getSignedProductUrl(fileName, expiresInMinutes);
            console.log(
              `[ProductStorage] \u2705 Converted to signed URL (length: ${signedUrl.length})`
            );
            return signedUrl;
          }
          console.log(`[ProductStorage] \u2139\uFE0F  Keeping original URL (not GCS product image): ${url}`);
          return url;
        } catch (error) {
          console.error(`[ProductStorage] \u274C Failed to convert URL ${url}:`, error);
          console.error(`[ProductStorage] Error details:`, {
            message: error instanceof Error ? error.message : "Unknown error",
            index: index + 1,
            originalUrl: url
          });
          throw error;
        }
      })
    );
    console.log(`[ProductStorage] \u2705 Successfully converted ${signedUrls.length} URLs`);
    signedUrls.forEach((url, index) => {
      const isSignedUrl = url.includes("X-Goog-Signature");
      console.log(
        `[ProductStorage]   ${index + 1}: ${isSignedUrl ? "SIGNED" : "DIRECT"} - ${url.substring(0, 100)}${url.length > 100 ? "..." : ""}`
      );
    });
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

// src/services/notification-service.ts
var NotificationService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "NotificationService");
  }
  /**
   * Create a new notification for a user
   */
  async createNotification(data) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId }
      });
      if (!user) {
        throw errors.notFound("User not found");
      }
      if (data.listingId) {
        const listing = await this.prisma.listing.findUnique({
          where: { id: data.listingId }
        });
        if (!listing) {
          throw errors.notFound("Listing not found");
        }
      }
      if (data.submissionId) {
        const submission = await this.prisma.submission.findUnique({
          where: { id: data.submissionId }
        });
        if (!submission) {
          throw errors.notFound("Submission not found");
        }
      }
      const notification = await this.prisma.userNotification.create({
        data: {
          userId: data.userId,
          listingId: data.listingId,
          submissionId: data.submissionId,
          type: data.type,
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl,
          expiresAt: data.expiresAt
        }
      });
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
  /**
   * Get all notifications for a user
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const { includeRead = true, limit = 50, offset = 0 } = options;
      const whereClause = {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }]
      };
      const finalWhereClause = !includeRead ? { ...whereClause, isRead: false } : whereClause;
      const notifications = await this.prisma.userNotification.findMany({
        where: finalWhereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true
            }
          },
          submission: {
            select: {
              id: true,
              title: true,
              symbol: true,
              status: true,
              rejectionReason: true,
              imageGallery: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      });
      return notifications;
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      throw error;
    }
  }
  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await this.prisma.userNotification.findFirst({
        where: {
          id: notificationId,
          userId
        }
      });
      if (!notification) {
        throw errors.notFound("Notification not found");
      }
      const updatedNotification = await this.prisma.userNotification.update({
        where: { id: notificationId },
        data: { isRead: true }
      });
      return updatedNotification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }
  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      const result = await this.prisma.userNotification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: { isRead: true }
      });
      return { count: result.count };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }
  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId) {
    try {
      const count = await this.prisma.userNotification.count({
        where: {
          userId,
          isRead: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }]
        }
      });
      return count;
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      throw error;
    }
  }
  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await this.prisma.userNotification.findFirst({
        where: {
          id: notificationId,
          userId
        }
      });
      if (!notification) {
        throw errors.notFound("Notification not found");
      }
      await this.prisma.userNotification.delete({
        where: { id: notificationId }
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }
  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await this.prisma.userNotification.deleteMany({
        where: {
          expiresAt: {
            lt: /* @__PURE__ */ new Date()
          }
        }
      });
      return { count: result.count };
    } catch (error) {
      console.error("Error cleaning up expired notifications:", error);
      throw error;
    }
  }
};
var NotificationTemplates = {
  ["LISTING_APPROVED" /* LISTING_APPROVED */]: {
    title: "Listing Approved!",
    message: "Your submission has been approved and converted to a listing. Complete your listing details to proceed with token creation.",
    getActionUrl: /* @__PURE__ */ __name((listingId) => `/profile?tab=listings&listing=${listingId}`, "getActionUrl")
  },
  ["READY_TO_MINT" /* READY_TO_MINT */]: {
    title: "Ready to Launch!",
    message: "Your token parameters have been approved by our team. You can now mint your token and launch it for trading!",
    getActionUrl: /* @__PURE__ */ __name((listingId) => `/listings/${listingId}/mint`, "getActionUrl")
  },
  ["TOKEN_MINTED" /* TOKEN_MINTED */]: {
    title: "Token Live!",
    message: "Congratulations! Your token has been successfully minted and is now live for trading.",
    getActionUrl: /* @__PURE__ */ __name((symbol) => `/rwa/${symbol}`, "getActionUrl")
  },
  ["TOKEN_PARAMETERS_SUBMITTED" /* TOKEN_PARAMETERS_SUBMITTED */]: {
    title: "Token Parameters Under Review",
    message: "Your token creation request has been submitted and is being reviewed by our team. You'll be notified once the parameters are approved.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile", "getActionUrl")
  },
  ["ADMIN_MESSAGE" /* ADMIN_MESSAGE */]: {
    title: "Message from Admin",
    message: "You have received a message from the administration team.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile", "getActionUrl")
  },
  ["SYSTEM_ALERT" /* SYSTEM_ALERT */]: {
    title: "System Alert",
    message: "Important system information.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile", "getActionUrl")
  },
  // Verification notifications
  ["VERIFICATION_PENDING" /* VERIFICATION_PENDING */]: {
    title: "Verification Submitted",
    message: "Your identity verification has been submitted and is under review. You will be notified of the results.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile", "getActionUrl")
  },
  ["VERIFICATION_APPROVED" /* VERIFICATION_APPROVED */]: {
    title: "Verification Approved!",
    message: "Your identity has been successfully verified! You can now submit assets for tokenization and place bids.",
    getActionUrl: /* @__PURE__ */ __name(() => "/launch", "getActionUrl")
  },
  ["VERIFICATION_REJECTED" /* VERIFICATION_REJECTED */]: {
    title: "Verification Rejected",
    message: "Your verification was rejected. Please review the requirements and resubmit with correct information.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile", "getActionUrl")
  },
  // Submission notifications
  ["SUBMISSION_APPROVED" /* SUBMISSION_APPROVED */]: {
    title: "Submission Approved!",
    message: "Great news! Your asset submission has been approved.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile", "getActionUrl")
  },
  ["SUBMISSION_REJECTED" /* SUBMISSION_REJECTED */]: {
    title: "Submission Rejected",
    message: "Your asset submission has been reviewed and rejected.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile", "getActionUrl")
  },
  // Bidding notifications
  ["NEW_BID_RECEIVED" /* NEW_BID_RECEIVED */]: {
    title: "New Bid Received!",
    message: "Someone has placed a bid on your listing. Check your bids to review and respond.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile?tab=bids", "getActionUrl")
  },
  ["BID_ACCEPTED" /* BID_ACCEPTED */]: {
    title: "Bid Accepted!",
    message: "Great news! Your bid has been accepted by the listing owner.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile?tab=bids", "getActionUrl")
  },
  ["BID_REJECTED" /* BID_REJECTED */]: {
    title: "Bid Not Accepted",
    message: "Your bid was not accepted by the listing owner. You can place a new bid if the listing is still available.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile?tab=bids", "getActionUrl")
  },
  ["BID_OUTBID" /* BID_OUTBID */]: {
    title: "You Have Been Outbid",
    message: "Another bidder has placed a higher bid on this listing. Consider placing a new bid if you're still interested.",
    getActionUrl: /* @__PURE__ */ __name(() => "/profile?tab=bids", "getActionUrl")
  },
  // Admin notifications
  ["ADMIN_NEW_SUBMISSION" /* ADMIN_NEW_SUBMISSION */]: {
    title: "New Asset Submission",
    message: "A new asset has been submitted for review and approval.",
    getActionUrl: /* @__PURE__ */ __name(() => "/admin/submissions", "getActionUrl")
  },
  ["ADMIN_NEW_VERIFICATION" /* ADMIN_NEW_VERIFICATION */]: {
    title: "New Verification Request",
    message: "A user has submitted identity verification documents for review.",
    getActionUrl: /* @__PURE__ */ __name(() => "/admin/verifications", "getActionUrl")
  },
  ["ADMIN_TOKEN_REVIEW_NEEDED" /* ADMIN_TOKEN_REVIEW_NEEDED */]: {
    title: "Token Parameters Need Review",
    message: "A user has completed token creation details and requires admin approval.",
    getActionUrl: /* @__PURE__ */ __name(() => "/admin/listings", "getActionUrl")
  }
};

// src/services/aerodrome-data-service.ts
var import_ethers = require("ethers");
var PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)"
];
var FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB, bool stable) view returns (address)"
];
var ERC20_ABI = ["function decimals() view returns (uint8)"];
var FIVE_SECONDS_IN_MS = 5e3;
var DEFAULT_RESOLUTION = "5m";
var AerodromeDataService = class {
  static {
    __name(this, "AerodromeDataService");
  }
  provider;
  factoryAddress;
  acesTokenAddress;
  apiBaseUrl;
  apiKey;
  defaultStable;
  cacheTtlMs;
  mockEnabled;
  mockData;
  fetchFn;
  poolCache = /* @__PURE__ */ new Map();
  tradesCache = /* @__PURE__ */ new Map();
  candleCache = /* @__PURE__ */ new Map();
  decimalsCache = /* @__PURE__ */ new Map();
  genericPoolCache = /* @__PURE__ */ new Map();
  constructor(options) {
    this.acesTokenAddress = options.acesTokenAddress.toLowerCase();
    this.factoryAddress = options.factoryAddress;
    this.apiBaseUrl = options.apiBaseUrl;
    this.apiKey = options.apiKey;
    this.defaultStable = options.defaultStable ?? false;
    this.cacheTtlMs = options.cacheTtlMs ?? FIVE_SECONDS_IN_MS;
    this.mockEnabled = options.mockEnabled ?? process.env.USE_DEX_MOCKS === "true";
    this.mockData = options.mockData || { pools: {}, trades: {} };
    this.fetchFn = options.fetchFn ?? fetch;
    if (!this.mockEnabled) {
      if (!options.provider && !options.rpcUrl) {
        throw new Error(
          "AerodromeDataService: rpcUrl or provider is required when mock mode is disabled"
        );
      }
      this.provider = options.provider ?? new import_ethers.ethers.JsonRpcProvider(options.rpcUrl);
      if (!this.factoryAddress) {
        throw new Error(
          "AerodromeDataService: factoryAddress is required when mock mode is disabled"
        );
      }
    } else {
      this.provider = null;
    }
  }
  async getPoolState(tokenAddress, knownPoolAddress) {
    const normalizedToken = tokenAddress.toLowerCase();
    if (this.mockEnabled) {
      const mockPool = this.mockData.pools?.[normalizedToken];
      if (!mockPool) {
        return null;
      }
      return {
        ...mockPool,
        lastUpdated: Date.now()
      };
    }
    if (!this.provider || !this.factoryAddress) {
      return null;
    }
    const cacheKey = normalizedToken;
    const cached = this.getCached(this.poolCache, cacheKey);
    if (cached) {
      return cached;
    }
    let poolAddress;
    if (knownPoolAddress) {
      console.log(`\u{1F50D} Using known pool address: ${knownPoolAddress}`);
      poolAddress = knownPoolAddress.toLowerCase();
    } else {
      console.log(`\u{1F50D} Resolving pool address from factory for token: ${normalizedToken}`);
      poolAddress = await this.resolvePoolAddress(normalizedToken);
    }
    console.log(`\u{1F4CD} Pool address resolved to: ${poolAddress}`);
    if (!poolAddress || poolAddress === import_ethers.ethers.ZeroAddress) {
      console.log(`\u274C Invalid pool address: ${poolAddress}`);
      return null;
    }
    console.log(`\u{1F504} Creating contract for pool: ${poolAddress}`);
    const pairContract = new import_ethers.ethers.Contract(poolAddress, PAIR_ABI, this.provider);
    console.log(`\u{1F4DE} Calling getReserves() on pool contract...`);
    try {
      const [reserve0, reserve1] = await pairContract.getReserves();
      console.log(`\u2705 Got reserves - reserve0: ${reserve0}, reserve1: ${reserve1}`);
      const token0 = (await pairContract.token0()).toLowerCase();
      const token1 = (await pairContract.token1()).toLowerCase();
      const totalSupply = await pairContract.totalSupply();
      const tokenDecimals = await this.getTokenDecimals(normalizedToken);
      const counterDecimals = await this.getTokenDecimals(this.acesTokenAddress);
      const tokenIsToken0 = token0 === normalizedToken;
      const tokenReserveRaw = tokenIsToken0 ? reserve0 : reserve1;
      const counterReserveRaw = tokenIsToken0 ? reserve1 : reserve0;
      const tokenReserve = parseFloat(import_ethers.ethers.formatUnits(tokenReserveRaw, tokenDecimals));
      const counterReserve = parseFloat(import_ethers.ethers.formatUnits(counterReserveRaw, counterDecimals));
      const priceInCounter = tokenReserve === 0 ? 0 : counterReserve / tokenReserve;
      const poolState = {
        poolAddress,
        tokenAddress: normalizedToken,
        counterToken: this.acesTokenAddress,
        reserves: {
          token: tokenReserve.toString(),
          counter: counterReserve.toString()
        },
        reserveRaw: {
          token: tokenReserveRaw.toString(),
          counter: counterReserveRaw.toString()
        },
        priceInCounter,
        lastUpdated: Date.now(),
        totalSupply: totalSupply.toString()
      };
      this.setCached(this.poolCache, cacheKey, poolState);
      return poolState;
    } catch (error) {
      console.error(`\u274C ERROR calling pool contract at ${poolAddress}:`, error);
      return null;
    }
  }
  async getRecentTrades(tokenAddress, limit = 100) {
    const normalizedToken = tokenAddress.toLowerCase();
    if (this.mockEnabled) {
      const trades = this.mockData.trades?.[normalizedToken] ?? [];
      return trades.slice(-limit);
    }
    if (!this.provider) {
      return [];
    }
    const poolAddress = await this.resolvePoolAddress(normalizedToken);
    if (!poolAddress || poolAddress === import_ethers.ethers.ZeroAddress) {
      return [];
    }
    const cacheKey = `${poolAddress}-${limit}`;
    const cached = this.getCached(this.tradesCache, cacheKey);
    if (cached) {
      return cached.slice(-limit);
    }
    const swaps = await this.fetchTradesFromAerodromeApi(poolAddress, limit);
    if (swaps.length > 0) {
      this.setCached(this.tradesCache, cacheKey, swaps);
    }
    return swaps.slice(-limit);
  }
  async getCandles(tokenAddress, resolution = DEFAULT_RESOLUTION, lookbackMinutes = 60) {
    const normalizedToken = tokenAddress.toLowerCase();
    const cacheKey = `${normalizedToken}-${resolution}-${lookbackMinutes}`;
    const cached = this.getCached(this.candleCache, cacheKey);
    if (cached) {
      return cached;
    }
    const trades = await this.getRecentTrades(normalizedToken);
    if (trades.length === 0) {
      return [];
    }
    const resolutionMs = this.resolutionToMs(resolution);
    const cutoff = Date.now() - lookbackMinutes * 60 * 1e3;
    const filtered = trades.filter((trade) => trade.timestamp >= cutoff);
    const candles = this.buildCandles(filtered, resolutionMs, resolution);
    this.setCached(this.candleCache, cacheKey, candles);
    return candles;
  }
  clearCaches() {
    this.poolCache.clear();
    this.tradesCache.clear();
    this.candleCache.clear();
    this.genericPoolCache.clear();
  }
  async getPairReserves(tokenIn, tokenOut) {
    const state = await this.getGenericPoolState(tokenIn, tokenOut);
    if (!state) {
      return null;
    }
    const normalizedIn = tokenIn.toLowerCase();
    const normalizedOut = tokenOut.toLowerCase();
    let reserveIn;
    let reserveOut;
    if (state.token0 === normalizedIn && state.token1 === normalizedOut) {
      reserveIn = BigInt(state.reserve0);
      reserveOut = BigInt(state.reserve1);
    } else if (state.token0 === normalizedOut && state.token1 === normalizedIn) {
      reserveIn = BigInt(state.reserve1);
      reserveOut = BigInt(state.reserve0);
    } else {
      return null;
    }
    const decimalsIn = await this.getTokenDecimals(normalizedIn);
    const decimalsOut = await this.getTokenDecimals(normalizedOut);
    return {
      poolAddress: state.poolAddress,
      reserveIn,
      reserveOut,
      decimalsIn,
      decimalsOut,
      stable: state.stable
    };
  }
  async resolvePoolAddress(tokenAddress) {
    if (this.mockEnabled) {
      const mockPool = this.mockData.pools?.[tokenAddress];
      return mockPool?.poolAddress ?? null;
    }
    if (!this.provider || !this.factoryAddress) {
      return null;
    }
    const factory = new import_ethers.ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);
    const poolAddress = await factory.getPair(
      tokenAddress,
      this.acesTokenAddress,
      this.defaultStable
    );
    return poolAddress.toLowerCase();
  }
  async resolvePairAddress(tokenA, tokenB) {
    if (this.mockEnabled) {
      return null;
    }
    if (!this.provider || !this.factoryAddress) {
      return null;
    }
    const normalizedA = tokenA.toLowerCase();
    const normalizedB = tokenB.toLowerCase();
    const factory = new import_ethers.ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);
    const attempts = this.defaultStable ? [true, false] : [false, true];
    for (const stable of attempts) {
      try {
        const pairAddress = await factory.getPair(normalizedA, normalizedB, stable);
        if (pairAddress && pairAddress !== import_ethers.ethers.ZeroAddress) {
          return { address: pairAddress.toLowerCase(), stable };
        }
      } catch (error) {
        console.error("\u274C Failed to resolve pair address:", error);
      }
    }
    return null;
  }
  async getGenericPoolState(tokenA, tokenB) {
    const normalizedA = tokenA.toLowerCase();
    const normalizedB = tokenB.toLowerCase();
    const cacheKey = normalizedA < normalizedB ? `${normalizedA}-${normalizedB}` : `${normalizedB}-${normalizedA}`;
    const cached = this.getCached(this.genericPoolCache, cacheKey);
    if (cached) {
      return cached;
    }
    if (this.mockEnabled) {
      return null;
    }
    if (!this.provider) {
      return null;
    }
    const pair = await this.resolvePairAddress(normalizedA, normalizedB);
    if (!pair) {
      return null;
    }
    try {
      const pairContract = new import_ethers.ethers.Contract(pair.address, PAIR_ABI, this.provider);
      const [reserve0, reserve1] = await pairContract.getReserves();
      const token0 = (await pairContract.token0()).toLowerCase();
      const token1 = (await pairContract.token1()).toLowerCase();
      const state = {
        poolAddress: pair.address,
        token0,
        token1,
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        stable: pair.stable,
        lastUpdated: Date.now()
      };
      this.setCached(this.genericPoolCache, cacheKey, state);
      return state;
    } catch (error) {
      console.error("\u274C ERROR reading generic pool state:", error);
      return null;
    }
  }
  async getTokenDecimals(address) {
    const normalized = address.toLowerCase();
    if (this.decimalsCache.has(normalized)) {
      return this.decimalsCache.get(normalized);
    }
    if (this.mockEnabled) {
      const decimals2 = normalized === this.acesTokenAddress ? 18 : 18;
      this.decimalsCache.set(normalized, decimals2);
      return decimals2;
    }
    if (!this.provider) {
      throw new Error("Provider unavailable for decimals lookup");
    }
    const erc20 = new import_ethers.ethers.Contract(normalized, ERC20_ABI, this.provider);
    const decimals = await erc20.decimals();
    this.decimalsCache.set(normalized, Number(decimals));
    return Number(decimals);
  }
  async fetchTradesFromAerodromeApi(poolAddress, limit) {
    if (!this.apiBaseUrl) {
      return [];
    }
    const url = new URL(this.apiBaseUrl.replace(/\/$/, ""));
    url.pathname = `${url.pathname.replace(/\/$/, "")}/trades`;
    url.searchParams.set("poolAddress", poolAddress);
    url.searchParams.set("limit", String(limit));
    const response = await this.fetchFn(url.toString(), {
      headers: this.apiKey ? {
        Authorization: `Bearer ${this.apiKey}`
      } : void 0
    });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    const tradesArray = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    if (!Array.isArray(tradesArray)) {
      return [];
    }
    return tradesArray.map((item) => this.mapApiTrade(item)).filter(Boolean);
  }
  mapApiTrade(trade) {
    if (!trade) return null;
    const timestampMs = typeof trade.timestamp === "number" ? trade.timestamp * 1e3 : Date.now();
    const direction = trade.direction === "buy" ? "buy" : trade.direction === "sell" ? "sell" : "buy";
    return {
      txHash: trade.txHash || trade.transactionHash || "",
      timestamp: timestampMs,
      blockNumber: trade.blockNumber || 0,
      direction,
      amountToken: trade.amountToken?.toString?.() ?? trade.amountIn?.toString?.() ?? "0",
      amountCounter: trade.amountCounter?.toString?.() ?? trade.amountOut?.toString?.() ?? "0",
      priceInCounter: Number(trade.priceInCounter ?? trade.price ?? 0)
    };
  }
  buildCandles(trades, resolutionMs, resolution) {
    if (trades.length === 0) {
      return [];
    }
    const buckets = /* @__PURE__ */ new Map();
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    for (const trade of sortedTrades) {
      const bucketStart = Math.floor(trade.timestamp / resolutionMs) * resolutionMs;
      let candle = buckets.get(bucketStart);
      if (!candle) {
        candle = {
          open: trade.priceInCounter,
          high: trade.priceInCounter,
          low: trade.priceInCounter,
          close: trade.priceInCounter,
          volumeToken: 0,
          volumeCounter: 0,
          startTime: bucketStart,
          resolution
        };
        buckets.set(bucketStart, candle);
      }
      candle.high = Math.max(candle.high, trade.priceInCounter);
      candle.low = Math.min(candle.low, trade.priceInCounter);
      candle.close = trade.priceInCounter;
      const tokenVolume = Number(trade.amountToken ?? 0);
      const counterVolume = Number(trade.amountCounter ?? 0);
      candle.volumeToken += Number.isFinite(tokenVolume) ? tokenVolume : 0;
      candle.volumeCounter += Number.isFinite(counterVolume) ? counterVolume : 0;
    }
    return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([, candle]) => candle);
  }
  resolutionToMs(resolution) {
    switch (resolution) {
      case "5m":
        return 5 * 60 * 1e3;
      case "15m":
        return 15 * 60 * 1e3;
      case "1h":
        return 60 * 60 * 1e3;
      case "4h":
        return 4 * 60 * 60 * 1e3;
      case "1d":
        return 24 * 60 * 60 * 1e3;
      default:
        return 5 * 60 * 1e3;
    }
  }
  getCached(cache, key) {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }
  setCached(cache, key, data) {
    cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs
    });
  }
};

// src/config/network.config.ts
var import_ethers2 = require("ethers");
var baseMainnet = {
  chainId: 8453,
  rpcUrl: process.env.QUICKNODE_BASE_URL || "",
  aerodromeFactory: process.env.AERODROME_FACTORY_ADDRESS || "",
  aerodromeRouter: process.env.AERODROME_ROUTER_ADDRESS || "",
  acesToken: process.env.ACES_TOKEN_ADDRESS || "0x55337650856299363c496065C836B9C6E9dE0367"
};
var baseSepolia = {
  chainId: 84532,
  rpcUrl: process.env.QUICKNODE_BASE_SEPOLIA_RPC || "",
  aerodromeFactory: process.env.AERODROME_FACTORY_ADDRESS_BASE_SEPOLIA || "",
  aerodromeRouter: process.env.AERODROME_ROUTER_ADDRESS_BASE_SEPOLIA || "",
  acesToken: process.env.ACES_TOKEN_ADDRESS_BASE_SEPOLIA || "0xF6b0c828ee8098120AFa90CEb11f80e6Fd4e2F1e"
};
var NETWORKS = {
  8453: baseMainnet,
  84532: baseSepolia
};
function getNetworkConfig(chainId) {
  return NETWORKS[chainId];
}
__name(getNetworkConfig, "getNetworkConfig");
function createProvider(chainId) {
  const config2 = getNetworkConfig(chainId);
  if (!config2.rpcUrl) {
    return null;
  }
  return new import_ethers2.ethers.JsonRpcProvider(config2.rpcUrl);
}
__name(createProvider, "createProvider");

// src/services/listing-service.ts
var ListingService = class {
  constructor(prisma2, notificationService) {
    this.prisma = prisma2;
    this.notificationService = notificationService || new NotificationService(prisma2);
    const mainnetConfig = getNetworkConfig(8453);
    const provider = createProvider(8453);
    const shouldMock = process.env.USE_DEX_MOCKS === "true" || !mainnetConfig.rpcUrl || !mainnetConfig.aerodromeFactory || !mainnetConfig.aerodromeRouter;
    try {
      this.aerodromeDataService = new AerodromeDataService({
        provider: provider ?? void 0,
        rpcUrl: provider ? void 0 : mainnetConfig.rpcUrl,
        factoryAddress: mainnetConfig.aerodromeFactory,
        acesTokenAddress: mainnetConfig.acesToken,
        apiBaseUrl: process.env.AERODROME_API_BASE_URL,
        apiKey: process.env.AERODROME_API_KEY,
        defaultStable: process.env.AERODROME_DEFAULT_STABLE === "true",
        mockEnabled: shouldMock
      });
    } catch (error) {
      console.error("[ListingService] Failed to initialize AerodromeDataService:", error);
      this.aerodromeDataService = void 0;
    }
  }
  static {
    __name(this, "ListingService");
  }
  notificationService;
  aerodromeDataService;
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
      try {
        const template = NotificationTemplates["LISTING_APPROVED" /* LISTING_APPROVED */];
        await this.notificationService.createNotification({
          userId: submission.ownerId,
          listingId: listing.id,
          type: "LISTING_APPROVED" /* LISTING_APPROVED */,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl(listing.id)
        });
      } catch (notificationError) {
        console.error("Error creating listing approved notification:", notificationError);
      }
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
          },
          _count: {
            select: {
              comments: true
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
      const enriched = await Promise.all(
        data.map((listing) => this.prepareListingForResponse(listing, true))
      );
      return { data: enriched, nextCursor, hasMore };
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
      const enriched = await Promise.all(
        data.map((listing) => this.prepareListingForResponse(listing))
      );
      return { data: enriched, nextCursor, hasMore };
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
      const enriched = await Promise.all(
        data.map((listing) => this.prepareListingForResponse(listing))
      );
      return { data: enriched, nextCursor, hasMore };
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
          approvedByUser: true,
          _count: {
            select: {
              comments: true
            }
          }
        }
      });
      if (!listing) {
        return null;
      }
      return this.prepareListingForResponse(listing, true);
    } catch (error) {
      console.error("Error fetching listing by ID:", error);
      throw error;
    }
  }
  /**
   * Get listing by symbol (case-insensitive)
   */
  async getListingBySymbol(symbol) {
    try {
      const listing = await this.prisma.listing.findFirst({
        where: {
          symbol: {
            equals: symbol,
            mode: "insensitive"
          }
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
          token: true,
          _count: {
            select: {
              comments: true
            }
          }
        }
      });
      if (!listing) {
        return null;
      }
      return this.prepareListingForResponse(listing, true);
    } catch (error) {
      console.error("Error fetching listing by symbol:", error);
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
      const enriched = await Promise.all(
        data.map((listing) => this.prepareListingForResponse(listing))
      );
      return { data: enriched, nextCursor, hasMore };
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
      const enriched = await Promise.all(
        listings.map((listing) => this.prepareListingForResponse(listing))
      );
      return enriched;
    } catch (error) {
      console.error("Error fetching all listings for admin:", error);
      throw error;
    }
  }
  async prepareListingForResponse(listing, includeDex = false) {
    const commentCount = listing?._count?.comments ?? listing?.commentCount ?? null;
    const safeListing = {
      ...listing,
      commentCount,
      imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery)
    };
    if ("_count" in safeListing) {
      delete safeListing._count;
    }
    if (!includeDex) {
      return safeListing;
    }
    return this.attachDexState(safeListing);
  }
  async attachDexState(listing) {
    const token = listing.token ? { ...listing.token } : void 0;
    let poolState = null;
    if (token?.contractAddress && this.aerodromeDataService) {
      try {
        poolState = await this.aerodromeDataService.getPoolState(token.contractAddress);
      } catch (error) {
        console.warn(
          `[ListingService] Failed to fetch pool state for ${token.contractAddress}:`,
          error
        );
      }
    }
    const initialPoolAddress = token?.poolAddress ?? null;
    const hasStoredDexPhase = (token?.phase ?? "BONDING_CURVE") === "DEX_TRADING";
    const resolvedPoolAddress = poolState?.poolAddress ?? initialPoolAddress ?? null;
    const isDexLive = !!poolState || hasStoredDexPhase || !!resolvedPoolAddress;
    const lastUpdated = poolState ? new Date(poolState.lastUpdated).toISOString() : null;
    const dexLiveAt = poolState ? lastUpdated : token?.dexLiveAt ?? null;
    const priceSource = isDexLive ? "DEX" : "BONDING_CURVE";
    if (token) {
      token.phase = isDexLive ? "DEX_TRADING" : token.phase ?? "BONDING_CURVE";
      token.priceSource = priceSource;
      token.poolAddress = resolvedPoolAddress;
      token.dexLiveAt = dexLiveAt;
    }
    const dexMeta = {
      isDexLive,
      poolAddress: resolvedPoolAddress,
      dexLiveAt,
      priceSource,
      lastUpdated,
      bondingCutoff: dexLiveAt
    };
    return {
      ...listing,
      token,
      dex: dexMeta
    };
  }
};

// src/services/token-holder-service.ts
var import_ethers3 = require("ethers");
var BASE_SEPOLIA_CHAIN_ID = 84532;
var BASE_MAINNET_CHAIN_ID = 8453;
var DEFAULT_CHAIN_PRIORITY = [BASE_SEPOLIA_CHAIN_ID, BASE_MAINNET_CHAIN_ID];
var CACHE_TTL_MS = 5 * 60 * 1e3;
var ZERO_ADDRESS = import_ethers3.ethers.ZeroAddress;
var LAUNCHPAD_TOKEN_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
var ACES_FACTORY_EVENT_ABI = [
  "event CreatedToken(address tokenAddress, uint8 curve, uint256 steepness, uint256 floor)"
];
function normalizeAddress(value) {
  if (!value) {
    return void 0;
  }
  try {
    return import_ethers3.ethers.getAddress(value);
  } catch (error) {
    return void 0;
  }
}
__name(normalizeAddress, "normalizeAddress");
function uniqueTruthy(values) {
  return Array.from(
    new Set(values.filter((value) => Boolean(value && value.trim())))
  );
}
__name(uniqueTruthy, "uniqueTruthy");
function resolveChainConfig(chainId) {
  switch (chainId) {
    case BASE_SEPOLIA_CHAIN_ID: {
      const rpcUrls = uniqueTruthy([
        process.env.QUICKNODE_BASE_SEPOLIA_RPC,
        process.env.BASE_SEPOLIA_RPC_URL,
        process.env.BASE_SEPOLIA_RPC,
        process.env.BASE_SEPOLIA_PROVIDER_URL,
        process.env.QUICKNODE_BASE_RPC,
        "https://sepolia.base.org",
        "https://base-sepolia-rpc.publicnode.com",
        "https://base-sepolia.blockpi.network/v1/rpc/public",
        "https://base-sepolia.gateway.tenderly.co"
      ]);
      const factoryAddress = normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_BASE_SEPOLIA) || normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_TESTNET) || normalizeAddress(process.env.FACTORY_PROXY_ADDRESS) || // Fallback to known default testnet deployment
      normalizeAddress("0x7e224ae4e6235bF18BBcb79cc2B5d04a7a6F8d1D");
      return { chainId, factoryAddress, rpcUrls };
    }
    case BASE_MAINNET_CHAIN_ID: {
      const rpcUrls = uniqueTruthy([
        process.env.QUICKNODE_BASE_URL,
        process.env.BASE_MAINNET_RPC_URL,
        process.env.BASE_MAINNET_RPC,
        process.env.QUICKNODE_BASE_RPC,
        "https://mainnet.base.org",
        "https://base-rpc.publicnode.com",
        "https://base.blockpi.network/v1/rpc/public",
        "https://base.gateway.tenderly.co"
      ]);
      const factoryAddress = normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_BASE_MAINNET) || normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_MAINNET) || normalizeAddress(process.env.FACTORY_PROXY_ADDRESS);
      return { chainId, factoryAddress, rpcUrls };
    }
    default:
      return void 0;
  }
}
__name(resolveChainConfig, "resolveChainConfig");
function normalizeBigInt(value) {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (value.trim().startsWith("0x")) {
      return BigInt(value);
    }
    return BigInt(value.trim());
  }
  if (value && typeof value === "object" && "toString" in value) {
    return BigInt(value.toString());
  }
  throw new Error(`Unable to convert value to bigint: ${value}`);
}
__name(normalizeBigInt, "normalizeBigInt");
function updateBalanceMap(balances, address, delta, isAddition) {
  const key = address.toLowerCase();
  const current = balances.get(key) ?? 0n;
  if (isAddition) {
    const next2 = current + delta;
    if (next2 === 0n) {
      balances.delete(key);
    } else {
      balances.set(key, next2);
    }
    return;
  }
  const next = current - delta;
  if (next <= 0n) {
    balances.delete(key);
  } else {
    balances.set(key, next);
  }
}
__name(updateBalanceMap, "updateBalanceMap");
function shouldChunkQuery(error) {
  const message = typeof error === "object" && error && "message" in error ? String(error.message).toLowerCase() : "";
  const code = typeof error === "object" && error && "code" in error ? error.code : void 0;
  if (code === -32011) {
    return true;
  }
  return message.includes("query returned more than") || message.includes("response size exceeded") || message.includes("log result size exceeded") || message.includes("block range too wide") || message.includes("no backend is currently healthy") || message.includes("limit");
}
__name(shouldChunkQuery, "shouldChunkQuery");
var TokenHolderService = class {
  constructor(cacheTtlMs = CACHE_TTL_MS) {
    this.cacheTtlMs = cacheTtlMs;
  }
  static {
    __name(this, "TokenHolderService");
  }
  cache = /* @__PURE__ */ new Map();
  async getHolderCount(tokenAddress, chainId) {
    if (!tokenAddress) {
      throw new Error("Token address is required");
    }
    let normalizedAddress;
    try {
      normalizedAddress = import_ethers3.ethers.getAddress(tokenAddress);
    } catch (error) {
      throw new Error("Invalid token address");
    }
    const cacheKey = this.buildCacheKey(normalizedAddress, chainId);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.count;
    }
    const candidateChainIds = this.getCandidateChainIds(chainId);
    let lastError;
    for (const candidateChainId of candidateChainIds) {
      const chainConfig = resolveChainConfig(candidateChainId);
      if (!chainConfig || chainConfig.rpcUrls.length === 0) {
        continue;
      }
      for (const rpcUrl of chainConfig.rpcUrls) {
        try {
          const result = await this.fetchHolderCountFromRpc(normalizedAddress, chainConfig, rpcUrl);
          this.cache.set(cacheKey, { count: result, expiresAt: Date.now() + this.cacheTtlMs });
          return result;
        } catch (error) {
          lastError = error;
        }
      }
    }
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error("Failed to resolve holder count");
  }
  buildCacheKey(tokenAddress, chainId) {
    return `${tokenAddress.toLowerCase()}::${chainId ?? "auto"}`;
  }
  getCandidateChainIds(chainId) {
    if (chainId) {
      return [chainId];
    }
    return DEFAULT_CHAIN_PRIORITY;
  }
  async fetchHolderCountFromRpc(tokenAddress, chainConfig, rpcUrl) {
    const provider = new import_ethers3.ethers.JsonRpcProvider(rpcUrl, chainConfig.chainId);
    const tokenContract = new import_ethers3.ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);
    let startBlock = 0;
    if (chainConfig.factoryAddress) {
      const factoryContract = new import_ethers3.ethers.Contract(
        chainConfig.factoryAddress,
        ACES_FACTORY_EVENT_ABI,
        provider
      );
      const creationBlock = await this.resolveCreationBlock(factoryContract, tokenAddress);
      if (creationBlock) {
        startBlock = creationBlock;
      }
    }
    const latestBlock = await provider.getBlockNumber();
    const events = await this.collectTransferEvents(tokenContract, startBlock, latestBlock);
    const balances = /* @__PURE__ */ new Map();
    for (const event of events) {
      const eventArgs = event.args;
      if (!eventArgs) {
        continue;
      }
      const from = typeof eventArgs.from === "string" ? eventArgs.from : eventArgs[0];
      const to = typeof eventArgs.to === "string" ? eventArgs.to : eventArgs[1];
      const valueRaw = eventArgs.value ?? eventArgs[2];
      if (!from || !to || valueRaw == null) {
        continue;
      }
      let value;
      try {
        value = normalizeBigInt(valueRaw);
      } catch (error) {
        continue;
      }
      if (from !== ZERO_ADDRESS) {
        updateBalanceMap(balances, from, value, false);
      }
      if (to !== ZERO_ADDRESS) {
        updateBalanceMap(balances, to, value, true);
      }
    }
    let holderCount = 0;
    for (const balance of balances.values()) {
      if (balance > 0n) {
        holderCount += 1;
      }
    }
    return holderCount;
  }
  async resolveCreationBlock(factoryContract, tokenAddress) {
    try {
      const normalizedTarget = tokenAddress.toLowerCase();
      const events = await factoryContract.queryFilter(
        factoryContract.filters.CreatedToken(),
        0,
        "latest"
      );
      for (const rawEvent of events) {
        let args;
        if ("args" in rawEvent) {
          args = rawEvent.args;
        } else {
          try {
            const parsed = factoryContract.interface.parseLog(rawEvent);
            args = parsed?.args;
          } catch (parseError) {
            continue;
          }
        }
        if (!args) {
          continue;
        }
        const createdAddress = args.tokenAddress ?? args[0];
        if (!createdAddress || typeof createdAddress !== "string") {
          continue;
        }
        if (createdAddress.toLowerCase() === normalizedTarget) {
          return rawEvent.blockNumber ?? null;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  async collectTransferEvents(tokenContract, fromBlock, toBlock) {
    const transferFilter = tokenContract.filters.Transfer();
    try {
      const events = await tokenContract.queryFilter(transferFilter, fromBlock, toBlock);
      return events.map((event) => this.normalizeEvent(tokenContract, event));
    } catch (error) {
      if (!shouldChunkQuery(error)) {
        throw error instanceof Error ? error : new Error("Failed to fetch transfer events");
      }
      const chunkSize = 5e4;
      const events = [];
      let currentFrom = fromBlock;
      while (currentFrom <= toBlock) {
        const currentTo = Math.min(currentFrom + chunkSize, toBlock);
        const chunk = await tokenContract.queryFilter(transferFilter, currentFrom, currentTo);
        events.push(...chunk.map((log) => this.normalizeEvent(tokenContract, log)));
        currentFrom = currentTo + 1;
      }
      return events;
    }
  }
  normalizeEvent(tokenContract, event) {
    if ("args" in event) {
      return { args: event.args };
    }
    const parsed = tokenContract.interface.parseLog(event);
    if (!parsed) {
      return { args: [] };
    }
    return { args: parsed.args };
  }
};

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
  const tokenHolderService = new TokenHolderService();
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
    "/symbol/:symbol",
    {
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            symbol: import_zod.z.string().min(1).max(50)
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { symbol } = request.params;
        const listing = await listingService.getListingBySymbol(symbol);
        if (!listing) {
          throw errors.notFound("Listing not found");
        }
        const commentCount = typeof listing.commentCount === "number" ? listing.commentCount : void 0;
        let holderCount = null;
        const tokenAddress = listing.token?.contractAddress;
        if (tokenAddress) {
          try {
            holderCount = await tokenHolderService.getHolderCount(
              tokenAddress,
              listing.token?.chainId ?? void 0
            );
          } catch (error) {
            fastify.log.warn(
              { error, tokenAddress },
              "[Listings] Failed to compute holder count for listing symbol route"
            );
          }
        }
        const responseListing = {
          ...listing,
          commentCount: commentCount ?? 0,
          token: listing.token ? {
            ...listing.token,
            holderCount: holderCount ?? listing.token.holderCount ?? null,
            holdersCount: holderCount ?? listing.token.holdersCount ?? null
          } : void 0
        };
        return reply.send({
          success: true,
          data: responseListing
        });
      } catch (error) {
        console.error("Error getting listing by symbol:", error);
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
        "https://aces-monorepo-git-dev-dan-aces-fun.vercel.app",
        "https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app"
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
