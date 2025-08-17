import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EmailService, type ContactFormData } from '../../lib/email-service';

const contactFormSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  itemName: z.string().min(1, 'Item name is required'),
  email: z.string().email('Valid email is required'),
});

export default async function contactRoutes(fastify: FastifyInstance) {
  // POST /api/v1/contact - Submit contact form
  fastify.post('/contact', async (request, reply) => {
    try {
      // Validate request body
      const validationResult = contactFormSchema.safeParse(request.body);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );

        return reply.status(400).send({
          success: false,
          message: 'Validation failed',
          errors,
        });
      }

      const formData: ContactFormData = validationResult.data;

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
        });
      }

      // Send email using EmailService
      const emailResult = await EmailService.sendContactFormEmail(formData);

      if (!emailResult.success) {
        console.error('Failed to send contact form email:', emailResult.error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to send your message. Please try again later.',
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Thank you for your inquiry! We will get back to you soon.',
        messageId: emailResult.messageId,
      });
    } catch (error) {
      console.error('Contact form submission error:', error);

      return reply.status(500).send({
        success: false,
        message: 'Internal server error. Please try again later.',
      });
    }
  });
}
