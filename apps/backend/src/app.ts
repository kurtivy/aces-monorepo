import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyWebSocket from '@fastify/websocket';

import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from './lib/database';
import { loggers } from './lib/logger';
import { handleError } from './lib/errors';
import { registerAuth } from './plugins/auth';
import { submissionRoutes } from './routes/v1/submissions';
import { adminRoutes } from './routes/v1/admin'; // Step 2: Enabled
import { bidsRoutes } from './routes/v1/bids';
import { accountVerificationRoutes } from './routes/v1/verification';
import { usersRoutes } from './routes/v1/users';
import { listingRoutes } from './routes/v1/listings';
import { contactRoutes } from './routes/v1/contact';
import { purchaseRoutes } from './routes/v1/purchase';
import { commentsRoutes } from './routes/v1/comments';
import { tokensRoutes } from './routes/v1/tokens';
import { portfolioRoutes } from './routes/v1/portfolio';
import { twitchRoutes } from './routes/v1/twitch';
import { dexRoutes } from './routes/v1/dex';

import { cronRoutes } from './routes/v1/cron/trigger';

// NEW: Phase 1 - Token creation and notifications
import { notificationRoutes } from './routes/v1/notifications';
import { tokenCreationRoutes } from './routes/v1/token-creation';
import productImagesRoutes from './routes/v1/product-images';
import { adminTokenRoutes } from './routes/v1/admin/tokens';
import { bondingRoutes } from './routes/v1/bonding';
import { bondingDataRoutes } from './routes/v1/bonding-data';
import { pricesRoutes } from './routes/v1/prices';
import { chartUnifiedRoutes } from './routes/v1/chart-unified';

// GoldSky webhook for historical price tracking
import { goldskyWebhookRoutes } from './routes/webhooks/goldsky';

// WebSocket services
import { ChartDataWebSocket } from './websockets/chart-data-socket';
import { BondingMonitorWebSocket } from './websockets/bonding-monitor-socket';
import { BitQueryService } from './services/bitquery-service';
import { TokenService } from './services/token-service';
import { AcesUsdPriceService } from './services/aces-usd-price-service';
import { AerodromeDataService } from './services/aerodrome-data-service';
import { ethers } from 'ethers';
import { debugRoutes } from './api/debug';

