import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ChainEventWebhookSchema } from '@aces/utils';
import type { z } from 'zod';
import { ApprovalService } from '../../services/approval-service';
import { errors } from '../../lib/errors';
import { loggers } from '../../lib/logger';

export async function webhooksRoutes(fastify: FastifyInstance) {
  const approvalService = new ApprovalService(fastify.prisma);

  // Webhook endpoint for blockchain events
  fastify.post(
    '/chain-event',
    {
      schema: {
        body: zodToJsonSchema(ChainEventWebhookSchema),
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof ChainEventWebhookSchema>;
      const correlationId = request.id;
      const headers = request.headers;

      // Log the webhook for debugging and dead-letter queue
      let webhookLogId: string | null = null;

      try {
        // Create webhook log entry first (dead-letter queue pattern)
        const webhookLog = await fastify.prisma.webhookLog.create({
          data: {
            payload: JSON.parse(JSON.stringify(body)),
            headers: JSON.parse(JSON.stringify(headers)),
          },
        });
        webhookLogId = webhookLog.id;

        loggers.blockchain(body.txHash, 'webhook_received', `log_id: ${webhookLogId}`);

        // Process the webhook idempotently
        const success = await approvalService.updateTransactionStatus(
          body.txHash,
          body.status,
          body.blockNumber,
          body.gasUsed,
          correlationId,
        );

        if (success) {
          // Mark webhook as processed
          await fastify.prisma.webhookLog.update({
            where: { id: webhookLogId },
            data: { processedAt: new Date() },
          });

          loggers.blockchain(body.txHash, 'webhook_processed', `status: ${body.status}`);

          return reply.send({
            success: true,
            message: 'Webhook processed successfully',
          });
        } else {
          // Webhook received but no matching transaction found
          // This is not an error - transaction might not be from our system
          await fastify.prisma.webhookLog.update({
            where: { id: webhookLogId },
            data: {
              processedAt: new Date(),
              error: 'No matching transaction found',
            },
          });

          loggers.blockchain(
            body.txHash,
            'webhook_no_match',
            'transaction not found in our system',
          );

          return reply.send({
            success: true,
            message: 'Webhook received but no matching transaction found',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        loggers.error(error as Error, {
          txHash: body.txHash,
          correlationId,
          webhookLogId,
          operation: 'processWebhook',
        });

        // Update webhook log with error (dead-letter queue)
        if (webhookLogId) {
          try {
            await fastify.prisma.webhookLog.update({
              where: { id: webhookLogId },
              data: { error: errorMessage },
            });
          } catch (logError) {
            loggers.error(logError as Error, {
              webhookLogId,
              originalError: errorMessage,
              operation: 'updateWebhookLogError',
            });
          }
        }

        // Return success to prevent webhook provider from retrying
        // The error is logged and can be replayed manually via admin
        return reply.send({
          success: true,
          message: 'Webhook received but processing failed - logged for manual review',
        });
      }
    },
  );

  // Health check endpoint for webhook provider
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      success: true,
      timestamp: new Date().toISOString(),
      service: 'webhook-processor',
    });
  });

  // Test webhook endpoint (for development)
  fastify.post(
    '/test',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            txHash: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
            status: { type: 'string', enum: ['MINED', 'FAILED', 'DROPPED'] },
            blockNumber: { type: 'number' },
            gasUsed: { type: 'string' },
          },
          required: ['txHash', 'status'],
        },
      },
    },
    async (request, reply) => {
      if (process.env.NODE_ENV === 'production') {
        throw errors.notFound('Test endpoint not available in production');
      }

      const body = request.body as z.infer<typeof ChainEventWebhookSchema>;

      loggers.blockchain(body.txHash, 'test_webhook', `status: ${body.status}`);

      // Process the test webhook the same way as real ones
      const success = await approvalService.updateTransactionStatus(
        body.txHash,
        body.status,
        body.blockNumber,
        body.gasUsed,
        request.id,
      );

      return reply.send({
        success: true,
        processed: success,
        message: success ? 'Test webhook processed' : 'No matching transaction found',
      });
    },
  );

  // Webhook statistics (admin-only would be better, but public for now)
  fastify.get('/stats', async (request, reply) => {
    const [totalWebhooks, processedWebhooks, errorWebhooks, recentErrors] = await Promise.all([
      fastify.prisma.webhookLog.count(),
      fastify.prisma.webhookLog.count({ where: { processedAt: { not: null } } }),
      fastify.prisma.webhookLog.count({ where: { error: { not: null } } }),
      fastify.prisma.webhookLog.findMany({
        where: { error: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          error: true,
        },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        total: totalWebhooks,
        processed: processedWebhooks,
        errors: errorWebhooks,
        successRate:
          totalWebhooks > 0
            ? (((processedWebhooks - errorWebhooks) / totalWebhooks) * 100).toFixed(2)
            : 100,
        recentErrors,
      },
    });
  });
}
