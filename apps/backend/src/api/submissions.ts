import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { StorageService } from '../lib/storage-utils';
import { CreateSubmissionSchema, type CreateSubmissionRequest } from '@aces/utils';
import { errors } from '../lib/errors';
import { SubmissionService } from '../services/submission-service';
import { getPrismaClient } from '../lib/database';

// Create a singleton instance of SubmissionService
const submissionService = new SubmissionService(getPrismaClient());

const GetSignedUrlSchema = z.object({
  fileType: z.string(),
});

export const submissionsApi: FastifyPluginAsync = async (fastify) => {
  // Get signed URL for image upload
  fastify.post<{ Body: z.infer<typeof GetSignedUrlSchema> }>('/api/submissions/get-upload-url', {
    schema: {
      body: GetSignedUrlSchema,
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
  fastify.post<{ Body: CreateSubmissionRequest }>('/api/submissions', {
    schema: {
      body: CreateSubmissionSchema,
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
};
