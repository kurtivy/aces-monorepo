import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../app';

let appPromise: Promise<any> | undefined;

const handler = async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Initialize app only once
    if (!appPromise) {
      appPromise = buildApp();
    }

    const app = await appPromise;
    await app.ready();

    // Use the original URL since Fastify routes are registered with /api/v1/* prefixes
    let url = req.url || '/';

    // Use Fastify's inject method for serverless
    const response = await app.inject({
      method: req.method as any,
      url: url,
      headers: req.headers as any,
      payload: req.body,
    });

    // Set response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value as string);
    });

    res.status(response.statusCode).send(response.payload);
  } catch (error) {
    console.error('API handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export default handler;
