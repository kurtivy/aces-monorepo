'use client';

// Notifications API Service
export interface NotificationData {
  id: string;
  userId: string;
  listingId?: string;
  submissionId?: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
  expiresAt?: string;
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
  submission?: {
    id: string;
    title: string;
    symbol: string;
    status: string;
    rejectionReason: string | null;
    imageGallery: string[];
  } | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GetNotificationsOptions {
  includeRead?: boolean;
  limit?: number;
  offset?: number;
}

export class NotificationsApi {
  private static baseUrl = '/api/v1/notifications';

  /**
   * Get user's notifications
   */
  static async getNotifications(
    options: GetNotificationsOptions = {},
    token: string,
  ): Promise<ApiResponse<NotificationData[]>> {
    try {
      const searchParams = new URLSearchParams();

      if (options.includeRead !== undefined) {
        searchParams.append('includeRead', options.includeRead.toString());
      }
      if (options.limit !== undefined) {
        searchParams.append('limit', options.limit.toString());
      }
      if (options.offset !== undefined) {
        searchParams.append('offset', options.offset.toString());
      }

      const url = searchParams.toString()
        ? `${this.baseUrl}?${searchParams.toString()}`
        : this.baseUrl;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notifications',
      };
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(token: string): Promise<ApiResponse<{ count: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/unread-count`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get unread count',
      };
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(
    notificationId: string,
    token: string,
  ): Promise<ApiResponse<NotificationData>> {
    try {
      const response = await fetch(`${this.baseUrl}/${notificationId}/mark-read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark notification as read',
      };
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(token: string): Promise<ApiResponse<{ count: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/mark-all-read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark all notifications as read',
      };
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(
    notificationId: string,
    token: string,
  ): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete notification',
      };
    }
  }
}
