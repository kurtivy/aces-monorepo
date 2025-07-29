import { FastifyInstance } from 'fastify';
import { AccountVerificationService } from '../../services/account-verification-service';
import { requireAuth, requireAdmin } from '../../lib/auth-middleware';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MultipartFile } from '@fastify/multipart';
import { errors } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { getSignedSecureUrl } from '../../lib/secure-storage-utils';
import { VerificationStatus } from '@prisma/client';

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
  twitter: z.string().optional(),
  website: z.string().optional(),
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
  console.log('🔐 Registering account verification routes...');

  try {
    const verificationService = new AccountVerificationService(fastify.prisma);
    const log = logger.child({ module: 'account-verification-routes' });
    console.log('✅ Account verification service initialized');

    // Add debugging hook for account verification requests
    fastify.addHook('preHandler', async (request) => {
      if (request.url.includes('/account-verification/submit')) {
        console.log('🔍 PRE-HANDLER HOOK - before any middleware', {
          method: request.method,
          url: request.url,
          hasAuth: !!request.auth,
          isMultipart: request.isMultipart?.() ?? 'unknown',
        });
      }
    });

    console.log('📝 Registering POST /submit route...');
    fastify.post(
      '/submit',
      {
        preHandler: [requireAuth],
        // Removed schema - multipart/form-data doesn't work with JSON schema validation
      },
      async (request, reply) => {
        console.log('🎯 ROUTE HANDLER REACHED - verification submission starting');
        log.info('Starting verification submission', {
          userId: request.user?.id,
          hasUser: !!request.user,
          userKeys: request.user ? Object.keys(request.user) : [],
        });

        if (!request.user?.id) {
          log.error('No authenticated user found');
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        try {
          if (!request.isMultipart()) {
            log.error('Request is not multipart');
            throw errors.badRequest('Request must be multipart/form-data');
          }

          log.info('Processing multipart form data');
          const parts = request.parts();
          const fields: Record<string, string> = {};
          let documentFile: DocumentFile | null = null;

          for await (const part of parts) {
            if (part.type === 'field') {
              fields[part.fieldname] = part.value as string;
              log.info('Received field', {
                fieldname: part.fieldname,
                value: part.fieldname === 'emailAddress' ? '[email]' : part.value,
              });
            } else if (part.type === 'file' && part.fieldname === 'documentFile') {
              log.info('Received file', {
                fieldname: part.fieldname,
                filename: part.filename,
                mimetype: part.mimetype,
              });
              // Validate and store file
              documentFile = validateFile(part);
              const buffer = await part.toBuffer();
              if (buffer.length > MAX_FILE_SIZE) {
                throw errors.badRequest(
                  `File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                );
              }
              documentFile.buffer = buffer;
            }
          }

          log.info('Form fields received', {
            fieldCount: Object.keys(fields).length,
            hasFile: !!documentFile,
          });

          // Validate form data
          log.info('Validating form data with schema');
          const formData = VerificationSubmissionSchema.parse(fields);

          // Submit verification
          const { fullName, ...formDataWithoutFullName } = formData;
          const result = await verificationService.submitVerification(
            request.user!.id,
            {
              ...formDataWithoutFullName,
              dateOfBirth: new Date(formData.dateOfBirth),
              firstName: formData.fullName.split(' ')[0] || '',
              lastName: formData.fullName.split(' ').slice(1).join(' ') || '',
            },
            documentFile || undefined,
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
            stack: error instanceof Error ? error.stack : undefined,
            errorType: error?.constructor?.name,
            userId: request.user?.id || 'unknown',
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

          const decision = approve ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
          const result = await verificationService.reviewVerification(
            verificationId,
            request.user!.id,
            decision,
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

    /**
     * Get signed URL for secure document (admin only)
     */
    fastify.get(
      '/admin/document/:verificationId',
      {
        preHandler: [requireAdmin],
        schema: {
          params: zodToJsonSchema(
            z.object({
              verificationId: z.string().cuid(),
            }),
          ),
        },
      },
      async (request, reply) => {
        try {
          const { verificationId } = request.params as { verificationId: string };

          // Get verification with document URL
          const verification = await verificationService.getVerificationById(verificationId);

          if (!verification) {
            throw errors.notFound('Verification not found');
          }

          if (!verification.documentImageUrl) {
            throw errors.notFound('No document found for this verification');
          }

          // Extract filename from URL
          const fileName = verification.documentImageUrl.split('aces-secure-documents/')[1];
          if (!fileName) {
            throw errors.badRequest('Invalid document URL');
          }

          // Generate signed URL for secure access
          const signedUrl = await getSignedSecureUrl(fileName, 30); // 30 minutes access

          return reply.send({
            success: true,
            data: {
              signedUrl,
              expiresIn: 30 * 60, // 30 minutes in seconds
              documentType: verification.documentType,
              uploadedAt: verification.submittedAt,
            },
          });
        } catch (error: unknown) {
          log.error('Secure document access error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            adminId: request.user!.id,
            verificationId: (request.params as { verificationId: string }).verificationId,
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
            error: 'Failed to access secure document',
          });
        }
      },
    );

    // Add debug hook for all verification routes
    fastify.addHook('preHandler', async (request) => {
      if (request.url.includes('/account-verification/submit')) {
        console.log('🔍 PRE-HANDLER HOOK - before any middleware', {
          url: request.url,
          method: request.method,
          contentType: request.headers['content-type'],
          hasAuth: !!request.auth,
          hasUser: !!request.user,
        });
      }
    });

    console.log('✅ Account verification routes registered successfully');
  } catch (error) {
    console.error('❌ Error during route registration:', error);
    throw error;
  }
}
