// backend/src/routes/v1/submissions.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SubmissionService, CreateSubmissionRequest } from '../../services/submission-service';
import { SubmissionStatus, RejectionType } from '../../lib/prisma-enums';
import { requireAuth, requireAdmin } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';
import { ProductStorageService } from '../../lib/product-storage-utils';
import { SecureStorageService } from '../../lib/secure-storage-utils';
import { randomUUID } from 'crypto';

// Validation schemas
const OwnershipDocumentTypeEnum = z.enum([
  'BILL_OF_SALE',
  'CERTIFICATE_OF_AUTH',
  'INSURANCE_DOC',
  'DEED_OR_TITLE',
  'APPRAISAL_DOC',
  'PROVENANCE_DOC',
]);

const OwnershipDocumentSchema = z.object({
  type: OwnershipDocumentTypeEnum,
  imageUrl: z.string().url(),
  uploadedAt: z.string().datetime(),
});

const CreateSubmissionSchema = z.object({
  title: z.string().min(1).max(200),
  symbol: z.string().min(1).max(10),
  brand: z.string().min(1).max(100),
  story: z.string().min(10).max(5000),
  details: z.string().min(10).max(5000),
  provenance: z.string().min(10).max(5000),
  value: z.string().min(1),
  reservePrice: z.string().min(1),
  hypeSentence: z.string().min(10).max(500),
  assetType: z.enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER']),
  imageGallery: z.array(z.string().url()).min(1, 'At least one asset image is required'),
  location: z.string().max(200).optional(),
  ownershipDocumentation: z
    .array(OwnershipDocumentSchema)
    .min(3, 'At least 3 ownership documents are required')
    .max(6, 'Maximum 6 ownership documents allowed'),
});

const RejectSubmissionSchema = z.object({
  rejectionReason: z.string().min(1).max(1000),
  rejectionType: z.enum(['MANUAL', 'TX_FAILURE']).optional().default('MANUAL'),
});

