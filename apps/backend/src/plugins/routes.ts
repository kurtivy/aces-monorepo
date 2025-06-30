import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { adminRoutes } from '../routes/v1/admin';
import { submissionsRoutes } from '../routes/v1/submissions';
import { bidsRoutes } from '../routes/v1/bids';
import { webhooksRoutes } from '../routes/v1/webhooks';

const registerRoutesPlugin = async (fastify: FastifyInstance) => {
  fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  fastify.register(submissionsRoutes, { prefix: '/api/v1/submissions' });
  fastify.register(bidsRoutes, { prefix: '/api/v1/bids' });
  fastify.register(webhooksRoutes, { prefix: '/api/v1/webhooks' });
};

export const registerRoutes = fp(registerRoutesPlugin);
