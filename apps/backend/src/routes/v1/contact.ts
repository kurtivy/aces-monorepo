import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const contactFormSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  itemName: z.string().min(1, 'Item name is required'),
  email: z.string().email('Valid email is required'),
});

// Mock EmailService since we don't know if it exists
const EmailService = {
  async sendContactFormEmail(data: any) {
    // Mock implementation - replace with your actual email service
    console.log('Sending contact form email:', data);
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
    };
  },
};

export async function contactRoutes(fastify: FastifyInstance) {
  // POST / - Submit contact form (path rewritten from /api/v1/contact → /)
  fastify.post('/', {
    schema: {
      body: zodToJsonSchema(contactFormSchema),
    },
    handler: async (request, reply) => {
      try {
        console.log('🔍 Contact form submission received:', request.body);

        const formData = contactFormSchema.parse(request.body);

        // Validate category against allowed values
        const allowedCategories = [
          'watches',
          'jewelry',
          'art',
          'vehicles',
          'fashion',
          'spirits',
          'real-estate',
          'yachts',
          'private-jets',
          'memorabilia',
          'other',
        ];

        if (!allowedCategories.includes(formData.category)) {
          return reply.status(400).send({
            success: false,
            message: 'Invalid category selected',
            allowedCategories,
          });
        }

        // Send email using EmailService
        const emailResult = await EmailService.sendContactFormEmail(formData);
        if (!emailResult.success) {
          console.error('Failed to send contact form email:', emailResult);
          return reply.status(500).send({
            success: false,
            message: 'Failed to send your message. Please try again later.',
          });
        }

        // Log successful submission
        console.log('✅ Contact form submitted successfully:', {
          email: formData.email,
          category: formData.category,
          itemName: formData.itemName,
          messageId: emailResult.messageId,
        });

        return reply.status(200).send({
          success: true,
          message: 'Thank you for your inquiry! We will get back to you soon.',
          messageId: emailResult.messageId,
        });
      } catch (error) {
        console.error('❌ Contact form submission error:', error);

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

  // Health check for contact service
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      success: true,
      service: 'contact',
      timestamp: new Date().toISOString(),
    });
  });
}
