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
  default: () => submissions_default
});
module.exports = __toCommonJS(submissions_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto2 = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");

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

// src/api/submissions.ts
var import_utils = require("@aces/utils");

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
var withTransaction = /* @__PURE__ */ __name(async (callback) => {
  const client = getPrismaClient();
  return await client.$transaction(callback);
}, "withTransaction");

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

// src/api/submissions.ts
var GetSignedUrlSchema = import_zod.z.object({
  fileType: import_zod.z.string()
});
var cachedApp = null;
var buildSubmissionsApp = /* @__PURE__ */ __name(async () => {
  if (cachedApp) {
    return cachedApp;
  }
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto2.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  const submissionService = new SubmissionService(prisma2);
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(registerAuth);
  fastify.post("/get-upload-url", {
    schema: {
      body: (0, import_zod_to_json_schema.zodToJsonSchema)(GetSignedUrlSchema)
    },
    handler: /* @__PURE__ */ __name(async (request) => {
      try {
        const { fileType } = request.body;
        const { url, fileName } = await StorageService.getSignedUploadUrl(fileType);
        return { url, fileName, publicUrl: StorageService.getPublicUrl(fileName) };
      } catch (error) {
        throw errors.internal("Failed to generate signed URL", { cause: error });
      }
    }, "handler")
  });
  fastify.post("/", {
    schema: {
      body: (0, import_zod_to_json_schema.zodToJsonSchema)(import_utils.CreateSubmissionSchema)
    },
    handler: /* @__PURE__ */ __name(async (request) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          throw errors.unauthorized("User must be authenticated");
        }
        const submission = await submissionService.createSubmission(
          userId,
          request.body,
          request.id
          // Using request ID as correlation ID
        );
        return { success: true, data: submission };
      } catch (error) {
        throw errors.internal("Failed to create submission", { cause: error });
      }
    }, "handler")
  });
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
  cachedApp = fastify;
  return fastify;
}, "buildSubmissionsApp");
var handler = /* @__PURE__ */ __name(async (req, res) => {
  try {
    const app = await buildSubmissionsApp();
    await app.ready();
    if (req.url?.startsWith("/api/v1/submissions")) {
      req.url = req.url.replace("/api/v1/submissions", "") || "/";
    }
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("Submissions handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
}, "handler");
var submissions_default = handler;
