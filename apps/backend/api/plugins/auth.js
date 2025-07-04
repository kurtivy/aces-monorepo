"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuth = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const server_auth_1 = require("@privy-io/server-auth");
const logger_1 = require("../lib/logger");
const registerAuthPlugin = async (fastify) => {
    // Always decorate the request with user property
    fastify.decorateRequest('user', null);
    // Skip auth verification if Privy credentials are missing
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
        fastify.log.warn('Privy credentials missing - authentication disabled');
        return;
    }
    const privyClient = new server_auth_1.PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
    fastify.addHook('preHandler', async (request) => {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const claims = (await privyClient.verifyAuthToken(token));
                const user = await fastify.prisma.user.upsert({
                    where: { privyDid: claims.userId },
                    update: { walletAddress: claims.walletAddress || null },
                    create: {
                        privyDid: claims.userId,
                        walletAddress: claims.walletAddress,
                    },
                });
                if (user) {
                    logger_1.loggers.auth(user.id, user.walletAddress, 'authenticated');
                }
                request.user = user;
            }
            catch (error) {
                fastify.log.warn('Auth verification failed:', error);
            }
        }
    });
};
exports.registerAuth = (0, fastify_plugin_1.default)(registerAuthPlugin);
