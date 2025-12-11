import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Base app webhook event types
const WebhookEventSchema = z.object({
  type: z.string(),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export async function farcasterWebhookRoutes(fastify: FastifyInstance) {
  /**
   * Farcaster/Base app webhook endpoint
   * Receives events from the Base app for notifications and other integrations
   */
  fastify.post(
    '/webhook',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            data: { type: 'object' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const event = WebhookEventSchema.safeParse(request.body);

        if (!event.success) {
          console.warn('Invalid webhook payload received:', event.error);
          return reply.status(400).send({
            success: false,
            error: 'Invalid webhook payload',
          });
        }

        const { type, data } = event.data;

        console.log(`Received Farcaster webhook event: ${type}`, { data });

        // Handle different event types
        switch (type) {
          case 'notification_permission_granted':
            // User granted notification permissions
            console.log('User granted notification permissions', { data });
            break;

          case 'notification_permission_revoked':
            // User revoked notification permissions
            console.log('User revoked notification permissions', { data });
            break;

          case 'miniapp_opened':
            // Mini app was opened
            console.log('Mini app opened', { data });
            break;

          default:
            console.log(`Unhandled webhook event type: ${type}`, { data });
        }

        // Respond quickly with 200 to acknowledge receipt
        return reply.status(200).send({
          success: true,
          message: 'Webhook received',
        });
      } catch (error) {
        console.error('Error processing Farcaster webhook:', error);
        // Still return 200 to prevent retries for processing errors
        return reply.status(200).send({
          success: true,
          message: 'Webhook received with processing error',
        });
      }
    },
  );

  /**
   * Health check for the webhook endpoint
   */
  fastify.get('/webhook', async (_request, reply) => {
    return reply.send({
      success: true,
      message: 'Farcaster webhook endpoint is active',
    });
  });
}
