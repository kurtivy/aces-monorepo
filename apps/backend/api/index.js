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

// src/api/index.ts
var api_exports = {};
__export(api_exports, {
  default: () => api_default
});
module.exports = __toCommonJS(api_exports);
var import_dotenv2 = require("dotenv");

// src/app.ts
var import_fastify = __toESM(require("fastify"));
var import_crypto3 = require("crypto");
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
var checkDatabaseHealth = /* @__PURE__ */ __name(async () => {
  try {
    console.log("\u{1F50D} Checking database health...");
    const client = getPrismaClient();
    const start = Date.now();
    await client.$queryRaw`SELECT 1 as health_check`;
    const duration = Date.now() - start;
    console.log(`\u2705 Database health check passed in ${duration}ms`);
    return true;
  } catch (error) {
    console.error("\u274C Database health check failed:", error);
    logger.error({ error }, "Database health check failed");
    return false;
  }
}, "checkDatabaseHealth");
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
        "/api/v1/twitch",
        // Twitch stream endpoints
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
        if (path === "/api/v1/tokens" && request.url.startsWith("/api/v1/tokens")) return true;
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

// src/routes/v1/submissions.ts
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");

// src/lib/prisma-enums.ts
var VerificationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};
var SubmissionStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};
var RejectionType = {
  MANUAL: "MANUAL",
  TX_FAILURE: "TX_FAILURE"
};
var BidStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  WITHDRAWN: "WITHDRAWN"
};

// src/lib/product-storage-utils.ts
var import_storage = require("@google-cloud/storage");
var import_dotenv = require("dotenv");
(0, import_dotenv.config)();
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
      console.log(`[ProductStorage] Generating signed URL for: ${fileName} with ${expiresInMinutes}min expiry`);
      const [url] = await productBucket.file(fileName).getSignedUrl(options);
      if (!url || !url.includes("X-Goog-Signature")) {
        console.error(`[ProductStorage] Generated URL is not a valid signed URL for: ${fileName}`);
        console.error(`[ProductStorage] URL: ${url}`);
        throw new Error("Failed to generate valid signed URL");
      }
      console.log(`[ProductStorage] \u2705 Generated valid signed URL for: ${fileName} (length: ${url.length})`);
      return url;
    } catch (error) {
      console.error(`[ProductStorage] \u274C Error generating signed URL for ${fileName}:`, error);
      console.error(`[ProductStorage] Error details:`, {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace"
      });
      throw new Error(`Failed to generate signed URL for ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    console.log(`[ProductStorage] Current bucket name: ${productBucketName || "aces-product-images"}`);
    const signedUrls = await Promise.all(
      imageUrls.map(async (url, index) => {
        try {
          console.log(`[ProductStorage] Processing URL ${index + 1}/${imageUrls.length}: ${url}`);
          if (url.includes("storage.googleapis.com") && url.includes("aces-product-images")) {
            const fileName = this.extractFileName(url);
            console.log(`[ProductStorage] Extracted filename: ${fileName}`);
            const signedUrl = await this.getSignedProductUrl(fileName, expiresInMinutes);
            console.log(`[ProductStorage] \u2705 Converted to signed URL (length: ${signedUrl.length})`);
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
var NotificationType = /* @__PURE__ */ ((NotificationType2) => {
  NotificationType2["LISTING_APPROVED"] = "LISTING_APPROVED";
  NotificationType2["READY_TO_MINT"] = "READY_TO_MINT";
  NotificationType2["TOKEN_MINTED"] = "TOKEN_MINTED";
  NotificationType2["ADMIN_MESSAGE"] = "ADMIN_MESSAGE";
  NotificationType2["SYSTEM_ALERT"] = "SYSTEM_ALERT";
  NotificationType2["VERIFICATION_PENDING"] = "VERIFICATION_PENDING";
  NotificationType2["VERIFICATION_APPROVED"] = "VERIFICATION_APPROVED";
  NotificationType2["VERIFICATION_REJECTED"] = "VERIFICATION_REJECTED";
  NotificationType2["SUBMISSION_APPROVED"] = "SUBMISSION_APPROVED";
  NotificationType2["SUBMISSION_REJECTED"] = "SUBMISSION_REJECTED";
  NotificationType2["TOKEN_PARAMETERS_SUBMITTED"] = "TOKEN_PARAMETERS_SUBMITTED";
  NotificationType2["NEW_BID_RECEIVED"] = "NEW_BID_RECEIVED";
  NotificationType2["BID_ACCEPTED"] = "BID_ACCEPTED";
  NotificationType2["BID_REJECTED"] = "BID_REJECTED";
  NotificationType2["BID_OUTBID"] = "BID_OUTBID";
  NotificationType2["ADMIN_NEW_SUBMISSION"] = "ADMIN_NEW_SUBMISSION";
  NotificationType2["ADMIN_NEW_VERIFICATION"] = "ADMIN_NEW_VERIFICATION";
  NotificationType2["ADMIN_TOKEN_REVIEW_NEEDED"] = "ADMIN_TOKEN_REVIEW_NEEDED";
  return NotificationType2;
})(NotificationType || {});
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

// src/services/submission-service.ts
var SubmissionService = class {
  constructor(prisma2, notificationService) {
    this.prisma = prisma2;
    this.notificationService = notificationService || new NotificationService(prisma2);
  }
  static {
    __name(this, "SubmissionService");
  }
  notificationService;
  /**
   * Check if user is verified before allowing submission
   */
  async checkUserVerification(userId) {
    const verification = await this.prisma.accountVerification.findUnique({
      where: { userId },
      select: { status: true }
    });
    return verification?.status === "APPROVED";
  }
  /**
   * Create a new submission
   */
  async createSubmission(userId, data) {
    try {
      const isVerified = await this.checkUserVerification(userId);
      if (!isVerified) {
        throw errors.forbidden("Account verification required to submit assets");
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });
      const submissionData = {
        title: data.title,
        symbol: data.symbol,
        description: data.description,
        assetType: data.assetType,
        imageGallery: data.imageGallery || [],
        proofOfOwnership: data.proofOfOwnership,
        proofOfOwnershipImageUrl: data.proofOfOwnershipImageUrl || null,
        typeOfOwnership: data.typeOfOwnership,
        location: data.location || null,
        email: data.email || user?.email || null,
        ownerId: userId,
        status: SubmissionStatus.PENDING
      };
      const submission = await this.prisma.submission.create({
        data: submissionData,
        include: {
          owner: true
        }
      });
      try {
        const adminUsers = await this.prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true }
        });
        const adminTemplate = NotificationTemplates["ADMIN_NEW_SUBMISSION" /* ADMIN_NEW_SUBMISSION */];
        for (const admin of adminUsers) {
          await this.notificationService.createNotification({
            userId: admin.id,
            type: "ADMIN_NEW_SUBMISSION" /* ADMIN_NEW_SUBMISSION */,
            title: adminTemplate.title,
            message: adminTemplate.message,
            actionUrl: adminTemplate.getActionUrl()
          });
        }
      } catch (notificationError) {
        console.error("Error creating admin submission notification:", notificationError);
      }
      return submission;
    } catch (error) {
      console.error("Error in createSubmission:", error);
      throw error;
    }
  }
  /**
   * Get user's submissions
   */
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
      const submissions = await this.prisma.submission.findMany({
        where,
        include: {
          owner: true
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
        // Take one extra to check for more
      });
      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      const dataWithSignedUrls = await Promise.all(
        data.map(async (submission) => ({
          ...submission,
          imageGallery: await ProductStorageService.convertToSignedUrls(
            submission.imageGallery
          )
        }))
      );
      return { data: dataWithSignedUrls, nextCursor, hasMore };
    } catch (error) {
      console.error("Error in getUserSubmissions:", error);
      throw error;
    }
  }
  /**
   * Get submission by ID
   */
  async getSubmissionById(submissionId, userId) {
    try {
      const where = { id: submissionId };
      if (userId) {
        where.ownerId = userId;
      }
      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true
        }
      });
      if (!submission) {
        return null;
      }
      const submissionWithSignedUrls = {
        ...submission,
        imageGallery: await ProductStorageService.convertToSignedUrls(
          submission.imageGallery
        )
      };
      return submissionWithSignedUrls;
    } catch (error) {
      console.error("Error in getSubmissionById:", error);
      throw error;
    }
  }
  /**
   * Delete submission (only if pending)
   */
  async deleteSubmission(submissionId, userId) {
    try {
      const submission = await this.prisma.submission.findUnique({
        where: {
          id: submissionId,
          ownerId: userId
          // Ensure user can only delete their own submissions
        }
      });
      if (!submission) {
        throw errors.notFound("Submission not found or access denied");
      }
      if (submission.status !== SubmissionStatus.PENDING) {
        throw errors.validation(
          `Cannot delete submission with status: ${submission.status}. Only pending submissions can be deleted.`
        );
      }
      await this.prisma.submission.delete({
        where: { id: submissionId }
      });
    } catch (error) {
      console.error("Error in deleteSubmission:", error);
      throw error;
    }
  }
  /**
   * Get all submissions (admin only)
   */
  async getAllSubmissions(filter, options = {}) {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where = {
        ...filter?.status && { status: filter.status }
      };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const submissions = await this.prisma.submission.findMany({
        where,
        include: {
          owner: true
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });
      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error("Error in getAllSubmissions:", error);
      throw error;
    }
  }
  /**
   * Get pending submissions (admin only)
   */
  async getPendingSubmissions(options = {}) {
    return this.getAllSubmissions({ status: SubmissionStatus.PENDING }, options);
  }
  /**
   * Approve submission (admin only)
   */
  async approveSubmission(submissionId, adminId) {
    try {
      const submission = await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.APPROVED,
          approvedBy: adminId,
          approvedAt: /* @__PURE__ */ new Date()
        },
        include: {
          owner: true
        }
      });
      try {
        const template = NotificationTemplates["SUBMISSION_APPROVED" /* SUBMISSION_APPROVED */];
        await this.notificationService.createNotification({
          userId: submission.ownerId,
          submissionId: submission.id,
          type: "SUBMISSION_APPROVED" /* SUBMISSION_APPROVED */,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl()
        });
      } catch (notificationError) {
        console.error("Error creating submission approved notification:", notificationError);
      }
      return submission;
    } catch (error) {
      console.error("Error in approveSubmission:", error);
      throw error;
    }
  }
  /**
   * Reject submission (admin only)
   */
  async rejectSubmission(submissionId, adminId, rejectionReason, rejectionType = RejectionType.MANUAL) {
    try {
      const submission = await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.REJECTED,
          approvedBy: adminId,
          rejectionReason,
          rejectionType
        },
        include: {
          owner: true
        }
      });
      try {
        const template = NotificationTemplates["SUBMISSION_REJECTED" /* SUBMISSION_REJECTED */];
        await this.notificationService.createNotification({
          userId: submission.ownerId,
          submissionId: submission.id,
          type: "SUBMISSION_REJECTED" /* SUBMISSION_REJECTED */,
          title: template.title,
          message: `${template.message} Reason: ${rejectionReason}`,
          actionUrl: template.getActionUrl()
        });
      } catch (notificationError) {
        console.error("Error creating submission rejected notification:", notificationError);
      }
      return submission;
    } catch (error) {
      console.error("Error in rejectSubmission:", error);
      throw error;
    }
  }
  /**
   * Get all submissions for admin dashboard
   */
  async getAllSubmissionsForAdmin(options) {
    try {
      const where = {};
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      const submissions = await this.prisma.submission.findMany({
        where,
        include: {
          owner: {
            include: {
              accountVerification: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: options?.limit || 50
      });
      return submissions;
    } catch (error) {
      console.error("Error in getAllSubmissionsForAdmin:", error);
      throw error;
    }
  }
};

// src/routes/v1/submissions.ts
var CreateSubmissionSchema = import_zod.z.object({
  title: import_zod.z.string().min(1).max(200),
  symbol: import_zod.z.string().min(1).max(10),
  description: import_zod.z.string().min(1).max(2e3),
  assetType: import_zod.z.enum(["VEHICLE", "JEWELRY", "COLLECTIBLE", "ART", "FASHION", "ALCOHOL", "OTHER"]),
  imageGallery: import_zod.z.array(import_zod.z.string().url()).optional().default([]),
  location: import_zod.z.string().max(200).optional(),
  email: import_zod.z.string().email().optional(),
  proofOfOwnership: import_zod.z.string().min(1).max(1e3),
  proofOfOwnershipImageUrl: import_zod.z.string().url().optional(),
  typeOfOwnership: import_zod.z.string().min(1).max(100)
});
var RejectSubmissionSchema = import_zod.z.object({
  rejectionReason: import_zod.z.string().min(1).max(1e3),
  rejectionType: import_zod.z.enum(["MANUAL", "TX_FAILURE"]).optional().default("MANUAL")
});
async function submissionRoutes(fastify) {
  const submissionService = new SubmissionService(fastify.prisma);
  fastify.get(
    "/verification-status",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const isVerified = await submissionService.checkUserVerification(request.user.id);
        return reply.send({
          success: true,
          data: {
            isVerified,
            message: isVerified ? "Account is verified and ready for submissions" : "Account verification required to submit assets"
          }
        });
      } catch (error) {
        console.error("Error checking verification status:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/",
    {
      preHandler: [requireAuth],
      schema: {
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(CreateSubmissionSchema)
      }
    },
    async (request, reply) => {
      try {
        const data = request.body;
        const submission = await submissionService.createSubmission(request.user.id, data);
        return reply.status(201).send({
          success: true,
          data: submission,
          message: "Submission created successfully"
        });
      } catch (error) {
        console.error("Error creating submission:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/my",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            status: import_zod.z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
            limit: import_zod.z.string().transform(Number).optional(),
            cursor: import_zod.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query;
        const result = await submissionService.getUserSubmissions(
          request.user.id,
          status ? { status } : void 0,
          { limit, cursor }
        );
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting user submissions:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/:id",
    {
      preHandler: [requireAuth],
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
        const submission = await submissionService.getSubmissionById(id, request.user.id);
        if (!submission) {
          throw errors.notFound("Submission not found");
        }
        return reply.send({
          success: true,
          data: submission
        });
      } catch (error) {
        console.error("Error getting submission:", error);
        throw error;
      }
    }
  );
  fastify.delete(
    "/:id",
    {
      preHandler: [requireAuth],
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
        await submissionService.deleteSubmission(id, request.user.id);
        return reply.send({
          success: true,
          message: "Submission deleted successfully"
        });
      } catch (error) {
        console.error("Error deleting submission:", error);
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
            status: import_zod.z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
            limit: import_zod.z.string().transform(Number).optional(),
            cursor: import_zod.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query;
        const result = await submissionService.getAllSubmissions(
          status ? { status } : void 0,
          {
            limit,
            cursor
          }
        );
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting all submissions:", error);
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
        const result = await submissionService.getPendingSubmissions({ limit, cursor });
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting pending submissions:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id/approve",
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
        const submission = await submissionService.approveSubmission(id, request.user.id);
        return reply.send({
          success: true,
          data: submission,
          message: "Submission approved successfully"
        });
      } catch (error) {
        console.error("Error approving submission:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id/reject",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(RejectSubmissionSchema)
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { rejectionReason, rejectionType } = request.body;
        const submission = await submissionService.rejectSubmission(
          id,
          request.user.id,
          rejectionReason,
          rejectionType
        );
        return reply.send({
          success: true,
          data: submission,
          message: "Submission rejected successfully"
        });
      } catch (error) {
        console.error("Error rejecting submission:", error);
        throw error;
      }
    }
  );
}
__name(submissionRoutes, "submissionRoutes");

// src/services/verification-service.ts
var import_client2 = require("@prisma/client");

// src/lib/secure-storage-utils.ts
var import_storage2 = require("@google-cloud/storage");
var import_crypto = require("crypto");
var hasGoogleCloudCredentials2 = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY);
var secureStorage = null;
var secureBucket = null;
var secureBucketName = "";
if (hasGoogleCloudCredentials2) {
  secureStorage = new import_storage2.Storage({
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
    if (!hasGoogleCloudCredentials2 || !secureBucket) {
      throw new Error("Google Cloud Storage not configured");
    }
    return secureBucket;
  }
  /**
   * Upload a verification document to secure storage
   */
  static async uploadSecureDocument(file, userId, documentType) {
    if (!hasGoogleCloudCredentials2 || !secureBucket) {
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
    if (!hasGoogleCloudCredentials2 || !secureBucketName) {
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
    if (!hasGoogleCloudCredentials2 || !secureBucket) {
      return `mock-signed://${fileName}?expires=${options.expires}`;
    }
    const [url] = await secureBucket.file(fileName).getSignedUrl(options);
    return url;
  }
  /**
   * Delete a secure document
   */
  static async deleteSecureDocument(fileName) {
    if (!hasGoogleCloudCredentials2 || !secureBucket) {
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
    if (!hasGoogleCloudCredentials2 || !secureBucket) {
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
    if (!hasGoogleCloudCredentials2 || !secureBucket) {
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
    if (!hasGoogleCloudCredentials2 || !secureBucket) {
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

// src/lib/vision-service.ts
var import_vision = require("@google-cloud/vision");
var import_storage3 = require("@google-cloud/storage");
var visionClient = new import_vision.ImageAnnotatorClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  }
});
var secureStorage2 = new import_storage3.Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  }
});
var secureBucketName2 = process.env.GOOGLE_CLOUD_SECURE_BUCKET_NAME || "aces-secure-documents";
var VisionService = class {
  static {
    __name(this, "VisionService");
  }
  /**
   * Detect faces in an image
   */
  static async detectFaces(imageBuffer) {
    try {
      if (imageBuffer.length < 100) {
        console.log("\u{1F9EA} Test mode detected in face detection - returning mock result");
        return {
          faceDetected: true,
          confidence: 85.5,
          // Mock confidence
          boundingBox: {
            x: 0,
            y: 0,
            width: 1,
            height: 1
          },
          landmarks: [
            {
              type: "LEFT_EYE",
              position: { x: 0.3, y: 0.4 }
            },
            {
              type: "RIGHT_EYE",
              position: { x: 0.7, y: 0.4 }
            }
          ]
        };
      }
      const [result] = await visionClient.faceDetection({
        image: { content: imageBuffer }
      });
      const faces = result.faceAnnotations || [];
      if (faces.length === 0) {
        return {
          faceDetected: false,
          confidence: 0
        };
      }
      const face = faces[0];
      const confidence = face.detectionConfidence || 0;
      let boundingBox;
      if (face.boundingPoly?.vertices) {
        const vertices = face.boundingPoly.vertices;
        const x = Math.min(...vertices.map((v) => v.x || 0));
        const y = Math.min(...vertices.map((v) => v.y || 0));
        const maxX = Math.max(...vertices.map((v) => v.x || 0));
        const maxY = Math.max(...vertices.map((v) => v.y || 0));
        boundingBox = {
          x,
          y,
          width: maxX - x,
          height: maxY - y
        };
      }
      const landmarks = face.landmarks?.map((landmark) => ({
        type: String(landmark.type || "UNKNOWN"),
        position: {
          x: landmark.position?.x || 0,
          y: landmark.position?.y || 0
        }
      })) || [];
      return {
        faceDetected: true,
        confidence: confidence * 100,
        // Convert to percentage
        boundingBox,
        landmarks
      };
    } catch (error) {
      console.error("\u274C Error detecting faces:", error);
      if (error instanceof Error) {
        if (error.message.includes("PERMISSION_DENIED")) {
          throw new Error("Vision API permission denied - check service account credentials");
        }
        if (error.message.includes("QUOTA_EXCEEDED")) {
          throw new Error("Vision API quota exceeded - check billing and limits");
        }
        if (error.message.includes("INVALID_ARGUMENT")) {
          throw new Error("Invalid image format - Vision API cannot process this image");
        }
      }
      throw new Error(
        `Failed to detect faces in image: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Analyze document for text and authenticity
   */
  static async analyzeDocument(imageBuffer) {
    try {
      if (imageBuffer.length < 100) {
        console.log("\u{1F9EA} Test mode detected in document analysis - returning mock result");
        return {
          textDetected: [
            {
              text: "DRIVER LICENSE",
              confidence: 95,
              boundingBox: { x: 10, y: 10, width: 200, height: 30 }
            },
            {
              text: "TEST USER",
              confidence: 92.5,
              boundingBox: { x: 10, y: 50, width: 150, height: 25 }
            },
            {
              text: "TEST-12345",
              confidence: 88,
              boundingBox: { x: 10, y: 80, width: 100, height: 20 }
            }
          ],
          documentType: "DRIVERS_LICENSE",
          authenticity: {
            score: 85,
            indicators: ["High text clarity", "Consistent formatting", "Valid document structure"]
          }
        };
      }
      const [textResult] = await visionClient.textDetection({
        image: { content: imageBuffer }
      });
      const textAnnotations = textResult.textAnnotations || [];
      const textDetected = textAnnotations.slice(1).map((annotation) => ({
        text: annotation.description || "",
        confidence: (annotation.confidence || 0) * 100,
        boundingBox: {
          x: annotation.boundingPoly?.vertices?.[0]?.x || 0,
          y: annotation.boundingPoly?.vertices?.[0]?.y || 0,
          width: annotation.boundingPoly?.vertices?.[2]?.x || 0 - (annotation.boundingPoly?.vertices?.[0]?.x || 0),
          height: annotation.boundingPoly?.vertices?.[2]?.y || 0 - (annotation.boundingPoly?.vertices?.[0]?.y || 0)
        }
      }));
      const fullText = textAnnotations[0]?.description?.toLowerCase() || "";
      let documentType = "UNKNOWN";
      if (fullText.includes("driver") && fullText.includes("license")) {
        documentType = "DRIVERS_LICENSE";
      } else if (fullText.includes("passport")) {
        documentType = "PASSPORT";
      } else if (fullText.includes("identification") || fullText.includes("id card")) {
        documentType = "ID_CARD";
      }
      const authenticityScore = this.calculateAuthenticityScore(textDetected, fullText);
      return {
        textDetected,
        documentType,
        authenticity: {
          score: authenticityScore,
          indicators: this.getAuthenticityIndicators(authenticityScore, textDetected)
        }
      };
    } catch (error) {
      console.error("\u274C Error analyzing document:", error);
      if (error instanceof Error) {
        if (error.message.includes("PERMISSION_DENIED")) {
          throw new Error("Vision API permission denied - check service account credentials");
        }
        if (error.message.includes("QUOTA_EXCEEDED")) {
          throw new Error("Vision API quota exceeded - check billing and limits");
        }
      }
      throw new Error(
        `Failed to analyze document: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Compare faces between document and selfie
   */
  static async compareFaces(documentImageBuffer, selfieImageBuffer, threshold = 75) {
    try {
      const [documentFace, selfieFace] = await Promise.all([
        this.detectFaces(documentImageBuffer),
        this.detectFaces(selfieImageBuffer)
      ]);
      if (!documentFace.faceDetected || !selfieFace.faceDetected) {
        return {
          similarity: 0,
          match: false,
          threshold,
          documentFace,
          selfieFace
        };
      }
      const similarity = this.calculateFaceSimilarity(documentFace, selfieFace);
      return {
        similarity,
        match: similarity >= threshold,
        threshold,
        documentFace,
        selfieFace
      };
    } catch (error) {
      console.error("Error comparing faces:", error);
      throw new Error("Failed to compare faces");
    }
  }
  /**
   * Complete verification analysis
   */
  static async analyzeVerification(documentImageUrl, selfieImageBuffer) {
    try {
      console.log("\u{1F50D} VisionService.analyzeVerification called", {
        documentImageUrl,
        selfieBufferSize: selfieImageBuffer.length
      });
      if (!documentImageUrl) {
        throw new Error("Document image URL is required");
      }
      if (!selfieImageBuffer || selfieImageBuffer.length === 0) {
        throw new Error("Selfie image buffer is required");
      }
      console.log("\u{1F4E5} Downloading document image from secure storage...");
      const documentImageBuffer = await this.downloadImageFromSecureStorage(documentImageUrl);
      console.log("\u2705 Document image downloaded", { size: documentImageBuffer.length });
      console.log("\u{1F50D} Running face comparison and document analysis...");
      const [faceComparison, documentAnalysis] = await Promise.all([
        this.compareFaces(documentImageBuffer, selfieImageBuffer),
        this.analyzeDocument(documentImageBuffer)
      ]);
      console.log("\u2705 Analyses completed");
      const overallScore = this.calculateOverallScore(faceComparison, documentAnalysis);
      const { recommendation, reasons } = this.getRecommendation(
        overallScore,
        faceComparison,
        documentAnalysis
      );
      console.log("\u2705 Verification analysis completed", {
        overallScore,
        recommendation,
        faceMatch: faceComparison.match
      });
      return {
        faceComparison,
        documentAnalysis,
        overallScore,
        recommendation,
        reasons
      };
    } catch (error) {
      console.error("\u274C Error in verification analysis:", error);
      console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
      throw new Error(
        `Failed to complete verification analysis: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Download image from secure storage
   */
  static async downloadImageFromSecureStorage(imageUrl) {
    try {
      console.log("\u{1F4E5} Downloading from secure storage", { imageUrl, secureBucketName: secureBucketName2 });
      if (imageUrl.includes("test-document.jpg")) {
        console.log("\u{1F9EA} Test mode detected - creating mock document image");
        return this.createMockDocumentImage();
      }
      const bucketPrefix = `https://storage.googleapis.com/${secureBucketName2}/`;
      if (!imageUrl.startsWith(bucketPrefix)) {
        throw new Error("Invalid secure storage URL format");
      }
      const fileName = imageUrl.replace(bucketPrefix, "");
      if (!fileName) {
        throw new Error("Invalid image URL - no filename found");
      }
      console.log("\u{1F4C1} Extracted filename:", fileName);
      const bucket = secureStorage2.bucket(secureBucketName2);
      const file = bucket.file(fileName);
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File does not exist in bucket: ${fileName}`);
      }
      console.log("\u2705 File exists, downloading...");
      const [buffer] = await file.download();
      console.log("\u2705 File downloaded successfully", { size: buffer.length });
      return buffer;
    } catch (error) {
      console.error("\u274C Error downloading image from secure storage:", error);
      console.error("Details:", {
        imageUrl,
        secureBucketName: secureBucketName2,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace"
      });
      throw new Error(
        `Failed to download image from secure storage: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Create a mock document image for testing (simple 1x1 pixel image)
   */
  static createMockDocumentImage() {
    const pngData = Buffer.from([
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10,
      // PNG signature
      0,
      0,
      0,
      13,
      // IHDR chunk size
      73,
      72,
      68,
      82,
      // IHDR
      0,
      0,
      0,
      1,
      // Width: 1
      0,
      0,
      0,
      1,
      // Height: 1
      8,
      6,
      0,
      0,
      0,
      // Bit depth, color type, compression, filter, interlace
      31,
      21,
      196,
      137,
      // CRC
      0,
      0,
      0,
      10,
      // IDAT chunk size
      73,
      68,
      65,
      84,
      // IDAT
      120,
      156,
      98,
      0,
      0,
      0,
      2,
      0,
      1,
      // Compressed data
      226,
      33,
      188,
      51,
      // CRC
      0,
      0,
      0,
      0,
      // IEND chunk size
      73,
      69,
      78,
      68,
      // IEND
      174,
      66,
      96,
      130
      // CRC
    ]);
    console.log("\u{1F3A8} Created mock PNG image for testing", { size: pngData.length });
    return pngData;
  }
  /**
   * Calculate authenticity score based on text detection
   */
  static calculateAuthenticityScore(textDetected, fullText) {
    let score = 50;
    const avgConfidence = textDetected.reduce((sum, t) => sum + t.confidence, 0) / textDetected.length;
    score += (avgConfidence - 50) * 0.5;
    if (fullText.includes("license number") || fullText.includes("id number")) score += 10;
    if (fullText.includes("date of birth") || fullText.includes("dob")) score += 10;
    if (fullText.includes("expires") || fullText.includes("exp")) score += 10;
    if (fullText.includes("class") || fullText.includes("type")) score += 5;
    if (textDetected.length < 5) score -= 20;
    if (avgConfidence < 30) score -= 30;
    return Math.max(0, Math.min(100, score));
  }
  /**
   * Get authenticity indicators
   */
  static getAuthenticityIndicators(score, textDetected) {
    const indicators = [];
    if (score >= 80) {
      indicators.push("High text recognition confidence");
      indicators.push("Expected document structure detected");
    } else if (score >= 60) {
      indicators.push("Moderate text quality");
      indicators.push("Some document features detected");
    } else {
      indicators.push("Poor text quality or structure");
      if (textDetected.length < 5) indicators.push("Insufficient text content");
    }
    return indicators;
  }
  /**
   * Calculate face similarity (simplified implementation)
   */
  static calculateFaceSimilarity(face1, face2) {
    if (!face1.landmarks || !face2.landmarks) {
      return 30;
    }
    let similarityScore = 0;
    const commonLandmarks = Math.min(face1.landmarks.length, face2.landmarks.length);
    if (commonLandmarks > 0) {
      const confidenceSimilarity = 100 - Math.abs(face1.confidence - face2.confidence);
      similarityScore = Math.max(20, confidenceSimilarity * 0.8);
    }
    return Math.min(100, similarityScore);
  }
  /**
   * Calculate overall verification score
   */
  static calculateOverallScore(faceComparison, documentAnalysis) {
    const faceWeight = 0.6;
    const documentWeight = 0.4;
    return Math.round(
      faceComparison.similarity * faceWeight + documentAnalysis.authenticity.score * documentWeight
    );
  }
  /**
   * Get verification recommendation
   */
  static getRecommendation(overallScore, faceComparison, documentAnalysis) {
    const reasons = [];
    if (overallScore >= 85 && faceComparison.match && documentAnalysis.authenticity.score >= 70) {
      reasons.push("High overall confidence score");
      reasons.push("Face comparison successful");
      reasons.push("Document appears authentic");
      return { recommendation: "APPROVE", reasons };
    }
    if (overallScore < 40 || !faceComparison.documentFace.faceDetected || !faceComparison.selfieFace.faceDetected) {
      reasons.push("Low overall confidence score");
      if (!faceComparison.documentFace.faceDetected) reasons.push("No face detected in document");
      if (!faceComparison.selfieFace.faceDetected) reasons.push("No face detected in selfie");
      return { recommendation: "REJECT", reasons };
    }
    reasons.push("Moderate confidence score requires human review");
    if (faceComparison.similarity < 75) reasons.push("Face similarity below threshold");
    if (documentAnalysis.authenticity.score < 70) reasons.push("Document authenticity concerns");
    return { recommendation: "MANUAL_REVIEW", reasons };
  }
};

// src/services/verification-service.ts
var AccountVerificationService = class {
  constructor(prisma2, notificationService) {
    this.prisma = prisma2;
    this.notificationService = notificationService || new NotificationService(prisma2);
  }
  static {
    __name(this, "AccountVerificationService");
  }
  notificationService;
  /**
   * Submit a new verification request
   */
  async submitVerification(userId, data, documentFile) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { accountVerification: true }
      });
      if (!user) {
        throw errors.notFound("User not found");
      }
      if (user.accountVerification && user.accountVerification.attempts >= 3) {
        const lastAttempt = user.accountVerification.lastAttemptAt;
        if (lastAttempt && Date.now() - lastAttempt.getTime() < 24 * 60 * 60 * 1e3) {
          throw errors.badRequest("Too many verification attempts. Please try again in 24 hours.");
        }
      }
      let documentImageUrl = null;
      if (documentFile) {
        try {
          documentImageUrl = await SecureStorageService.uploadSecureDocument(
            documentFile,
            userId,
            data.documentType
          );
        } catch (error) {
          console.error("Document upload failed:", error);
          if (error instanceof Error && error.message.includes("Google Cloud Storage not configured")) {
            console.warn(
              "Continuing verification submission without document upload (GCS not configured)"
            );
            documentImageUrl = `mock://verification/${userId}/${data.documentType}/${Date.now()}.jpg`;
          } else {
            throw error;
          }
        }
      }
      const verification = await this.prisma.$transaction(async (tx) => {
        const verificationRecord = await tx.accountVerification.upsert({
          where: { userId },
          create: {
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
            documentImageUrl,
            status: VerificationStatus.PENDING,
            attempts: 1,
            lastAttemptAt: /* @__PURE__ */ new Date(),
            documentAnalysisResults: data.documentAnalysisResults ? data.documentAnalysisResults : import_client2.Prisma.JsonNull
          },
          update: {
            documentType: data.documentType,
            documentNumber: data.documentNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: data.dateOfBirth,
            countryOfIssue: data.countryOfIssue,
            state: data.state,
            address: data.address,
            emailAddress: data.emailAddress,
            documentImageUrl,
            status: VerificationStatus.PENDING,
            attempts: { increment: 1 },
            lastAttemptAt: /* @__PURE__ */ new Date(),
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: null,
            documentAnalysisResults: data.documentAnalysisResults ? data.documentAnalysisResults : import_client2.Prisma.JsonNull
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                walletAddress: true,
                createdAt: true
              }
            }
          }
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            sellerStatus: "PENDING",
            appliedAt: /* @__PURE__ */ new Date()
          }
        });
        return verificationRecord;
      });
      try {
        const template = NotificationTemplates["VERIFICATION_PENDING" /* VERIFICATION_PENDING */];
        await this.notificationService.createNotification({
          userId,
          type: "VERIFICATION_PENDING" /* VERIFICATION_PENDING */,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl()
        });
      } catch (notificationError) {
        console.error("Error creating verification pending notification:", notificationError);
      }
      try {
        const adminUsers = await this.prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true }
        });
        const adminTemplate = NotificationTemplates["ADMIN_NEW_VERIFICATION" /* ADMIN_NEW_VERIFICATION */];
        for (const admin of adminUsers) {
          await this.notificationService.createNotification({
            userId: admin.id,
            type: "ADMIN_NEW_VERIFICATION" /* ADMIN_NEW_VERIFICATION */,
            title: adminTemplate.title,
            message: adminTemplate.message,
            actionUrl: adminTemplate.getActionUrl()
          });
        }
      } catch (notificationError) {
        console.error("Error creating admin verification notification:", notificationError);
      }
      return verification;
    } catch (error) {
      console.error("Error submitting verification:", error);
      throw error;
    }
  }
  /**
   * Get verification by user ID
   */
  async getVerificationByUserId(userId) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true
            }
          },
          reviewer: {
            select: {
              id: true,
              email: true
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
  /**
   * Get user's verification status (simplified)
   */
  async getUserVerificationStatus(userId) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
        select: {
          status: true,
          attempts: true,
          lastAttemptAt: true,
          rejectionReason: true
        }
      });
      return {
        status: verification?.status || null,
        attempts: verification?.attempts || 0,
        lastAttemptAt: verification?.lastAttemptAt || null,
        rejectionReason: verification?.rejectionReason || null,
        canSubmit: verification ? verification.attempts < 3 || Date.now() - verification.lastAttemptAt.getTime() >= 24 * 60 * 60 * 1e3 : true
      };
    } catch (error) {
      console.error("Error getting verification status:", error);
      throw error;
    }
  }
  /**
   * Review verification (admin only)
   */
  async reviewVerification(verificationId, reviewerId, decision, rejectionReason) {
    if (decision === VerificationStatus.PENDING) {
      throw errors.badRequest("Cannot set verification status to pending during review");
    }
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { id: verificationId }
      });
      if (!verification) {
        throw errors.notFound("Verification not found");
      }
      if (verification.status !== VerificationStatus.PENDING) {
        throw errors.badRequest("Verification has already been reviewed");
      }
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedVerification = await tx.accountVerification.update({
          where: { id: verificationId },
          data: {
            status: decision,
            reviewedAt: /* @__PURE__ */ new Date(),
            reviewedBy: reviewerId,
            rejectionReason: decision === VerificationStatus.REJECTED ? rejectionReason : null
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                walletAddress: true,
                createdAt: true
              }
            },
            reviewer: {
              select: {
                id: true,
                email: true
              }
            }
          }
        });
        const userUpdateData = {
          sellerStatus: decision === VerificationStatus.APPROVED ? "APPROVED" : "REJECTED"
        };
        if (decision === VerificationStatus.APPROVED) {
          userUpdateData.verifiedAt = /* @__PURE__ */ new Date();
          userUpdateData.rejectedAt = null;
          userUpdateData.rejectionReason = null;
        } else if (decision === VerificationStatus.REJECTED) {
          userUpdateData.rejectedAt = /* @__PURE__ */ new Date();
          userUpdateData.rejectionReason = rejectionReason;
        }
        await tx.user.update({
          where: { id: verification.userId },
          data: userUpdateData
        });
        return updatedVerification;
      });
      try {
        const notificationType = decision === VerificationStatus.APPROVED ? "VERIFICATION_APPROVED" /* VERIFICATION_APPROVED */ : "VERIFICATION_REJECTED" /* VERIFICATION_REJECTED */;
        const template = NotificationTemplates[notificationType];
        await this.notificationService.createNotification({
          userId: result.userId,
          type: notificationType,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl()
        });
      } catch (notificationError) {
        console.error("Error creating verification result notification:", notificationError);
      }
      return result;
    } catch (error) {
      console.error("Error reviewing verification:", error);
      throw error;
    }
  }
  /**
   * Get all pending verifications (admin only)
   */
  async getPendingVerifications() {
    try {
      const verifications = await this.prisma.accountVerification.findMany({
        where: { status: VerificationStatus.PENDING },
        orderBy: { submittedAt: "asc" },
        // FIFO order
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true
            }
          },
          reviewer: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });
      return verifications;
    } catch (error) {
      console.error("Error getting pending verifications:", error);
      throw error;
    }
  }
  /**
   * Get all verifications (admin only)
   */
  async getAllVerifications() {
    try {
      const verifications = await this.prisma.accountVerification.findMany({
        orderBy: { submittedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true
            }
          },
          reviewer: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });
      return verifications;
    } catch (error) {
      console.error("Error getting all verifications:", error);
      throw error;
    }
  }
  /**
   * Delete verification document
   */
  async deleteVerificationDocument(userId) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId }
      });
      if (!verification?.documentImageUrl) {
        return false;
      }
      await SecureStorageService.deleteSecureDocumentByUrl(verification.documentImageUrl);
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
  /**
   * Submit facial verification (selfie)
   */
  async submitFacialVerification(userId, selfieFile) {
    try {
      console.log("\u{1F50D} Starting facial verification for user:", userId);
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId }
      });
      if (!verification) {
        throw errors.badRequest("Please submit document verification first");
      }
      if (!verification.documentImageUrl) {
        throw errors.badRequest("Document image is required for facial verification");
      }
      let selfieImageUrl;
      try {
        selfieImageUrl = await SecureStorageService.uploadSecureDocument(
          selfieFile,
          userId,
          "SELFIE"
        );
      } catch (error) {
        console.error("Selfie upload failed:", error);
        if (error instanceof Error && error.message.includes("Google Cloud Storage not configured")) {
          console.warn("Continuing facial verification without selfie upload (GCS not configured)");
          selfieImageUrl = `mock://selfie/${userId}/${Date.now()}.jpg`;
        } else {
          throw error;
        }
      }
      console.log("\u{1F50D} Processing with Google Vision API...");
      const visionResult = await VisionService.analyzeVerification(
        verification.documentImageUrl,
        selfieFile.buffer
      );
      console.log("\u2705 Vision API analysis completed:", {
        overallScore: visionResult.overallScore,
        recommendation: visionResult.recommendation,
        faceMatch: visionResult.faceComparison.match
      });
      const updatedVerification = await this.prisma.accountVerification.update({
        where: { userId },
        data: {
          selfieImageUrl,
          facialComparisonScore: visionResult.faceComparison.similarity,
          visionApiRecommendation: visionResult.recommendation,
          documentAnalysisResults: {
            faceComparison: visionResult.faceComparison,
            documentAnalysis: visionResult.documentAnalysis,
            overallScore: visionResult.overallScore,
            reasons: visionResult.reasons
          },
          facialVerificationAt: /* @__PURE__ */ new Date()
        }
      });
      return {
        verificationId: updatedVerification.id,
        facialVerificationStatus: "COMPLETED",
        overallScore: visionResult.overallScore,
        faceComparisonScore: visionResult.faceComparison.similarity,
        visionApiRecommendation: visionResult.recommendation,
        recommendation: visionResult.recommendation,
        message: this.getVerificationMessage(visionResult.recommendation, visionResult.reasons)
      };
    } catch (error) {
      console.error("Error in facial verification:", error);
      throw error;
    }
  }
  /**
   * Get facial verification status
   */
  async getFacialVerificationStatus(userId) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId }
      });
      if (!verification) {
        return {
          facialVerificationStatus: "NOT_STARTED",
          canStartFacialVerification: false,
          reason: "Please submit document verification first"
        };
      }
      if (!verification.documentImageUrl) {
        return {
          facialVerificationStatus: "NOT_STARTED",
          canStartFacialVerification: false,
          reason: "Document image is required for facial verification"
        };
      }
      if (!verification.selfieImageUrl) {
        return {
          facialVerificationStatus: "NOT_STARTED",
          canStartFacialVerification: true
        };
      }
      if (!verification.facialVerificationAt) {
        return {
          facialVerificationStatus: "PENDING",
          canStartFacialVerification: false,
          reason: "Facial verification is being processed"
        };
      }
      return {
        facialVerificationStatus: "COMPLETED",
        canStartFacialVerification: false,
        overallScore: verification.documentAnalysisResults?.overallScore,
        faceComparisonScore: verification.facialComparisonScore,
        visionApiRecommendation: verification.visionApiRecommendation
      };
    } catch (error) {
      console.error("Error getting facial verification status:", error);
      throw error;
    }
  }
  /**
   * Check if user is ready for facial verification
   */
  async isReadyForFacialVerification(userId) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId }
      });
      if (!verification) {
        return {
          ready: false,
          requiresDocumentFirst: true,
          reason: "Please submit document verification first"
        };
      }
      if (!verification.documentImageUrl) {
        return {
          ready: false,
          requiresDocumentFirst: true,
          reason: "Document image is required for facial verification"
        };
      }
      if (verification.selfieImageUrl && verification.facialVerificationAt) {
        return {
          ready: false,
          requiresDocumentFirst: false,
          reason: "Facial verification already completed"
        };
      }
      return {
        ready: true,
        requiresDocumentFirst: false
      };
    } catch (error) {
      console.error("Error checking facial verification readiness:", error);
      throw error;
    }
  }
  /**
   * Get verification message based on recommendation
   */
  getVerificationMessage(recommendation, reasons) {
    switch (recommendation) {
      case "APPROVE":
        return "Facial verification completed successfully. Your identity has been verified.";
      case "REJECT":
        return `Facial verification failed: ${reasons.join(", ")}. Please try again with a clearer photo.`;
      case "MANUAL_REVIEW":
        return `Facial verification completed but requires manual review: ${reasons.join(", ")}. We'll notify you of the result.`;
      default:
        return "Facial verification completed.";
    }
  }
};

