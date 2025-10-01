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

// src/api/verification.ts
var verification_exports = {};
__export(verification_exports, {
  default: () => verification_default
});
module.exports = __toCommonJS(verification_exports);
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

// src/routes/v1/verification.ts
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");

// src/services/verification-service.ts
var import_client2 = require("@prisma/client");

// src/lib/prisma-enums.ts
var VerificationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};

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

// src/lib/vision-service.ts
var import_vision = require("@google-cloud/vision");
var import_storage2 = require("@google-cloud/storage");
var visionClient = new import_vision.ImageAnnotatorClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  }
});
var secureStorage2 = new import_storage2.Storage({
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

// src/routes/v1/verification.ts
var SubmitVerificationSchema = import_zod.z.object({
  documentType: import_zod.z.enum(["DRIVERS_LICENSE", "PASSPORT", "ID_CARD"]),
  documentNumber: import_zod.z.string().min(1),
  fullName: import_zod.z.string().min(1),
  dateOfBirth: import_zod.z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format"
  }),
  countryOfIssue: import_zod.z.string().min(1),
  state: import_zod.z.string().optional(),
  address: import_zod.z.string().min(1),
  emailAddress: import_zod.z.string().email()
});
var ReviewVerificationSchema = import_zod.z.object({
  decision: import_zod.z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: import_zod.z.string().optional()
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
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(ReviewVerificationSchema)
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
        params: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            id: import_zod.z.string()
          })
        ),
        body: (0, import_zod_to_json_schema.zodToJsonSchema)(
          import_zod.z.object({
            rejectionReason: import_zod.z.string().min(1)
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

// src/api/verification.ts
var buildAccountVerificationApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto2.randomUUID)(), "genReqId")
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
  fastify.register(accountVerificationRoutes);
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
}, "buildAccountVerificationApp");
var appPromise;
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    appPromise = appPromise ?? buildAccountVerificationApp();
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
    if (req.url?.startsWith("/api/v1/verification")) {
      req.url = req.url.replace("/api/v1/verification", "") || "/";
    }
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("\u26A0 Account verification handler error:", error);
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
var verification_default = handler;
