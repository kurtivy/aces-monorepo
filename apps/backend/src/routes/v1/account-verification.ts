import { FastifyInstance } from 'fastify';
import { AccountVerificationService } from '../../services/account-verification-service';
import { requireAuth, requireAdmin } from '../../lib/auth-middleware';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MultipartFile } from '@fastify/multipart';
import { errors } from '../../lib/errors';
import { logger } from '../../lib/logger';

interface CustomError extends Error {
  statusCode?: number;
}

// Validation schemas
const VerificationSubmissionSchema = z.object({
  documentType: z.string().min(1, 'Document type is required'),
  documentNumber: z.string().min(1, 'Document number is required'),
  fullName: z.string().min(1, 'Full name is required'),
  dateOfBirth: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
  countryOfIssue: z.string().min(1, 'Country of issue is required'),
  state: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  emailAddress: z.string().email('Invalid email address'),
});

const VerificationApprovalSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().optional().nullable(),
});

// File validation
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface DocumentFile extends MultipartFile {
  buffer: Buffer;
  mimetype: (typeof ALLOWED_MIME_TYPES)[number];
}

function validateFile(file: MultipartFile): DocumentFile {
  if (!file || !file.mimetype) {
    throw errors.badRequest('Document file is required');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw errors.badRequest('Invalid file type. Please upload a JPEG, PNG, or PDF file.');
  }

  return file as DocumentFile;
}

export async function accountVerificationRoutes(fastify: FastifyInstance) {
  const verificationService = new AccountVerificationService(fastify.prisma);
  const log = logger.child({ module: 'account-verification-routes' });

  fastify.post(
    '/submit',
    {
      preHandler: [requireAuth],
      schema: {
        consumes: ['multipart/form-data'],
        body: {
          type: 'object',
          properties: {
            documentType: { type: 'string', minLength: 1 },
            documentNumber: { type: 'string', minLength: 1 },
            fullName: { type: 'string', minLength: 1 },
            dateOfBirth: { type: 'string', format: 'date' },
            countryOfIssue: { type: 'string', minLength: 1 },
            state: { type: 'string' },
            address: { type: 'string', minLength: 1 },
            emailAddress: { type: 'string', format: 'email' },
            documentFile: {
              type: 'string',
              format: 'binary',
              contentMediaType: ALLOWED_MIME_TYPES.join(','),
              maxLength: MAX_FILE_SIZE,
            },
          },
          required: [
            'documentType',
            'documentNumber',
            'fullName',
            'dateOfBirth',
            'countryOfIssue',
            'address',
            'emailAddress',
            'documentFile',
          ],
        } as const,
      },
    },
    async (request, reply) => {
      try {
        if (!request.isMultipart()) {
          throw errors.badRequest('Request must be multipart/form-data');
        }

        const parts = request.parts();
        const fields: Record<string, string> = {};
        let documentFile: DocumentFile | null = null;

        for await (const part of parts) {
          if (part.type === 'field') {
            fields[part.fieldname] = part.value as string;
          } else if (part.type === 'file' && part.fieldname === 'documentFile') {
            // Validate and store file
            documentFile = validateFile(part);
            const buffer = await part.toBuffer();
            if (buffer.length > MAX_FILE_SIZE) {
              throw errors.badRequest(`File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`);
            }
            documentFile.buffer = buffer;
          }
        }

        // Validate form data
        const formData = VerificationSubmissionSchema.parse(fields);

        if (!documentFile) {
          throw errors.badRequest('Document file is required');
        }

        // Submit verification
        const result = await verificationService.submitVerification(
          request.user!.id,
          {
            ...formData,
            dateOfBirth: new Date(formData.dateOfBirth),
            firstName: '',
            lastName: '',
          },
          documentFile,
        );

        log.info('Verification submitted successfully', {
          userId: request.user!.id,
          verificationId: result.id,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        log.error('Verification submission error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: request.user!.id,
        });

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid form data',
            details: error.errors,
          });
        }

        const customError = error as CustomError;
        if (customError.statusCode) {
          return reply.status(customError.statusCode).send({
            success: false,
            error: customError.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    },
  );

  fastify.delete(
    '/document',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        await verificationService.deleteVerificationDocument(request.user!.id);
        return reply.send({
          success: true,
          message: 'Document deleted successfully',
        });
      } catch (error: unknown) {
        log.error('Document deletion error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: request.user!.id,
        });

        const customError = error as CustomError;
        if (customError.statusCode) {
          return reply.status(customError.statusCode).send({
            success: false,
            error: customError.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to delete document',
        });
      }
    },
  );

  fastify.get(
    '/status',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const status = await verificationService.getUserVerificationStatus(request.user!.id);
        return reply.send({
          success: true,
          data: status,
        });
      } catch (error: unknown) {
        log.error('Status check error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: request.user!.id,
        });

        const customError = error as CustomError;
        if (customError.statusCode) {
          return reply.status(customError.statusCode).send({
            success: false,
            error: customError.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to get verification status',
        });
      }
    },
  );

  fastify.get(
    '/admin/pending',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const pendingVerifications = await verificationService.getAllPendingVerifications();
        return reply.send({
          success: true,
          data: pendingVerifications,
        });
      } catch (error: unknown) {
        log.error('Pending verifications fetch error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          adminId: request.user!.id,
        });

        const customError = error as CustomError;
        if (customError.statusCode) {
          return reply.status(customError.statusCode).send({
            success: false,
            error: customError.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch pending verifications',
        });
      }
    },
  );

  fastify.post(
    '/admin/process/:verificationId',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            verificationId: z.string().uuid('Invalid verification ID'),
          }),
        ),
        body: zodToJsonSchema(VerificationApprovalSchema),
      },
    },
    async (request, reply) => {
      try {
        const { verificationId } = request.params as { verificationId: string };
        const { approve, rejectionReason } = VerificationApprovalSchema.parse(request.body);

        const result = await verificationService.processVerification(
          verificationId,
          request.user!.id,
          approve,
          rejectionReason || undefined,
        );

        log.info('Verification processed', {
          verificationId,
          adminId: request.user!.id,
          approved: approve,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        log.error('Verification processing error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          adminId: request.user!.id,
          verificationId: (request.params as { verificationId: string }).verificationId,
        });

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          });
        }

        const customError = error as CustomError;
        if (customError.statusCode) {
          return reply.status(customError.statusCode).send({
            success: false,
            error: customError.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to process verification',
        });
      }
    },
  );
}