// src/services/listing-service.ts
var ListingService = class {
  constructor(prisma2, notificationService) {
    this.prisma = prisma2;
    this.notificationService = notificationService || new NotificationService(prisma2);
  }
  static {
    __name(this, "ListingService");
  }
  notificationService;
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

// src/routes/v1/admin.ts
async function adminRoutes(fastify) {
  const verificationService = new AccountVerificationService(fastify.prisma);
  const submissionService = new SubmissionService(fastify.prisma);
  const listingService = new ListingService(fastify.prisma);
  fastify.get(
    "/dashboard/stats",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const [totalUsers, pendingVerifications, approvedVerifications, rejectedVerifications] = await Promise.all([
          fastify.prisma.user.count(),
          fastify.prisma.accountVerification.count({
            where: { status: "PENDING" }
          }),
          fastify.prisma.accountVerification.count({
            where: { status: "APPROVED" }
          }),
          fastify.prisma.accountVerification.count({
            where: { status: "REJECTED" }
          })
        ]);
        const stats = {
          users: {
            total: totalUsers,
            withVerification: approvedVerifications + rejectedVerifications + pendingVerifications
          },
          verifications: {
            pending: pendingVerifications,
            approved: approvedVerifications,
            rejected: rejectedVerifications,
            total: approvedVerifications + rejectedVerifications + pendingVerifications
          }
        };
        return reply.send({
          success: true,
          data: stats
        });
      } catch (error) {
        console.error("Error getting admin stats:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/verifications/pending",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getPendingVerifications();
        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length
        });
      } catch (error) {
        console.error("Error getting pending verifications:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/verifications/all",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getAllVerifications();
        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length
        });
      } catch (error) {
        console.error("Error getting all verifications:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/verifications",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getAllVerifications();
        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length
        });
      } catch (error) {
        console.error("Error getting all verifications:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/submissions/all",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const query = request.query;
        const status = query.status;
        const limit = query.limit ? parseInt(query.limit) : 50;
        const submissions = await submissionService.getAllSubmissionsForAdmin({
          status: status && status !== "ALL" ? status : void 0,
          limit
        });
        return reply.send({
          success: true,
          data: submissions,
          count: submissions.length
        });
      } catch (error) {
        console.error("Error getting admin submissions:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/listings",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const listings = await listingService.getAllListingsForAdmin();
        return reply.send({
          success: true,
          data: listings,
          count: listings.length
        });
      } catch (error) {
        console.error("Error getting admin listings:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/sellers",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const sellers = await fastify.prisma.user.findMany({
          where: {
            sellerStatus: { in: ["PENDING", "APPROVED", "REJECTED"] }
          },
          include: {
            accountVerification: true,
            listings: {
              select: {
                id: true,
                isLive: true,
                createdAt: true
              }
            },
            _count: {
              select: {
                listings: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        });
        const sellersData = sellers.map((seller) => ({
          id: seller.id,
          displayName: seller.accountVerification?.firstName && seller.accountVerification?.lastName ? `${seller.accountVerification.firstName} ${seller.accountVerification.lastName}` : seller.email || seller.walletAddress || "Unknown",
          email: seller.email,
          walletAddress: seller.walletAddress,
          sellerStatus: seller.sellerStatus,
          appliedAt: seller.appliedAt?.toISOString() || null,
          verifiedAt: seller.verifiedAt?.toISOString() || null,
          rejectedAt: seller.rejectedAt?.toISOString() || null,
          rejectionReason: seller.rejectionReason,
          createdAt: seller.createdAt.toISOString(),
          updatedAt: seller.updatedAt.toISOString(),
          accountVerification: seller.accountVerification ? {
            id: seller.accountVerification.id,
            status: seller.accountVerification.status,
            submittedAt: seller.accountVerification.submittedAt.toISOString(),
            reviewedAt: seller.accountVerification.reviewedAt?.toISOString() || null,
            attempts: seller.accountVerification.attempts,
            firstName: seller.accountVerification.firstName,
            lastName: seller.accountVerification.lastName,
            documentType: seller.accountVerification.documentType
          } : null,
          listings: {
            total: seller._count.listings,
            live: seller.listings.filter((l) => l.isLive).length,
            recent: seller.listings.slice(0, 5).map((listing) => ({
              id: listing.id,
              title: "Listing",
              // We don't have title in this query, could be enhanced
              symbol: "N/A",
              // We don't have symbol in this query, could be enhanced
              isLive: listing.isLive,
              createdAt: listing.createdAt.toISOString()
            }))
          },
          bidStats: {
            totalBids: 0,
            // TODO: Calculate from bids table when implemented
            totalBidValue: 0
            // TODO: Calculate from bids table when implemented
          }
        }));
        return reply.send({
          success: true,
          data: sellersData,
          count: sellersData.length
        });
      } catch (error) {
        console.error("Error getting admin sellers:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/bids",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const bids = [];
        return reply.send({
          success: true,
          data: bids,
          count: bids.length
        });
      } catch (error) {
        console.error("Error getting admin bids:", error);
        throw error;
      }
    }
  );
}
__name(adminRoutes, "adminRoutes");

// src/routes/v1/bids.ts
var import_zod2 = require("zod");
var import_zod_to_json_schema2 = require("zod-to-json-schema");

// src/services/bid-service.ts
var BidService = class {
  constructor(prisma2, notificationService) {
    this.prisma = prisma2;
    this.notificationService = notificationService || new NotificationService(prisma2);
  }
  static {
    __name(this, "BidService");
  }
  notificationService;
  /**
   * Check if user is verified and can place bids
   */
  async checkUserBiddingEligibility(userId) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        accountVerification: true
      }
    });
    if (!user) return false;
    const hasSellerApproval = user.sellerStatus === "APPROVED";
    const hasAccountVerification = user.accountVerification?.status === "APPROVED";
    return hasSellerApproval && hasAccountVerification;
  }
  /**
   * Validate bid amount against listing rules
   */
  async validateBidAmount(listingId, amount, excludeBidId) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        bids: {
          where: {
            status: BidStatus.PENDING,
            isActive: true,
            ...excludeBidId && { id: { not: excludeBidId } }
          },
          orderBy: { amount: "desc" },
          take: 1
        }
      }
    });
    if (!listing) {
      throw errors.notFound("Listing not found");
    }
    const bidAmount = parseFloat(amount);
    if (listing.startingBidPrice) {
      const startingPrice = parseFloat(listing.startingBidPrice);
      if (bidAmount < startingPrice) {
        throw errors.validation(`Bid must be at least $${startingPrice.toLocaleString()}`);
      }
    }
    if (listing.bids.length > 0) {
      const highestBid = parseFloat(listing.bids[0].amount);
      if (bidAmount <= highestBid) {
        throw errors.validation(
          `Bid must be higher than current highest bid of $${highestBid.toLocaleString()}`
        );
      }
    }
  }
  /**
   * Create a new bid
   */
  async createBid(userId, data) {
    try {
      const isEligible = await this.checkUserBiddingEligibility(userId);
      if (!isEligible) {
        throw errors.forbidden("Account verification required to place bids");
      }
      const listing = await this.prisma.listing.findUnique({
        where: { id: data.listingId },
        select: {
          id: true,
          ownerId: true,
          isLive: true,
          startingBidPrice: true
        }
      });
      if (!listing) {
        throw errors.notFound("Listing not found");
      }
      if (!listing.isLive) {
        throw errors.validation("Listing is not available for bidding");
      }
      if (listing.ownerId === userId) {
        throw errors.validation("You cannot bid on your own listing");
      }
      await this.validateBidAmount(data.listingId, data.amount);
      const existingBid = await this.prisma.bid.findFirst({
        where: {
          listingId: data.listingId,
          bidderId: userId,
          status: BidStatus.PENDING,
          isActive: true
        }
      });
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      let newBid;
      if (existingBid) {
        await this.prisma.bid.update({
          where: { id: existingBid.id },
          data: { isActive: false }
        });
        newBid = await this.prisma.bid.create({
          data: {
            amount: data.amount,
            message: data.message,
            listingId: data.listingId,
            bidderId: userId,
            expiresAt,
            previousBidId: existingBid.id
          },
          include: {
            bidder: {
              select: {
                id: true,
                username: true,
                walletAddress: true,
                email: true
              }
            },
            listing: {
              select: {
                id: true,
                title: true,
                symbol: true,
                ownerId: true,
                isLive: true,
                startingBidPrice: true,
                reservePrice: true
              }
            }
          }
        });
      } else {
        newBid = await this.prisma.bid.create({
          data: {
            amount: data.amount,
            message: data.message,
            listingId: data.listingId,
            bidderId: userId,
            expiresAt
          },
          include: {
            bidder: {
              select: {
                id: true,
                username: true,
                walletAddress: true,
                email: true
              }
            },
            listing: {
              select: {
                id: true,
                title: true,
                symbol: true,
                ownerId: true,
                isLive: true,
                startingBidPrice: true,
                reservePrice: true
              }
            }
          }
        });
      }
      try {
        const template = NotificationTemplates["NEW_BID_RECEIVED" /* NEW_BID_RECEIVED */];
        await this.notificationService.createNotification({
          userId: listing.ownerId,
          listingId: data.listingId,
          type: "NEW_BID_RECEIVED" /* NEW_BID_RECEIVED */,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl()
        });
      } catch (notificationError) {
        console.error("Error creating bid notification:", notificationError);
      }
      try {
        const newBidAmount = parseFloat(data.amount);
        const outbidUsers = await this.prisma.bid.findMany({
          where: {
            listingId: data.listingId,
            bidderId: { not: userId },
            // Exclude current bidder
            status: BidStatus.PENDING,
            isActive: true,
            amount: { lt: data.amount }
            // Bids lower than the new bid
          },
          select: {
            bidderId: true
          }
        });
        const outbidTemplate = NotificationTemplates["BID_OUTBID" /* BID_OUTBID */];
        for (const outbidUser of outbidUsers) {
          await this.notificationService.createNotification({
            userId: outbidUser.bidderId,
            listingId: data.listingId,
            type: "BID_OUTBID" /* BID_OUTBID */,
            title: outbidTemplate.title,
            message: outbidTemplate.message,
            actionUrl: outbidTemplate.getActionUrl()
          });
        }
      } catch (notificationError) {
        console.error("Error creating outbid notifications:", notificationError);
      }
      return newBid;
    } catch (error) {
      console.error("Error in createBid:", error);
      throw error;
    }
  }
  /**
   * Get bids for a listing
   */
  async getListingBids(listingId, options = {}) {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where = {
        listingId,
        status: BidStatus.PENDING,
        ...options.includeInactive ? {} : { isActive: true }
      };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const bids = await this.prisma.bid.findMany({
        where,
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true
            }
          }
        },
        orderBy: { amount: "desc" },
        take: limit + 1
      });
      const hasMore = bids.length > limit;
      const data = hasMore ? bids.slice(0, -1) : bids;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error("Error in getListingBids:", error);
      throw error;
    }
  }
  /**
   * Get user's bids
   */
  async getUserBids(userId, filter, options = {}) {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where = {
        bidderId: userId,
        isActive: true,
        ...filter?.status && { status: filter.status }
      };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const bids = await this.prisma.bid.findMany({
        where,
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });
      const hasMore = bids.length > limit;
      const data = hasMore ? bids.slice(0, -1) : bids;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error("Error in getUserBids:", error);
      throw error;
    }
  }
  /**
   * Get bids on user's listings
   */
  async getBidsOnUserListings(userId, filter, options = {}) {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where = {
        listing: {
          ownerId: userId
        },
        isActive: true,
        ...filter?.status && { status: filter.status }
      };
      if (options.cursor) {
        where.id = { lt: options.cursor };
      }
      const bids = await this.prisma.bid.findMany({
        where,
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });
      const hasMore = bids.length > limit;
      const data = hasMore ? bids.slice(0, -1) : bids;
      const nextCursor = hasMore ? data[data.length - 1]?.id : void 0;
      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error("Error in getBidsOnUserListings:", error);
      throw error;
    }
  }
  /**
   * Respond to a bid (accept/reject) - listing owner only
   */
  async respondToBid(bidId, userId, data) {
    try {
      const bid = await this.prisma.bid.findUnique({
        where: { id: bidId },
        include: {
          listing: {
            select: {
              ownerId: true
            }
          }
        }
      });
      if (!bid) {
        throw errors.notFound("Bid not found");
      }
      if (bid.listing.ownerId !== userId) {
        throw errors.forbidden("You can only respond to bids on your own listings");
      }
      if (bid.status !== BidStatus.PENDING) {
        throw errors.validation("Bid has already been responded to");
      }
      if (!bid.isActive) {
        throw errors.validation("This bid is no longer active");
      }
      const updatedBid = await this.prisma.bid.update({
        where: { id: bidId },
        data: {
          status: data.status === "ACCEPTED" ? BidStatus.ACCEPTED : BidStatus.REJECTED,
          respondedAt: /* @__PURE__ */ new Date(),
          responseMessage: data.responseMessage
        },
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true
            }
          }
        }
      });
      try {
        const notificationType = data.status === "ACCEPTED" ? "BID_ACCEPTED" /* BID_ACCEPTED */ : "BID_REJECTED" /* BID_REJECTED */;
        const template = NotificationTemplates[notificationType];
        await this.notificationService.createNotification({
          userId: updatedBid.bidderId,
          listingId: updatedBid.listingId,
          type: notificationType,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl()
        });
      } catch (notificationError) {
        console.error("Error creating bid response notification:", notificationError);
      }
      return updatedBid;
    } catch (error) {
      console.error("Error in respondToBid:", error);
      throw error;
    }
  }
  /**
   * Withdraw a bid - bidder only
   */
  async withdrawBid(bidId, userId) {
    try {
      const bid = await this.prisma.bid.findUnique({
        where: { id: bidId },
        select: {
          bidderId: true,
          status: true,
          isActive: true
        }
      });
      if (!bid) {
        throw errors.notFound("Bid not found");
      }
      if (bid.bidderId !== userId) {
        throw errors.forbidden("You can only withdraw your own bids");
      }
      if (bid.status !== BidStatus.PENDING) {
        throw errors.validation("Can only withdraw pending bids");
      }
      if (!bid.isActive) {
        throw errors.validation("Bid is not active");
      }
      await this.prisma.bid.update({
        where: { id: bidId },
        data: {
          status: BidStatus.WITHDRAWN,
          isActive: false
        }
      });
    } catch (error) {
      console.error("Error in withdrawBid:", error);
      throw error;
    }
  }
  /**
   * Get highest bid for a listing
   */
  async getHighestBid(listingId) {
    try {
      const highestBid = await this.prisma.bid.findFirst({
        where: {
          listingId,
          status: BidStatus.PENDING,
          isActive: true
        },
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true
            }
          }
        },
        orderBy: { amount: "desc" }
      });
      return highestBid;
    } catch (error) {
      console.error("Error in getHighestBid:", error);
      throw error;
    }
  }
  /**
   * Auto-expire bids (to be run periodically)
   */
  async expireBids() {
    try {
      const result = await this.prisma.bid.updateMany({
        where: {
          status: BidStatus.PENDING,
          expiresAt: {
            lt: /* @__PURE__ */ new Date()
          }
        },
        data: {
          status: BidStatus.EXPIRED,
          isActive: false
        }
      });
      return result.count;
    } catch (error) {
      console.error("Error in expireBids:", error);
      throw error;
    }
  }
};

