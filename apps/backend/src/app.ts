import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyWebSocket from '@fastify/websocket';

import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from './lib/database';
import { loggers } from './lib/logger';
import { handleError } from './lib/errors';
import { registerAuth } from './plugins/auth';
import cachePlugin from './plugins/cache-plugin';
import { submissionRoutes } from './routes/v1/submissions';
import { adminRoutes } from './routes/v1/admin'; // Step 2: Enabled
import { bidsRoutes } from './routes/v1/bids';
import { accountVerificationRoutes } from './routes/v1/verification';
import { usersRoutes } from './routes/v1/users';
import { listingRoutes } from './routes/v1/listings';
import { contactRoutes } from './routes/v1/contact';
import { conciergeRoutes } from './routes/v1/concierge';
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
import { marketCapRoutes } from './routes/v1/market-cap';

// GoldSky webhook for historical price tracking
import { goldskyWebhookRoutes } from './routes/webhooks/goldsky';

// Services
import { BitQueryService } from './services/bitquery-service';
import { TokenService } from './services/token-service';
import { AcesUsdPriceService } from './services/aces-usd-price-service';
import { AerodromeDataService } from './services/aerodrome-data-service';
import { ethers } from 'ethers';
import { debugRoutes } from './api/debug';
import { RateLimitMonitor } from './services/websocket/rate-limit-monitor';