export const buildApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // 🔥 NEW: Initialize token metadata cache (shared across all routes)
  const { initTokenMetadataCache } = await import('./services/token-metadata-cache-service');
  const tokenMetadataCache = initTokenMetadataCache(prisma);
  fastify.decorate('tokenMetadataCache', tokenMetadataCache);

  // 🔥 NEW: Initialize ACES snapshot cache (for historical price queries)
  const { initAcesSnapshotCache } = await import('./services/aces-snapshot-cache-service');
  const acesSnapshotCache = initAcesSnapshotCache(prisma);
  fastify.decorate('acesSnapshotCache', acesSnapshotCache);

  // Initialize provider FIRST (needed by multiple services)
  // Use QuickNode (paid) first, fallback to Alchemy free tier
  const rpcUrl = process.env.QUICKNODE_BASE_URL || process.env.BASE_MAINNET_RPC_URL;

  if (!rpcUrl) {
    throw new Error('❌ No RPC URL configured! Set QUICKNODE_BASE_URL or BASE_MAINNET_RPC_URL');
  }

  console.log('[App] 🔗 Using RPC provider:', rpcUrl.substring(0, 40) + '...');
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Initialize services
  const bitQueryService = new BitQueryService();
  const tokenService = new TokenService(prisma);

  // Initialize AerodromeDataService for AcesUsdPriceService
  const aerodromeService = new AerodromeDataService({
    acesTokenAddress:
      process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367',
    factoryAddress: '0x7e224ae4e6235bF18BBcb79cc2B5d04a7a6F8d1D',
    apiBaseUrl: process.env.AERODROME_API_URL || 'https://base.api.aerodrome.finance/v1',
    apiKey: process.env.AERODROME_API_KEY || '',
    provider: provider,
  });

  const acesUsdPriceService = new AcesUsdPriceService(
    aerodromeService,
    process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367',
  );

  // Register services with Fastify instance
  fastify.decorate('bitQueryService', bitQueryService);
  fastify.decorate('acesUsdPriceService', acesUsdPriceService);

  // Register plugins
  fastify.register(helmet);
  fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Register WebSocket plugin and initialize WebSocket routes
  await fastify.register(fastifyWebSocket);

  // Check if WebSocket polling should be disabled (useful for frontend development)
  const disableWebSocketPolling = process.env.DISABLE_WEBSOCKET_POLLING === 'true';

  let chartWebSocket: ChartDataWebSocket | null = null;
  let bondingMonitor: BondingMonitorWebSocket | null = null;

  if (disableWebSocketPolling) {
    console.log('⏸️  WebSocket polling disabled via DISABLE_WEBSOCKET_POLLING=true');
  } else {
    // Initialize Chart WebSocket with new ChartAggregationService
    const { ChartAggregationService } = await import('./services/chart-aggregation-service');
    const chartAggregationService = new ChartAggregationService(
      prisma,
      bitQueryService,
      acesUsdPriceService,
      tokenMetadataCache, // 🔥 NEW: Pass token cache to chart service
      acesSnapshotCache, // 🔥 NEW: Pass snapshot cache to chart service
    );

    // 🔥 NEW: Decorate fastify so service can be reused across requests
    fastify.decorate('chartAggregationService', chartAggregationService);

    chartWebSocket = new ChartDataWebSocket(fastify, chartAggregationService, {
      pollIntervalMs: 3000, // 🔥 OPTIMIZED: Poll every 3s for faster trade display
    });
    await chartWebSocket.initialize();
    console.log('✅ Chart WebSocket enabled with ChartAggregationService');

    // Initialize Bonding Monitor WebSocket
    bondingMonitor = new BondingMonitorWebSocket(fastify, prisma, aerodromeService);
    await bondingMonitor.initialize();
    console.log('✅ Bonding Monitor WebSocket enabled');
  }

  // Decorate fastify with bonding monitor for access in routes (may be null)
  fastify.decorate('bondingMonitor', bondingMonitor);

  // Register custom plugins
  fastify.register(registerAuth);

  // Dynamic CORS configuration
  const getAllowedOrigins = () => {
    const origins = [];

    // Always allow localhost for development (regardless of NODE_ENV)
    origins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002');

    // Production origins from environment variables
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL);
    }

    // Staging/dev branch URLs (common Vercel pattern)
    if (process.env.VERCEL_URL) {
      origins.push(`https://${process.env.VERCEL_URL}`);
    }

    // Production domains
    origins.push(
      'https://www.aces.fun',
      'https://aces.fun',
      'https://aces-monorepo-git-dev-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-main-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-feat-ui-updates-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app',
    );

    return origins;
  };

  const isOriginAllowed = (origin: string | undefined): boolean => {
    if (!origin) return false;

    const allowedOrigins = getAllowedOrigins();

    // Exact match for listed origins
    if (allowedOrigins.includes(origin)) return true;

    // Allow any vercel.app preview deployment
    if (origin.endsWith('.vercel.app')) return true;

    return false;
  };

  // Add CORS hook to all requests
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;

    if (isOriginAllowed(origin)) {
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        .header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Accept, Origin, X-Requested-With',
        )
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Vary', 'Origin');
    }
  });

  // Handle OPTIONS preflight requests globally with proper CORS headers
  fastify.options('*', async (request, reply) => {
    const origin = request.headers.origin;

    if (isOriginAllowed(origin)) {
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        .header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Accept, Origin, X-Requested-With',
        )
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Access-Control-Max-Age', '86400')
        .header('Vary', 'Origin');
    }

    reply.code(204).send();
  });

  // Register v1 routes with proper API prefixes
  fastify.register(submissionRoutes, { prefix: '/api/v1/submissions' }); // Step 4: Enabled
  fastify.register(adminRoutes, { prefix: '/api/v1/admin' }); // Step 2: Enabled
  fastify.register(bidsRoutes, { prefix: '/api/v1/bids' }); // NEW: Bidding system
  fastify.register(accountVerificationRoutes, { prefix: '/api/v1/verification' }); // Step 2: Enabled
  fastify.register(usersRoutes, { prefix: '/api/v1/users' });
  // import { webhooksRoutes } from './routes/v1/webhooks';
  fastify.register(listingRoutes, { prefix: '/api/v1/listings' }); // Step 5: Enabled
  fastify.register(tokensRoutes, { prefix: '/api/v1/tokens' });
  fastify.register(portfolioRoutes, { prefix: '/api/v1/portfolio' });
  fastify.register(contactRoutes, { prefix: '/api/v1/contact' });
  fastify.register(purchaseRoutes, { prefix: '/api/v1/purchase' });
  fastify.register(commentsRoutes, { prefix: '/api/v1/comments' });
  fastify.register(twitchRoutes, { prefix: '/api/v1/twitch' });
  fastify.register(dexRoutes, { prefix: '/api/v1/dex' });

  // NEW: Phase 1 - Token creation and notifications
  fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  fastify.register(tokenCreationRoutes, { prefix: '/api/v1/token-creation' });
  fastify.register(productImagesRoutes, { prefix: '/api/v1/product-images' });
  fastify.register(adminTokenRoutes); // No prefix, routes define their own paths

  // Register cron routes for manual testing
  fastify.register(cronRoutes);

  fastify.register(bondingRoutes, { prefix: '/api/v1/bonding' });
  fastify.register(bondingDataRoutes, { prefix: '/api/v1/bonding' });

  fastify.register(pricesRoutes, { prefix: '/api/v1/prices' });

  // Register new unified chart route
  fastify.register(chartUnifiedRoutes);
  fastify.register(debugRoutes);

  // Register GoldSky webhook routes (NO AUTH - uses webhook secret verification)
  fastify.register(goldskyWebhookRoutes, { prefix: '/api/webhooks/goldsky' });

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });

  // Health check routes
  fastify.get('/health/live', async () => ({ status: 'ok' }));
  fastify.get('/health/ready', async () => {
    const isDbReady = await checkDatabaseHealth();
    if (!isDbReady) {
      throw new Error('Database not ready');
    }
    return { status: 'ready' };
  });

  // WebSocket stats endpoint
  fastify.get('/api/v1/ws/stats', async (request, reply) => {
    const stats: Record<string, any> = {
      bondingMonitor: bondingMonitor ? 'enabled' : 'disabled',
    };

    if (chartWebSocket) {
      stats.chartWebSocket = 'enabled';
      stats.chartStats = chartWebSocket.getStats();
    } else {
      stats.chartWebSocket = 'disabled';
    }

    return reply.send(stats);
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Log the error with full context
    loggers.error(error instanceof Error ? error : new Error('Unknown error'), {
      url: request.url,
      method: request.method,
      headers: request.headers,
      params: request.params,
      query: request.query,
      userId: request.user?.id,
      requestId: request.id,
    });

    try {
      handleError(error, reply);
    } catch (handlerError) {
      loggers.error(
        handlerError instanceof Error ? handlerError : new Error('Error handler failed'),
        {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          url: request.url,
          method: request.method,
          requestId: request.id,
        },
      );
      handleError(handlerError, reply);
    }
  });

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  return fastify;
};
