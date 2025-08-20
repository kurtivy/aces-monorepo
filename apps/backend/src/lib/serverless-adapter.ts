import type { FastifyInstance } from 'fastify';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function createServerlessHandler(createApp: () => Promise<FastifyInstance>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const app = await createApp();

    try {
      await app.ready();

      // Handle URL rewriting for v1 API paths
      let url = req.url || '/';
      if (url.startsWith('/api/v1/')) {
        // Extract the endpoint name and the rest of the path
        const parts = url.split('/');
        if (parts.length >= 4) {
          // /api/v1/health/live → /live
          // /api/v1/submissions → /
          url = parts.slice(4).join('/') || '/';
          if (!url.startsWith('/')) {
            url = '/' + url;
          }
        }
      }

      // Use Fastify's inject method for serverless
      const response = await app.inject({
        method: req.method as any,
        url: url,
        headers: req.headers,
        payload: req.body,
      });

      // Set response headers
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });

      res.status(response.statusCode).send(response.payload);
    } catch (error) {
      console.error('Serverless handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
