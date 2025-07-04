"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = void 0;
const fastify_1 = __importDefault(require("fastify"));
const crypto_1 = require("crypto");
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const fastify_metrics_1 = __importDefault(require("fastify-metrics"));
const database_1 = require("./lib/database");
const logger_1 = require("./lib/logger");
const errors_1 = require("./lib/errors");
const auth_1 = require("./plugins/auth");
const routes_1 = require("./plugins/routes");
const buildApp = async () => {
    const fastify = (0, fastify_1.default)({
        logger: false,
        genReqId: () => (0, crypto_1.randomUUID)(),
    });
    const prisma = (0, database_1.getPrismaClient)();
    fastify.decorate('prisma', prisma);
    // Register plugins
    fastify.register(cors_1.default, { origin: '*' });
    fastify.register(helmet_1.default);
    // Temporarily disable under-pressure for development
    // fastify.register(underPressure, {
    //   maxEventLoopDelay: 1000,
    //   maxHeapUsedBytes: 100000000,
    //   maxRssBytes: 100000000,
    // });
    fastify.register(fastify_metrics_1.default, {
        endpoint: '/metrics',
        routeMetrics: { enabled: true },
    });
    // Register custom plugins
    fastify.register(auth_1.registerAuth);
    fastify.register(routes_1.registerRoutes);
    // Register hooks
    fastify.addHook('onRequest', async (request) => {
        request.startTime = Date.now();
        logger_1.loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
    });
    fastify.addHook('onResponse', async (request, reply) => {
        const responseTime = request.startTime ? Date.now() - request.startTime : 0;
        logger_1.loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
    });
    // Health check routes
    fastify.get('/api/v1/health/live', async () => ({ status: 'ok' }));
    fastify.get('/api/v1/health/ready', async () => {
        const isDbReady = await (0, database_1.checkDatabaseHealth)();
        if (!isDbReady) {
            throw new Error('Database not ready');
        }
        return { status: 'ready' };
    });
    // Global error handler
    fastify.setErrorHandler((error, request, reply) => {
        (0, errors_1.handleError)(reply, error);
    });
    fastify.addHook('onClose', async () => {
        await (0, database_1.disconnectDatabase)();
    });
    return fastify;
};
exports.buildApp = buildApp;
