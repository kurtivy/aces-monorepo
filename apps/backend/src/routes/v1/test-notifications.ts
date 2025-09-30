import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  NotificationService,
  NotificationType,
  NotificationTemplates,
} from '../../services/notification-service';
import { requireAuth, requireAdmin } from '../../lib/auth-middleware';

const TestNotificationSchema = z.object({
  type: z.enum([
    'VERIFICATION_PENDING',
    'VERIFICATION_APPROVED',
    'VERIFICATION_REJECTED',
    'LISTING_APPROVED',
    'READY_TO_MINT',
    'TOKEN_MINTED',
    'NEW_BID_RECEIVED',
    'BID_ACCEPTED',
    'BID_REJECTED',
    'BID_OUTBID',
    'ADMIN_MESSAGE',
    'SYSTEM_ALERT',
    'ADMIN_NEW_SUBMISSION',
    'ADMIN_NEW_VERIFICATION',
    'ADMIN_TOKEN_REVIEW_NEEDED',
  ]),
  targetUserId: z.string().optional(), // If not provided, uses current user
  listingId: z.string().optional(),
  customTitle: z.string().optional(),
  customMessage: z.string().optional(),
  customActionUrl: z.string().optional(),
});

/**
 * Test routes for the notification system
 * These should only be available in development/testing environments
 */