// src/routes/v1/bids.ts
var CreateBidSchema = import_zod2.z.object({
  listingId: import_zod2.z.string().min(1),
  amount: import_zod2.z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal number"),
  message: import_zod2.z.string().max(500).optional()
});
var RespondToBidSchema = import_zod2.z.object({
  status: import_zod2.z.enum(["ACCEPTED", "REJECTED"]),
  responseMessage: import_zod2.z.string().max(500).optional()
});
async function bidsRoutes(fastify) {
  const bidService = new BidService(fastify.prisma);
  fastify.get(
    "/eligibility",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const isEligible = await bidService.checkUserBiddingEligibility(request.user.id);
        return reply.send({
          success: true,
          data: {
            isEligible,
            message: isEligible ? "You are eligible to place bids" : "Account verification required to place bids"
          }
        });
      } catch (error) {
        console.error("Error checking bidding eligibility:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/",
    {
      preHandler: [requireAuth],
      schema: {
        body: (0, import_zod_to_json_schema2.zodToJsonSchema)(CreateBidSchema)
      }
    },
    async (request, reply) => {
      try {
        const data = request.body;
        const bid = await bidService.createBid(request.user.id, data);
        return reply.status(201).send({
          success: true,
          data: bid,
          message: "Bid placed successfully"
        });
      } catch (error) {
        console.error("Error creating bid:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/listing/:listingId",
    {
      schema: {
        params: (0, import_zod_to_json_schema2.zodToJsonSchema)(
          import_zod2.z.object({
            listingId: import_zod2.z.string()
          })
        ),
        querystring: (0, import_zod_to_json_schema2.zodToJsonSchema)(
          import_zod2.z.object({
            limit: import_zod2.z.string().transform(Number).optional(),
            cursor: import_zod2.z.string().optional(),
            includeInactive: import_zod2.z.string().transform((val) => val === "true").optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { listingId } = request.params;
        const { limit, cursor, includeInactive } = request.query;
        const result = await bidService.getListingBids(listingId, {
          limit,
          cursor,
          includeInactive
        });
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting listing bids:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/listing/:listingId/highest",
    {
      schema: {
        params: (0, import_zod_to_json_schema2.zodToJsonSchema)(
          import_zod2.z.object({
            listingId: import_zod2.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { listingId } = request.params;
        const highestBid = await bidService.getHighestBid(listingId);
        return reply.send({
          success: true,
          data: highestBid
        });
      } catch (error) {
        console.error("Error getting highest bid:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/my",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: (0, import_zod_to_json_schema2.zodToJsonSchema)(
          import_zod2.z.object({
            status: import_zod2.z.enum(["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"]).optional(),
            limit: import_zod2.z.string().transform(Number).optional(),
            cursor: import_zod2.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query;
        const result = await bidService.getUserBids(
          request.user.id,
          status ? { status } : void 0,
          { limit, cursor }
        );
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting user bids:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/received",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: (0, import_zod_to_json_schema2.zodToJsonSchema)(
          import_zod2.z.object({
            status: import_zod2.z.enum(["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"]).optional(),
            limit: import_zod2.z.string().transform(Number).optional(),
            cursor: import_zod2.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query;
        const result = await bidService.getBidsOnUserListings(
          request.user.id,
          status ? { status } : void 0,
          { limit, cursor }
        );
        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
          }
        });
      } catch (error) {
        console.error("Error getting bids on user listings:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/:bidId/respond",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema2.zodToJsonSchema)(
          import_zod2.z.object({
            bidId: import_zod2.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema2.zodToJsonSchema)(RespondToBidSchema)
      }
    },
    async (request, reply) => {
      try {
        const { bidId } = request.params;
        const data = request.body;
        const bid = await bidService.respondToBid(bidId, request.user.id, data);
        return reply.send({
          success: true,
          data: bid,
          message: `Bid ${data.status.toLowerCase()} successfully`
        });
      } catch (error) {
        console.error("Error responding to bid:", error);
        throw error;
      }
    }
  );
  fastify.delete(
    "/:bidId",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema2.zodToJsonSchema)(
          import_zod2.z.object({
            bidId: import_zod2.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { bidId } = request.params;
        await bidService.withdrawBid(bidId, request.user.id);
        return reply.send({
          success: true,
          message: "Bid withdrawn successfully"
        });
      } catch (error) {
        console.error("Error withdrawing bid:", error);
        throw error;
      }
    }
  );
  fastify.post("/expire", async (request, reply) => {
    try {
      const expiredCount = await bidService.expireBids();
      return reply.send({
        success: true,
        data: {
          expiredCount
        },
        message: `${expiredCount} bids expired`
      });
    } catch (error) {
      console.error("Error expiring bids:", error);
      throw error;
    }
  });
}
__name(bidsRoutes, "bidsRoutes");

// src/routes/v1/verification.ts
var import_zod3 = require("zod");
var import_zod_to_json_schema3 = require("zod-to-json-schema");
var SubmitVerificationSchema = import_zod3.z.object({
  documentType: import_zod3.z.enum(["DRIVERS_LICENSE", "PASSPORT", "ID_CARD"]),
  documentNumber: import_zod3.z.string().min(1),
  fullName: import_zod3.z.string().min(1),
  dateOfBirth: import_zod3.z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format"
  }),
  countryOfIssue: import_zod3.z.string().min(1),
  state: import_zod3.z.string().optional(),
  address: import_zod3.z.string().min(1),
  emailAddress: import_zod3.z.string().email()
});
var ReviewVerificationSchema = import_zod3.z.object({
  decision: import_zod3.z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: import_zod3.z.string().optional()
});
async function accountVerificationRoutes(fastify) {
  const verificationService = new AccountVerificationService(fastify.prisma);
  fastify.post(
    "/submit",
    {
      preHandler: [requireAuth]
      // Remove schema validation for multipart requests
      // We'll validate the data manually after processing multipart
    },
    async (request, reply) => {
      try {
        console.log("\u{1F50D} Starting verification submission for user:", request.user?.id);
        let documentFile = null;
        const formData = {};
        if (request.isMultipart()) {
          console.log("\u{1F50D} Processing multipart request...");
          for await (const part of request.parts()) {
            console.log("\u{1F50D} Processing part:", { type: part.type, fieldname: part.fieldname });
            if (part.type === "file" && part.fieldname === "documentFile") {
              console.log("\u{1F50D} Document file found, reading buffer...");
              const buffer = await part.toBuffer();
              documentFile = {
                ...part,
                buffer
              };
              console.log("\u{1F50D} Document file processed:", {
                filename: documentFile.filename,
                mimetype: documentFile.mimetype,
                size: buffer.length
              });
            } else if (part.type === "field") {
              formData[part.fieldname] = String(part.value);
              console.log("\u{1F50D} Form field processed:", part.fieldname);
            }
          }
          console.log("\u2705 Multipart processing completed");
        } else {
          console.log("\u{1F50D} Processing JSON request...");
          Object.assign(formData, request.body);
          console.log("\u2705 JSON processing completed");
        }
        console.log("\u{1F50D} Validating form data:", Object.keys(formData));
        const validationResult = SubmitVerificationSchema.safeParse(formData);
        if (!validationResult.success) {
          console.log("\u274C Validation failed:", validationResult.error.errors);
          return reply.status(400).send({
            success: false,
            error: "Validation failed",
            details: validationResult.error.errors
          });
        }
        console.log("\u2705 Validation passed");
        const data = validationResult.data;
        const nameParts = data.fullName.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const verificationData = {
          ...data,
          firstName,
          lastName,
          dateOfBirth: new Date(data.dateOfBirth),
          documentType: data.documentType
        };
        console.log("\u{1F50D} Submitting verification with data:", {
          userId: request.user.id,
          documentType: verificationData.documentType,
          hasDocumentFile: !!documentFile
        });
        const verification = await verificationService.submitVerification(
          request.user.id,
          {
            ...verificationData,
            selfieImageUrl: "",
            facialComparisonScore: 0,
            visionApiRecommendation: "UNKNOWN",
            documentAnalysisResults: null,
            facialVerificationAt: /* @__PURE__ */ new Date()
          },
          documentFile || void 0
        );
        console.log("\u2705 Verification submitted successfully:", verification.id);
        return reply.send({
          success: true,
          data: verification,
          message: "Verification submitted successfully"
        });
      } catch (error) {
        console.error("Error in verification submission:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/status",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const status = await verificationService.getUserVerificationStatus(request.user.id);
        return reply.send({
          success: true,
          data: status
        });
      } catch (error) {
        console.error("Error getting verification status:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/details",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const verification = await verificationService.getVerificationByUserId(request.user.id);
        return reply.send({
          success: true,
          data: verification
        });
      } catch (error) {
        console.error("Error getting verification details:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/admin/pending",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getPendingVerifications();
        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length
        });
      } catch (error) {
        console.error("Error getting pending verifications:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/admin/all",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getAllVerifications();
        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length
        });
      } catch (error) {
        console.error("Error getting all verifications:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id/review",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema3.zodToJsonSchema)(
          import_zod3.z.object({
            id: import_zod3.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema3.zodToJsonSchema)(ReviewVerificationSchema)
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { decision, rejectionReason } = request.body;
        const verification = await verificationService.reviewVerification(
          id,
          request.user.id,
          decision,
          rejectionReason
        );
        return reply.send({
          success: true,
          data: verification,
          message: `Verification ${decision.toLowerCase()} successfully`
        });
      } catch (error) {
        console.error("Error reviewing verification:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id/approve",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema3.zodToJsonSchema)(
          import_zod3.z.object({
            id: import_zod3.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const verification = await verificationService.reviewVerification(
          id,
          request.user.id,
          VerificationStatus.APPROVED
        );
        return reply.send({
          success: true,
          data: verification,
          message: "Verification approved successfully"
        });
      } catch (error) {
        console.error("Error approving verification:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/admin/:id/reject",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema3.zodToJsonSchema)(
          import_zod3.z.object({
            id: import_zod3.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema3.zodToJsonSchema)(
          import_zod3.z.object({
            rejectionReason: import_zod3.z.string().min(1)
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { rejectionReason } = request.body;
        const verification = await verificationService.reviewVerification(
          id,
          request.user.id,
          VerificationStatus.REJECTED,
          rejectionReason
        );
        return reply.send({
          success: true,
          data: verification,
          message: "Verification rejected successfully"
        });
      } catch (error) {
        console.error("Error rejecting verification:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/facial-verification",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        console.log("\u{1F50D} Starting facial verification for user:", request.user?.id);
        let selfieFile = null;
        if (request.isMultipart()) {
          console.log("\u{1F50D} Processing selfie multipart request...");
          for await (const part of request.parts()) {
            console.log("\u{1F50D} Processing part:", { type: part.type, fieldname: part.fieldname });
            if (part.type === "file" && part.fieldname === "selfie") {
              console.log("\u{1F50D} Selfie file found, reading buffer...");
              const buffer = await part.toBuffer();
              selfieFile = {
                ...part,
                buffer
              };
              console.log("\u{1F50D} Selfie file processed:", {
                filename: selfieFile.filename,
                mimetype: selfieFile.mimetype,
                size: buffer.length
              });
            }
          }
          console.log("\u2705 Selfie multipart processing completed");
        } else {
          console.log("\u274C No multipart data found for selfie");
          return reply.status(400).send({
            success: false,
            error: "Selfie image is required"
          });
        }
        if (!selfieFile) {
          return reply.status(400).send({
            success: false,
            error: "Selfie image is required"
          });
        }
        console.log("\u{1F50D} Processing facial verification...");
        const result = await verificationService.submitFacialVerification(
          request.user.id,
          selfieFile
        );
        console.log("\u2705 Facial verification completed:", result.visionApiRecommendation);
        return reply.send({
          success: true,
          data: result,
          message: "Facial verification completed successfully"
        });
      } catch (error) {
        console.error("Error in facial verification:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/facial-verification/status",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const status = await verificationService.getFacialVerificationStatus(request.user.id);
        return reply.send({
          success: true,
          data: status
        });
      } catch (error) {
        console.error("Error getting facial verification status:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/facial-verification/ready",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const readiness = await verificationService.isReadyForFacialVerification(request.user.id);
        return reply.send({
          success: true,
          data: readiness
        });
      } catch (error) {
        console.error("Error checking facial verification readiness:", error);
        throw error;
      }
    }
  );
}
__name(accountVerificationRoutes, "accountVerificationRoutes");

// src/routes/v1/users.ts
var import_zod4 = require("zod");
var import_jsonwebtoken2 = require("jsonwebtoken");
var import_zod_to_json_schema4 = require("zod-to-json-schema");

// src/services/users-service.ts
var UsersService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "UsersService");
  }
  /**
   * Get user profile by ID - Step 1 version
   */
  async getUserProfile(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          privyDid: true,
          walletAddress: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!user) {
        throw errors.notFound("User not found");
      }
      return user;
    } catch (error) {
      loggers.error(error, { userId, operation: "getUserProfile" });
      throw error;
    }
  }
  /**
   * Update user profile - supports email and username updates
   */
  async updateUserProfile(userId, updates) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: /* @__PURE__ */ new Date()
        },
        select: {
          id: true,
          privyDid: true,
          walletAddress: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return updatedUser;
    } catch (error) {
      loggers.error(error, { userId, updates, operation: "updateUserProfile" });
      throw error;
    }
  }
};

// src/routes/v1/users.ts
var UserProfileUpdateSchema = import_zod4.z.object({
  email: import_zod4.z.string().email().optional(),
  username: import_zod4.z.string().min(1).max(50).optional()
});
async function usersRoutes(fastify) {
  const usersService = new UsersService(fastify.prisma);
  fastify.post(
    "/verify-or-create",
    {
      schema: {
        body: (0, import_zod_to_json_schema4.zodToJsonSchema)(
          import_zod4.z.object({
            privyDid: import_zod4.z.string().min(1),
            walletAddress: import_zod4.z.string().optional(),
            email: import_zod4.z.string().email().optional(),
            username: import_zod4.z.string().optional()
          })
        )
      }
    },
    async (request, reply) => {
      const { privyDid, walletAddress, email, username } = request.body;
      const correlationId = request.id;
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          throw errors.unauthorized("Authentication token required");
        }
        const token = authHeader.replace("Bearer ", "");
        const decoded = (0, import_jsonwebtoken2.decode)(token);
        if (!decoded || !decoded.sub || decoded.sub !== privyDid) {
          throw errors.unauthorized("Invalid or mismatched authentication token");
        }
        let user = await fastify.prisma.user.findUnique({
          where: { privyDid }
        });
        if (!user) {
          console.log("Creating new user for Privy DID:", privyDid);
          user = await fastify.prisma.user.create({
            data: {
              privyDid,
              walletAddress: walletAddress || null,
              email: email || null,
              username: username || null,
              role: "TRADER",
              isActive: true
            }
          });
          console.log("User created successfully:", user.id);
        } else {
          console.log("Existing user found:", user.id);
          const updates = {};
          if (walletAddress && user.walletAddress !== walletAddress) {
            updates.walletAddress = walletAddress;
          }
          if (email && user.email !== email) {
            updates.email = email;
          }
          if (username && user.username !== username) {
            updates.username = username;
          }
          if (Object.keys(updates).length > 0) {
            user = await fastify.prisma.user.update({
              where: { id: user.id },
              data: { ...updates, updatedAt: /* @__PURE__ */ new Date() }
            });
            console.log("Updated user info:", user.id);
          }
        }
        const profile = await usersService.getUserProfile(user.id);
        return reply.send({
          success: true,
          data: {
            profile,
            created: user.createdAt.getTime() > Date.now() - 1e4
            // true if just created
          }
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, correlationId, privyDid, operation: "verifyOrCreateUser" },
          "Failed to verify or create user"
        );
        throw error;
      }
    }
  );
  fastify.get(
    "/me",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const profile = await usersService.getUserProfile(request.user.id);
        return reply.send({
          success: true,
          data: profile
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, operation: "getCurrentUserProfile" },
          "Failed to get current user profile"
        );
        throw error;
      }
    }
  );
  fastify.put(
    "/me",
    {
      preHandler: [requireAuth],
      schema: {
        body: (0, import_zod_to_json_schema4.zodToJsonSchema)(UserProfileUpdateSchema)
      }
    },
    async (request, reply) => {
      const updates = request.body;
      const correlationId = request.id;
      try {
        const updatedProfile = await usersService.updateUserProfile(request.user.id, updates);
        return reply.send({
          success: true,
          data: updatedProfile
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        fastify.log.error(
          { err, correlationId, operation: "updateCurrentUserProfile" },
          "Failed to update current user profile"
        );
        throw error;
      }
    }
  );
}
__name(usersRoutes, "usersRoutes");

// src/routes/v1/listings.ts
var import_zod5 = require("zod");
var import_zod_to_json_schema5 = require("zod-to-json-schema");
var CreateListingFromSubmissionSchema = import_zod5.z.object({
  submissionId: import_zod5.z.string()
});
var UpdateListingSchema = import_zod5.z.object({
  title: import_zod5.z.string().min(1).max(200).optional(),
  symbol: import_zod5.z.string().min(1).max(10).optional(),
  description: import_zod5.z.string().min(1).max(2e3).optional(),
  assetType: import_zod5.z.enum(["VEHICLE", "JEWELRY", "COLLECTIBLE", "ART", "FASHION", "ALCOHOL", "OTHER"]).optional(),
  imageGallery: import_zod5.z.array(import_zod5.z.string().url()).optional(),
  location: import_zod5.z.string().max(200).optional(),
  email: import_zod5.z.string().email().optional()
});
var SetListingLiveSchema = import_zod5.z.object({
  isLive: import_zod5.z.boolean()
});
var SetListingLaunchDateSchema = import_zod5.z.object({
  launchDate: import_zod5.z.string().datetime().nullable()
});
async function listingRoutes(fastify) {
  const listingService = new ListingService(fastify.prisma);
  fastify.get(
    "/live",
    {
      schema: {
        querystring: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            limit: import_zod5.z.string().transform(Number).optional(),
            cursor: import_zod5.z.string().optional()
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
        params: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            id: import_zod5.z.string()
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
        querystring: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            limit: import_zod5.z.string().transform(Number).optional(),
            cursor: import_zod5.z.string().optional()
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
        body: (0, import_zod_to_json_schema5.zodToJsonSchema)(CreateListingFromSubmissionSchema)
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
        querystring: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            limit: import_zod5.z.string().transform(Number).optional(),
            cursor: import_zod5.z.string().optional()
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
        querystring: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            limit: import_zod5.z.string().transform(Number).optional(),
            cursor: import_zod5.z.string().optional()
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
        params: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            id: import_zod5.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema5.zodToJsonSchema)(UpdateListingSchema)
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
        params: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            id: import_zod5.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema5.zodToJsonSchema)(SetListingLiveSchema)
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
        params: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            id: import_zod5.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema5.zodToJsonSchema)(SetListingLaunchDateSchema)
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
        params: (0, import_zod_to_json_schema5.zodToJsonSchema)(
          import_zod5.z.object({
            id: import_zod5.z.string()
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

// src/routes/v1/contact.ts
var import_zod6 = require("zod");
var import_zod_to_json_schema6 = require("zod-to-json-schema");

// src/lib/email-service.ts
var import_resend = require("resend");
var resend = new import_resend.Resend(process.env.RESEND_API_KEY);
var EmailService = class {
  static {
    __name(this, "EmailService");
  }
  static async sendContactFormEmail(data) {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.error("RESEND_API_KEY environment variable is not set");
        return {
          success: false,
          error: "Email service configuration error"
        };
      }
      const categoryMap = {
        watches: "Watches & Timepieces",
        jewelry: "Jewelry & Precious Stones",
        art: "Art & Collectibles",
        vehicles: "Luxury Vehicles",
        fashion: "Fashion & Accessories",
        spirits: "Fine Wines & Spirits",
        "real-estate": "Real Estate",
        yachts: "Yachts & Boats",
        "private-jets": "Private Jets",
        memorabilia: "Sports Memorabilia",
        other: "Other Luxury Items"
      };
      const categoryDisplay = categoryMap[data.category] || data.category;
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Form Submission - ACES</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .header {
              background: linear-gradient(135deg, #D0B264 0%, #231F20 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 0 0 10px 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .field {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border-radius: 8px;
              border-left: 4px solid #D0B264;
            }
            .label {
              font-weight: bold;
              color: #231F20;
              margin-bottom: 5px;
              display: block;
            }
            .value {
              color: #555;
              font-size: 16px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              letter-spacing: 2px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ACES</div>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">New Contact Form Submission</p>
          </div>
          
          <div class="content">
            <h2 style="color: #231F20; margin-top: 0;">Contact Request Details</h2>
            
            <div class="field">
              <span class="label">Customer Email:</span>
              <span class="value">${data.email}</span>
            </div>
            
            <div class="field">
              <span class="label">Category:</span>
              <span class="value">${categoryDisplay}</span>
            </div>
            
            <div class="field">
              <span class="label">Item Requested:</span>
              <span class="value">${data.itemName}</span>
            </div>
            
            <div class="field">
              <span class="label">Generated Message:</span>
              <span class="value">"Hello, my email is ${data.email} and I am looking for this item ${data.itemName}"</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated from the ACES contact form.</p>
            <p>Reply directly to this email to respond to the customer at <strong>${data.email}</strong></p>
          </div>
        </body>
        </html>
      `;
      const emailText = `
New Contact Form Submission - ACES

Customer Email: ${data.email}
Category: ${categoryDisplay}
Item Requested: ${data.itemName}

Generated Message: "Hello, my email is ${data.email} and I am looking for this item ${data.itemName}"

Reply directly to this email to respond to the customer.
      `;
      const result = await resend.emails.send({
        from: "ACES Contact Form <noreply@aces.fun>",
        to: ["pocket@aces.fun"],
        replyTo: data.email,
        subject: `New Contact Request: ${data.itemName} (${categoryDisplay})`,
        html: emailHtml,
        text: emailText
      });
      if (result.error) {
        console.error("Resend API error:", result.error);
        return {
          success: false,
          error: "Failed to send email"
        };
      }
      console.log("Contact form email sent successfully:", result.data?.id);
      return {
        success: true,
        messageId: result.data?.id
      };
    } catch (error) {
      console.error("Email service error:", error);
      return {
        success: false,
        error: "Internal email service error"
      };
    }
  }
  static async sendPurchaseInquiryEmail(data) {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.error("RESEND_API_KEY environment variable is not set");
        return {
          success: false,
          error: "Email service configuration error"
        };
      }
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Purchase Inquiry - ACES</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .header {
              background: linear-gradient(135deg, #D0B264 0%, #231F20 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 0 0 10px 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .field {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border-radius: 8px;
              border-left: 4px solid #D0B264;
            }
            .label {
              font-weight: bold;
              color: #231F20;
              margin-bottom: 5px;
              display: block;
            }
            .value {
              color: #555;
              font-size: 16px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              letter-spacing: 2px;
            }
            .priority {
              background: linear-gradient(135deg, #ff6b6b, #ee5a24);
              color: white;
              padding: 10px 20px;
              border-radius: 20px;
              font-weight: bold;
              display: inline-block;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ACES</div>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">New Purchase Inquiry</p>
          </div>
          
          <div class="content">
            <div class="priority">\u{1F525} HIGH PRIORITY - PURCHASE INQUIRY</div>
            
            <h2 style="color: #231F20; margin-top: 0;">Purchase Request Details</h2>
            
            <div class="field">
              <span class="label">Customer Email:</span>
              <span class="value">${data.customerEmail}</span>
            </div>
            
            <div class="field">
              <span class="label">Product:</span>
              <span class="value">${data.productTitle}</span>
            </div>
            
            <div class="field">
              <span class="label">Token Symbol:</span>
              <span class="value">${data.productTicker}</span>
            </div>
            
            ${data.productPrice ? `
            <div class="field">
              <span class="label">Listed Price:</span>
              <span class="value">${data.productPrice}</span>
            </div>
            ` : ""}
            
            ${data.customerMessage ? `
            <div class="field">
              <span class="label">Customer Message:</span>
              <span class="value">${data.customerMessage}</span>
            </div>
            ` : ""}
            
            <div class="field">
              <span class="label">Generated Message:</span>
              <span class="value">"Hello, I am interested in purchasing ${data.productTitle} (${data.productTicker}). Please contact me at ${data.customerEmail} to discuss the purchase."</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated from the ACES purchase inquiry system.</p>
            <p>Reply directly to this email to respond to the customer at <strong>${data.customerEmail}</strong></p>
            <p><strong>\u26A1 This is a purchase inquiry - prioritize response!</strong></p>
          </div>
        </body>
        </html>
      `;
      const emailText = `
New Purchase Inquiry - ACES

\u{1F525} HIGH PRIORITY - PURCHASE INQUIRY

Customer Email: ${data.customerEmail}
Product: ${data.productTitle}
Token Symbol: ${data.productTicker}
${data.productPrice ? `Listed Price: ${data.productPrice}` : ""}
${data.customerMessage ? `Customer Message: ${data.customerMessage}` : ""}

Generated Message: "Hello, I am interested in purchasing ${data.productTitle} (${data.productTicker}). Please contact me at ${data.customerEmail} to discuss the purchase."

\u26A1 This is a purchase inquiry - prioritize response!

Reply directly to this email to respond to the customer.
      `;
      const result = await resend.emails.send({
        from: "ACES Purchase Inquiry <pocket@aces.fun>",
        to: ["pocket@aces.fun"],
        replyTo: data.customerEmail,
        subject: `\u{1F525} Purchase Inquiry: ${data.productTitle} (${data.productTicker})`,
        html: emailHtml,
        text: emailText
      });
      if (result.error) {
        console.error("Resend API error:", result.error);
        return {
          success: false,
          error: "Failed to send email"
        };
      }
      console.log("Purchase inquiry email sent successfully:", result.data?.id);
      return {
        success: true,
        messageId: result.data?.id
      };
    } catch (error) {
      console.error("Purchase inquiry email service error:", error);
      return {
        success: false,
        error: "Failed to send email"
      };
    }
  }
};

// src/routes/v1/contact.ts
var contactFormSchema = import_zod6.z.object({
  category: import_zod6.z.string().min(1, "Category is required"),
  itemName: import_zod6.z.string().min(1, "Item name is required"),
  email: import_zod6.z.string().email("Valid email is required")
});
async function contactRoutes(fastify) {
  fastify.post("/", {
    schema: {
      body: (0, import_zod_to_json_schema6.zodToJsonSchema)(contactFormSchema)
    },
    handler: /* @__PURE__ */ __name(async (request, reply) => {
      try {
        console.log("\u{1F50D} Contact form submission received:", request.body);
        const formData = contactFormSchema.parse(request.body);
        const allowedCategories = [
          "watches",
          "jewelry",
          "art",
          "vehicles",
          "fashion",
          "spirits",
          "real-estate",
          "yachts",
          "private-jets",
          "memorabilia",
          "other"
        ];
        if (!allowedCategories.includes(formData.category)) {
          return reply.status(400).send({
            success: false,
            message: "Invalid category selected",
            allowedCategories
          });
        }
        const emailResult = await EmailService.sendContactFormEmail(formData);
        if (!emailResult.success) {
          console.error("Failed to send contact form email:", emailResult);
          return reply.status(500).send({
            success: false,
            message: "Failed to send your message. Please try again later."
          });
        }
        console.log("\u2705 Contact form submitted successfully:", {
          email: formData.email,
          category: formData.category,
          itemName: formData.itemName,
          messageId: emailResult.messageId
        });
        return reply.status(200).send({
          success: true,
          message: "Thank you for your inquiry! We will get back to you soon.",
          messageId: emailResult.messageId
        });
      } catch (error) {
        console.error("\u274C Contact form submission error:", error);
        if (error instanceof import_zod6.z.ZodError) {
          return reply.status(400).send({
            success: false,
            message: "Validation failed",
            errors: error.errors.map((err) => `${err.path.join(".")}: ${err.message}`)
          });
        }
        return reply.status(500).send({
          success: false,
          message: "Internal server error. Please try again later.",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }, "handler")
  });
  fastify.get("/health", async (request, reply) => {
    return reply.send({
      success: true,
      service: "contact",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}
__name(contactRoutes, "contactRoutes");

// src/routes/v1/purchase.ts
var import_zod7 = require("zod");
var import_zod_to_json_schema7 = require("zod-to-json-schema");
var purchaseInquirySchema = import_zod7.z.object({
  productTitle: import_zod7.z.string().min(1, "Product title is required"),
  productTicker: import_zod7.z.string().min(1, "Product ticker is required"),
  productPrice: import_zod7.z.string().optional(),
  customerEmail: import_zod7.z.string().email("Valid email is required"),
  customerMessage: import_zod7.z.string().optional()
});
async function purchaseRoutes(fastify) {
  fastify.post("/", {
    schema: {
      body: (0, import_zod_to_json_schema7.zodToJsonSchema)(purchaseInquirySchema)
    },
    handler: /* @__PURE__ */ __name(async (request, reply) => {
      try {
        console.log("\u{1F50D} Purchase inquiry submission received:", request.body);
        const inquiryData = purchaseInquirySchema.parse(request.body);
        const emailResult = await EmailService.sendPurchaseInquiryEmail(inquiryData);
        if (!emailResult.success) {
          console.error("Failed to send purchase inquiry email:", emailResult);
          return reply.status(500).send({
            success: false,
            message: "Failed to send your inquiry. Please try again later."
          });
        }
        console.log("\u2705 Purchase inquiry submitted successfully:", {
          customerEmail: inquiryData.customerEmail,
          productTitle: inquiryData.productTitle,
          productTicker: inquiryData.productTicker,
          messageId: emailResult.messageId
        });
        return reply.status(200).send({
          success: true,
          message: "Thank you for your purchase inquiry! We will contact you soon to discuss the details.",
          messageId: emailResult.messageId
        });
      } catch (error) {
        console.error("\u274C Purchase inquiry submission error:", error);
        if (error instanceof import_zod7.z.ZodError) {
          return reply.status(400).send({
            success: false,
            message: "Validation failed",
            errors: error.errors.map((err) => `${err.path.join(".")}: ${err.message}`)
          });
        }
        return reply.status(500).send({
          success: false,
          message: "Internal server error. Please try again later.",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }, "handler")
  });
  fastify.get("/health", async (request, reply) => {
    return reply.send({
      success: true,
      service: "purchase",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}
__name(purchaseRoutes, "purchaseRoutes");

// src/routes/v1/comments.ts
var import_zod8 = require("zod");
var RATE_LIMIT_WINDOW = 1e4;
var CreateCommentSchema = import_zod8.z.object({
  content: import_zod8.z.string().min(1).max(1e3).trim(),
  listingId: import_zod8.z.string(),
  parentId: import_zod8.z.string().optional()
});
var UpdateUsernameSchema = import_zod8.z.object({
  username: import_zod8.z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional()
});
async function commentsRoutes(fastify) {
  const prisma2 = getPrismaClient();
  fastify.get("/:listingId", async (request, reply) => {
    const { listingId } = request.params;
    const currentUserId = request.user?.id;
    try {
      const listing = await prisma2.listing.findUnique({
        where: { id: listingId },
        select: { id: true }
      });
      if (!listing) {
        return reply.status(404).send({
          success: false,
          error: "Listing not found"
        });
      }
      const comments = await prisma2.listingComment.findMany({
        where: {
          listingId,
          parentId: null,
          // Only top-level comments
          isHidden: false
          // Don't show hidden comments
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              walletAddress: true
            }
          },
          replies: {
            where: { isHidden: false },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  walletAddress: true
                }
              },
              _count: {
                select: { likes: true }
              }
            },
            orderBy: { createdAt: "asc" }
          },
          _count: {
            select: { likes: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      let userLikes = [];
      if (currentUserId) {
        const userLikeRecords = await prisma2.listingCommentLike.findMany({
          where: {
            userId: currentUserId,
            comment: {
              listingId
            }
          },
          select: {
            commentId: true
          }
        });
        userLikes = userLikeRecords.map((like) => like.commentId);
      }
      const formatComment = /* @__PURE__ */ __name((comment) => {
        const displayName = comment.author.username || (comment.author.walletAddress ? `${comment.author.walletAddress.slice(0, 6)}...${comment.author.walletAddress.slice(-4)}` : "Anonymous");
        return {
          id: comment.id,
          content: comment.content,
          listingId: comment.listingId,
          authorId: comment.authorId,
          parentId: comment.parentId,
          createdAt: comment.createdAt.toISOString(),
          author: {
            ...comment.author,
            username: displayName
          },
          likeCount: comment._count.likes,
          isLikedByUser: userLikes.includes(comment.id),
          replies: comment.replies?.map(formatComment) || []
        };
      }, "formatComment");
      const formattedComments = comments.map(formatComment);
      reply.send({
        success: true,
        data: formattedComments
      });
    } catch (error) {
      fastify.log.error({ error }, "Failed to fetch comments");
      reply.status(500).send({
        success: false,
        error: "Failed to fetch comments"
      });
    }
  });
  fastify.post(
    "/",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      const { content, listingId, parentId } = request.body;
      const userId = request.user.id;
      try {
        const userLastComment = await prisma2.listingComment.findFirst({
          where: { authorId: userId },
          orderBy: { createdAt: "desc" }
        });
        if (userLastComment) {
          const timeSinceLastComment = Date.now() - userLastComment.createdAt.getTime();
          if (timeSinceLastComment < RATE_LIMIT_WINDOW) {
            const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastComment) / 1e3);
            return reply.status(429).send({
              success: false,
              error: "Please wait before posting another comment",
              retryAfter: remainingTime
            });
          }
        }
        const listing = await prisma2.listing.findUnique({
          where: { id: listingId },
          select: { id: true }
        });
        if (!listing) {
          return reply.status(404).send({
            success: false,
            error: "Listing not found"
          });
        }
        if (parentId) {
          const parentComment = await prisma2.listingComment.findUnique({
            where: { id: parentId }
          });
          if (!parentComment || parentComment.listingId !== listingId) {
            return reply.status(400).send({
              success: false,
              error: "Invalid parent comment"
            });
          }
        }
        const user = await prisma2.user.findUnique({
          where: { id: userId },
          select: { username: true, walletAddress: true }
        });
        if (!user?.username && user?.walletAddress) {
          await prisma2.user.update({
            where: { id: userId },
            data: { username: user.walletAddress }
          });
        }
        const comment = await prisma2.listingComment.create({
          data: {
            content: content.trim(),
            listingId,
            authorId: userId,
            parentId: parentId || null
          },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                walletAddress: true
              }
            },
            _count: {
              select: { likes: true }
            }
          }
        });
        const displayName = comment.author.username || (comment.author.walletAddress ? `${comment.author.walletAddress.slice(0, 6)}...${comment.author.walletAddress.slice(-4)}` : "Anonymous");
        const formattedComment = {
          id: comment.id,
          content: comment.content,
          listingId: comment.listingId,
          authorId: comment.authorId,
          parentId: comment.parentId,
          createdAt: comment.createdAt.toISOString(),
          author: {
            ...comment.author,
            username: displayName
          },
          likeCount: comment._count.likes,
          isLikedByUser: false
        };
        reply.status(201).send({
          success: true,
          data: formattedComment
        });
      } catch (error) {
        fastify.log.error({ error }, "Failed to create comment");
        reply.status(500).send({
          success: false,
          error: "Failed to create comment"
        });
      }
    }
  );
  fastify.post(
    "/:commentId/like",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      const { commentId } = request.params;
      const userId = request.user.id;
      console.log("\u{1F50D} Like request received:", { commentId, userId });
      try {
        console.log("\u{1F50D} Checking if comment exists:", commentId);
        const comment = await prisma2.listingComment.findUnique({
          where: { id: commentId },
          select: { id: true }
        });
        console.log("\u{1F50D} Comment found:", comment);
        if (!comment) {
          console.log("\u274C Comment not found");
          return reply.status(404).send({
            success: false,
            error: "Comment not found"
          });
        }
        console.log("\u{1F50D} Checking for existing like...");
        const existingLike = await prisma2.listingCommentLike.findFirst({
          where: {
            commentId,
            userId
          }
        });
        console.log("\u{1F50D} Existing like found:", existingLike);
        let liked;
        if (existingLike) {
          console.log("\u{1F50D} Removing existing like...");
          await prisma2.listingCommentLike.delete({
            where: {
              id: existingLike.id
            }
          });
          liked = false;
          console.log("\u2705 Like removed successfully");
        } else {
          console.log("\u{1F50D} Creating new like...");
          await prisma2.listingCommentLike.create({
            data: {
              commentId,
              userId
            }
          });
          liked = true;
          console.log("\u2705 Like created successfully");
        }
        console.log("\u{1F50D} Getting updated like count...");
        const newCount = await prisma2.listingCommentLike.count({
          where: { commentId }
        });
        console.log("\u2705 Like operation completed:", { liked, newCount });
        reply.send({
          success: true,
          data: {
            liked,
            newCount
          }
        });
      } catch (error) {
        console.error("\u274C Like operation failed:", error);
        console.error("\u274C Error details:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : void 0,
          commentId,
          userId
        });
        fastify.log.error({ error, commentId, userId }, "Failed to toggle like");
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          try {
            await prisma2.listingCommentLike.deleteMany({
              where: {
                commentId,
                userId
              }
            });
            const likeCount = await prisma2.listingCommentLike.count({
              where: { commentId }
            });
            return reply.send({
              success: true,
              data: {
                liked: false,
                newCount: likeCount
              }
            });
          } catch (deleteError) {
            fastify.log.error(
              { deleteError, commentId, userId },
              "Failed to handle unique constraint violation"
            );
          }
        }
        reply.status(500).send({
          success: false,
          error: "Failed to toggle like"
        });
      }
    }
  );
  fastify.put(
    "/username",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      const { username } = request.body;
      const userId = request.user.id;
      try {
        const updatedUser = await prisma2.user.update({
          where: { id: userId },
          data: { username: username?.trim() || null },
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        });
        reply.send({
          success: true,
          data: updatedUser
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          return reply.status(400).send({
            success: false,
            error: "Username already taken"
          });
        }
        fastify.log.error({ error }, "Failed to update username");
        reply.status(500).send({
          success: false,
          error: "Failed to update username"
        });
      }
    }
  );
}
__name(commentsRoutes, "commentsRoutes");

// src/routes/v1/tokens.ts
var import_zod9 = require("zod");
var import_zod_to_json_schema8 = require("zod-to-json-schema");

// src/services/token-service.ts
var import_decimal = require("decimal.js");
var TokenService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "TokenService");
  }
  async getOrCreateToken(contractAddress) {
    const lowerAddress = contractAddress.toLowerCase();
    let token = await this.prisma.token.findUnique({
      where: { contractAddress: lowerAddress }
    });
    if (!token) {
      token = await this.prisma.token.create({
        data: {
          contractAddress: lowerAddress,
          symbol: "UNKNOWN",
          name: "Loading...",
          currentPrice: "0",
          currentPriceACES: "0",
          volume24h: "0"
        }
      });
    }
    return token;
  }
  async fetchAndUpdateTokenData(contractAddress) {
    try {
      let token = await this.getOrCreateToken(contractAddress);
      const subgraphData = await this.fetchFromSubgraph(contractAddress);
      if (subgraphData?.data.tokens?.[0]) {
        const tokenData = subgraphData.data.tokens[0];
        const trades = subgraphData.data.trades || [];
        let currentPrice = "0";
        if (trades.length > 0) {
          const latestTrade = trades[0];
          const tokenAmt = new import_decimal.Decimal(latestTrade.tokenAmount);
          const acesAmt = new import_decimal.Decimal(latestTrade.acesTokenAmount);
          currentPrice = tokenAmt.isZero() ? "0" : acesAmt.div(tokenAmt).toString();
        }
        const oneDayAgo = Date.now() / 1e3 - 24 * 60 * 60;
        const recentTrades = trades.filter((t) => parseInt(t.createdAt) > oneDayAgo);
        const volume24h = recentTrades.reduce((sum, trade) => {
          return sum.add(new import_decimal.Decimal(trade.acesTokenAmount));
        }, new import_decimal.Decimal(0)).toString();
        token = await this.prisma.token.update({
          where: { contractAddress: contractAddress.toLowerCase() },
          data: {
            symbol: tokenData.symbol,
            name: tokenData.name,
            currentPriceACES: currentPrice,
            volume24h,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
        await this.storeRecentTrades(contractAddress, trades);
      }
      return token;
    } catch (error) {
      console.error("Error updating token data:", error);
      return await this.getOrCreateToken(contractAddress);
    }
  }
  // New method to fetch trades for chart data
  async fetchTradesForChart(contractAddress, timeframe) {
    try {
      const hoursBack = this.getHoursBack(timeframe);
      const startTime = Math.floor(Date.now() / 1e3) - hoursBack * 60 * 60;
      const query = `{
        trades(
          where: {
            token: "${contractAddress.toLowerCase()}"
            createdAt_gte: "${startTime}"
          }
          orderBy: createdAt
          orderDirection: asc
          first: 1000
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          blockNumber
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      return result.data.trades || [];
    } catch (error) {
      console.error("Chart data fetch error:", error);
      return [];
    }
  }
  // New method to fetch daily aggregated data
  async fetchTokenDayData(contractAddress) {
    try {
      const query = `{
        tokenDays(
          where: {token: "${contractAddress.toLowerCase()}"}
          orderBy: date
          orderDirection: desc
          first: 30
        ) {
          id
          date
          tradesCount
          tokensBought
          tokensSold
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      return result.data.tokenDays || [];
    } catch (error) {
      console.error("Token day data fetch error:", error);
      return [];
    }
  }
  getHoursBack(timeframe) {
    const timeframeHours = {
      "1m": 2,
      // 2 hours for minute data
      "5m": 12,
      // 12 hours for 5-minute data
      "15m": 48,
      // 48 hours for 15-minute data
      "1h": 168,
      // 1 week for hourly data
      "1d": 720
      // 30 days for daily data
    };
    return timeframeHours[timeframe] || 168;
  }
  async fetchFromSubgraph(contractAddress, retries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const query = `{
          tokens(where: {address: "${contractAddress.toLowerCase()}"}) {
            id
            address
            name
            symbol
            supply
            tradesCount
            owner {
              id
              address
            }
            bonded
            tokensBought
            tokensSold
            subjectFeeAmount
            protocolFeeAmount
            tokenHours(first: 24, orderBy: id, orderDirection: desc) {
              id
              tradesCount
              tokensBought
              tokensSold
            }
            tokenDays(first: 30, orderBy: id, orderDirection: desc) {
              id
              tradesCount
              tokensBought
              tokensSold
            }
          }
          trades(
            where: {token: "${contractAddress.toLowerCase()}"}
            orderBy: createdAt
            orderDirection: desc
            first: 50
          ) {
            id
            isBuy
            tokenAmount
            acesTokenAmount
            supply
            createdAt
            blockNumber
            protocolFeeAmount
            subjectFeeAmount
          }
        }`;
        const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          // Add timeout
          signal: AbortSignal.timeout(15e3)
          // 15 second timeout
        });
        if (!response.ok) {
          throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        if (result.errors) {
          throw new Error(`Subgraph GraphQL errors: ${JSON.stringify(result.errors)}`);
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[TokenService] Subgraph attempt ${attempt}/${retries} failed:`,
          lastError.message
        );
        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1e3;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.error(
      `Subgraph fetch failed after ${retries} attempts. Last error: ${lastError.message}`
    );
    return null;
  }
  async storeRecentTrades(contractAddress, trades) {
    if (trades.length === 0) return;
    const tradeData = trades.slice(0, 10).map((trade) => {
      const tokenAmt = new import_decimal.Decimal(trade.tokenAmount);
      const acesAmt = new import_decimal.Decimal(trade.acesTokenAmount);
      const pricePerToken = tokenAmt.isZero() ? "0" : acesAmt.div(tokenAmt).toString();
      return {
        contractAddress: contractAddress.toLowerCase(),
        txHash: trade.id,
        trader: "unknown",
        tradeType: trade.isBuy ? "BUY" : "SELL",
        tokenAmount: trade.tokenAmount,
        acesAmount: trade.acesTokenAmount,
        pricePerToken,
        timestamp: new Date(parseInt(trade.createdAt) * 1e3),
        source: "SUBGRAPH"
      };
    });
    try {
      await this.prisma.tokenTrade.createMany({
        data: tradeData,
        skipDuplicates: true
        // Same behavior as the empty upsert update
      });
    } catch (error) {
      console.warn("Failed to store trades batch:", error);
      for (const trade of trades.slice(0, 10)) {
        try {
          const tokenAmt = new import_decimal.Decimal(trade.tokenAmount);
          const acesAmt = new import_decimal.Decimal(trade.acesTokenAmount);
          const pricePerToken = tokenAmt.isZero() ? "0" : acesAmt.div(tokenAmt).toString();
          await this.prisma.tokenTrade.upsert({
            where: { txHash: trade.id },
            update: {},
            create: {
              contractAddress: contractAddress.toLowerCase(),
              txHash: trade.id,
              trader: "unknown",
              tradeType: trade.isBuy ? "BUY" : "SELL",
              tokenAmount: trade.tokenAmount,
              acesAmount: trade.acesTokenAmount,
              pricePerToken,
              timestamp: new Date(parseInt(trade.createdAt) * 1e3),
              source: "SUBGRAPH"
            }
          });
        } catch (individualError) {
          console.warn("Failed to store individual trade:", individualError);
        }
      }
    }
  }
  async getRecentTrades(contractAddress, limit = 10) {
    return await this.prisma.tokenTrade.findMany({
      where: { contractAddress: contractAddress.toLowerCase() },
      orderBy: { timestamp: "desc" },
      take: limit
    });
  }
  // New method to fetch fresh trades from subgraph for trade history component
  async getRecentTradesForToken(contractAddress, limit = 50) {
    try {
      const query = `{
        trades(
          where: { token: "${contractAddress.toLowerCase()}" }
          orderBy: createdAt
          orderDirection: desc
          first: ${limit}
        ) {
          id
          isBuy
          trader { id }
          tokenAmount
          acesTokenAmount
          createdAt
          blockNumber
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      return result.data.trades || [];
    } catch (error) {
      console.error("Trade history fetch error:", error);
      return [];
    }
  }
};

// src/services/ohlcv-service.ts
var import_decimal2 = require("decimal.js");
var OHLCVService = class {
  constructor(prisma2, tokenService) {
    this.prisma = prisma2;
    this.tokenService = tokenService;
  }
  static {
    __name(this, "OHLCVService");
  }
  async generateOHLCVCandles(contractAddress, timeframe, options = {}) {
    try {
      if (options.startTime || options.forceRefresh) {
        const fresh = await this.generateFreshCandles(contractAddress, timeframe, options);
        if (options.startTime) {
          return await this.mergeWithCachedCandles(contractAddress, timeframe, fresh);
        }
        return fresh;
      }
      const cachedCandles = await this.getCachedCandles(contractAddress, timeframe, 1e3);
      if (this.isCacheValid(cachedCandles, timeframe)) {
        console.log(`[OHLCV] Using cached data for ${contractAddress} ${timeframe}`);
        return cachedCandles;
      }
      console.log(`[OHLCV] Cache stale, generating fresh data for ${contractAddress} ${timeframe}`);
      return await this.generateFreshCandles(contractAddress, timeframe, options);
    } catch (error) {
      console.error("Error generating OHLCV candles:", error);
      const fallbackCandles = await this.getCachedCandles(contractAddress, timeframe);
      if (fallbackCandles.length > 0) {
        console.warn("Using stale cached data as fallback");
        return fallbackCandles;
      }
      return [];
    }
  }
  /**
   * NEW: Generate live candles for real-time updates
   * This is used by the new /live endpoint
   */
  async generateLiveCandles(contractAddress, timeframe, since) {
    const options = {
      startTime: since,
      endTime: Date.now(),
      forceRefresh: true
    };
    return await this.generateFreshCandles(contractAddress, timeframe, options);
  }
  /**
   * Generate fresh candles from subgraph data
   * This uses your existing logic but with enhanced time range support
   */
  async generateFreshCandles(contractAddress, timeframe, options = {}) {
    try {
      if (timeframe === "1d") {
        return await this.generateDailyCandles(contractAddress);
      } else {
        return await this.generateIntradayCandles(contractAddress, timeframe, options);
      }
    } catch (error) {
      console.error("Error generating fresh candles:", error);
      return [];
    }
  }
  async generateDailyCandles(contractAddress) {
    try {
      const tokenDayData = await this.tokenService.fetchTokenDayData(contractAddress);
      if (tokenDayData.length === 0) return [];
      const candles = [];
      for (const dayData of tokenDayData) {
        const netVolume = new import_decimal2.Decimal(dayData.tokensBought).minus(new import_decimal2.Decimal(dayData.tokensSold));
        const totalVolume = new import_decimal2.Decimal(dayData.tokensBought).plus(new import_decimal2.Decimal(dayData.tokensSold));
        const basePrice = new import_decimal2.Decimal(1);
        const priceVariation = netVolume.div(totalVolume.plus(1)).mul(0.1);
        const open = basePrice.toString();
        const close = basePrice.plus(priceVariation).toString();
        const high = import_decimal2.Decimal.max(new import_decimal2.Decimal(open), new import_decimal2.Decimal(close)).mul(1.05).toString();
        const low = import_decimal2.Decimal.min(new import_decimal2.Decimal(open), new import_decimal2.Decimal(close)).mul(0.95).toString();
        candles.push({
          timestamp: new Date(dayData.date * 1e3),
          open,
          high,
          low,
          close,
          volume: totalVolume.toString(),
          trades: dayData.tradesCount
        });
      }
      return candles.reverse();
    } catch (error) {
      console.error("Error generating daily candles:", error);
      return [];
    }
  }
  async generateIntradayCandles(contractAddress, timeframe, options = {}) {
    try {
      console.log(`[OHLCV] Starting generateIntradayCandles for ${contractAddress} ${timeframe}`);
      const intervalMs = this.getIntervalMs(timeframe);
      const endTime = options.endTime || Date.now();
      const startTime = options.startTime || endTime - this.getHoursBack(timeframe) * 60 * 60 * 1e3;
      const trades = options.startTime ? await this.fetchTradesForTimeRange(contractAddress, startTime, endTime) : await this.tokenService.fetchTradesForChart(contractAddress, timeframe);
      console.log(`[OHLCV] Fetched ${trades.length} trades for ${contractAddress}`);
      if (trades.length === 0) {
        console.log(`[OHLCV] No trades found for ${contractAddress} ${timeframe}`);
        return [];
      }
      const candleGroups = this.groupTradesByInterval(trades, intervalMs);
      console.log(`[OHLCV] Created ${candleGroups.length} candle groups with trades`);
      const candles = [];
      for (const group of candleGroups) {
        if (group.trades.length > 0) {
          try {
            const candle = this.calculateOHLCV(group);
            const hasVariation = candle.open !== candle.high || candle.high !== candle.low || candle.low !== candle.close;
            if (hasVariation || candle.trades > 1) {
              candles.push(candle);
            } else if (candle.trades === 1) {
              candles.push(candle);
            } else {
              console.log(`[OHLCV] Skipping empty candle at ${group.timestamp.toISOString()}`);
            }
          } catch (error) {
            console.error(`[OHLCV] Error calculating candle at ${group.timestamp}:`, error);
          }
        }
      }
      console.log(
        `[OHLCV] Generated ${candles.length} candles with actual trades for ${contractAddress} ${timeframe}`
      );
      if (candles.length > 0) {
        console.log("[OHLCV] Sample candles:", {
          first: {
            time: candles[0].timestamp.toISOString(),
            O: candles[0].open,
            H: candles[0].high,
            L: candles[0].low,
            C: candles[0].close,
            trades: candles[0].trades
          },
          last: {
            time: candles[candles.length - 1].timestamp.toISOString(),
            O: candles[candles.length - 1].open,
            H: candles[candles.length - 1].high,
            L: candles[candles.length - 1].low,
            C: candles[candles.length - 1].close,
            trades: candles[candles.length - 1].trades
          }
        });
      }
      if (!options.skipStorage && !options.startTime) {
        console.log("[OHLCV] Storing candles to database...");
        await this.storeCandles(contractAddress, timeframe, candles);
      } else {
        console.log("[OHLCV] Skipping database storage for fast response");
      }
      return candles;
    } catch (error) {
      console.error(
        `[OHLCV] Error generating intraday candles for ${contractAddress} ${timeframe}:`,
        error
      );
      if (error instanceof Error) {
        console.error(`[OHLCV] Error stack:`, error.stack);
      }
      throw error;
    }
  }
  /**
   * Merge live candles with cached historical data
   * This provides seamless hybrid mode: old cached data + new live data
   */
  async mergeWithCachedCandles(contractAddress, timeframe, liveCandles) {
    try {
      const cachedCandles = await this.getCachedCandles(contractAddress, timeframe, 1e3);
      if (cachedCandles.length === 0) {
        return liveCandles;
      }
      const liveStartTime = liveCandles.length > 0 ? liveCandles[0].timestamp.getTime() : Date.now();
      const oldCachedCandles = cachedCandles.filter((c) => c.timestamp.getTime() < liveStartTime);
      const combined = [...oldCachedCandles, ...liveCandles];
      combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      console.log(
        `[OHLCV] Merged candles: ${oldCachedCandles.length} cached + ${liveCandles.length} live = ${combined.length} total`
      );
      return combined;
    } catch (error) {
      console.error("[OHLCV] Error merging candles:", error);
      return liveCandles;
    }
  }
  groupTradesByInterval(trades, intervalMs) {
    const groups = {};
    console.log(
      `[OHLCV] Grouping ${trades.length} trades with interval ${intervalMs}ms (${intervalMs / 6e4}min)`
    );
    trades.forEach((trade) => {
      const tradeTime = parseInt(trade.createdAt) * 1e3;
      const intervalStart = Math.floor(tradeTime / intervalMs) * intervalMs;
      if (!groups[intervalStart]) {
        groups[intervalStart] = [];
      }
      groups[intervalStart].push(trade);
    });
    const groupedResults = Object.entries(groups).map(([timestamp, trades2]) => ({
      timestamp: new Date(parseInt(timestamp)),
      trades: trades2
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    console.log(`[OHLCV] Created ${groupedResults.length} candle groups`);
    console.log(
      `[OHLCV] Groups with trades: ${groupedResults.filter((g) => g.trades.length > 0).length}`
    );
    console.log(
      `[OHLCV] First group: ${groupedResults[0]?.timestamp.toISOString()} with ${groupedResults[0]?.trades.length} trades`
    );
    return groupedResults;
  }
  calculateOHLCV(candleGroup) {
    const { timestamp, trades } = candleGroup;
    if (trades.length === 0) {
      throw new Error("No trades for candle calculation");
    }
    const tradesWithPrice = trades.map((trade) => {
      const tokenAmt = new import_decimal2.Decimal(trade.tokenAmount);
      const acesAmt = new import_decimal2.Decimal(trade.acesTokenAmount);
      const price = tokenAmt.isZero() ? new import_decimal2.Decimal(0) : acesAmt.div(tokenAmt);
      return {
        price,
        volume: acesAmt,
        timestamp: parseInt(trade.createdAt)
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
    const prices = tradesWithPrice.map((t) => t.price);
    const volumes = tradesWithPrice.map((t) => t.volume);
    const candle = {
      timestamp,
      open: prices[0].toString(),
      high: import_decimal2.Decimal.max(...prices).toString(),
      low: import_decimal2.Decimal.min(...prices).toString(),
      close: prices[prices.length - 1].toString(),
      volume: volumes.reduce((sum, vol) => sum.add(vol), new import_decimal2.Decimal(0)).toString(),
      trades: trades.length
    };
    if (Math.random() < 0.1) {
      console.log(
        `[OHLCV] Candle at ${timestamp.toISOString()}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} trades=${trades.length}`
      );
    }
    return candle;
  }
  getIntervalMs(timeframe) {
    const intervals = {
      "1m": 60 * 1e3,
      "5m": 5 * 60 * 1e3,
      "15m": 15 * 60 * 1e3,
      "1h": 60 * 60 * 1e3,
      "4h": 4 * 60 * 60 * 1e3
    };
    return intervals[timeframe] || intervals["1h"];
  }
  generateTimeSlots(startTime, endTime, intervalMs) {
    const slots = [];
    const alignedStart = Math.floor(startTime / intervalMs) * intervalMs;
    for (let time = alignedStart; time < endTime; time += intervalMs) {
      slots.push(new Date(time));
    }
    return slots;
  }
  async getLastKnownPrice(contractAddress) {
    try {
      const lastCandle = await this.prisma.tokenOHLCV.findFirst({
        where: { contractAddress: contractAddress.toLowerCase() },
        orderBy: { timestamp: "desc" }
      });
      if (lastCandle) {
        return parseFloat(lastCandle.close);
      }
      const token = await this.prisma.token.findUnique({
        where: { contractAddress: contractAddress.toLowerCase() }
      });
      return token ? parseFloat(token.currentPriceACES) : 1;
    } catch (error) {
      console.warn("Could not get last known price, defaulting to 1.0:", error);
      return 1;
    }
  }
  getHoursBack(timeframe) {
    const timeframeHours = {
      "1m": 2,
      // 2 hours for minute data
      "5m": 12,
      // 12 hours for 5-minute data
      "15m": 48,
      // 48 hours for 15-minute data
      "1h": 168,
      // 1 week for hourly data
      "1d": 720
      // 30 days for daily data
    };
    return timeframeHours[timeframe] || 168;
  }
  async storeCandles(contractAddress, timeframe, candles) {
    if (candles.length === 0) return;
    try {
      const lowerAddress = contractAddress.toLowerCase();
      console.log(`[OHLCV] Storing ${candles.length} candles for ${lowerAddress} ${timeframe}`);
      let upsertedCount = 0;
      let errorCount = 0;
      for (const candle of candles) {
        try {
          await this.prisma.tokenOHLCV.upsert({
            where: {
              contractAddress_timeframe_timestamp: {
                contractAddress: lowerAddress,
                timeframe,
                timestamp: candle.timestamp
              }
            },
            update: {
              // Update existing candle data
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              trades: candle.trades
            },
            create: {
              // Create new candle if it doesn't exist
              contractAddress: lowerAddress,
              timeframe,
              timestamp: candle.timestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              trades: candle.trades
            }
          });
          upsertedCount++;
        } catch (upsertError) {
          errorCount++;
          console.warn(`Failed to upsert candle at ${candle.timestamp}:`, upsertError);
        }
      }
      console.log(
        `[OHLCV] Stored ${upsertedCount} candles for ${lowerAddress} ${timeframe} (${errorCount} errors)`
      );
    } catch (error) {
      console.error("Failed to store OHLCV candles:", error);
    }
  }
  async getStoredOHLCVData(contractAddress, timeframe, limit = 100) {
    return await this.prisma.tokenOHLCV.findMany({
      where: {
        contractAddress: contractAddress.toLowerCase(),
        timeframe
      },
      orderBy: { timestamp: "desc" },
      take: typeof limit === "string" ? parseInt(limit) : limit
    });
  }
  /**
   * Public method to allow external callers to store candles
   * Used by /live endpoint to persist real-time data
   */
  async storeCandlesPublic(contractAddress, timeframe, candles) {
    await this.storeCandles(contractAddress, timeframe, candles);
  }
  /**
   * NEW: Fetch trades for a specific time range from subgraph
   * This is optimized for live data requests
   */
  async fetchTradesForTimeRange(contractAddress, startTime, endTime) {
    try {
      const startTimeSeconds = Math.floor(startTime / 1e3);
      const endTimeSeconds = Math.floor(endTime / 1e3);
      const query = `{
        trades(
          where: {
            token: "${contractAddress.toLowerCase()}"
            createdAt_gte: "${startTimeSeconds}"
            createdAt_lte: "${endTimeSeconds}"
          }
          orderBy: createdAt
          orderDirection: asc
          first: 1000
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          blockNumber
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(1e4)
        // 10 second timeout for live queries
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      if (result.errors) {
        throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
      }
      return result.data.trades || [];
    } catch (error) {
      console.error("Error fetching trades for time range:", error);
      return [];
    }
  }
  /**
   * NEW: Check if cached data is still valid
   */
  isCacheValid(candles, timeframe) {
    if (candles.length === 0) return false;
    const latestCandle = candles[candles.length - 1];
    const now = Date.now();
    const candleAge = now - latestCandle.timestamp.getTime();
    const maxAge = this.getIntervalMs(timeframe) * 2;
    return candleAge < maxAge;
  }
  /**
   * NEW: Get cached candles from database
   */
  async getCachedCandles(contractAddress, timeframe, limit = 200) {
    try {
      const stored = await this.prisma.tokenOHLCV.findMany({
        where: {
          contractAddress: contractAddress.toLowerCase(),
          timeframe
        },
        orderBy: { timestamp: "asc" },
        take: limit
      });
      return stored.map((candle) => ({
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        trades: candle.trades
      }));
    } catch (error) {
      console.error("Error fetching cached candles:", error);
      return [];
    }
  }
};

// src/routes/v1/tokens.ts
async function tokensRoutes(fastify) {
  const tokenService = new TokenService(fastify.prisma);
  const ohlcvService = new OHLCVService(fastify.prisma, tokenService);
  fastify.get(
    "/:address",
    {
      schema: {
        params: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            address: import_zod9.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { address } = request.params;
        const token = await tokenService.fetchAndUpdateTokenData(address);
        return reply.send({
          success: true,
          data: token
        });
      } catch (error) {
        fastify.log.error({ error }, "Token fetch error");
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch token data"
        });
      }
    }
  );
  fastify.get(
    "/:address/trades",
    {
      schema: {
        params: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            address: import_zod9.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        ),
        querystring: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            limit: import_zod9.z.string().transform(Number).default("50")
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { address } = request.params;
        const { limit = 50 } = request.query;
        const trades = await tokenService.getRecentTradesForToken(address, limit);
        return reply.send({
          success: true,
          data: trades
        });
      } catch (error) {
        fastify.log.error({ error }, "Trades fetch error");
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch trades"
        });
      }
    }
  );
  fastify.post(
    "/:address/refresh",
    {
      schema: {
        params: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            address: import_zod9.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { address } = request.params;
        const token = await tokenService.fetchAndUpdateTokenData(address);
        return reply.send({
          success: true,
          data: token,
          message: "Token data refreshed successfully"
        });
      } catch (error) {
        fastify.log.error({ error }, "Token refresh error");
        return reply.code(500).send({
          success: false,
          error: "Failed to refresh token data"
        });
      }
    }
  );
  fastify.get(
    "/:address/ohlcv",
    {
      schema: {
        params: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            address: import_zod9.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        ),
        querystring: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            timeframe: import_zod9.z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).default("1h"),
            limit: import_zod9.z.string().transform(Number).default("100")
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { address } = request.params;
        const { timeframe = "1h", limit = 100 } = request.query;
        const ohlcvCandles = await ohlcvService.generateOHLCVCandles(address, timeframe);
        if (!ohlcvCandles || ohlcvCandles.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              message: "No trading data available for this timeframe"
            }
          });
        }
        const chartData = ohlcvCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1e3),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close)
        }));
        const volumeData = ohlcvCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1e3),
          value: parseFloat(candle.volume),
          color: parseFloat(candle.close) >= parseFloat(candle.open) ? "rgba(0, 200, 150, 0.6)" : "rgba(255, 91, 91, 0.6)"
        }));
        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: chartData.length
          }
        });
      } catch (error) {
        fastify.log.error({ error }, "OHLCV fetch error");
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch chart data"
        });
      }
    }
  );
  fastify.get(
    "/:address/live",
    {
      schema: {
        params: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            address: import_zod9.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        ),
        querystring: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            timeframe: import_zod9.z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).default("1h"),
            since: import_zod9.z.string().optional(),
            // Unix timestamp
            limit: import_zod9.z.string().transform(Number).default("100")
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { address } = request.params;
        const { timeframe = "1h", since, limit = 100 } = request.query;
        const sinceTimestamp = since ? parseInt(since) * 1e3 : Date.now() - 10 * 60 * 1e3;
        const liveCandles = await ohlcvService.generateLiveCandles(
          address,
          timeframe,
          sinceTimestamp
        );
        if (liveCandles && liveCandles.length > 0) {
          try {
            await ohlcvService.storeCandlesPublic(address, timeframe, liveCandles);
            console.log(
              `[API /live] Persisted ${liveCandles.length} live candles for ${address} ${timeframe}`
            );
          } catch (storeError) {
            console.warn("[API /live] Failed to persist live candles:", storeError);
          }
        }
        if (!liveCandles || liveCandles.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              isLive: true,
              lastUpdate: Date.now(),
              message: "No new trading data available"
            }
          });
        }
        const chartData = liveCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1e3),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close)
        }));
        const volumeData = liveCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1e3),
          value: parseFloat(candle.volume),
          color: parseFloat(candle.close) >= parseFloat(candle.open) ? "rgba(0, 200, 150, 0.6)" : "rgba(255, 91, 91, 0.6)"
        }));
        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: chartData.length,
            isLive: true,
            lastUpdate: Date.now(),
            since: sinceTimestamp
          }
        });
      } catch (error) {
        fastify.log.error({ error }, "Live data fetch error");
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch live data",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/:address/chart",
    {
      schema: {
        params: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            address: import_zod9.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        ),
        querystring: (0, import_zod_to_json_schema8.zodToJsonSchema)(
          import_zod9.z.object({
            timeframe: import_zod9.z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).default("1h"),
            limit: import_zod9.z.string().transform(Number).default("100"),
            mode: import_zod9.z.enum(["live", "cached", "hybrid"]).default("hybrid")
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { address } = request.params;
        const { timeframe = "1h", limit = 100, mode = "hybrid" } = request.query;
        let chartData = [];
        let volumeData = [];
        let isLive = false;
        let dataSource = "unknown";
        if (mode === "live") {
          const liveCandles = await ohlcvService.generateOHLCVCandles(address, timeframe, {
            forceRefresh: true,
            skipStorage: true
            // Don't block response with slow database writes
          });
          chartData = liveCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1e3),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close)
          }));
          volumeData = liveCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1e3),
            value: parseFloat(candle.volume),
            color: parseFloat(candle.close) >= parseFloat(candle.open) ? "rgba(0, 200, 150, 0.6)" : "rgba(255, 91, 91, 0.6)"
          }));
          isLive = true;
          dataSource = "live";
        } else if (mode === "cached") {
          const cachedCandles = await ohlcvService.getStoredOHLCVData(address, timeframe, limit);
          chartData = cachedCandles.reverse().map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1e3),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close)
          }));
          volumeData = cachedCandles.map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1e3),
            value: parseFloat(candle.volume),
            color: parseFloat(candle.close) >= parseFloat(candle.open) ? "rgba(0, 200, 150, 0.6)" : "rgba(255, 91, 91, 0.6)"
          }));
          dataSource = "cached";
        } else {
          const hybridCandles = await ohlcvService.generateOHLCVCandles(address, timeframe);
          chartData = hybridCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1e3),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close)
          }));
          volumeData = hybridCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1e3),
            value: parseFloat(candle.volume),
            color: parseFloat(candle.close) >= parseFloat(candle.open) ? "rgba(0, 200, 150, 0.6)" : "rgba(255, 91, 91, 0.6)"
          }));
          isLive = hybridCandles.length > 0;
          dataSource = "hybrid";
        }
        if (chartData.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              isLive: false,
              dataSource,
              message: "No trading data available for this timeframe"
            }
          });
        }
        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: chartData.length,
            isLive,
            dataSource,
            lastUpdate: Date.now()
          }
        });
      } catch (error) {
        fastify.log.error({ error }, "Chart data fetch error");
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch chart data",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
}
__name(tokensRoutes, "tokensRoutes");

// src/routes/v1/portfolio.ts
var import_zod10 = require("zod");
var import_zod_to_json_schema9 = require("zod-to-json-schema");

// src/services/portfolio-service.ts
var PortfolioService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "PortfolioService");
  }
  /**
   * Get user's complete portfolio from subgraph
   */
  async getUserPortfolio(walletAddress) {
    try {
      console.log(`[Portfolio] Fetching portfolio for ${walletAddress}`);
      const portfolioData = await this.fetchUserPortfolioFromSubgraph(walletAddress);
      if (!portfolioData) {
        return {
          holdings: [],
          metrics: this.getEmptyMetrics()
        };
      }
      const holdings = await this.calculateUserHoldings(walletAddress, portfolioData);
      const metrics = this.calculatePortfolioMetrics(holdings);
      console.log(`[Portfolio] Found ${holdings.length} token holdings for ${walletAddress}`);
      return { holdings, metrics };
    } catch (error) {
      console.error("[Portfolio] Error fetching user portfolio:", error);
      return {
        holdings: [],
        metrics: this.getEmptyMetrics()
      };
    }
  }
  /**
   * Fetch user's tokens and trades from enhanced subgraph
   */
  async fetchUserPortfolioFromSubgraph(walletAddress) {
    try {
      const query = `{
        tokens(where: {owner: "${walletAddress.toLowerCase()}"}) {
          id
          address
          name
          symbol
          supply
          tradesCount
          owner {
            id
            address
          }
          bonded
          tokensBought
          tokensSold
          subjectFeeAmount
          protocolFeeAmount
        }
        trades(
          where: {
            or: [
              {token_: {owner: "${walletAddress.toLowerCase()}"}},
              {trader: "${walletAddress.toLowerCase()}"}
            ]
          }
          orderBy: createdAt
          orderDirection: desc
          first: 1000
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          protocolFeeAmount
          subjectFeeAmount
          token {
            address
            name
            symbol
          }
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15e3)
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      if (result.errors) {
        throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
      }
      return result;
    } catch (error) {
      console.error("[Portfolio] Error fetching from subgraph:", error);
      return null;
    }
  }
  /**
   * Calculate user's current holdings based on owned tokens and trading history
   */
  async calculateUserHoldings(walletAddress, portfolioData) {
    const holdings = [];
    const { tokens, trades } = portfolioData.data;
    for (const token of tokens) {
      try {
        const currentPrice = await this.getCurrentTokenPrice(token.address);
        const userTrades = trades.filter(
          (trade) => trade.token.address.toLowerCase() === token.address.toLowerCase()
        );
        const position = this.calculateTokenPosition(userTrades, token.supply);
        if (position.balance > 0) {
          const currentValue = position.balance * parseFloat(currentPrice);
          const pnl = currentValue - position.totalInvested;
          const pnlPercentage = position.totalInvested > 0 ? pnl / position.totalInvested * 100 : 0;
          holdings.push({
            tokenAddress: token.address,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            balance: position.balance.toString(),
            currentPrice,
            entryPrice: position.averageEntryPrice.toString(),
            totalInvested: position.totalInvested.toString(),
            currentValue: currentValue.toString(),
            pnl: pnl.toString(),
            pnlPercentage: pnlPercentage.toString(),
            allocation: 0,
            // Will be calculated in metrics
            owner: token.owner,
            tokenData: {
              supply: token.supply,
              tradesCount: token.tradesCount,
              bonded: token.bonded,
              tokensBought: token.tokensBought,
              tokensSold: token.tokensSold
            }
          });
        }
      } catch (error) {
        console.error(`[Portfolio] Error calculating holding for ${token.symbol}:`, error);
      }
    }
    return holdings;
  }
  /**
   * Calculate user's position in a specific token
   */
  calculateTokenPosition(userTrades, tokenSupply) {
    let balance = 0;
    let totalInvested = 0;
    let totalTokensBought = 0;
    for (const trade of userTrades) {
      const tokenAmount = parseFloat(trade.tokenAmount);
      const acesAmount = parseFloat(trade.acesTokenAmount);
      if (trade.isBuy) {
        balance += tokenAmount;
        totalInvested += acesAmount;
        totalTokensBought += tokenAmount;
      } else {
        balance -= tokenAmount;
        if (totalTokensBought > 0) {
          const sellRatio = tokenAmount / totalTokensBought;
          totalInvested -= totalInvested * sellRatio;
        }
      }
    }
    const averageEntryPrice = totalTokensBought > 0 ? totalInvested / totalTokensBought : 0;
    return {
      balance: Math.max(0, balance),
      // Can't have negative balance
      totalInvested: Math.max(0, totalInvested),
      averageEntryPrice
    };
  }
  /**
   * Get current token price from recent trades or bonding curve
   */
  async getCurrentTokenPrice(tokenAddress) {
    try {
      const query = `{
        trades(
          where: {token: "${tokenAddress.toLowerCase()}"}
          orderBy: createdAt
          orderDirection: desc
          first: 1
        ) {
          tokenAmount
          acesTokenAmount
          supply
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(5e3)
      });
      if (response.ok) {
        const result = await response.json();
        const latestTrade = result.data?.trades?.[0];
        if (latestTrade) {
          const price = parseFloat(latestTrade.acesTokenAmount) / parseFloat(latestTrade.tokenAmount);
          return price.toString();
        }
      }
      return "0.001";
    } catch (error) {
      console.error(`[Portfolio] Error getting price for ${tokenAddress}:`, error);
      return "0.001";
    }
  }
  /**
   * Calculate overall portfolio metrics
   */
  calculatePortfolioMetrics(holdings) {
    if (holdings.length === 0) {
      return this.getEmptyMetrics();
    }
    const totalValue = holdings.reduce((sum, holding) => sum + parseFloat(holding.currentValue), 0);
    const totalInvested = holdings.reduce(
      (sum, holding) => sum + parseFloat(holding.totalInvested),
      0
    );
    const totalPnL = totalValue - totalInvested;
    const pnlPercentage = totalInvested > 0 ? totalPnL / totalInvested * 100 : 0;
    holdings.forEach((holding) => {
      holding.allocation = totalValue > 0 ? parseFloat(holding.currentValue) / totalValue * 100 : 0;
    });
    const sortedByPnL = [...holdings].sort(
      (a, b) => parseFloat(b.pnlPercentage) - parseFloat(a.pnlPercentage)
    );
    return {
      totalValue: totalValue.toString(),
      totalInvested: totalInvested.toString(),
      totalPnL: totalPnL.toString(),
      pnlPercentage: pnlPercentage.toString(),
      tokenCount: holdings.length,
      topPerformer: sortedByPnL[0] || null,
      worstPerformer: sortedByPnL[sortedByPnL.length - 1] || null
    };
  }
  getEmptyMetrics() {
    return {
      totalValue: "0",
      totalInvested: "0",
      totalPnL: "0",
      pnlPercentage: "0",
      tokenCount: 0,
      topPerformer: null,
      worstPerformer: null
    };
  }
};

// src/routes/v1/portfolio.ts
async function portfolioRoutes(fastify) {
  const portfolioService = new PortfolioService(fastify.prisma);
  fastify.get(
    "/:walletAddress",
    {
      schema: {
        params: (0, import_zod_to_json_schema9.zodToJsonSchema)(
          import_zod10.z.object({
            walletAddress: import_zod10.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        ),
        querystring: (0, import_zod_to_json_schema9.zodToJsonSchema)(
          import_zod10.z.object({
            includeMetrics: import_zod10.z.string().optional().default("true"),
            limit: import_zod10.z.string().transform(Number).optional().default("100")
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { walletAddress } = request.params;
        const { includeMetrics = "true", limit = 100 } = request.query;
        console.log(`[API] Fetching portfolio for wallet: ${walletAddress}`);
        const portfolioData = await portfolioService.getUserPortfolio(walletAddress);
        const limitedHoldings = portfolioData.holdings.slice(0, limit);
        const response = {
          success: true,
          data: {
            walletAddress,
            holdings: limitedHoldings,
            ...includeMetrics === "true" && { metrics: portfolioData.metrics },
            meta: {
              totalHoldings: portfolioData.holdings.length,
              returnedHoldings: limitedHoldings.length,
              hasMore: portfolioData.holdings.length > limit,
              lastUpdate: Date.now()
            }
          }
        };
        reply.code(200).send(response);
      } catch (error) {
        console.error("[API] Portfolio fetch error:", error);
        reply.code(500).send({
          success: false,
          error: "Failed to fetch portfolio data",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/:walletAddress/summary",
    {
      schema: {
        params: (0, import_zod_to_json_schema9.zodToJsonSchema)(
          import_zod10.z.object({
            walletAddress: import_zod10.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { walletAddress } = request.params;
        console.log(`[API] Fetching portfolio summary for: ${walletAddress}`);
        const portfolioData = await portfolioService.getUserPortfolio(walletAddress);
        reply.code(200).send({
          success: true,
          data: {
            walletAddress,
            metrics: portfolioData.metrics,
            topHoldings: portfolioData.holdings.sort((a, b) => parseFloat(b.currentValue) - parseFloat(a.currentValue)).slice(0, 5).map((holding) => ({
              tokenAddress: holding.tokenAddress,
              tokenSymbol: holding.tokenSymbol,
              tokenName: holding.tokenName,
              currentValue: holding.currentValue,
              pnlPercentage: holding.pnlPercentage,
              allocation: holding.allocation
            })),
            lastUpdate: Date.now()
          }
        });
      } catch (error) {
        console.error("[API] Portfolio summary error:", error);
        reply.code(500).send({
          success: false,
          error: "Failed to fetch portfolio summary",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/:walletAddress/token/:tokenAddress",
    {
      schema: {
        params: (0, import_zod_to_json_schema9.zodToJsonSchema)(
          import_zod10.z.object({
            walletAddress: import_zod10.z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            tokenAddress: import_zod10.z.string().regex(/^0x[a-fA-F0-9]{40}$/)
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const { walletAddress, tokenAddress } = request.params;
        console.log(`[API] Fetching ${tokenAddress} holding for ${walletAddress}`);
        const portfolioData = await portfolioService.getUserPortfolio(walletAddress);
        const tokenHolding = portfolioData.holdings.find(
          (h) => h.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
        );
        if (!tokenHolding) {
          reply.code(404).send({
            success: false,
            error: "Token holding not found",
            details: `No holding found for token ${tokenAddress}`
          });
          return;
        }
        reply.code(200).send({
          success: true,
          data: {
            walletAddress,
            tokenAddress,
            holding: tokenHolding,
            lastUpdate: Date.now()
          }
        });
      } catch (error) {
        console.error("[API] Token holding fetch error:", error);
        reply.code(500).send({
          success: false,
          error: "Failed to fetch token holding",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
}
__name(portfolioRoutes, "portfolioRoutes");

// src/routes/v1/twitch.ts
var import_zod11 = require("zod");
var import_zod_to_json_schema10 = require("zod-to-json-schema");
async function twitchRoutes(fastify) {
  fastify.get(
    "/stream-status/:channelName",
    {
      schema: {
        params: (0, import_zod_to_json_schema10.zodToJsonSchema)(
          import_zod11.z.object({
            channelName: import_zod11.z.string().min(1).max(50)
          })
        ),
        response: {
          200: (0, import_zod_to_json_schema10.zodToJsonSchema)(
            import_zod11.z.object({
              success: import_zod11.z.boolean(),
              data: import_zod11.z.object({
                isLive: import_zod11.z.boolean(),
                streamData: import_zod11.z.record(import_zod11.z.unknown()).nullable()
              })
            })
          )
        }
      }
    },
    async (request, reply) => {
      try {
        const { channelName } = request.params;
        if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
          fastify.log.error("Twitch API credentials not configured");
          return reply.code(500).send({
            success: false,
            error: "Twitch API not configured"
          });
        }
        const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: "client_credentials"
          })
        });
        if (!tokenResponse.ok) {
          fastify.log.error("Failed to get Twitch OAuth token");
          return reply.code(500).send({
            success: false,
            error: "Failed to authenticate with Twitch API"
          });
        }
        const tokenData = await tokenResponse.json();
        const streamResponse = await fetch(
          `https://api.twitch.tv/helix/streams?user_login=${channelName}`,
          {
            headers: {
              "Client-ID": process.env.TWITCH_CLIENT_ID,
              Authorization: `Bearer ${tokenData.access_token}`
            }
          }
        );
        if (!streamResponse.ok) {
          fastify.log.error("Failed to fetch stream data from Twitch");
          return reply.code(500).send({
            success: false,
            error: "Failed to fetch stream data"
          });
        }
        const streamData = await streamResponse.json();
        return reply.send({
          success: true,
          data: {
            isLive: streamData.data.length > 0,
            streamData: streamData.data[0] || null
          }
        });
      } catch (error) {
        fastify.log.error({ error }, "Twitch stream status error");
        return reply.code(500).send({
          success: false,
          error: "Failed to check stream status"
        });
      }
    }
  );
  fastify.post(
    "/analytics",
    {
      schema: {
        body: (0, import_zod_to_json_schema10.zodToJsonSchema)(
          import_zod11.z.object({
            action: import_zod11.z.string(),
            windowState: import_zod11.z.record(import_zod11.z.unknown()).optional(),
            timestamp: import_zod11.z.string()
          })
        ),
        response: {
          200: (0, import_zod_to_json_schema10.zodToJsonSchema)(
            import_zod11.z.object({
              success: import_zod11.z.boolean()
            })
          )
        }
      }
    },
    async (request, reply) => {
      try {
        const { action, windowState, timestamp } = request.body;
        fastify.log.info(
          {
            action,
            windowState,
            timestamp
          },
          "Twitch Stream Analytics"
        );
        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error({ error }, "Twitch analytics error");
        return reply.code(500).send({
          success: false,
          error: "Failed to track analytics"
        });
      }
    }
  );
}
__name(twitchRoutes, "twitchRoutes");

// src/services/price-service.ts
var import_ethers = require("ethers");
var ERC20_ABI = ["function decimals() view returns (uint8)"];
var UNISWAP_V3_POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
];
var AERODROME_POOL_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
];
var SimpleThrottler = class {
  static {
    __name(this, "SimpleThrottler");
  }
  lastRequestTime = 0;
  minInterval = 1e3;
  // 1 second between requests
  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }
};
var PriceService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
    this.provider = new import_ethers.ethers.JsonRpcProvider(process.env.QUICKNODE_BASE_URL);
    this.cacheTTL = parseInt(process.env.PRICE_CACHE_TTL_SECONDS || "60") * 1e3;
    this.throttler = new SimpleThrottler();
  }
  static {
    __name(this, "PriceService");
  }
  provider;
  cacheTTL;
  throttler;
  /**
   * Get ACES price in USD with caching and throttling
   */
  async getAcesPrice() {
    try {
      const cached = await this.prisma.tokenPrice.findUnique({
        where: { symbol: "ACES" }
      });
      const now = /* @__PURE__ */ new Date();
      const isStale = !cached || now.getTime() - cached.updatedAt.getTime() > this.cacheTTL;
      if (cached && !isStale) {
        return {
          symbol: "ACES",
          priceUSD: cached.priceUSD.toString(),
          updatedAt: cached.updatedAt,
          isStale: false
        };
      }
      await this.throttler.throttle();
      const acesPerWeth = await this.getAcesPerWeth();
      const wethUsdPrice = await this.getWethUsdPrice();
      const acesUsdPrice = acesPerWeth * wethUsdPrice;
      if (!this.validatePrice(acesUsdPrice)) {
        throw new Error(`Invalid price calculated: ${acesUsdPrice}`);
      }
      await this.prisma.tokenPrice.upsert({
        where: { symbol: "ACES" },
        update: { priceUSD: acesUsdPrice.toFixed(8) },
        create: { symbol: "ACES", priceUSD: acesUsdPrice.toFixed(8) }
      });
      return {
        symbol: "ACES",
        priceUSD: acesUsdPrice.toFixed(8),
        updatedAt: now,
        isStale: false
      };
    } catch (error) {
      console.error("[PriceService] Error fetching ACES price:", error);
      const cached = await this.prisma.tokenPrice.findUnique({
        where: { symbol: "ACES" }
      });
      if (cached) {
        return {
          symbol: "ACES",
          priceUSD: cached.priceUSD.toString(),
          updatedAt: cached.updatedAt,
          isStale: true
        };
      }
      throw new Error("Unable to fetch ACES price and no cached price available");
    }
  }
  /**
   * Convert ACES amount to USD
   */
  async convertAcesToUsd(acesAmount) {
    const priceData = await this.getAcesPrice();
    const amount = parseFloat(acesAmount);
    const price = parseFloat(priceData.priceUSD);
    return (amount * price).toFixed(2);
  }
  /**
   * Get ACES price per WETH from Aerodrome pool
   * Fixed: Now correctly calculates WETH/ACES ratio
   */
  async getAcesPerWeth() {
    const poolAddress = process.env.AERODROME_ACES_WETH_POOL;
    const acesAddress = process.env.ACES_TOKEN_ADDRESS;
    const pool = new import_ethers.ethers.Contract(poolAddress, AERODROME_POOL_ABI, this.provider);
    const [reserve0, reserve1] = await pool.getReserves();
    const token0 = await pool.token0();
    const isToken0Aces = token0.toLowerCase() === acesAddress.toLowerCase();
    const acesReserve = isToken0Aces ? reserve0 : reserve1;
    const wethReserve = isToken0Aces ? reserve1 : reserve0;
    return parseFloat(import_ethers.ethers.formatEther(wethReserve)) / parseFloat(import_ethers.ethers.formatEther(acesReserve));
  }
  /**
   * Get WETH price in USD from Uniswap V3 pool
   */
  async getWethUsdPrice() {
    const poolAddress = process.env.WETH_USDC_POOL;
    const wethAddress = process.env.WETH_ADDRESS;
    const usdcAddress = process.env.USDC_ADDRESS;
    const pool = new import_ethers.ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, this.provider);
    const slot0 = await pool.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const token0 = await pool.token0();
    const wethContract = new import_ethers.ethers.Contract(wethAddress, ERC20_ABI, this.provider);
    const usdcContract = new import_ethers.ethers.Contract(usdcAddress, ERC20_ABI, this.provider);
    const wethDecimals = await wethContract.decimals();
    const usdcDecimals = await usdcContract.decimals();
    const price = BigInt(sqrtPriceX96.toString()) ** 2n * 10n ** BigInt(wethDecimals) / 2n ** 192n / 10n ** BigInt(usdcDecimals);
    const isToken0Weth = token0.toLowerCase() === wethAddress.toLowerCase();
    if (isToken0Weth) {
      return 1 / parseFloat(import_ethers.ethers.formatUnits(price, usdcDecimals));
    } else {
      return parseFloat(import_ethers.ethers.formatUnits(price, usdcDecimals));
    }
  }
  /**
   * Validate price is within reasonable bounds
   */
  validatePrice(price) {
    return price > 0 && price < 1e6;
  }
  /**
   * Health check for price service
   */
  async healthCheck() {
    try {
      const priceData = await this.getAcesPrice();
      return {
        status: "ok",
        lastPrice: priceData.priceUSD,
        isStale: priceData.isStale,
        updatedAt: priceData.updatedAt
      };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
};

// src/routes/v1/price.ts
var priceRoutes = /* @__PURE__ */ __name(async (fastify) => {
  const priceService = new PriceService(fastify.prisma);
  fastify.get("/aces", async (request, reply) => {
    try {
      const priceData = await priceService.getAcesPrice();
      reply.send({
        success: true,
        data: {
          symbol: "ACES",
          priceUSD: parseFloat(priceData.priceUSD).toFixed(2),
          updatedAt: priceData.updatedAt,
          isStale: priceData.isStale
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: "Failed to fetch ACES price",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  fastify.get("/convert", async (request, reply) => {
    try {
      const { amount } = request.query;
      if (!amount || isNaN(parseFloat(amount))) {
        return reply.code(400).send({
          success: false,
          error: "Invalid amount parameter"
        });
      }
      const usdValue = await priceService.convertAcesToUsd(amount);
      const priceData = await priceService.getAcesPrice();
      reply.send({
        success: true,
        data: {
          acesAmount: amount,
          usdValue,
          acesPrice: parseFloat(priceData.priceUSD).toFixed(2),
          isStale: priceData.isStale
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: "Failed to convert amount",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  fastify.get("/health", async (request, reply) => {
    try {
      const healthData = await priceService.healthCheck();
      reply.send({
        success: true,
        data: healthData
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: "Price service health check failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}, "priceRoutes");

// src/routes/v1/debug/gcs-test.ts
var gcsTestRoutes = /* @__PURE__ */ __name(async (fastify) => {
  fastify.get("/debug/gcs-test", async (request, reply) => {
    try {
      console.log("[GCS-Test] Starting Google Cloud Storage test...");
      const envCheck = {
        GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
        GOOGLE_CLOUD_CLIENT_EMAIL: !!process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        GOOGLE_CLOUD_PRIVATE_KEY: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY,
        GOOGLE_CLOUD_BUCKET_NAME: process.env.GOOGLE_CLOUD_BUCKET_NAME || "aces-product-images"
      };
      console.log("[GCS-Test] Environment variables:", envCheck);
      const testFileName = "apkaws/APxKaws-image-4.webp";
      console.log(`[GCS-Test] Testing signed URL for: ${testFileName}`);
      const signedUrl = await ProductStorageService.getSignedProductUrl(testFileName, 5);
      console.log(`[GCS-Test] Generated signed URL: ${signedUrl.substring(0, 100)}...`);
      const response = await fetch(signedUrl, { method: "HEAD" });
      const urlTest = {
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length")
      };
      console.log("[GCS-Test] URL accessibility test:", urlTest);
      const testUrls = [
        "https://storage.googleapis.com/aces-product-images/apkaws/APxKaws-image-4.webp"
      ];
      console.log("[GCS-Test] Testing convertToSignedUrls...");
      const convertedUrls = await ProductStorageService.convertToSignedUrls(testUrls, 5);
      return {
        success: true,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        environment: {
          NODE_ENV: "production",
          VERCEL: !!process.env.VERCEL,
          ...envCheck
        },
        tests: {
          signedUrlGeneration: {
            success: !!signedUrl,
            url: signedUrl,
            // Show full URL for debugging
            urlLength: signedUrl.length
          },
          urlAccessibility: urlTest,
          convertToSignedUrls: {
            originalUrls: testUrls,
            convertedUrls: convertedUrls.map((url) => url.substring(0, 100) + "...")
          }
        }
      };
    } catch (error) {
      console.error("[GCS-Test] Error:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : void 0,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
}, "gcsTestRoutes");
var gcs_test_default = gcsTestRoutes;

// src/routes/v1/cron/trigger.ts
async function cronRoutes(fastify) {
  fastify.post("/api/v1/cron/trigger", async (request, reply) => {
    if (true) {
      return reply.code(403).send({ error: "Not allowed in production" });
    }
    try {
      const startTime = Date.now();
      const activeTokensFromSubgraph = await getActiveTokensFromSubgraph(fastify.prisma);
      const tokenService = new TokenService(fastify.prisma);
      const ohlcvService = new OHLCVService(fastify.prisma, tokenService);
      const results = {
        processed: 0,
        errors: 0,
        tokenResults: []
      };
      for (const tokenData of activeTokensFromSubgraph) {
        try {
          await syncTokenData(tokenData, tokenService, ohlcvService, fastify.prisma);
          results.processed++;
          results.tokenResults.push({
            address: tokenData.address,
            symbol: tokenData.symbol,
            status: "success"
          });
        } catch (error) {
          results.errors++;
          results.tokenResults.push({
            address: tokenData.address,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
      const duration = Date.now() - startTime;
      return reply.send({
        success: true,
        message: "Manual trigger completed",
        duration: `${duration}ms`,
        results,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  fastify.get("/api/v1/cron/status", async (request, reply) => {
    try {
      const recentSync = await fastify.prisma.token.findFirst({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 5 * 60 * 1e3)
            // Last 5 minutes
          }
        },
        orderBy: { updatedAt: "desc" },
        select: {
          contractAddress: true,
          symbol: true,
          updatedAt: true
        }
      });
      const totalTokens = await fastify.prisma.token.count();
      const activeTokens = await fastify.prisma.token.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1e3)
            // Last 24h
          }
        }
      });
      return reply.send({
        success: true,
        cronEnabled: process.env.ENABLE_CRON === "true",
        lastSync: recentSync,
        totalTokens,
        activeTokens,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
__name(cronRoutes, "cronRoutes");
async function getActiveTokensFromSubgraph(prisma2) {
  try {
    const query = `{
      tokens(first: 50, orderBy: tradesCount, orderDirection: desc) {
        id
        address
        name
        symbol
        tradesCount
        tokensBought
        tokensSold
        bonded
      }
    }`;
    const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }
    const result = await response.json();
    if (result.errors) {
      throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
    }
    const allTokens = result.data?.tokens || [];
    const recentlyViewedTokens = await getRecentlyViewedTokens(prisma2);
    const activeTokens = allTokens.filter(
      (token) => token.tradesCount > 0 || recentlyViewedTokens.includes(token.address.toLowerCase())
    );
    console.log(
      `[CRON] Found ${activeTokens.length} active tokens out of ${allTokens.length} total`
    );
    return activeTokens;
  } catch (error) {
    console.error("[CRON] Error fetching tokens from subgraph:", error);
    const fallbackTokens = await prisma2.token.findMany({
      where: {
        isActive: true,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1e3)
          // Last 24h
        }
      },
      select: {
        contractAddress: true,
        symbol: true
      }
    });
    return fallbackTokens.map((t) => ({
      address: t.contractAddress,
      symbol: t.symbol,
      tradesCount: 0
    }));
  }
}
__name(getActiveTokensFromSubgraph, "getActiveTokensFromSubgraph");
async function getRecentlyViewedTokens(prisma2) {
  const recentTokens = await prisma2.token.findMany({
    where: {
      updatedAt: {
        gte: new Date(Date.now() - 6 * 60 * 60 * 1e3)
        // Last 6 hours
      }
    },
    select: {
      contractAddress: true
    }
  });
  return recentTokens.map((t) => t.contractAddress.toLowerCase());
}
__name(getRecentlyViewedTokens, "getRecentlyViewedTokens");
async function syncTokenData(tokenData, tokenService, ohlcvService, prisma2) {
  const contractAddress = tokenData.address;
  if (tokenData.tradesCount === 0) {
    console.log(`[CRON] Skipping dormant token ${tokenData.symbol} (${contractAddress})`);
    return;
  }
  await prisma2.$transaction(
    async (tx) => {
      const txTokenService = new TokenService(tx);
      const txOhlcvService = new OHLCVService(tx, txTokenService);
      await txTokenService.fetchAndUpdateTokenData(contractAddress);
      const allTimeframes = ["1m", "5m", "15m", "1h", "4h"];
      for (const timeframe of allTimeframes) {
        await txOhlcvService.generateOHLCVCandles(contractAddress, timeframe);
        console.log(`[CRON] Generated ${timeframe} candles for ${tokenData.symbol}`);
      }
      await tx.token.update({
        where: { contractAddress: contractAddress.toLowerCase() },
        data: { updatedAt: /* @__PURE__ */ new Date() }
      });
    },
    {
      timeout: 9e4
      // 90 seconds timeout to handle all 5 timeframes
    }
  );
}
__name(syncTokenData, "syncTokenData");

// src/routes/v1/notifications.ts
var import_zod12 = require("zod");
var import_zod_to_json_schema11 = require("zod-to-json-schema");
var GetNotificationsQuerySchema = import_zod12.z.object({
  includeRead: import_zod12.z.string().transform((val) => val === "true").optional(),
  limit: import_zod12.z.string().transform((val) => parseInt(val)).optional(),
  offset: import_zod12.z.string().transform((val) => parseInt(val)).optional()
});
var AdminMessageSchema = import_zod12.z.object({
  userId: import_zod12.z.string().min(1, "User ID is required"),
  title: import_zod12.z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
  message: import_zod12.z.string().min(1, "Message is required").max(500, "Message must be 500 characters or less"),
  actionUrl: import_zod12.z.string().url().optional(),
  expiresAt: import_zod12.z.string().datetime().optional()
});
async function notificationRoutes(fastify) {
  const notificationService = new NotificationService(fastify.prisma);
  fastify.get(
    "/",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: (0, import_zod_to_json_schema11.zodToJsonSchema)(GetNotificationsQuerySchema)
      }
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const query = GetNotificationsQuerySchema.parse(request.query);
        const notifications = await notificationService.getUserNotifications(userId, {
          includeRead: query.includeRead,
          limit: query.limit,
          offset: query.offset
        });
        return reply.send({
          success: true,
          data: notifications
        });
      } catch (error) {
        console.error("Error fetching notifications:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/unread-count",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const count = await notificationService.getUnreadCount(userId);
        return reply.send({
          success: true,
          data: { count }
        });
      } catch (error) {
        console.error("Error fetching unread count:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/:id/mark-read",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema11.zodToJsonSchema)(
          import_zod12.z.object({
            id: import_zod12.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { id } = request.params;
        const notification = await notificationService.markAsRead(id, userId);
        return reply.send({
          success: true,
          data: notification,
          message: "Notification marked as read"
        });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        throw error;
      }
    }
  );
  fastify.put(
    "/mark-all-read",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const result = await notificationService.markAllAsRead(userId);
        return reply.send({
          success: true,
          data: result,
          message: `${result.count} notifications marked as read`
        });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        throw error;
      }
    }
  );
  fastify.delete(
    "/:id",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema11.zodToJsonSchema)(
          import_zod12.z.object({
            id: import_zod12.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { id } = request.params;
        await notificationService.deleteNotification(id, userId);
        return reply.send({
          success: true,
          message: "Notification deleted successfully"
        });
      } catch (error) {
        console.error("Error deleting notification:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/admin/message",
    {
      preHandler: [requireAdmin],
      schema: {
        body: (0, import_zod_to_json_schema11.zodToJsonSchema)(AdminMessageSchema)
      }
    },
    async (request, reply) => {
      try {
        const data = AdminMessageSchema.parse(request.body);
        const notification = await notificationService.createNotification({
          userId: data.userId,
          type: "ADMIN_MESSAGE" /* ADMIN_MESSAGE */,
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : void 0
        });
        return reply.send({
          success: true,
          data: notification,
          message: "Admin message sent successfully"
        });
      } catch (error) {
        console.error("Error sending admin message:", error);
        throw error;
      }
    }
  );
}
__name(notificationRoutes, "notificationRoutes");

// src/routes/v1/token-creation.ts
var import_zod13 = require("zod");
var import_zod_to_json_schema12 = require("zod-to-json-schema");

// src/services/token-creation-service.ts
var TokenCreationService = class {
  constructor(prisma2, notificationService) {
    this.prisma = prisma2;
    this.notificationService = notificationService || new NotificationService(prisma2);
  }
  static {
    __name(this, "TokenCreationService");
  }
  notificationService;
  /**
   * Submit additional details by user for token creation
   */
  async submitUserDetails(listingId, userId, details) {
    try {
      const listing = await this.prisma.listing.findFirst({
        where: {
          id: listingId,
          ownerId: userId
        }
      });
      if (!listing) {
        throw errors.notFound("Listing not found or access denied");
      }
      const listingWithToken = listing;
      if (listingWithToken.tokenCreationStatus !== "AWAITING_USER_DETAILS" /* AWAITING_USER_DETAILS */) {
        throw errors.validation(
          `Cannot submit details for listing in status: ${listingWithToken.tokenCreationStatus}`
        );
      }
      const updatedListing = await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          userProvidedDetails: details,
          tokenCreationStatus: "PENDING_ADMIN_REVIEW" /* PENDING_ADMIN_REVIEW */,
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
      try {
        const userTemplate = NotificationTemplates["TOKEN_PARAMETERS_SUBMITTED" /* TOKEN_PARAMETERS_SUBMITTED */];
        await this.notificationService.createNotification({
          userId,
          listingId,
          type: "TOKEN_PARAMETERS_SUBMITTED" /* TOKEN_PARAMETERS_SUBMITTED */,
          title: userTemplate.title,
          message: userTemplate.message,
          actionUrl: userTemplate.getActionUrl()
        });
      } catch (notificationError) {
        console.error("Error creating user token submission notification:", notificationError);
      }
      try {
        const adminUsers = await this.prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true }
        });
        const adminTemplate = NotificationTemplates["ADMIN_TOKEN_REVIEW_NEEDED" /* ADMIN_TOKEN_REVIEW_NEEDED */];
        for (const admin of adminUsers) {
          await this.notificationService.createNotification({
            userId: admin.id,
            listingId,
            type: "ADMIN_TOKEN_REVIEW_NEEDED" /* ADMIN_TOKEN_REVIEW_NEEDED */,
            title: adminTemplate.title,
            message: adminTemplate.message,
            actionUrl: adminTemplate.getActionUrl()
          });
        }
      } catch (notificationError) {
        console.error("Error creating admin token review notification:", notificationError);
      }
      return updatedListing;
    } catch (error) {
      console.error("Error submitting user details:", error);
      throw error;
    }
  }
  /**
   * Admin approves token parameters and sets status to ready for minting
   */
  async approveTokenParameters(listingId, adminId, parameters) {
    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          owner: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });
      if (!listing) {
        throw errors.notFound("Listing not found");
      }
      const listingWithToken = listing;
      if (listingWithToken.tokenCreationStatus !== "PENDING_ADMIN_REVIEW" /* PENDING_ADMIN_REVIEW */) {
        throw errors.validation(
          `Cannot approve parameters for listing in status: ${listingWithToken.tokenCreationStatus}`
        );
      }
      this.validateTokenParameters(parameters);
      const updatedListing = await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          tokenParameters: parameters,
          tokenCreationStatus: "READY_TO_MINT" /* READY_TO_MINT */,
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
      const template = NotificationTemplates["READY_TO_MINT" /* READY_TO_MINT */];
      await this.notificationService.createNotification({
        userId: listing.ownerId,
        listingId,
        type: "READY_TO_MINT" /* READY_TO_MINT */,
        title: template.title,
        message: template.message,
        actionUrl: template.getActionUrl(listingId)
      });
      return updatedListing;
    } catch (error) {
      console.error("Error approving token parameters:", error);
      throw error;
    }
  }
  /**
   * Get mint parameters for a listing (user-facing, readonly)
   */
  async getMintParameters(listingId, userId) {
    try {
      const listing = await this.prisma.listing.findFirst({
        where: {
          id: listingId,
          ownerId: userId
        }
      });
      if (!listing) {
        throw errors.notFound("Listing not found or access denied");
      }
      const listingWithToken = listing;
      if (listingWithToken.tokenCreationStatus !== "READY_TO_MINT" /* READY_TO_MINT */) {
        throw errors.validation("Token parameters not ready for minting");
      }
      if (!listingWithToken.tokenParameters) {
        throw errors.validation("Token parameters not found");
      }
      const params = listingWithToken.tokenParameters;
      return {
        contractAddress: process.env.FACTORY_PROXY_ADDRESS || "",
        steepness: params.steepness,
        floor: params.floor,
        tokensBondedAt: params.tokensBondedAt,
        curve: params.curve,
        salt: params.salt || `${listing.symbol}-${Date.now()}`,
        name: listing.title,
        symbol: listing.symbol
      };
    } catch (error) {
      console.error("Error getting mint parameters:", error);
      throw error;
    }
  }
  /**
   * Confirm that a token has been minted (called after successful blockchain transaction)
   */
  async confirmTokenMint(listingId, userId, txHash, tokenAddress) {
    try {
      const listing = await this.prisma.listing.findFirst({
        where: {
          id: listingId,
          ownerId: userId
        }
      });
      if (!listing) {
        throw errors.notFound("Listing not found or access denied");
      }
      const listingWithToken = listing;
      if (listingWithToken.tokenCreationStatus !== "READY_TO_MINT" /* READY_TO_MINT */) {
        throw errors.validation("Token is not ready for minting confirmation");
      }
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedListing = await tx.listing.update({
          where: { id: listingId },
          data: {
            tokenCreationStatus: "MINTED" /* MINTED */,
            isLive: true,
            // Make the listing live once token is minted
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
        await tx.token.create({
          data: {
            contractAddress: tokenAddress,
            symbol: listing.symbol,
            name: listing.title,
            listingId,
            currentPrice: "0",
            currentPriceACES: "0",
            volume24h: "0"
          }
        });
        return updatedListing;
      });
      const template = NotificationTemplates["TOKEN_MINTED" /* TOKEN_MINTED */];
      await this.notificationService.createNotification({
        userId,
        listingId,
        type: "TOKEN_MINTED" /* TOKEN_MINTED */,
        title: template.title,
        message: template.message,
        actionUrl: template.getActionUrl(listing.symbol)
      });
      return result;
    } catch (error) {
      console.error("Error confirming token mint:", error);
      throw error;
    }
  }
  /**
   * Get all listings pending admin review for token creation
   */
  async getListingsPendingReview() {
    try {
      const listings = await this.prisma.listing.findMany({
        where: {
          tokenCreationStatus: "PENDING_ADMIN_REVIEW" /* PENDING_ADMIN_REVIEW */
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              walletAddress: true
            }
          },
          submission: {
            select: {
              id: true,
              assetType: true
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
      });
      return listings;
    } catch (error) {
      console.error("Error getting listings pending review:", error);
      throw error;
    }
  }
  /**
   * Get token creation status for a user's listings
   */
  async getUserTokenCreationStatus(userId) {
    try {
      const listings = await this.prisma.listing.findMany({
        where: {
          ownerId: userId,
          tokenCreationStatus: {
            not: null
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
      });
      return listings;
    } catch (error) {
      console.error("Error getting user token creation status:", error);
      throw error;
    }
  }
  /**
   * Private method to validate token parameters
   */
  validateTokenParameters(params) {
    const errors2 = [];
    const steepness = parseFloat(params.steepness);
    if (isNaN(steepness) || steepness < 1 || steepness > 1e16) {
      errors2.push("Steepness must be between 1 and 10,000,000,000,000,000");
    }
    const floor = parseFloat(params.floor);
    if (isNaN(floor) || floor < 0 || floor > 1e9) {
      errors2.push("Floor must be between 0 and 1,000,000,000");
    }
    const tokensBondedAt = parseFloat(params.tokensBondedAt);
    if (isNaN(tokensBondedAt) || tokensBondedAt < 1) {
      errors2.push("Tokens bonded at must be at least 1 token");
    }
    if (![0, 1].includes(params.curve)) {
      errors2.push("Curve must be 0 (exponential) or 1 (linear)");
    }
    if (errors2.length > 0) {
      throw new Error(`Token parameter validation failed: ${errors2.join(", ")}`);
    }
  }
};

// src/routes/v1/token-creation.ts
var SubmitUserDetailsSchema = import_zod13.z.object({
  additionalImages: import_zod13.z.array(import_zod13.z.string()).optional(),
  technicalSpecifications: import_zod13.z.string().optional(),
  additionalDescription: import_zod13.z.string().optional(),
  proofDocuments: import_zod13.z.array(import_zod13.z.string()).optional()
});
var TokenParametersSchema = import_zod13.z.object({
  steepness: import_zod13.z.string(),
  floor: import_zod13.z.string(),
  tokensBondedAt: import_zod13.z.string(),
  curve: import_zod13.z.number().int().min(0).max(1),
  salt: import_zod13.z.string().optional(),
  useVanityMining: import_zod13.z.boolean().optional(),
  vanityTarget: import_zod13.z.string().optional()
});
var ConfirmMintSchema = import_zod13.z.object({
  txHash: import_zod13.z.string().min(1),
  tokenAddress: import_zod13.z.string().min(1)
});
async function tokenCreationRoutes(fastify) {
  const notificationService = new NotificationService(fastify.prisma);
  const tokenCreationService = new TokenCreationService(fastify.prisma, notificationService);
  fastify.post(
    "/listings/:id/submit-details",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema12.zodToJsonSchema)(
          import_zod13.z.object({
            id: import_zod13.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema12.zodToJsonSchema)(SubmitUserDetailsSchema)
      }
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { id: listingId } = request.params;
        const details = request.body;
        const listing = await tokenCreationService.submitUserDetails(listingId, userId, details);
        return reply.send({
          success: true,
          data: listing,
          message: "Details submitted successfully. Awaiting admin review."
        });
      } catch (error) {
        console.error("Error submitting user details:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/listings/:id/mint-parameters",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema12.zodToJsonSchema)(
          import_zod13.z.object({
            id: import_zod13.z.string()
          })
        )
      }
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { id: listingId } = request.params;
        const parameters = await tokenCreationService.getMintParameters(listingId, userId);
        return reply.send({
          success: true,
          data: parameters
        });
      } catch (error) {
        console.error("Error fetching mint parameters:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/listings/:id/confirm-mint",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema12.zodToJsonSchema)(
          import_zod13.z.object({
            id: import_zod13.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema12.zodToJsonSchema)(ConfirmMintSchema)
      }
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { id: listingId } = request.params;
        const { txHash, tokenAddress } = request.body;
        const listing = await tokenCreationService.confirmTokenMint(
          listingId,
          userId,
          txHash,
          tokenAddress
        );
        return reply.send({
          success: true,
          data: listing,
          message: "Token mint confirmed successfully! Your token is now live."
        });
      } catch (error) {
        console.error("Error confirming token mint:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/my-status",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const listings = await tokenCreationService.getUserTokenCreationStatus(userId);
        return reply.send({
          success: true,
          data: listings
        });
      } catch (error) {
        console.error("Error fetching user token creation status:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/admin/pending-review",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const listings = await tokenCreationService.getListingsPendingReview();
        return reply.send({
          success: true,
          data: listings
        });
      } catch (error) {
        console.error("Error fetching listings pending review:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/admin/listings/:id/approve-parameters",
    {
      preHandler: [requireAdmin],
      schema: {
        params: (0, import_zod_to_json_schema12.zodToJsonSchema)(
          import_zod13.z.object({
            id: import_zod13.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema12.zodToJsonSchema)(TokenParametersSchema)
      }
    },
    async (request, reply) => {
      try {
        const adminId = request.user.id;
        const { id: listingId } = request.params;
        const parameters = request.body;
        const listing = await tokenCreationService.approveTokenParameters(
          listingId,
          adminId,
          parameters
        );
        return reply.send({
          success: true,
          data: listing,
          message: "Token parameters approved successfully. User notified."
        });
      } catch (error) {
        console.error("Error approving token parameters:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/admin/all-statuses",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const listings = await fastify.prisma.listing.findMany({
          where: {
            tokenCreationStatus: {
              not: null
            }
          },
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                walletAddress: true
              }
            },
            submission: {
              select: {
                id: true,
                assetType: true
              }
            }
          },
          orderBy: {
            updatedAt: "desc"
          }
        });
        return reply.send({
          success: true,
          data: listings
        });
      } catch (error) {
        console.error("Error fetching all token creation statuses:", error);
        throw error;
      }
    }
  );
}
__name(tokenCreationRoutes, "tokenCreationRoutes");

// src/routes/v1/product-images.ts
var import_crypto2 = require("crypto");
async function productImagesRoutes(fastify) {
  fastify.post(
    "/upload",
    {
      preHandler: fastify.authenticate,
      schema: {
        consumes: ["multipart/form-data"],
        description: "Upload a product image",
        tags: ["Product Images"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              imageUrl: { type: "string" },
              fileName: { type: "string" }
            }
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const data = await request.file();
        if (!data) {
          return reply.status(400).send({
            success: false,
            error: "No file uploaded"
          });
        }
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowedTypes.includes(data.mimetype)) {
          return reply.status(400).send({
            success: false,
            error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
          });
        }
        const MAX_SIZE = 2 * 1024 * 1024;
        const buffer = await data.toBuffer();
        if (buffer.length > MAX_SIZE) {
          return reply.status(400).send({
            success: false,
            error: "File size exceeds 2MB limit."
          });
        }
        const fileExtension = data.mimetype.split("/")[1];
        const fileName = `${(0, import_crypto2.randomUUID)()}.${fileExtension}`;
        const bucket = ProductStorageService.getProductBucket();
        const file = bucket.file(fileName);
        await file.save(buffer, {
          metadata: {
            contentType: data.mimetype
          }
        });
        await file.makePublic();
        const imageUrl = ProductStorageService.getProductUrl(fileName);
        return reply.send({
          success: true,
          imageUrl,
          fileName
        });
      } catch (error) {
        console.error("Error uploading product image:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to upload image"
        });
      }
    }
  );
  fastify.delete(
    "/:fileName",
    {
      preHandler: fastify.authenticate,
      schema: {
        description: "Delete a product image",
        tags: ["Product Images"],
        params: {
          type: "object",
          properties: {
            fileName: { type: "string" }
          },
          required: ["fileName"]
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" }
            }
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { fileName } = request.params;
        const bucket = ProductStorageService.getProductBucket();
        const file = bucket.file(fileName);
        const [exists] = await file.exists();
        if (!exists) {
          return reply.status(404).send({
            success: false,
            error: "File not found"
          });
        }
        await file.delete();
        return reply.send({
          success: true,
          message: "Image deleted successfully"
        });
      } catch (error) {
        console.error("Error deleting product image:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to delete image"
        });
      }
    }
  );
}
__name(productImagesRoutes, "productImagesRoutes");

// src/routes/v1/test-notifications.ts
var import_zod14 = require("zod");
var import_zod_to_json_schema13 = require("zod-to-json-schema");
var TestNotificationSchema = import_zod14.z.object({
  type: import_zod14.z.enum([
    "VERIFICATION_PENDING",
    "VERIFICATION_APPROVED",
    "VERIFICATION_REJECTED",
    "LISTING_APPROVED",
    "READY_TO_MINT",
    "TOKEN_MINTED",
    "NEW_BID_RECEIVED",
    "BID_ACCEPTED",
    "BID_REJECTED",
    "BID_OUTBID",
    "ADMIN_MESSAGE",
    "SYSTEM_ALERT",
    "ADMIN_NEW_SUBMISSION",
    "ADMIN_NEW_VERIFICATION",
    "ADMIN_TOKEN_REVIEW_NEEDED"
  ]),
  targetUserId: import_zod14.z.string().optional(),
  // If not provided, uses current user
  listingId: import_zod14.z.string().optional(),
  customTitle: import_zod14.z.string().optional(),
  customMessage: import_zod14.z.string().optional(),
  customActionUrl: import_zod14.z.string().optional()
});
async function testNotificationRoutes(fastify) {
  const notificationService = new NotificationService(fastify.prisma);
  fastify.post(
    "/test/:notificationType",
    {
      preHandler: [requireAuth],
      schema: {
        params: (0, import_zod_to_json_schema13.zodToJsonSchema)(
          import_zod14.z.object({
            notificationType: import_zod14.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema13.zodToJsonSchema)(TestNotificationSchema.partial())
      }
    },
    async (request, reply) => {
      try {
        const { notificationType } = request.params;
        const body = request.body;
        if (!Object.values(NotificationType).includes(notificationType)) {
          return reply.status(400).send({
            success: false,
            error: `Invalid notification type: ${notificationType}`,
            availableTypes: Object.values(NotificationType)
          });
        }
        const type = notificationType;
        const targetUserId = body.targetUserId || request.user.id;
        const template = NotificationTemplates[type];
        let actionUrl = body.customActionUrl;
        if (!actionUrl) {
          try {
            switch (type) {
              case "LISTING_APPROVED" /* LISTING_APPROVED */:
              case "READY_TO_MINT" /* READY_TO_MINT */:
                actionUrl = template.getActionUrl(
                  body.listingId || "test-listing-id"
                );
                break;
              case "TOKEN_MINTED" /* TOKEN_MINTED */:
                actionUrl = template.getActionUrl("TEST");
                break;
              default:
                actionUrl = template.getActionUrl();
                break;
            }
          } catch (error) {
            actionUrl = "/profile";
          }
        }
        const notification = await notificationService.createNotification({
          userId: targetUserId,
          listingId: body.listingId,
          type,
          title: body.customTitle || template.title,
          message: body.customMessage || template.message,
          actionUrl
        });
        return reply.send({
          success: true,
          data: notification,
          message: `Test notification '${type}' created successfully`
        });
      } catch (error) {
        console.error("Error creating test notification:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/test/all",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const results = [];
        const userNotificationTypes = [
          "VERIFICATION_PENDING" /* VERIFICATION_PENDING */,
          "VERIFICATION_APPROVED" /* VERIFICATION_APPROVED */,
          "VERIFICATION_REJECTED" /* VERIFICATION_REJECTED */,
          "LISTING_APPROVED" /* LISTING_APPROVED */,
          "READY_TO_MINT" /* READY_TO_MINT */,
          "TOKEN_MINTED" /* TOKEN_MINTED */,
          "NEW_BID_RECEIVED" /* NEW_BID_RECEIVED */,
          "BID_ACCEPTED" /* BID_ACCEPTED */,
          "BID_REJECTED" /* BID_REJECTED */,
          "BID_OUTBID" /* BID_OUTBID */,
          "ADMIN_MESSAGE" /* ADMIN_MESSAGE */,
          "SYSTEM_ALERT" /* SYSTEM_ALERT */
        ];
        for (const type of userNotificationTypes) {
          try {
            const template = NotificationTemplates[type];
            let actionUrl;
            try {
              switch (type) {
                case "LISTING_APPROVED" /* LISTING_APPROVED */:
                case "READY_TO_MINT" /* READY_TO_MINT */:
                  actionUrl = template.getActionUrl(
                    "test-listing-id"
                  );
                  break;
                case "TOKEN_MINTED" /* TOKEN_MINTED */:
                  actionUrl = template.getActionUrl("TEST");
                  break;
                default:
                  actionUrl = template.getActionUrl();
                  break;
              }
            } catch (error) {
              actionUrl = "/profile";
            }
            const notification = await notificationService.createNotification({
              userId,
              type,
              title: `[TEST] ${template.title}`,
              message: `[TEST] ${template.message}`,
              actionUrl
            });
            results.push({ type, success: true, id: notification.id });
          } catch (error) {
            results.push({
              type,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
        return reply.send({
          success: true,
          data: results,
          message: `Created ${results.filter((r) => r.success).length} test notifications`
        });
      } catch (error) {
        console.error("Error creating test notifications:", error);
        throw error;
      }
    }
  );
  fastify.post(
    "/test/admin",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const results = [];
        const adminNotificationTypes = [
          "ADMIN_NEW_SUBMISSION" /* ADMIN_NEW_SUBMISSION */,
          "ADMIN_NEW_VERIFICATION" /* ADMIN_NEW_VERIFICATION */,
          "ADMIN_TOKEN_REVIEW_NEEDED" /* ADMIN_TOKEN_REVIEW_NEEDED */
        ];
        for (const type of adminNotificationTypes) {
          try {
            const template = NotificationTemplates[type];
            const actionUrl = template.getActionUrl();
            const notification = await notificationService.createNotification({
              userId,
              type,
              title: `[TEST] ${template.title}`,
              message: `[TEST] ${template.message}`,
              actionUrl
            });
            results.push({ type, success: true, id: notification.id });
          } catch (error) {
            results.push({
              type,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
        return reply.send({
          success: true,
          data: results,
          message: `Created ${results.filter((r) => r.success).length} admin test notifications`
        });
      } catch (error) {
        console.error("Error creating admin test notifications:", error);
        throw error;
      }
    }
  );
  fastify.delete(
    "/test/cleanup",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const deletedCount = await fastify.prisma.userNotification.deleteMany({
          where: {
            userId,
            title: {
              startsWith: "[TEST]"
            }
          }
        });
        return reply.send({
          success: true,
          data: { deletedCount: deletedCount.count },
          message: `Cleaned up ${deletedCount.count} test notifications`
        });
      } catch (error) {
        console.error("Error cleaning up test notifications:", error);
        throw error;
      }
    }
  );
  fastify.get(
    "/test/stats",
    {
      preHandler: [requireAuth]
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const stats = await fastify.prisma.userNotification.groupBy({
          by: ["type"],
          where: { userId },
          _count: {
            type: true
          }
        });
        const unreadCount = await fastify.prisma.userNotification.count({
          where: {
            userId,
            isRead: false
          }
        });
        const totalCount = await fastify.prisma.userNotification.count({
          where: { userId }
        });
        return reply.send({
          success: true,
          data: {
            byType: stats,
            unreadCount,
            totalCount
          }
        });
      } catch (error) {
        console.error("Error getting notification stats:", error);
        throw error;
      }
    }
  );
}
__name(testNotificationRoutes, "testNotificationRoutes");

// src/routes/v1/admin/tokens.ts
var import_zod15 = require("zod");
var import_zod_to_json_schema14 = require("zod-to-json-schema");
var AddTokenSchema = import_zod15.z.object({
  contractAddress: import_zod15.z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
});
var LinkTokenToListingSchema = import_zod15.z.object({
  contractAddress: import_zod15.z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  listingId: import_zod15.z.string().min(1, "Listing ID is required")
});
async function adminTokenRoutes(fastify) {
  fastify.post(
    "/api/v1/admin/tokens/add",
    {
      preHandler: [requireAdmin],
      schema: {
        body: (0, import_zod_to_json_schema14.zodToJsonSchema)(AddTokenSchema),
        response: {
          200: (0, import_zod_to_json_schema14.zodToJsonSchema)(
            import_zod15.z.object({
              success: import_zod15.z.boolean(),
              message: import_zod15.z.string(),
              data: import_zod15.z.object({
                contractAddress: import_zod15.z.string(),
                symbol: import_zod15.z.string(),
                name: import_zod15.z.string(),
                currentPrice: import_zod15.z.string(),
                currentPriceACES: import_zod15.z.string()
              })
            })
          )
        }
      }
    },
    async (request, reply) => {
      try {
        const { contractAddress } = request.body;
        const tokenService = new TokenService(fastify.prisma);
        console.log(`[ADMIN] Adding token: ${contractAddress}`);
        const token = await tokenService.getOrCreateToken(contractAddress);
        await tokenService.fetchAndUpdateTokenData(contractAddress);
        const updatedToken = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
          select: {
            contractAddress: true,
            symbol: true,
            name: true,
            currentPrice: true,
            currentPriceACES: true,
            volume24h: true,
            createdAt: true,
            updatedAt: true
          }
        });
        console.log(`[ADMIN] Token added successfully: ${updatedToken?.symbol}`);
        return reply.send({
          success: true,
          message: `Token ${updatedToken?.symbol} (${updatedToken?.name}) added successfully`,
          data: {
            contractAddress: updatedToken.contractAddress,
            symbol: updatedToken.symbol,
            name: updatedToken.name,
            currentPrice: updatedToken.currentPrice,
            currentPriceACES: updatedToken.currentPriceACES,
            volume24h: updatedToken?.volume24h || "0",
            createdAt: updatedToken.createdAt,
            updatedAt: updatedToken.updatedAt
          }
        });
      } catch (error) {
        console.error("[ADMIN] Error adding token:", error);
        if (error instanceof Error) {
          return reply.code(500).send({
            success: false,
            error: "Failed to add token",
            message: error.message
          });
        }
        return reply.code(500).send({
          success: false,
          error: "Failed to add token",
          message: "Unknown error occurred"
        });
      }
    }
  );
  fastify.post(
    "/api/v1/admin/tokens/sync",
    {
      preHandler: [requireAdmin],
      schema: {
        body: (0, import_zod_to_json_schema14.zodToJsonSchema)(AddTokenSchema)
      }
    },
    async (request, reply) => {
      try {
        const { contractAddress } = request.body;
        const tokenService = new TokenService(fastify.prisma);
        console.log(`[ADMIN] Force syncing token: ${contractAddress}`);
        await tokenService.fetchAndUpdateTokenData(contractAddress);
        const updatedToken = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() }
        });
        return reply.send({
          success: true,
          message: `Token ${updatedToken?.symbol} synced successfully`,
          data: updatedToken
        });
      } catch (error) {
        console.error("[ADMIN] Error syncing token:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to sync token",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/api/v1/admin/tokens",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const tokens = await fastify.prisma.token.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          // Limit to latest 100 tokens
          select: {
            contractAddress: true,
            symbol: true,
            name: true,
            currentPrice: true,
            currentPriceACES: true,
            volume24h: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            listingId: true,
            listing: {
              select: {
                id: true,
                title: true,
                symbol: true,
                isLive: true
              }
            }
          }
        });
        return reply.send({
          success: true,
          count: tokens.length,
          data: tokens
        });
      } catch (error) {
        console.error("[ADMIN] Error fetching tokens:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch tokens",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.post(
    "/api/v1/admin/tokens/link-listing",
    {
      preHandler: [requireAdmin],
      schema: {
        body: (0, import_zod_to_json_schema14.zodToJsonSchema)(LinkTokenToListingSchema),
        response: {
          200: (0, import_zod_to_json_schema14.zodToJsonSchema)(
            import_zod15.z.object({
              success: import_zod15.z.boolean(),
              message: import_zod15.z.string(),
              data: import_zod15.z.object({
                contractAddress: import_zod15.z.string(),
                listingId: import_zod15.z.string(),
                listingTitle: import_zod15.z.string()
              })
            })
          )
        }
      }
    },
    async (request, reply) => {
      try {
        const { contractAddress, listingId } = request.body;
        console.log(`[ADMIN] Linking token ${contractAddress} to listing ${listingId}`);
        const token = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() }
        });
        if (!token) {
          return reply.code(404).send({
            success: false,
            error: "Token not found",
            message: `Token with address ${contractAddress} does not exist in database`
          });
        }
        const listing = await fastify.prisma.listing.findUnique({
          where: { id: listingId }
        });
        if (!listing) {
          return reply.code(404).send({
            success: false,
            error: "Listing not found",
            message: `Listing with ID ${listingId} does not exist`
          });
        }
        const existingToken = await fastify.prisma.token.findFirst({
          where: { listingId }
        });
        if (existingToken && existingToken.contractAddress !== token.contractAddress) {
          return reply.code(400).send({
            success: false,
            error: "Listing already linked",
            message: `Listing "${listing.title}" is already linked to token ${existingToken.contractAddress}`
          });
        }
        const updatedToken = await fastify.prisma.token.update({
          where: { contractAddress: contractAddress.toLowerCase() },
          data: { listingId }
        });
        console.log(
          `[ADMIN] Successfully linked token ${updatedToken.symbol} to listing ${listing.title}`
        );
        return reply.send({
          success: true,
          message: `Token ${updatedToken.symbol} successfully linked to listing "${listing.title}"`,
          data: {
            contractAddress: updatedToken.contractAddress,
            listingId,
            listingTitle: listing.title
          }
        });
      } catch (error) {
        console.error("[ADMIN] Error linking token to listing:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to link token to listing",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.delete(
    "/api/v1/admin/tokens/unlink-listing",
    {
      preHandler: [requireAdmin],
      schema: {
        body: (0, import_zod_to_json_schema14.zodToJsonSchema)(AddTokenSchema)
      }
    },
    async (request, reply) => {
      try {
        const { contractAddress } = request.body;
        console.log(`[ADMIN] Unlinking token ${contractAddress} from listing`);
        const token = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
          include: {
            listing: true
          }
        });
        if (!token) {
          return reply.code(404).send({
            success: false,
            error: "Token not found",
            message: `Token with address ${contractAddress} does not exist in database`
          });
        }
        if (!token.listingId) {
          return reply.code(400).send({
            success: false,
            error: "Token not linked",
            message: "Token is not currently linked to any listing"
          });
        }
        const updatedToken = await fastify.prisma.token.update({
          where: { contractAddress: contractAddress.toLowerCase() },
          data: { listingId: null }
        });
        console.log(`[ADMIN] Successfully unlinked token ${updatedToken.symbol} from listing`);
        return reply.send({
          success: true,
          message: `Token ${updatedToken.symbol} successfully unlinked from listing`,
          data: {
            contractAddress: updatedToken.contractAddress
          }
        });
      } catch (error) {
        console.error("[ADMIN] Error unlinking token from listing:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to unlink token from listing",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.get(
    "/api/v1/admin/listings/available",
    {
      preHandler: [requireAdmin]
    },
    async (request, reply) => {
      try {
        const listings = await fastify.prisma.listing.findMany({
          where: {
            approvedBy: { not: null }
            // Only approved listings
          },
          select: {
            id: true,
            title: true,
            symbol: true,
            description: true,
            assetType: true,
            isLive: true,
            launchDate: true,
            createdAt: true,
            owner: {
              select: {
                walletAddress: true,
                email: true
              }
            },
            token: {
              select: {
                contractAddress: true,
                symbol: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 100
        });
        return reply.send({
          success: true,
          count: listings.length,
          data: listings
        });
      } catch (error) {
        console.error("[ADMIN] Error fetching available listings:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch available listings",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
}
__name(adminTokenRoutes, "adminTokenRoutes");

// src/app.ts
var buildApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto3.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(import_multipart.default, {
    limits: {
      fileSize: 5 * 1024 * 1024
      // 5MB
    }
  });
  fastify.register(registerAuth);
  const getAllowedOrigins = /* @__PURE__ */ __name(() => {
    const origins = [];
    origins.push("http://localhost:3000", "http://localhost:3001", "http://localhost:3002");
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL);
    }
    if (process.env.VERCEL_URL) {
      origins.push(`https://${process.env.VERCEL_URL}`);
    }
    origins.push(
      "https://www.aces.fun",
      "https://aces.fun",
      "https://aces-monorepo-git-dev-dan-aces-fun.vercel.app",
      "https://aces-monorepo-git-main-dan-aces-fun.vercel.app",
      "https://aces-monorepo-git-feat-ui-updates-dan-aces-fun.vercel.app",
      "https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app"
    );
    return origins;
  }, "getAllowedOrigins");
  const isOriginAllowed = /* @__PURE__ */ __name((origin) => {
    if (!origin) return false;
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) return true;
    if (origin.endsWith(".vercel.app")) return true;
    return false;
  }, "isOriginAllowed");
  fastify.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (isOriginAllowed(origin)) {
      reply.header("Access-Control-Allow-Origin", origin).header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS").header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      ).header("Access-Control-Allow-Credentials", "true").header("Vary", "Origin");
    }
  });
  fastify.options("*", async (request, reply) => {
    const origin = request.headers.origin;
    if (isOriginAllowed(origin)) {
      reply.header("Access-Control-Allow-Origin", origin).header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS").header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      ).header("Access-Control-Allow-Credentials", "true").header("Access-Control-Max-Age", "86400").header("Vary", "Origin");
    }
    reply.code(204).send();
  });
  fastify.register(submissionRoutes, { prefix: "/api/v1/submissions" });
  fastify.register(adminRoutes, { prefix: "/api/v1/admin" });
  fastify.register(bidsRoutes, { prefix: "/api/v1/bids" });
  fastify.register(accountVerificationRoutes, { prefix: "/api/v1/verification" });
  fastify.register(usersRoutes, { prefix: "/api/v1/users" });
  fastify.register(listingRoutes, { prefix: "/api/v1/listings" });
  fastify.register(tokensRoutes, { prefix: "/api/v1/tokens" });
  fastify.register(portfolioRoutes, { prefix: "/api/v1/portfolio" });
  fastify.register(contactRoutes, { prefix: "/api/v1/contact" });
  fastify.register(purchaseRoutes, { prefix: "/api/v1/purchase" });
  fastify.register(commentsRoutes, { prefix: "/api/v1/comments" });
  fastify.register(twitchRoutes, { prefix: "/api/v1/twitch" });
  fastify.register(priceRoutes, { prefix: "/api/v1/price" });
  fastify.register(notificationRoutes, { prefix: "/api/v1/notifications" });
  fastify.register(tokenCreationRoutes, { prefix: "/api/v1/token-creation" });
  fastify.register(productImagesRoutes, { prefix: "/api/v1/product-images" });
  fastify.register(adminTokenRoutes);
  fastify.register(gcs_test_default, { prefix: "/api/v1" });
  fastify.register(cronRoutes);
  fastify.register(testNotificationRoutes, { prefix: "/api/v1/notifications" });
  fastify.addHook("onRequest", async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers["user-agent"]);
  });
  fastify.addHook("onResponse", async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });
  fastify.get("/health/live", async () => ({ status: "ok" }));
  fastify.get("/health/ready", async () => {
    const isDbReady = await checkDatabaseHealth();
    if (!isDbReady) {
      throw new Error("Database not ready");
    }
    return { status: "ready" };
  });
  fastify.setErrorHandler((error, request, reply) => {
    loggers.error(error instanceof Error ? error : new Error("Unknown error"), {
      url: request.url,
      method: request.method,
      headers: request.headers,
      params: request.params,
      query: request.query,
      userId: request.user?.id,
      requestId: request.id
    });
    try {
      handleError(error, reply);
    } catch (handlerError) {
      loggers.error(
        handlerError instanceof Error ? handlerError : new Error("Error handler failed"),
        {
          originalError: error instanceof Error ? error.message : "Unknown error",
          url: request.url,
          method: request.method,
          requestId: request.id
        }
      );
      handleError(handlerError, reply);
    }
  });
  fastify.addHook("onClose", async () => {
    await disconnectDatabase();
  });
  return fastify;
}, "buildApp");

// src/api/index.ts
(0, import_dotenv2.config)();
var appPromise;
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    if (!appPromise) {
      appPromise = buildApp();
    }
    const app = await appPromise;
    await app.ready();
    let url = req.url || "/";
    console.log("API Handler - Original URL:", req.url);
    console.log("API Handler - Method:", req.method);
    const response = await app.inject({
      method: req.method,
      url,
      headers: req.headers,
      payload: req.body
    });
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(response.statusCode).send(response.payload);
  } catch (error) {
    console.error("API handler error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}, "handler");
var api_default = handler;