export async function submissionRoutes(fastify: FastifyInstance) {
  const submissionService = new SubmissionService(fastify.prisma);

  /**
   * Upload submission image
   */
  fastify.post(
    '/upload-image',
    {
      preHandler: [requireAuth],
      schema: {
        consumes: ['multipart/form-data'],
        description: 'Upload a submission image (asset or ownership document)',
        tags: ['Submissions'],
        querystring: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['asset', 'ownership'],
              description: 'Type of upload: asset (public) or ownership (secure)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as { type?: string };
        const uploadType = query.type || 'asset'; // Default to asset if not specified

        console.log(`📸 Starting ${uploadType} image upload for submission...`);

        // Check if file was uploaded
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: 'No file uploaded',
          });
        }

        // Validate file type
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const ownershipAllowedTypes = [...imageTypes, 'application/pdf'];
        const isOwnership = uploadType === 'ownership';
        const isAllowed = (isOwnership ? ownershipAllowedTypes : imageTypes).includes(
          data.mimetype,
        );
        if (!isAllowed) {
          return reply.status(400).send({
            success: false,
            error: isOwnership
              ? 'Invalid file type. Only JPEG, PNG, WebP images, and PDF documents are allowed for ownership documentation.'
              : 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
          });
        }

        // Check file size (10MB limit for submissions)
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        const buffer = await data.toBuffer();

        if (buffer.length > MAX_SIZE) {
          return reply.status(400).send({
            success: false,
            error: 'File size exceeds 10MB limit.',
          });
        }

        let imageUrl: string;
        let fileName: string;

        if (uploadType === 'ownership') {
          // Upload ownership documents to SECURE bucket (aces-secure-documents)
          // These files are NOT made public - they're only accessible to admins for verification
          console.log('🔒 Uploading to SECURE bucket (not public)...');

          const fileExtension = data.mimetype.split('/')[1];
          fileName = `submissions/${request.user!.id}/ownership/${randomUUID()}.${fileExtension}`;

          console.log('🔧 Getting secure bucket...');
          const secureBucket = SecureStorageService.getSecureBucket();
          console.log('✅ Secure bucket retrieved, uploading file:', fileName);
          const file = secureBucket.file(fileName);

          await file.save(buffer, {
            metadata: {
              contentType: data.mimetype,
              userId: request.user!.id,
              uploadedAt: new Date().toISOString(),
              documentType: 'ownership',
            },
          });

          // IMPORTANT: Do NOT call makePublic() on secure documents
          // These files should only be accessible to authenticated admins
          // The bucket-level permissions control access

          // Generate secure URL (requires authentication or signed URL to access)
          imageUrl = SecureStorageService.getSecureUrl(fileName);
        } else {
          // Upload asset images to PUBLIC bucket (aces-product-images)
          // These images will be displayed on the marketplace, so they need to be public
          console.log('📸 Uploading to PUBLIC product images bucket...');

          const fileExtension = data.mimetype.split('/')[1];
          fileName = `submissions/${request.user!.id}/${randomUUID()}.${fileExtension}`;

          console.log('🔧 Getting product bucket...');
          const bucket = ProductStorageService.getProductBucket();
          console.log('✅ Product bucket retrieved, uploading file:', fileName);
          const file = bucket.file(fileName);

          await file.save(buffer, {
            metadata: {
              contentType: data.mimetype,
              userId: request.user!.id,
              uploadedAt: new Date().toISOString(),
            },
          });

          // Note: With Uniform Bucket-Level Access enabled, we can't call makePublic() on individual files
          // Instead, the bucket itself should be configured with public read access via IAM policies
          // This allows all files in the bucket to be publicly readable

          // Generate public URL
          imageUrl = ProductStorageService.getProductUrl(fileName);
        }

        console.log(`✅ ${uploadType} image uploaded successfully:`, imageUrl);

        return reply.send({
          success: true,
          imageUrl,
          fileName,
        });
      } catch (error) {
        console.error('❌ Error uploading submission image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
        return reply.status(500).send({
          success: false,
          error: errorMessage,
          details: error instanceof Error ? error.stack : undefined,
        });
      }
    },
  );

  /**
   * Check verification status
   */
  fastify.get(
    '/verification-status',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const isVerified = await submissionService.checkUserVerification(request.user!.id);

        return reply.send({
          success: true,
          data: {
            isVerified,
            message: isVerified
              ? 'Account is verified and ready for submissions'
              : 'Account verification required to submit assets',
          },
        });
      } catch (error) {
        console.error('Error checking verification status:', error);
        throw error;
      }
    },
  );

  /**
   * Create submission
   */
  fastify.post(
    '/',
    {
      preHandler: [requireAuth],
      // Temporarily removed Fastify schema validation to use manual Zod validation for better error messages
      // schema: {
      //   body: zodToJsonSchema(CreateSubmissionSchema),
      // },
    },
    async (request, reply) => {
      try {
        console.log('📥 Received submission request from user:', request.user?.id);
        console.log('📦 Request body keys:', Object.keys(request.body || {}));

        const data = request.body as CreateSubmissionRequest;

        // Validate with Zod for better error messages
        const validationResult = CreateSubmissionSchema.safeParse(data);
        if (!validationResult.success) {
          console.error('❌ Validation failed:', validationResult.error.format());
          return reply.status(400).send({
            success: false,
            error: 'Validation failed',
            details: validationResult.error.errors,
          });
        }

        const submission = await submissionService.createSubmission(request.user!.id, data);

        console.log('✅ Submission created successfully:', submission.id);
        return reply.status(201).send({
          success: true,
          data: submission,
          message: 'Submission created successfully',
        });
      } catch (error) {
        console.error('❌ Error creating submission:', error);
        throw error;
      }
    },
  );

  /**
   * Get user's submissions
   */
  fastify.get(
    '/my',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query as {
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          limit?: number;
          cursor?: string;
        };

        const result = await submissionService.getUserSubmissions(
          request.user!.id,
          status ? { status: status as keyof typeof SubmissionStatus } : undefined,
          { limit, cursor },
        );

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting user submissions:', error);
        throw error;
      }
    },
  );

  /**
   * Get specific submission
   */
  fastify.get(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const submission = await submissionService.getSubmissionById(id, request.user!.id);

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        return reply.send({
          success: true,
          data: submission,
        });
      } catch (error) {
        console.error('Error getting submission:', error);
        throw error;
      }
    },
  );

  /**
   * Delete submission
   */
  fastify.delete(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        await submissionService.deleteSubmission(id, request.user!.id);

        return reply.send({
          success: true,
          message: 'Submission deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting submission:', error);
        throw error;
      }
    },
  );

  // Admin routes

  /**
   * Get all submissions (admin only)
   */
  fastify.get(
    '/admin/all',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query as {
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          limit?: number;
          cursor?: string;
        };

        const result = await submissionService.getAllSubmissions(
          status ? { status: status as keyof typeof SubmissionStatus } : undefined,
          {
            limit,
            cursor,
          },
        );

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting all submissions:', error);
        throw error;
      }
    },
  );

  /**
   * Get pending submissions (admin only)
   */
  fastify.get(
    '/admin/pending',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query as {
          limit?: number;
          cursor?: string;
        };

        const result = await submissionService.getPendingSubmissions({ limit, cursor });

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting pending submissions:', error);
        throw error;
      }
    },
  );

  /**
   * Approve submission (admin only)
   */
  fastify.put(
    '/admin/:id/approve',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const submission = await submissionService.approveSubmission(id, request.user!.id);
        // Create listing from this approved submission (idempotent)
        try {
          const listingService = new (require('../../services/listing-service').ListingService)(
            fastify.prisma,
          );
          await listingService.createListingFromSubmission(id, request.user!.id);
        } catch (creationError) {
          const msg =
            creationError instanceof Error ? creationError.message : String(creationError);
          if (!msg.includes('Listing already exists')) {
            throw creationError;
          }
          request.log?.warn(
            { err: creationError, submissionId: id },
            'Listing already exists for submission',
          );
        }

        return reply.send({
          success: true,
          data: submission,
          message: 'Submission approved successfully',
        });
      } catch (error) {
        console.error('Error approving submission:', error);
        throw error;
      }
    },
  );

  /**
   * Reject submission (admin only)
   */
  fastify.put(
    '/admin/:id/reject',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(RejectSubmissionSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { rejectionReason, rejectionType } = request.body as {
          rejectionReason: string;
          rejectionType: 'MANUAL' | 'TX_FAILURE';
        };

        const submission = await submissionService.rejectSubmission(
          id,
          request.user!.id,
          rejectionReason,
          rejectionType as keyof typeof RejectionType,
        );

        return reply.send({
          success: true,
          data: submission,
          message: 'Submission rejected successfully',
        });
      } catch (error) {
        console.error('Error rejecting submission:', error);
        throw error;
      }
    },
  );
}
