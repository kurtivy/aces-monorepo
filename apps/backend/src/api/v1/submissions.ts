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

import { StorageService } from '../../lib/storage-utils';
import { CreateSubmissionSchema, type CreateSubmissionRequest } from '@aces/utils';
import { errors } from '../../lib/errors';
import { SubmissionService } from '../../services/submission-service';
import { getPrismaClient } from '../../lib/database';
import { setupErrorHandling, setupCommonHooks, setupCommonPlugins } from '../shared/setup';

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
  await setupCommonPlugins(fastify, {
    multipart: true,
    fileSize: 5 * 1024 * 1024, // 5MB
  });

  // Setup error handling
  setupErrorHandling(fastify);

  // Setup common hooks (logging, cleanup)
  setupCommonHooks(fastify);

  // Direct image upload endpoint
  fastify.post('/upload-image', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file provided',
        });
      }

      // Validate file type
      if (!data.mimetype.startsWith('image/')) {
        return reply.status(400).send({
          success: false,
          error: 'File must be an image',
        });
      }

      // Validate file size (5MB limit)
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          error: 'File size too large (max 5MB)',
        });
      }

      // Upload to Google Cloud Storage
      const cleanFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `submissions/${Date.now()}-${cleanFilename}`;
      const bucket = StorageService.getBucket();
      const file = bucket.file(fileName);

      await file.save(buffer, {
        metadata: {
          contentType: data.mimetype,
        },
      });

      const publicUrl = StorageService.getPublicUrl(fileName);

      return reply.send({
        success: true,
        data: { publicUrl },
      });
    } catch (error) {
      fastify.log.error({ error, operation: 'uploadImage' }, 'Failed to upload image');
      return reply.status(500).send({
        success: false,
        error: 'Failed to upload image',
      });
    }
  });

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
