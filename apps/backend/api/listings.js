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
var listings_exports = {};
__export(listings_exports, {
  default: () => listings_default
});
module.exports = __toCommonJS(listings_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));
var import_zod = require("zod");
var import_listing_service = require("../services/listing-service");
var import_database = require("../lib/database");
var import_errors = require("../lib/errors");
var import_logger = require("../lib/logger");
var import_auth = require("../plugins/auth");
const listingService = new import_listing_service.ListingService((0, import_database.getPrismaClient)());
const toggleListingStatusSchema = import_zod.z.object({
  isLive: import_zod.z.boolean()
});
const listingParamsSchema = import_zod.z.object({
  listingId: import_zod.z.string().cuid()
});
const buildListingsApp = /* @__PURE__ */ __name(async () => {
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
  fastify.get("/", async (request, reply) => {
    try {
      import_logger.logger.info("Getting all live listings");
      const listings = await listingService.getLiveListings();
      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length
      });
    } catch (error) {
      import_logger.logger.error("Error getting live listings:", error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch live listings"
      });
    }
  });
  fastify.get(
    "/:listingId",
    async (request, reply) => {
      try {
        const { listingId } = listingParamsSchema.parse(request.params);
        import_logger.logger.info(`Getting listing by ID: ${listingId}`);
        const listing = await listingService.getListingById(listingId);
        return reply.status(200).send({
          success: true,
          data: listing
        });
      } catch (error) {
        import_logger.logger.error(`Error getting listing ${request.params.listingId}:`, error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: "Listing not found"
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch listing"
        });
      }
    }
  );
  fastify.post(
    "/:listingId/toggle",
    async (request, reply) => {
      try {
        const { listingId } = listingParamsSchema.parse(request.params);
        const { isLive } = toggleListingStatusSchema.parse(request.body);
        const userId = request.user?.id;
        const userRole = request.user?.role;
        if (!userId || userRole !== "ADMIN") {
          return reply.status(403).send({
            success: false,
            error: "Admin access required"
          });
        }
        import_logger.logger.info(`Admin ${userId} toggling listing ${listingId} to isLive: ${isLive}`);
        const updatedListing = await listingService.updateListingStatus({
          listingId,
          isLive,
          updatedBy: userId
        });
        return reply.status(200).send({
          success: true,
          data: updatedListing,
          message: `Listing ${isLive ? "activated" : "deactivated"} successfully`
        });
      } catch (error) {
        import_logger.logger.error(`Error toggling listing status for ${request.params.listingId}:`, error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: "Listing not found"
          });
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to update listing status"
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
      import_logger.logger.info(`Admin ${userId} getting all listings`);
      const listings = await listingService.getAllListings();
      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length
      });
    } catch (error) {
      import_logger.logger.error("Error getting all listings for admin:", error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch listings"
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
      import_logger.logger.info(`User ${userId} getting their listings`);
      const listings = await listingService.getListingsByOwner(userId);
      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length
      });
    } catch (error) {
      import_logger.logger.error(`Error getting listings for user ${request.user?.id}:`, error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch your listings"
      });
    }
  });
  return fastify;
}, "buildListingsApp");
const handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildListingsApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/listings")) {
    req.url = req.url.replace("/api/v1/listings", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var listings_default = handler;
//# sourceMappingURL=listings.js.map