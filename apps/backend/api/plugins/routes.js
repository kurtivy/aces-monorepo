"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const admin_1 = require("../routes/v1/admin");
const submissions_1 = require("../routes/v1/submissions");
const bids_1 = require("../routes/v1/bids");
const webhooks_1 = require("../routes/v1/webhooks");
const registerRoutesPlugin = async (fastify) => {
    fastify.register(admin_1.adminRoutes, { prefix: '/api/v1/admin' });
    fastify.register(submissions_1.submissionsRoutes, { prefix: '/api/v1/submissions' });
    fastify.register(bids_1.bidsRoutes, { prefix: '/api/v1/bids' });
    fastify.register(webhooks_1.webhooksRoutes, { prefix: '/api/v1/webhooks' });
};
exports.registerRoutes = (0, fastify_plugin_1.default)(registerRoutesPlugin);
