import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { User as PrismaUser, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Extend Fastify types to include custom properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    user: PrismaUser | null;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

import { StorageService } from '../lib/storage-utils';
import { CreateSubmissionSchema, type CreateSubmissionRequest } from '@aces/utils';
import { errors } from '../lib/errors';
import { SubmissionService } from '../services/submission-service';
import { getPrismaClient } from '../lib/database';
import { setupCommonPlugins, setupErrorHandling, setupCommonHooks } from './shared/setup';

const GetSignedUrlSchema = z.object({
  fileType: z.string(),
});

const buildSubmissionsApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  const submissionService = new SubmissionService(prisma);

  fastify.decorate('prisma', prisma);

  // Setup common plugins (CORS, helmet, auth, multipart)
  await setupCommonPlugins(fastify, { multipart: true });

  // Setup error handling
  setupErrorHandling(fastify);

  // Setup common hooks (logging, cleanup)
  setupCommonHooks(fastify);

  // Get signed URL for image upload
  fastify.post<{ Body: z.infer<typeof GetSignedUrlSchema> }>('/get-upload-url', {
    schema: {
      body: zodToJsonSchema(GetSignedUrlSchema),
    },
    handler: async (request) => {
      try {
        const { fileType } = request.body;
        const { url, fileName } = await StorageService.getSignedUploadUrl(fileType);
        return { url, fileName, publicUrl: StorageService.getPublicUrl(fileName) };
      } catch (error) {
        throw errors.internal('Failed to generate signed URL', { cause: error });
      }
    },
  });

  // Create submission endpoint
  fastify.post<{ Body: CreateSubmissionRequest }>('/', {
    schema: {
      body: zodToJsonSchema(CreateSubmissionSchema),
    },
    handler: async (request) => {
      try {
        // Get the user ID from the authenticated session
        const userId = request.user?.id;
        if (!userId) {
          throw errors.unauthorized('User must be authenticated');
        }

        const submission = await submissionService.createSubmission(
          userId,
          request.body,
          request.id, // Using request ID as correlation ID
        );

        return { success: true, data: submission };
      } catch (error) {
        throw errors.internal('Failed to create submission', { cause: error });
      }
    },
  });

  // Common hooks and error handling are now setup via setupCommonHooks() and setupErrorHandling()

  return fastify;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildSubmissionsApp();
  await app.ready();

  // Handle path rewriting: /api/v1/submissions/... → /...
  if (req.url?.startsWith('/api/v1/submissions')) {
    req.url = req.url.replace('/api/v1/submissions', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
