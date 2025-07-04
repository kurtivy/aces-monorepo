import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

let app: FastifyInstance | null = null;
let initializationError: Error | null = null;
let startupTime: number | null = null;

/**
 * Caches the Fastify app instance for reuse across serverless function invocations.
 */
const getApp = async (): Promise<FastifyInstance> => {
  if (initializationError) {
    console.error('Previous initialization failed, rethrowing error:', initializationError.message);
    throw initializationError;
  }

  if (!app) {
    const startTime = Date.now();
    console.log('=== Fastify App Initialization Started ===');
    console.log('Node.js version:', process.version);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Vercel region:', process.env.VERCEL_REGION || 'unknown');
    console.log('Available memory:', process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 'unknown');

    try {
      console.log('Building Fastify app...');
      app = await buildApp();

      console.log('Calling app.ready()...');
      await app.ready();

      startupTime = Date.now() - startTime;
      console.log(`=== Fastify App Initialized Successfully in ${startupTime}ms ===`);
      console.log('Registered routes:', app.printRoutes());
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      console.error('=== Fastify App Initialization Failed ===');
      console.error('Duration before failure:', `${duration}ms`);
      console.error('Error name:', initializationError.name);
      console.error('Error message:', initializationError.message);
      console.error('Error stack:', initializationError.stack);

      // Log environment context for debugging
      console.error('Environment context:');
      console.error('- NODE_ENV:', process.env.NODE_ENV);
      console.error('- DATABASE_URL present:', !!process.env.DATABASE_URL);
      console.error('- PRIVY_APP_ID present:', !!process.env.PRIVY_APP_ID);
      console.error('- PRIVY_APP_SECRET present:', !!process.env.PRIVY_APP_SECRET);
      console.error('- JWT_SECRET present:', !!process.env.JWT_SECRET);
      console.error('- CORS_ORIGINS present:', !!process.env.CORS_ORIGINS);

      throw initializationError;
    }
  }
  return app;
};

/**
 * The serverless handler for Vercel.
 * It initializes the Fastify app and passes the request to it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestStart = Date.now();
  console.log(`=== Processing ${req.method} ${req.url} ===`);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));

  try {
    const fastifyApp = await getApp();
    console.log(`App ready, processing request (startup took ${startupTime}ms)`);

    fastifyApp.server.emit('request', req, res);
  } catch (error) {
    const duration = Date.now() - requestStart;
    console.error('=== Request Handler Error ===');
    console.error('Request duration before error:', `${duration}ms`);
    console.error('Error during request handling:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Ensure a response is sent even if the app fails to initialize
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        type: 'FUNCTION_INVOCATION_FAILED',
        context: {
          method: req.method,
          url: req.url,
          hasApp: !!app,
          startupTime: startupTime,
        },
      });
    }
  }
}
