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
var account_verification_exports = {};
__export(account_verification_exports, {
  default: () => account_verification_default
});
module.exports = __toCommonJS(account_verification_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));
var import_multipart = __toESM(require("@fastify/multipart"));
var import_database = require("../lib/database");
var import_logger = require("../lib/logger");
var import_errors = require("../lib/errors");
var import_auth = require("../plugins/auth");
var import_account_verification = require("../routes/v1/account-verification");
const buildAccountVerificationApp = /* @__PURE__ */ __name(async () => {
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma = (0, import_database.getPrismaClient)();
  fastify.decorate("prisma", prisma);
  fastify.register(import_helmet.default);
  fastify.register(import_multipart.default, {
    limits: {
      fileSize: 5 * 1024 * 1024
      // 5MB
    }
  });
  fastify.register(import_auth.registerAuth);
  fastify.register(import_account_verification.accountVerificationRoutes);
  fastify.addHook("onRequest", async (request) => {
    request.startTime = Date.now();
    import_logger.loggers.request(request.id, request.method, request.url, request.headers["user-agent"]);
  });
  fastify.addHook("onResponse", async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    import_logger.loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
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
  return fastify;
}, "buildAccountVerificationApp");
const handler = /* @__PURE__ */ __name(async (req, res) => {
  const app = await buildAccountVerificationApp();
  await app.ready();
  if (req.url?.startsWith("/api/v1/account-verification")) {
    req.url = req.url.replace("/api/v1/account-verification", "") || "/";
  }
  app.server.emit("request", req, res);
}, "handler");
var account_verification_default = handler;
//# sourceMappingURL=account-verification.js.map