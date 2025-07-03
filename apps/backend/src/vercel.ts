import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

let app: FastifyInstance | null = null;

/**
 * Caches the Fastify app instance for reuse across serverless function invocations.
 */
const getApp = async (): Promise<FastifyInstance> => {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
};

/**
 * The serverless handler for Vercel.
 * It initializes the Fastify app and passes the request to it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastifyApp = await getApp();
    fastifyApp.server.emit('request', req, res);
  } catch (error) {
    console.error('Error handling request:', error);
    // Ensure a response is sent even if the app fails to initialize
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
