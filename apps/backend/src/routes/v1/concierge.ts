import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { EmailService } from '../../lib/email-service';

const conciergeSupportSchema = z.object({
  email: z.string().email('Valid email is required'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message is too long. Please keep it under 2000 characters.'),
});

export async function conciergeRoutes(fastify: FastifyInstance) {
  fastify.post('/', {
    schema: {
      body: zodToJsonSchema(conciergeSupportSchema),
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['success', 'message'],
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const formData = conciergeSupportSchema.parse(request.body);

        const emailResult = await EmailService.sendConciergeSupportEmail(formData);
        if (!emailResult.success) {
          return reply.status(500).send({
            success: false,
            message: 'Failed to send your concierge request. Please try again later.',
          });
        }

        return reply.send({
          success: true,
          message: 'Thank you! Our concierge team will reach out shortly.',
          messageId: emailResult.messageId,
        });
      } catch (error) {
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
        });
      }
    },
  });

  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      success: true,
      service: 'concierge',
      timestamp: new Date().toISOString(),
    });
  });
}