export async function testNotificationRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService(fastify.prisma);

  /**
   * Test a specific notification type
   */
  fastify.post(
    '/test/:notificationType',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            notificationType: z.string(),
          }),
        ),
        body: zodToJsonSchema(TestNotificationSchema.partial()),
      },
    },
    async (request, reply) => {
      try {
        const { notificationType } = request.params as { notificationType: string };
        const body = request.body as Partial<z.infer<typeof TestNotificationSchema>>;

        // Validate notification type
        if (!Object.values(NotificationType).includes(notificationType as NotificationType)) {
          return reply.status(400).send({
            success: false,
            error: `Invalid notification type: ${notificationType}`,
            availableTypes: Object.values(NotificationType),
          });
        }

        const type = notificationType as NotificationType;
        const targetUserId = body.targetUserId || request.user!.id;

        // Get template for the notification type
        const template = NotificationTemplates[type];

        // Generate action URL based on notification type
        let actionUrl = body.customActionUrl;
        if (!actionUrl) {
          try {
            // Handle different getActionUrl function signatures
            switch (type) {
              case NotificationType.LISTING_APPROVED:
              case NotificationType.READY_TO_MINT:
                actionUrl = (template.getActionUrl as (listingId: string) => string)(body.listingId || 'test-listing-id');
                break;
              case NotificationType.TOKEN_MINTED:
                actionUrl = (template.getActionUrl as (symbol: string) => string)('TEST');
                break;
              default:
                actionUrl = (template.getActionUrl as () => string)();
                break;
            }
          } catch (error) {
            // Fallback to a default URL if getActionUrl fails
            actionUrl = '/profile';
          }
        }

        // Create the notification
        const notification = await notificationService.createNotification({
          userId: targetUserId,
          listingId: body.listingId,
          type,
          title: body.customTitle || template.title,
          message: body.customMessage || template.message,
          actionUrl,
        });

        return reply.send({
          success: true,
          data: notification,
          message: `Test notification '${type}' created successfully`,
        });
      } catch (error) {
        console.error('Error creating test notification:', error);
        throw error;
      }
    },
  );

  /**
   * Test all notification types for current user
   */
  fastify.post(
    '/test/all',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const results = [];

        // Test all user notification types
        const userNotificationTypes = [
          NotificationType.VERIFICATION_PENDING,
          NotificationType.VERIFICATION_APPROVED,
          NotificationType.VERIFICATION_REJECTED,
          NotificationType.LISTING_APPROVED,
          NotificationType.READY_TO_MINT,
          NotificationType.TOKEN_MINTED,
          NotificationType.NEW_BID_RECEIVED,
          NotificationType.BID_ACCEPTED,
          NotificationType.BID_REJECTED,
          NotificationType.BID_OUTBID,
          NotificationType.ADMIN_MESSAGE,
          NotificationType.SYSTEM_ALERT,
        ];

        for (const type of userNotificationTypes) {
          try {
            const template = NotificationTemplates[type];
            
            // Generate action URL based on notification type
            let actionUrl;
            try {
              switch (type) {
                case NotificationType.LISTING_APPROVED:
                case NotificationType.READY_TO_MINT:
                  actionUrl = (template.getActionUrl as (listingId: string) => string)('test-listing-id');
                  break;
                case NotificationType.TOKEN_MINTED:
                  actionUrl = (template.getActionUrl as (symbol: string) => string)('TEST');
                  break;
                default:
                  actionUrl = (template.getActionUrl as () => string)();
                  break;
              }
            } catch (error) {
              actionUrl = '/profile';
            }
            
            const notification = await notificationService.createNotification({
              userId,
              type,
              title: `[TEST] ${template.title}`,
              message: `[TEST] ${template.message}`,
              actionUrl,
            });
            results.push({ type, success: true, id: notification.id });
          } catch (error) {
            results.push({
              type,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        return reply.send({
          success: true,
          data: results,
          message: `Created ${results.filter((r) => r.success).length} test notifications`,
        });
      } catch (error) {
        console.error('Error creating test notifications:', error);
        throw error;
      }
    },
  );

  /**
   * Test admin notifications (admin only)
   */
  fastify.post(
    '/test/admin',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const results = [];

        const adminNotificationTypes = [
          NotificationType.ADMIN_NEW_SUBMISSION,
          NotificationType.ADMIN_NEW_VERIFICATION,
          NotificationType.ADMIN_TOKEN_REVIEW_NEEDED,
        ];

        for (const type of adminNotificationTypes) {
          try {
            const template = NotificationTemplates[type];
            
            // Admin notifications don't need parameters for getActionUrl
            const actionUrl = (template.getActionUrl as () => string)();
            
            const notification = await notificationService.createNotification({
              userId,
              type,
              title: `[TEST] ${template.title}`,
              message: `[TEST] ${template.message}`,
              actionUrl,
            });
            results.push({ type, success: true, id: notification.id });
          } catch (error) {
            results.push({
              type,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        return reply.send({
          success: true,
          data: results,
          message: `Created ${results.filter((r) => r.success).length} admin test notifications`,
        });
      } catch (error) {
        console.error('Error creating admin test notifications:', error);
        throw error;
      }
    },
  );

  /**
   * Clean up test notifications
   */
  fastify.delete(
    '/test/cleanup',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        // Delete all notifications with [TEST] prefix for current user
        const deletedCount = await fastify.prisma.userNotification.deleteMany({
          where: {
            userId,
            title: {
              startsWith: '[TEST]',
            },
          },
        });

        return reply.send({
          success: true,
          data: { deletedCount: deletedCount.count },
          message: `Cleaned up ${deletedCount.count} test notifications`,
        });
      } catch (error) {
        console.error('Error cleaning up test notifications:', error);
        throw error;
      }
    },
  );

  /**
   * Get notification stats for debugging
   */
  fastify.get(
    '/test/stats',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        const stats = await fastify.prisma.userNotification.groupBy({
          by: ['type'],
          where: { userId },
          _count: {
            type: true,
          },
        });

        const unreadCount = await fastify.prisma.userNotification.count({
          where: {
            userId,
            isRead: false,
          },
        });

        const totalCount = await fastify.prisma.userNotification.count({
          where: { userId },
        });

        return reply.send({
          success: true,
          data: {
            byType: stats,
            unreadCount,
            totalCount,
          },
        });
      } catch (error) {
        console.error('Error getting notification stats:', error);
        throw error;
      }
    },
  );
}
