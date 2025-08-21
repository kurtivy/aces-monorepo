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
var tokens_exports = {};
__export(tokens_exports, {
  default: () => tokens_default
});
module.exports = __toCommonJS(tokens_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));
var import_zod = require("zod");
var import_token_service = require("../services/token-service");
var import_database = require("../lib/database");
var import_errors = require("../lib/errors");
var import_logger = require("../lib/logger");
var import_auth = require("../plugins/auth");
const tokenService = new import_token_service.TokenService((0, import_database.getPrismaClient)());
const createTokenSchema = import_zod.z.object({
  listingId: import_zod.z.string().cuid(),
  contractAddress: import_zod.z.string().min(1)
});
const tokenParamsSchema = import_zod.z.object({
  tokenId: import_zod.z.string().cuid()
});
const contractAddressParamsSchema = import_zod.z.object({
  contractAddress: import_zod.z.string().min(1)
});
const buildTokensApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma = (0, import_database.getPrismaClient)();
  fastify.decorate("prisma", prisma);
  fastify.register(import_helmet.default);
  fastify.register(import_auth.registerAuth);
  fastify.addHook("onRequest", async (request) => {
    request.startTime = Date.now();
    import_logger.logger.info(`${request.id} ${request.method} ${request.url} ${request.headers["user-agent"]}`);
  });
  fastify.addHook("onResponse", async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    import_logger.logger.info(
      `${request.id} ${request.method} ${request.url} ${reply.statusCode} ${responseTime}ms`
    );
  });
  fastify.setErrorHandler((error, request, reply) => {
    try {
      (0, import_errors.handleError)(error, reply);
    } catch (error2) {
      (0, import_errors.handleError)(error2, reply);
    }
  });
  fastify.addHook("onClose", async () => {
    await (0, import_database.disconnectDatabase)();
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
          const listing = await (0, import_database.getPrismaClient)().rwaListing.findUnique({
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
        import_logger.logger.info(`User ${userId} creating token for listing ${listingId}`);
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
        import_logger.logger.error("Error creating token:", error);
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
        import_logger.logger.info(`Getting token by ID: ${tokenId}`);
        const token = await tokenService.getTokenById(tokenId);
        return reply.status(200).send({
          success: true,
          data: token
        });
      } catch (error) {
        import_logger.logger.error(`Error getting token ${request.params.tokenId}:`, error);
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
        import_logger.logger.info(`Getting token by contract address: ${contractAddress}`);
        const token = await tokenService.getTokenByContractAddress(contractAddress);
        return reply.status(200).send({
          success: true,
          data: token
        });
      } catch (error) {
        import_logger.logger.error(
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
      import_logger.logger.info(`Admin ${userId} getting all tokens`);
      const tokens = await tokenService.getAllTokens();
      return reply.status(200).send({
        success: true,
        data: tokens,
        count: tokens.length
      });
    } catch (error) {
      import_logger.logger.error("Error getting all tokens for admin:", error);
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
      import_logger.logger.info(`User ${userId} getting their tokens`);
      const tokens = await tokenService.getTokensByUser(userId);
      return reply.status(200).send({
        success: true,
        data: tokens,
        count: tokens.length
      });
    } catch (error) {
      import_logger.logger.error(`Error getting tokens for user ${request.user?.id}:`, error);
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
        import_logger.logger.info(`Admin ${userId} deleting token ${tokenId}`);
        await tokenService.deleteToken(tokenId);
        return reply.status(200).send({
          success: true,
          message: "Token deleted successfully"
        });
      } catch (error) {
        import_logger.logger.error(`Error deleting token ${request.params.tokenId}:`, error);
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
const handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildTokensApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/tokens")) {
    req.url = req.url.replace("/api/v1/tokens", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var tokens_default = handler;
//# sourceMappingURL=tokens.js.map