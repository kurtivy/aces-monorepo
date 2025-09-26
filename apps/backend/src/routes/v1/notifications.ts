import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { NotificationService, NotificationType } from '../../services/notification-service';
import { requireAuth } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';

// Validation schemas
// CreateNotificationSchema removed - not used in this file

const GetNotificationsQuerySchema = z.object({
  includeRead: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val))
    .optional(),
  offset: z
    .string()
    .transform((val) => parseInt(val))
    .optional(),
});

// MarkAsReadSchema removed - not used in this file

export async function notificationRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService(fastify.prisma);

  /**
   * Get user's notifications
   */
  fastify.get(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: zodToJsonSchema(GetNotificationsQuerySchema),
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const query = GetNotificationsQuerySchema.parse(request.query);

        const notifications = await notificationService.getUserNotifications(userId, {
          includeRead: query.includeRead,
          limit: query.limit,
          offset: query.offset,
        });

        return reply.send({
          success: true,
          data: notifications,
        });
      } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
    },
  );

  /**
   * Get unread notification count
   */
  fastify.get(
    '/unread-count',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const count = await notificationService.getUnreadCount(userId);

        return reply.send({
          success: true,
          data: { count },
        });
      } catch (error) {
        console.error('Error fetching unread count:', error);
        throw error;
      }
    },
  );

  /**
   * Mark notification as read
   */
  fastify.put(
    '/:id/mark-read',
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
        const userId = request.user!.id;
        const { id } = request.params as { id: string };

        const notification = await notificationService.markAsRead(id, userId);

        return reply.send({
          success: true,
          data: notification,
          message: 'Notification marked as read',
        });
      } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
      }
    },
  );

  /**
   * Mark all notifications as read
   */
  fastify.put(
    '/mark-all-read',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const result = await notificationService.markAllAsRead(userId);

        return reply.send({
          success: true,
          data: result,
          message: `${result.count} notifications marked as read`,
        });
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
      }
    },
  );

  /**
   * Delete notification
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
        const userId = request.user!.id;
        const { id } = request.params as { id: string };

        await notificationService.deleteNotification(id, userId);

        return reply.send({
          success: true,
          message: 'Notification deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
      }
    },
  );
}
