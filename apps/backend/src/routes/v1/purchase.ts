import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { EmailService } from '../../lib/email-service';

const purchaseInquirySchema = z.object({
  productTitle: z.string().min(1, 'Product title is required'),
  productTicker: z.string().min(1, 'Product ticker is required'),
  productPrice: z.string().optional(),
  customerEmail: z.string().email('Valid email is required'),
  customerMessage: z.string().optional(),
});

export async function purchaseRoutes(fastify: FastifyInstance) {
  // POST / - Submit purchase inquiry (path rewritten from /api/v1/purchase → /)
  fastify.post('/', {
    schema: {
      body: zodToJsonSchema(purchaseInquirySchema),
    },
    handler: async (request, reply) => {
      try {
        console.log('🔍 Purchase inquiry submission received:', request.body);

        const inquiryData = purchaseInquirySchema.parse(request.body);

        // Send email using EmailService
        const emailResult = await EmailService.sendPurchaseInquiryEmail(inquiryData);
        if (!emailResult.success) {
          console.error('Failed to send purchase inquiry email:', emailResult);
          return reply.status(500).send({
            success: false,
            message: 'Failed to send your inquiry. Please try again later.',
          });
        }

        // Log successful submission
        console.log('✅ Purchase inquiry submitted successfully:', {
          customerEmail: inquiryData.customerEmail,
          productTitle: inquiryData.productTitle,
          productTicker: inquiryData.productTicker,
          messageId: emailResult.messageId,
        });

        return reply.status(200).send({
          success: true,
          message:
            'Thank you for your purchase inquiry! We will contact you soon to discuss the details.',
          messageId: emailResult.messageId,
        });
      } catch (error) {
        console.error('❌ Purchase inquiry submission error:', error);

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            message: 'Validation failed',
            errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
          });
        }

        return reply.status(500).send({
          success: false,
          message: 'Internal server error. Please try again later.',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  // Health check for purchase service
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      success: true,
      service: 'purchase',
      timestamp: new Date().toISOString(),
    });
  });
}
