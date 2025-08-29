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
var createPrismaClient = /* @__PURE__ */ __name(() => {
  console.log("\u{1F527} Creating Prisma client...");
  console.log("Database URL exists:", !!process.env.DATABASE_URL);
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

// src/routes/v1/verification.ts
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");

// src/services/verification-service.ts
var import_client2 = require("@prisma/client");

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

// src/services/verification-service.ts
var AccountVerificationService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "AccountVerificationService");
  }
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
      const verification = await this.prisma.accountVerification.upsert({
        where: { userId },
        create: {
          userId,
          ...data,
          documentImageUrl,
          status: import_client2.VerificationStatus.PENDING,
          attempts: 1,
          lastAttemptAt: /* @__PURE__ */ new Date()
        },
        update: {
          ...data,
          documentImageUrl,
          status: import_client2.VerificationStatus.PENDING,
          attempts: { increment: 1 },
          lastAttemptAt: /* @__PURE__ */ new Date(),
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null
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
    if (decision === import_client2.VerificationStatus.PENDING) {
      throw errors.badRequest("Cannot set verification status to pending during review");
    }
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { id: verificationId }
      });
      if (!verification) {
        throw errors.notFound("Verification not found");
      }
      if (verification.status !== import_client2.VerificationStatus.PENDING) {
        throw errors.badRequest("Verification has already been reviewed");
      }
      const updatedVerification = await this.prisma.accountVerification.update({
        where: { id: verificationId },
        data: {
          status: decision,
          reviewedAt: /* @__PURE__ */ new Date(),
          reviewedBy: reviewerId,
          rejectionReason: decision === import_client2.VerificationStatus.REJECTED ? rejectionReason : null
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
      return updatedVerification;
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
        where: { status: import_client2.VerificationStatus.PENDING },
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

// src/routes/v1/verification.ts
var import_client3 = require("@prisma/client");
var SubmitVerificationSchema = import_zod.z.object({
  documentType: import_zod.z.enum(["DRIVERS_LICENSE", "PASSPORT", "ID_CARD"]),
  documentNumber: import_zod.z.string().min(1),
  firstName: import_zod.z.string().min(1),
  lastName: import_zod.z.string().min(1),
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
            if (part.type === "file" && part.fieldname === "documentImage") {
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
        const verificationData = {
          ...data,
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
          verificationData,
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
          import_client3.VerificationStatus.APPROVED
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
          import_client3.VerificationStatus.REJECTED,
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
        "https://aces.fun"
      ].includes(origin2);
    }, "isOriginAllowed");
    if (isOriginAllowed(origin) && origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
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
