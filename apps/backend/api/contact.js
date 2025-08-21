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
  fastify.post("/contact", async (request, reply) => {
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
//# sourceMappingURL=contact.js.map