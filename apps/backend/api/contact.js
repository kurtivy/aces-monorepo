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

// src/api/contact.ts
var contact_exports = {};
__export(contact_exports, {
  default: () => contact_default
});
module.exports = __toCommonJS(contact_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));

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
  console.log("\u{1F527} Creating Prisma client...");
  console.log("Database URL exists:", !!process.env.DATABASE_URL);
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
    ],
    errorFormat: "pretty"
  });
  if (false) {
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

// src/plugins/auth.ts
var import_fastify_plugin = __toESM(require("fastify-plugin"));

// src/lib/auth-middleware.ts
var import_client2 = require("@prisma/client");
function createAuthContext(user) {
  try {
    console.log("\u{1F50D} createAuthContext called with:", {
      userExists: !!user,
      userActive: user?.isActive,
      sellerStatus: user?.sellerStatus,
      enumsAvailable: {
        SellerStatus: typeof import_client2.SellerStatus,
        UserRole: typeof import_client2.UserRole
      }
    });
    if (!user) {
      return {
        user: null,
        isAuthenticated: false,
        hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
        isSellerVerified: false,
        canAccessSellerDashboard: false
      };
    }
    const isAuthenticated = !!user && user.isActive;
    let isSellerVerified = false;
    if (user.sellerStatus) {
      isSellerVerified = user.sellerStatus === "APPROVED";
      if (!isSellerVerified && typeof import_client2.SellerStatus !== "undefined") {
        try {
          isSellerVerified = user.sellerStatus === import_client2.SellerStatus.APPROVED;
        } catch (enumError) {
          console.warn("Prisma SellerStatus enum not available:", enumError);
        }
      }
    }
    const canAccessSellerDashboard = isSellerVerified && !!user?.verifiedAt;
    console.log("\u2705 Auth context created:", {
      isAuthenticated,
      isSellerVerified,
      canAccessSellerDashboard,
      userRole: user.role
    });
    return {
      user,
      isAuthenticated,
      hasRole: /* @__PURE__ */ __name((role) => {
        if (!user) return false;
        try {
          const roles = Array.isArray(role) ? role : [role];
          return roles.some((r) => {
            return user.role === r;
          });
        } catch (error) {
          console.error("Error checking user role:", error);
          return false;
        }
      }, "hasRole"),
      isSellerVerified,
      canAccessSellerDashboard
    };
  } catch (error) {
    console.error("\u274C Critical error in createAuthContext:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : void 0,
      userProvided: !!user
    });
    return {
      user,
      isAuthenticated: false,
      hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
      isSellerVerified: false,
      canAccessSellerDashboard: false
    };
  }
}
__name(createAuthContext, "createAuthContext");

// src/plugins/auth.ts
var registerAuthPlugin = /* @__PURE__ */ __name(async (fastify) => {
  console.log("\u{1F527} Registering production auth plugin...");
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
        // Public live submissions
        "/search",
        // Public search
        "/stats",
        // Public stats
        "/test",
        // Test endpoint
        "/get-upload-url",
        // File upload - you may want to protect this
        "/upload-image"
        // Direct image upload
      ];
      const isPublicPath = publicPaths.some((path) => {
        if (request.url === path) return true;
        if (path === "/health" && request.url.startsWith("/health")) return true;
        return false;
      }) || request.method === "GET" && ["/live", "/search", "/stats"].includes(request.url);
      if (isPublicPath) {
        console.log("\u2705 Public path, skipping auth:", request.url);
        request.user = null;
        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error("\u274C Error creating auth context for public path:", authError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
            isSellerVerified: false,
            canAccessSellerDashboard: false
          };
        }
        return;
      }
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.log("\u274C No valid auth header for protected route:", request.url);
        request.user = null;
        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error("\u274C Error creating auth context for unauthenticated user:", authError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
            isSellerVerified: false,
            canAccessSellerDashboard: false
          };
        }
        const protectedRoutes = ["/my", "/create", "/me"];
        if (protectedRoutes.includes(request.url)) {
          return reply.status(401).send({
            success: false,
            error: "Authentication required",
            code: "UNAUTHORIZED"
          });
        }
        return;
      }
      console.log("\u{1F50D} Auth header found, testing database connection...");
      const prisma2 = getPrismaClient();
      try {
        const dbStart = Date.now();
        await prisma2.$queryRaw`SELECT 1`;
        console.log("\u2705 Database connection successful in", Date.now() - dbStart, "ms");
        console.log("\u{1F50D} Creating auth context...");
        request.user = null;
        try {
          request.auth = createAuthContext(null);
          console.log("\u2705 Auth context created successfully");
        } catch (authContextError) {
          console.error("\u274C Error in createAuthContext:", authContextError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
            isSellerVerified: false,
            canAccessSellerDashboard: false
          };
        }
        console.log("\u2705 Auth hook completed in", Date.now() - startTime, "ms");
      } catch (dbError) {
        console.error("\u274C Database connection failed:", dbError);
        return reply.status(503).send({
          success: false,
          error: "Service temporarily unavailable",
          code: "DATABASE_ERROR"
        });
      }
    } catch (error) {
      console.error("\u274C Unexpected auth hook error:", error);
      request.user = null;
      request.auth = {
        user: null,
        isAuthenticated: false,
        hasRole: /* @__PURE__ */ __name(() => false, "hasRole"),
        isSellerVerified: false,
        canAccessSellerDashboard: false
      };
      console.log("\u{1F527} Continuing with no auth due to error");
    }
  });
  console.log("\u2705 Production auth plugin registered");
}, "registerAuthPlugin");
var registerAuth = (0, import_fastify_plugin.default)(registerAuthPlugin, {
  name: "auth-plugin"
});

// src/routes/v1/contact.ts
var import_zod = require("zod");

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
};

// src/routes/v1/contact.ts
var contactFormSchema = import_zod.z.object({
  category: import_zod.z.string().min(1, "Category is required"),
  itemName: import_zod.z.string().min(1, "Item name is required"),
  email: import_zod.z.string().email("Valid email is required")
});
async function contactRoutes(fastify) {
  fastify.post("/", async (request, reply) => {
    try {
      const validationResult = contactFormSchema.safeParse(request.body);
      if (!validationResult.success) {
        const errors2 = validationResult.error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        );
        return reply.status(400).send({
          success: false,
          message: "Validation failed",
          errors: errors2
        });
      }
      const formData = validationResult.data;
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
          message: "Invalid category selected"
        });
      }
      const emailResult = await EmailService.sendContactFormEmail(formData);
      if (!emailResult.success) {
        console.error("Failed to send contact form email:", emailResult.error);
        return reply.status(500).send({
          success: false,
          message: "Failed to send your message. Please try again later."
        });
      }
      console.log("Contact form submitted successfully:", {
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
      console.error("Contact form submission error:", error);
      return reply.status(500).send({
        success: false,
        message: "Internal server error. Please try again later."
      });
    }
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

// src/api/contact.ts
var buildContactApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma2 = getPrismaClient();
  fastify.decorate("prisma", prisma2);
  fastify.register(import_helmet.default);
  fastify.register(registerAuth);
  fastify.register(contactRoutes);
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
}, "buildContactApp");
var handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildContactApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/contact")) {
    req.url = req.url.replace("/api/v1/contact", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var contact_default = handler;
