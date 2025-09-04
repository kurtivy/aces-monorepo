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
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// src/lib/logger.ts
var import_pino, logger, loggers;
var init_logger = __esm({
  "src/lib/logger.ts"() {
    "use strict";
    import_pino = require("pino");
    logger = (0, import_pino.pino)({
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
    loggers = {
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
  }
});

// src/lib/database.ts
var database_exports = {};
__export(database_exports, {
  checkDatabaseHealth: () => checkDatabaseHealth,
  disconnectDatabase: () => disconnectDatabase,
  getPrismaClient: () => getPrismaClient,
  safeDbOperation: () => safeDbOperation,
  testDatabaseConnection: () => testDatabaseConnection,
  withTransaction: () => withTransaction
});
var import_client, prisma, createPrismaClient, getPrismaClient, checkDatabaseHealth, testDatabaseConnection, disconnectDatabase, withTransaction, safeDbOperation;
var init_database = __esm({
  "src/lib/database.ts"() {
    "use strict";
    init_logger();
    import_client = require("@prisma/client");
    prisma = null;
    createPrismaClient = /* @__PURE__ */ __name(() => {
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
    getPrismaClient = /* @__PURE__ */ __name(() => {
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
    checkDatabaseHealth = /* @__PURE__ */ __name(async () => {
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
        logger.error("Database health check failed", error);
        return false;
      }
    }, "checkDatabaseHealth");
    testDatabaseConnection = /* @__PURE__ */ __name(async () => {
      try {
        console.log("\u{1F50D} Testing database connection...");
        if (!process.env.DATABASE_URL) {
          return {
            success: false,
            error: "DATABASE_URL environment variable not set"
          };
        }
        const client = getPrismaClient();
        const start = Date.now();
        const result = await client.$queryRaw`SELECT 1 as test, NOW() as timestamp`;
        const duration = Date.now() - start;
        console.log("\u2705 Database connection test successful:", {
          duration,
          result
        });
        return {
          success: true,
          details: {
            duration,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        };
      } catch (error) {
        console.error("\u274C Database connection test failed:", error);
        const errorDetails = {
          message: error instanceof Error ? error.message : "Unknown error",
          code: error?.code,
          name: error instanceof Error ? error.name : "Unknown"
        };
        logger.error("Database connection test failed", errorDetails);
        return {
          success: false,
          error: errorDetails.message,
          details: errorDetails
        };
      }
    }, "testDatabaseConnection");
    disconnectDatabase = /* @__PURE__ */ __name(async (timeoutMs = 5e3) => {
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
    withTransaction = /* @__PURE__ */ __name(async (callback) => {
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
    safeDbOperation = /* @__PURE__ */ __name(async (operation, fallback) => {
      try {
        return await operation();
      } catch (error) {
        console.error("\u274C Database operation failed:", error);
        logger.error("Database operation failed", error);
        if (fallback !== void 0) {
          return fallback;
        }
        return null;
      }
    }, "safeDbOperation");
  }
});

// src/api/health.ts
var health_exports = {};
__export(health_exports, {
  default: () => health_default
});
module.exports = __toCommonJS(health_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));

// src/lib/serverless-adapter.ts
function createServerlessHandler(createApp) {
  return async (req, res) => {
    const app = await createApp();
    try {
      await app.ready();
      let url = req.url || "/";
      if (url.startsWith("/api/v1/")) {
        const parts = url.split("/");
        if (parts.length >= 4) {
          url = parts.slice(4).join("/") || "/";
          if (!url.startsWith("/")) {
            url = "/" + url;
          }
        }
      }
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
      console.error("Serverless handler error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
__name(createServerlessHandler, "createServerlessHandler");

// src/api/health.ts
init_logger();

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

// src/api/health.ts
var buildHealthApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  fastify.register(import_helmet.default);
  fastify.addHook("onRequest", async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers["user-agent"]);
  });
  fastify.addHook("onResponse", async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });
  fastify.get("/live", async () => ({
    status: "ok",
    version: "1.0.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: "production"
  }));
  fastify.get("/ready", async () => {
    try {
      if (process.env.DATABASE_URL) {
        const { getPrismaClient: getPrismaClient2 } = await Promise.resolve().then(() => (init_database(), database_exports));
        const prisma2 = getPrismaClient2();
        await prisma2.$queryRaw`SELECT 1 as health_check`;
        return {
          status: "ready",
          version: "1.0.0",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          database: "connected"
        };
      } else {
        return {
          status: "ready",
          version: "1.0.0",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          database: "no_database_url"
        };
      }
    } catch (error) {
      return {
        status: "ready",
        version: "1.0.0",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        database: "error",
        databaseError: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  fastify.setErrorHandler((error, request, reply) => {
    try {
      handleError(error, reply);
    } catch (handlerError) {
      handleError(handlerError, reply);
    }
  });
  return fastify;
}, "buildHealthApp");
var health_default = createServerlessHandler(buildHealthApp);
