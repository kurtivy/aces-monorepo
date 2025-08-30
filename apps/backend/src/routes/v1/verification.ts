// backend/src/routes/v1/account-verification.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MultipartFile } from '@fastify/multipart';
import { AccountVerificationService } from '../../services/verification-service';
import { requireAuth, requireAdmin } from '../../lib/auth-middleware';
import { DocumentType, VerificationStatus } from '@prisma/client';

// Validation schemas
const SubmitVerificationSchema = z.object({
  documentType: z.enum(['DRIVERS_LICENSE', 'PASSPORT', 'ID_CARD']),
  documentNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
  countryOfIssue: z.string().min(1),
  state: z.string().optional(),
  address: z.string().min(1),
  emailAddress: z.string().email(),
});

const ReviewVerificationSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

export async function accountVerificationRoutes(fastify: FastifyInstance) {
  const verificationService = new AccountVerificationService(fastify.prisma);

  /**
   * Submit verification documents
   */
  fastify.post(
    '/submit',
    {
      preHandler: [requireAuth],
      // Remove schema validation for multipart requests
      // We'll validate the data manually after processing multipart
    },
    async (request, reply) => {
      try {
        console.log('🔍 Starting verification submission for user:', request.user?.id);
        let documentFile = null;
        const formData: Record<string, string> = {};

        // Handle multipart data for file upload
        if (request.isMultipart()) {
          console.log('🔍 Processing multipart request...');
          for await (const part of request.parts()) {
            console.log('🔍 Processing part:', { type: part.type, fieldname: part.fieldname });
            if (part.type === 'file' && part.fieldname === 'documentImage') {
              console.log('🔍 Document file found, reading buffer...');
              // Read the file buffer immediately to prevent hanging
              const buffer = await part.toBuffer();
              documentFile = {
                ...part,
                buffer,
              } as MultipartFile & { buffer: Buffer };
              console.log('🔍 Document file processed:', {
                filename: documentFile.filename,
                mimetype: documentFile.mimetype,
                size: buffer.length,
              });
            } else if (part.type === 'field') {
              // Handle form fields
              formData[part.fieldname] = String(part.value);
              console.log('🔍 Form field processed:', part.fieldname);
            }
          }
          console.log('✅ Multipart processing completed');
        } else {
          console.log('🔍 Processing JSON request...');
          // Handle JSON requests (fallback)
          Object.assign(formData, request.body as Record<string, string>);
          console.log('✅ JSON processing completed');
        }

        // Validate the form data manually
        console.log('🔍 Validating form data:', Object.keys(formData));
        const validationResult = SubmitVerificationSchema.safeParse(formData);
        if (!validationResult.success) {
          console.log('❌ Validation failed:', validationResult.error.errors);
          return reply.status(400).send({
            success: false,
            error: 'Validation failed',
            details: validationResult.error.errors,
          });
        }

        console.log('✅ Validation passed');
        const data = validationResult.data;

        // Convert date string to Date object
        const verificationData = {
          ...data,
          dateOfBirth: new Date(data.dateOfBirth),
          documentType: data.documentType as DocumentType,
        };

        console.log('🔍 Submitting verification with data:', {
          userId: request.user!.id,
          documentType: verificationData.documentType,
          hasDocumentFile: !!documentFile,
        });

        const verification = await verificationService.submitVerification(
          request.user!.id,
          {
            ...verificationData,
            selfieImageUrl: '',
            facialComparisonScore: 0,
            visionApiRecommendation: 'UNKNOWN',
            documentAnalysisResults: null,
            facialVerificationAt: new Date(),
          },
          documentFile || undefined,
        );

        console.log('✅ Verification submitted successfully:', verification.id);

        return reply.send({
          success: true,
          data: verification,
          message: 'Verification submitted successfully',
        });
      } catch (error) {
        console.error('Error in verification submission:', error);
        throw error;
      }
    },
  );

  /**
   * Get current user's verification status
   */
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
      } catch (error) {
        console.error('Error getting verification status:', error);
        throw error;
      }
    },
  );

  /**
   * Get current user's verification details
   */
  fastify.get(
    '/details',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const verification = await verificationService.getVerificationByUserId(request.user!.id);

        return reply.send({
          success: true,
          data: verification,
        });
      } catch (error) {
        console.error('Error getting verification details:', error);
        throw error;
      }
    },
  );

  /**
   * Get all pending verifications (admin only)
   */
  fastify.get(
    '/admin/pending',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getPendingVerifications();

        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length,
        });
      } catch (error) {
        console.error('Error getting pending verifications:', error);
        throw error;
      }
    },
  );

  /**
   * Get all verifications (admin only)
   */
  fastify.get(
    '/admin/all',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getAllVerifications();

        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length,
        });
      } catch (error) {
        console.error('Error getting all verifications:', error);
        throw error;
      }
    },
  );

  /**
   * Review verification (admin only)
   */
  fastify.put(
    '/admin/:id/review',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(ReviewVerificationSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { decision, rejectionReason } = request.body as z.infer<
          typeof ReviewVerificationSchema
        >;

        const verification = await verificationService.reviewVerification(
          id,
          request.user!.id,
          decision as VerificationStatus,
          rejectionReason,
        );

        return reply.send({
          success: true,
          data: verification,
          message: `Verification ${decision.toLowerCase()} successfully`,
        });
      } catch (error) {
        console.error('Error reviewing verification:', error);
        throw error;
      }
    },
  );

  /**
   * Approve verification (admin only) - convenience endpoint
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

        const verification = await verificationService.reviewVerification(
          id,
          request.user!.id,
          VerificationStatus.APPROVED,
        );

        return reply.send({
          success: true,
          data: verification,
          message: 'Verification approved successfully',
        });
      } catch (error) {
        console.error('Error approving verification:', error);
        throw error;
      }
    },
  );

  /**
   * Reject verification (admin only) - convenience endpoint
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
        body: zodToJsonSchema(
          z.object({
            rejectionReason: z.string().min(1),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { rejectionReason } = request.body as { rejectionReason: string };

        const verification = await verificationService.reviewVerification(
          id,
          request.user!.id,
          VerificationStatus.REJECTED,
          rejectionReason,
        );

        return reply.send({
          success: true,
          data: verification,
          message: 'Verification rejected successfully',
        });
      } catch (error) {
        console.error('Error rejecting verification:', error);
        throw error;
      }
    },
  );

  /**
   * Submit facial verification (selfie)
   */
  fastify.post(
    '/facial-verification',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        console.log('🔍 Starting facial verification for user:', request.user?.id);
        let selfieFile = null;

        // Handle multipart data for selfie upload
        if (request.isMultipart()) {
          console.log('🔍 Processing selfie multipart request...');
          for await (const part of request.parts()) {
            console.log('🔍 Processing part:', { type: part.type, fieldname: part.fieldname });
            if (part.type === 'file' && part.fieldname === 'selfie') {
              console.log('🔍 Selfie file found, reading buffer...');
              const buffer = await part.toBuffer();
              selfieFile = {
                ...part,
                buffer,
              } as MultipartFile & { buffer: Buffer };
              console.log('🔍 Selfie file processed:', {
                filename: selfieFile.filename,
                mimetype: selfieFile.mimetype,
                size: buffer.length,
              });
            }
          }
          console.log('✅ Selfie multipart processing completed');
        } else {
          console.log('❌ No multipart data found for selfie');
          return reply.status(400).send({
            success: false,
            error: 'Selfie image is required',
          });
        }

        if (!selfieFile) {
          return reply.status(400).send({
            success: false,
            error: 'Selfie image is required',
          });
        }

        console.log('🔍 Processing facial verification...');
        const result = await verificationService.submitFacialVerification(
          request.user!.id,
          selfieFile,
        );

        console.log('✅ Facial verification completed:', result.visionApiRecommendation);

        return reply.send({
          success: true,
          data: result,
          message: 'Facial verification completed successfully',
        });
      } catch (error) {
        console.error('Error in facial verification:', error);
        throw error;
      }
    },
  );

  /**
   * Get facial verification status
   */
  fastify.get(
    '/facial-verification/status',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const status = await verificationService.getFacialVerificationStatus(request.user!.id);

        return reply.send({
          success: true,
          data: status,
        });
      } catch (error) {
        console.error('Error getting facial verification status:', error);
        throw error;
      }
    },
  );

  /**
   * Check if user is ready for facial verification
   */
  fastify.get(
    '/facial-verification/ready',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const readiness = await verificationService.isReadyForFacialVerification(request.user!.id);

        return reply.send({
          success: true,
          data: readiness,
        });
      } catch (error) {
        console.error('Error checking facial verification readiness:', error);
        throw error;
      }
    },
  );
}
