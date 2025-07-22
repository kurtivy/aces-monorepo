import fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAuth } from './plugins/auth';
import { submissionsRoutes } from './routes/v1/submissions';
import { webhooksRoutes } from './routes/v1/webhooks';
import { adminRoutes } from './routes/v1/admin';
import { sellerVerificationRoutes } from './routes/v1/seller-verification';
import { userProfileRoutes } from './routes/v1/user-profile';
import { PrismaClient } from '@prisma/client';
import multipart from '@fastify/multipart';

const server = fastify({
  logger: true,
});

// Register plugins
server.register(cors, {
  origin: true,
  credentials: true,
});

server.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Register auth plugin
server.register(registerAuth);

// Add Prisma to fastify instance
server.decorate('prisma', new PrismaClient());

// Register routes
server.get('/api/v1/health/live', async () => ({ status: 'ok' }));
server.register(submissionsRoutes, { prefix: '/api/v1/submissions' });
server.register(webhooksRoutes, { prefix: '/api/v1/webhooks' });
server.register(adminRoutes, { prefix: '/api/v1/admin' });
server.register(sellerVerificationRoutes, { prefix: '/api/v1/seller-verification' });
server.register(userProfileRoutes, { prefix: '/api/v1/users' }); // Changed from user-profile to users

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3002, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
