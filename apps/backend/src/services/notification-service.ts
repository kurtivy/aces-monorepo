import { PrismaClient } from '@prisma/client';
import { errors } from '../lib/errors';

// Use the UserNotification type from the Prisma client instance
type UserNotification = {
  id: string;
  userId: string;
  listingId: string | null;
  // submissionId removed
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export interface CreateNotificationData {
  userId: string;
  listingId?: string;
  // submissionId removed
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  expiresAt?: Date;
}

export enum NotificationType {
  // Existing types
  LISTING_APPROVED = 'LISTING_APPROVED',
  READY_TO_MINT = 'READY_TO_MINT',
  TOKEN_MINTED = 'TOKEN_MINTED',
  TOKEN_MINTED_SUCCESS = 'TOKEN_MINTED_SUCCESS',
  ADMIN_MESSAGE = 'ADMIN_MESSAGE',
  SYSTEM_ALERT = 'SYSTEM_ALERT',

  // Verification/submission notifications removed

  // Token creation notifications
  TOKEN_PARAMETERS_SUBMITTED = 'TOKEN_PARAMETERS_SUBMITTED',

  // Bidding notifications
  NEW_BID_RECEIVED = 'NEW_BID_RECEIVED',
  BID_ACCEPTED = 'BID_ACCEPTED',
  BID_REJECTED = 'BID_REJECTED',
  BID_OUTBID = 'BID_OUTBID',

  // Admin notifications (submission/verification removed)
  ADMIN_TOKEN_REVIEW_NEEDED = 'ADMIN_TOKEN_REVIEW_NEEDED',
}

export interface NotificationWithRelations {
  id: string;
  userId: string;
  listingId: string | null;
  // submissionId removed
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  user: {
    id: string;
    email: string | null;
    walletAddress: string | null;
  };
  listing?: {
    id: string;
    title: string;
    symbol: string;
  } | null;
  // Submission relation removed
}

/**
 * Service for managing user notifications
 */
export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification for a user
   */
  async createNotification(data: CreateNotificationData): Promise<UserNotification> {
    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
      });

      if (!user) {
        throw errors.notFound('User not found');
      }

      // Validate listing exists if provided
      if (data.listingId) {
        const listing = await this.prisma.listing.findUnique({
          where: { id: data.listingId },
        });

        if (!listing) {
          throw errors.notFound('Listing not found');
        }
      }

      // Submission validation removed

      const notification = await (this.prisma as any).userNotification.create({
        data: {
          userId: data.userId,
          listingId: data.listingId,
          // submissionId removed
          type: data.type,
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl,
          expiresAt: data.expiresAt,
        },
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options: {
      includeRead?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<NotificationWithRelations[]> {
    try {
      const { includeRead = true, limit = 50, offset = 0 } = options;

      const whereClause = {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      };

      const finalWhereClause = !includeRead ? { ...whereClause, isRead: false } : whereClause;

      const notifications = await this.prisma.userNotification.findMany({
        where: finalWhereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
            },
          },
          // Submission relation removed
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return notifications;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<UserNotification> {
    try {
      const notification = await (this.prisma as any).userNotification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw errors.notFound('Notification not found');
      }

      const updatedNotification = await (this.prisma as any).userNotification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });

      return updatedNotification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    try {
      const result = await (this.prisma as any).userNotification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: { isRead: true },
      });

      return { count: result.count };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await (this.prisma as any).userNotification.count({
        where: {
          userId,
          isRead: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      return count;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await (this.prisma as any).userNotification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw errors.notFound('Notification not found');
      }

      await (this.prisma as any).userNotification.delete({
        where: { id: notificationId },
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<{ count: number }> {
    try {
      const result = await (this.prisma as any).userNotification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return { count: result.count };
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      throw error;
    }
  }
}

/**
 * Template structure for notifications
 */
type NotificationTemplate = {
  title: string;
  message: string;
  getActionUrl: (...args: any[]) => string;
};

/**
 * Notification templates for consistent messaging
 */
export const NotificationTemplates: Record<NotificationType, NotificationTemplate> = {
  [NotificationType.LISTING_APPROVED]: {
    title: 'Listing Approved!',
    message:
      'Your submission has been approved and converted to a listing. Complete your listing details to proceed with token creation.',
    getActionUrl: (listingId: string) => `/profile?tab=listings&listing=${listingId}`,
  },
  [NotificationType.READY_TO_MINT]: {
    title: 'Ready to Launch!',
    message:
      'Your token parameters have been approved by our team. You can now mint your token and launch it for trading!',
    getActionUrl: (listingId: string) => `/listings/${listingId}/mint`,
  },
  [NotificationType.TOKEN_MINTED]: {
    title: 'Token Live!',
    message:
      'Congratulations! Your token has been successfully minted and is now live for trading.',
    getActionUrl: (symbol: string) => `/rwa/${symbol}`,
  },
  [NotificationType.TOKEN_MINTED_SUCCESS]: {
    title: 'Token Minted Successfully!',
    message: 'Congratulations! Your token has been successfully minted and is now live on ACES.',
    getActionUrl: (contractAddress: string) => `/token/${contractAddress}`,
  },
  [NotificationType.TOKEN_PARAMETERS_SUBMITTED]: {
    title: 'Token Parameters Under Review',
    message:
      "Your token creation request has been submitted and is being reviewed by our team. You'll be notified once the parameters are approved.",
    getActionUrl: () => '/profile',
  },
  [NotificationType.ADMIN_MESSAGE]: {
    title: 'Message from Admin',
    message: 'You have received a message from the administration team.',
    getActionUrl: () => '/profile',
  },
  [NotificationType.SYSTEM_ALERT]: {
    title: 'System Alert',
    message: 'Important system information.',
    getActionUrl: () => '/profile',
  },

  // Verification/submission notification templates removed

  // Bidding notifications
  [NotificationType.NEW_BID_RECEIVED]: {
    title: 'New Bid Received!',
    message: 'Someone has placed a bid on your listing. Check your bids to review and respond.',
    getActionUrl: () => '/profile?tab=bids',
  },
  [NotificationType.BID_ACCEPTED]: {
    title: 'Bid Accepted!',
    message: 'Great news! Your bid has been accepted by the listing owner.',
    getActionUrl: () => '/profile?tab=bids',
  },
  [NotificationType.BID_REJECTED]: {
    title: 'Bid Not Accepted',
    message:
      'Your bid was not accepted by the listing owner. You can place a new bid if the listing is still available.',
    getActionUrl: () => '/profile?tab=bids',
  },
  [NotificationType.BID_OUTBID]: {
    title: 'You Have Been Outbid',
    message:
      "Another bidder has placed a higher bid on this listing. Consider placing a new bid if you're still interested.",
    getActionUrl: () => '/profile?tab=bids',
  },

  // Admin notifications (submission/verification removed)
  [NotificationType.ADMIN_TOKEN_REVIEW_NEEDED]: {
    title: 'Token Parameters Need Review',
    message: 'A user has completed token creation details and requires admin approval.',
    getActionUrl: () => '/admin/listings',
  },
};
