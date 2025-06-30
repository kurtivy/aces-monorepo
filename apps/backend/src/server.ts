import { FastifyInstance } from 'fastify';
import { logger } from './lib/logger';
import { buildApp } from './app';

const start = async () => {
  let app: FastifyInstance | null = null;
  try {
    app = await buildApp();

    // Graceful shutdown handlers
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      if (app) {
        app.close().then(() => {
          logger.info('Server successfully closed.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    await app.listen({ port, host: '0.0.0.0' });

    logger.info(`Server listening at http://localhost:${port}`);
  } catch (err) {
    logger.error('Error starting server:', err);
    if (app) {
      await app.close();
    }
    process.exit(1);
  }
};

start();
