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

    // Handle URL rewriting for v1 API paths
    let url = req.url || '/';
    
    // Remove /api prefix since we're already in the /api route
    if (url.startsWith('/api')) {
      url = url.substring(4); // Remove '/api'
      if (!url.startsWith('/')) {
        url = '/' + url;
      }
    }

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
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export default handler;
