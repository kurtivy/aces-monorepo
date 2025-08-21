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
var submissions_exports = {};
__export(submissions_exports, {
  default: () => submissions_default
});
module.exports = __toCommonJS(submissions_exports);
var import_fastify = __toESM(require("fastify"));
var import_crypto = require("crypto");
var import_helmet = __toESM(require("@fastify/helmet"));
var import_zod = require("zod");
var import_zod_to_json_schema = require("zod-to-json-schema");
var import_storage_utils = require("../lib/storage-utils");
var import_utils = require("@aces/utils");
var import_errors = require("../lib/errors");
var import_submission_service = require("../services/submission-service");
var import_database = require("../lib/database");
var import_logger = require("../lib/logger");
var import_auth = require("../plugins/auth");
const GetSignedUrlSchema = import_zod.z.object({
  fileType: import_zod.z.string()
});
let cachedApp = null;
const buildSubmissionsApp = /* @__PURE__ */ __name(async () => {
  if (cachedApp) {
    return cachedApp;
  }
  const fastify = (0, import_fastify.default)({
    logger: false,
    genReqId: /* @__PURE__ */ __name(() => (0, import_crypto.randomUUID)(), "genReqId")
  });
  const prisma = (0, import_database.getPrismaClient)();
  const submissionService = new import_submission_service.SubmissionService(prisma);
  fastify.decorate("prisma", prisma);
  fastify.register(import_helmet.default);
  fastify.register(import_auth.registerAuth);
  fastify.post("/get-upload-url", {
    schema: {
      body: (0, import_zod_to_json_schema.zodToJsonSchema)(GetSignedUrlSchema)
    },
    handler: /* @__PURE__ */ __name(async (request) => {
      try {
        const { fileType } = request.body;
        const { url, fileName } = await import_storage_utils.StorageService.getSignedUploadUrl(fileType);
        return { url, fileName, publicUrl: import_storage_utils.StorageService.getPublicUrl(fileName) };
      } catch (error) {
        throw import_errors.errors.internal("Failed to generate signed URL", { cause: error });
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
          throw import_errors.errors.unauthorized("User must be authenticated");
        }
        const submission = await submissionService.createSubmission(
          userId,
          request.body,
          request.id
          // Using request ID as correlation ID
        );
        return { success: true, data: submission };
      } catch (error) {
        throw import_errors.errors.internal("Failed to create submission", { cause: error });
      }
    }, "handler")
  });
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
    } catch (handlerError) {
      (0, import_errors.handleError)(handlerError, reply);
    }
  });
  cachedApp = fastify;
  return fastify;
}, "buildSubmissionsApp");
const handler = /* @__PURE__ */ __name(async (req, res) => {
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
//# sourceMappingURL=submissions.js.map