// 🚀 NEW: Phase 1 WebSocket Gateway
import { WebSocketGateway } from './gateway/websocket-gateway';
import { websocketStatsRoutes } from './routes/v1/websocket-stats';

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

  const rateLimitMonitor = new RateLimitMonitor();
  fastify.decorate('rateLimitMonitor', rateLimitMonitor);

  // Initialize AerodromeDataService for AcesUsdPriceService
  const aerodromeService = new AerodromeDataService({
    acesTokenAddress:
      process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367',
    factoryAddress: '0x7e224ae4e6235bF18BBcb79cc2B5d04a7a6F8d1D',
    provider: provider,
    defaultStable: process.env.AERODROME_DEFAULT_STABLE === 'true',
  });

  const acesUsdPriceService = new AcesUsdPriceService(
    aerodromeService,
    process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367',
  );

  // Initialize services
  const bitQueryService = new BitQueryService(acesUsdPriceService, rateLimitMonitor);
  const tokenService = new TokenService(prisma);

  // Register services with Fastify instance
  fastify.decorate('acesUsdPriceService', acesUsdPriceService);
  fastify.decorate('bitQueryService', bitQueryService);

  // Register plugins
  fastify.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow CORS
  });
  fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Register WebSocket plugin with CORS origin validation
  await fastify.register(fastifyWebSocket, {
    options: {
      // Verify origin for WebSocket connections
      verifyClient: (info, callback) => {
        const origin = info.origin || info.req.headers.origin;
        const url = info.req.url;

        console.log(`[WebSocket] 🔍 Handshake request:`, {
          url,
          origin,
          host: info.req.headers.host,
          allHeaders: Object.keys(info.req.headers),
        });

        // Allow localhost origins for development
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
        ];

        // Add production origins
        if (process.env.FRONTEND_URL) {
          allowedOrigins.push(process.env.FRONTEND_URL);
        }
        if (process.env.VERCEL_URL) {
          allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
        }
        allowedOrigins.push(
          'https://www.aces.fun',
          'https://aces.fun',
          'https://aces-monorepo-git-dev-dan-aces-fun.vercel.app',
          'https://aces-monorepo-git-main-dan-aces-fun.vercel.app',
          'https://aces-monorepo-git-feat-ui-updates-dan-aces-fun.vercel.app',
          'https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app',
        );

        // Check if origin is allowed
        const isAllowed =
          origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'));

        if (isAllowed || !origin) {
          // Allow connection (no origin check in development, or origin is allowed)
          console.log(`[WebSocket] ✅ Allowing connection from origin: ${origin || 'no-origin'}`);
          callback(true);
        } else {
          console.warn(`[WebSocket] ❌ Rejected connection from origin: ${origin}`);
          callback(false, 403, 'Forbidden');
        }
      },
    },
  });

  // 🚀 Phase 1: Initialize WebSocket Gateway
  const gateway = WebSocketGateway.getInstance(fastify);
  await gateway.initialize();
  console.log('✅ Phase 1 WebSocket Gateway initialized');

  // 🚀 Phase 2: Initialize External Data Adapters
  const { AdapterManager } = await import('./services/websocket/adapter-manager');

  // Initialize adapter manager (non-blocking - BitQuery errors won't crash server)
  let adapterManager: any = null;
  try {
    adapterManager = new AdapterManager({
      quickNodeWsUrl: process.env.QUICKNODE_BASE_URL,
      goldskyWsUrl: process.env.GOLDSKY_WS_URL,
      goldskyApiKey: process.env.GOLDSKY_API_KEY,
      bitQueryWsUrl: process.env.BITQUERY_WS_URL,
      bitQueryApiKey: process.env.BITQUERY_API_KEY,
      acesUsdPriceService,
      rateLimitEnforcer: gateway.getRateLimitEnforcer(), // 🛡️ Enable rate limit enforcement
      prisma, // 🔥 NEW: Pass Prisma client for BitQuery trade storage
    });
    console.log('✅ AdapterManager initialized with rate limit enforcement');
  } catch (error: any) {
    console.warn('⚠️  AdapterManager initialization failed (non-blocking):', error.message);
    console.warn('⚠️  WebSocket adapters disabled - falling back to REST APIs');
    // Create a minimal adapter manager stub
    adapterManager = {
      connect: async () => {},
      isConnected: () => false,
    };
  }

  // Connect all adapters (QuickNode, Goldsky, BitQuery, Aerodrome)
  if (adapterManager && adapterManager.connect) {
    try {
      await adapterManager.connect();
      console.log('✅ Phase 2 External Adapters connected');
    } catch (error) {
      console.error('⚠️  Phase 2 Adapters failed to connect:', error);
      console.error('⚠️  WebSocket streaming disabled - falling back to REST APIs');
    }
  }

  // Decorate fastify with adapter manager for route access
  fastify.decorate('adapterManager', adapterManager);

  // Chart data store for live trade merging
  const { ChartDataStore } = await import('./services/chart-data-store');
  const chartDataStore = new ChartDataStore(fastify);
  fastify.decorate('chartDataStore', chartDataStore);

  // Chart Aggregation Service (will be enhanced with WebSocket streaming)
  const { ChartAggregationService } = await import('./services/chart-aggregation-service');
  const chartAggregationService = new ChartAggregationService(
    prisma,
    bitQueryService,
    acesUsdPriceService,
    tokenMetadataCache,
    acesSnapshotCache,
    fastify, // 🔥 PRICE FIX: Pass fastify for live trade merging
  );
  fastify.decorate('chartAggregationService', chartAggregationService);
  chartDataStore.setChartService(chartAggregationService);

  // Market Cap Service - Single Source of Truth
  const { MarketCapService } = await import('./services/market-cap-service');
  const marketCapService = new MarketCapService(
    prisma,
    bitQueryService,
    acesUsdPriceService,
    provider,
  );
  fastify.decorate('marketCapService', marketCapService);
  console.log('✅ Market Cap Service initialized');

  // Register custom plugins
  await fastify.register(cachePlugin); // 🔥 CRITICAL: Register cache plugin before routes
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
  fastify.register(conciergeRoutes, { prefix: '/api/v1/concierge' });
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

  // Register market cap routes (single source of truth)
  fastify.register(marketCapRoutes);

  fastify.register(debugRoutes);

  // Register GoldSky webhook routes (NO AUTH - uses webhook secret verification)
  fastify.register(goldskyWebhookRoutes, { prefix: '/api/webhooks/goldsky' });

  // 🚀 Phase 3: Register Real-Time WebSocket Routes
  const { tradesWebSocketRoutes } = await import('./routes/v1/ws/trades');
  const { bondingWebSocketRoutes } = await import('./routes/v1/ws/bonding');
  const { poolsWebSocketRoutes } = await import('./routes/v1/ws/pools');
  const { candlesWebSocketRoutes } = await import('./routes/v1/ws/candles');
  const { chartCompatWebSocketRoutes } = await import('./routes/v1/ws/chart-compat');
  const { metricsWebSocketRoutes } = await import('./routes/v1/ws/metrics');

  fastify.register(tradesWebSocketRoutes, { prefix: '/api/v1/ws' });
  fastify.register(bondingWebSocketRoutes, { prefix: '/api/v1/ws' });
  fastify.register(poolsWebSocketRoutes, { prefix: '/api/v1/ws' });
  fastify.register(candlesWebSocketRoutes, { prefix: '/api/v1/ws' });
  fastify.register(chartCompatWebSocketRoutes, { prefix: '/ws' }); // Legacy TradingView endpoint
  fastify.register(metricsWebSocketRoutes, { prefix: '/api/v1/ws' });
  console.log('✅ Phase 3 WebSocket routes registered');

  // 🚀 NEW: Register Phase 1 WebSocket stats routes
  fastify.register(websocketStatsRoutes);

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

  // Legacy WebSocket stats endpoint - DEPRECATED
  // Use /api/v1/ws/stats (from websocketStatsRoutes) instead
  fastify.get('/api/v1/ws/legacy-stats', async (request, reply) => {
    return reply.send({
      deprecated: true,
      message: 'This endpoint is deprecated. Use /api/v1/ws/stats instead',
      legacy: {
        bondingMonitor: 'DELETED - replaced by /api/v1/ws/bonding/:tokenAddress',
        chartWebSocket: 'DELETED - replaced by /api/v1/ws/candles/:tokenAddress',
      },
      newEndpoints: {
        stats: '/api/v1/ws/stats',
        trades: '/api/v1/ws/trades/:tokenAddress',
        bonding: '/api/v1/ws/bonding/:tokenAddress',
        pools: '/api/v1/ws/pools/:poolAddress?token=0xTOKEN',
        candles: '/api/v1/ws/candles/:tokenAddress?timeframe=1m',
      },
    });
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
