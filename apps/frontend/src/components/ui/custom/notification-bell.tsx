'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth/auth-context';
import { NotificationsApi, NotificationData } from '@/lib/api/notifications';

export function NotificationBell() {
  const { getAccessToken, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Fetch notifications when opened
  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
    }
  }, [isOpen, user]);

  // Fetch unread count periodically
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) return;

      const result = await NotificationsApi.getNotifications(
        { includeRead: true, limit: 20 },
        token,
      );

      if (result.success && result.data) {
        setNotifications(result.data);
      } else {
        setError(result.error || 'Failed to fetch notifications');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const result = await NotificationsApi.getUnreadCount(token);

      if (result.success && result.data) {
        setUnreadCount(result.data.count);
      }
    } catch (err) {
      // Silently fail for unread count to avoid spam
      console.warn('Failed to fetch unread count:', err);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const result = await NotificationsApi.markAsRead(notificationId, token);

      if (result.success) {
        // Update local state
        setNotifications((prev) =>
          prev.map((notif) => (notif.id === notificationId ? { ...notif, isRead: true } : notif)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const result = await NotificationsApi.markAllAsRead(token);

      if (result.success) {
        // Update local state
        setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const result = await NotificationsApi.deleteNotification(notificationId, token);

      if (result.success) {
        // Update local state
        setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
        // Update unread count if the deleted notification was unread
        const deletedNotification = notifications.find((n) => n.id === notificationId);
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getNotificationAge = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold bg-red-500 text-white border-0"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-black border border-[#D0B284]/20 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#D0B284]/20">
            <h3 className="text-lg font-medium text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-[#D0B284] hover:text-white"
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-[#D0B284] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#D0B284]" />
                <span className="ml-2 text-[#DCDDCC]">Loading notifications...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchNotifications}
                  className="mt-2 text-[#D0B284] hover:text-white"
                >
                  Try again
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-[#D0B284]/50 mx-auto mb-2" />
                <p className="text-[#DCDDCC] text-sm">No notifications yet</p>
                <p className="text-[#DCDDCC]/70 text-xs mt-1">
                  You&apos;ll see updates about your listings here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#D0B284]/10">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-[#D0B284]/5 transition-colors ${
                      !notification.isRead ? 'bg-[#D0B284]/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-white truncate">
                            {notification.title}
                          </h4>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-[#D0B284] rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[#DCDDCC] mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#DCDDCC]/70">
                            {getNotificationAge(notification.createdAt)}
                          </span>
                          {notification.actionUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.location.href = notification.actionUrl!;
                                setIsOpen(false);
                              }}
                              className="text-xs text-[#D0B284] hover:text-white h-6 px-2"
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-[#D0B284] hover:text-white p-1"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-[#D0B284]/20 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.location.href = '/profile';
                  setIsOpen(false);
                }}
                className="text-xs text-[#D0B284] hover:text-white"
              >
                View all in profile
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
