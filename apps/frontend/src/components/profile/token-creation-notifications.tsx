'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Clock,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings,
  Coins,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  TokenCreationApi,
  ListingWithTokenStatus,
  TokenCreationStatus,
} from '@/lib/api/token-creation';
import { useRouter } from 'next/navigation';

interface AcknowledgedTokenNotifications {
  [listingId: string]: boolean;
}

interface MinimizedTokenNotifications {
  [listingId: string]: boolean;
}

export function TokenCreationNotifications() {
  const { getAccessToken, user } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<ListingWithTokenStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgedNotifications, setAcknowledgedNotifications] =
    useState<AcknowledgedTokenNotifications>({});
  const [minimizedNotifications, setMinimizedNotifications] = useState<MinimizedTokenNotifications>(
    {},
  );

  // Load acknowledged notifications from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const stored = localStorage.getItem(`acknowledged-token-notifications-${user.id}`);
      if (stored) {
        try {
          setAcknowledgedNotifications(JSON.parse(stored));
        } catch (err) {
          console.error('Failed to parse acknowledged token notifications:', err);
        }
      }

      const storedMinimized = localStorage.getItem(`minimized-token-notifications-${user.id}`);
      if (storedMinimized) {
        try {
          setMinimizedNotifications(JSON.parse(storedMinimized));
        } catch (err) {
          console.error('Failed to parse minimized token notifications:', err);
        }
      }
    }
  }, [user?.id]);

  // Fetch user's token creation status
  useEffect(() => {
    if (user?.id) {
      fetchTokenCreationStatus();
    }
  }, [user?.id]);

  const fetchTokenCreationStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const result = await TokenCreationApi.getUserTokenCreationStatus(token);

      if (result.success && result.data) {
        setListings(result.data);
      } else {
        setError(result.error || 'Failed to fetch token creation status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const saveAcknowledgedNotifications = (acknowledged: AcknowledgedTokenNotifications) => {
    if (typeof window !== 'undefined' && user?.id) {
      localStorage.setItem(
        `acknowledged-token-notifications-${user.id}`,
        JSON.stringify(acknowledged),
      );
    }
  };

  const saveMinimizedNotifications = (minimized: MinimizedTokenNotifications) => {
    if (typeof window !== 'undefined' && user?.id) {
      localStorage.setItem(`minimized-token-notifications-${user.id}`, JSON.stringify(minimized));
    }
  };

  const handleAcknowledge = (listingId: string) => {
    const newAcknowledged = { ...acknowledgedNotifications, [listingId]: true };
    setAcknowledgedNotifications(newAcknowledged);
    saveAcknowledgedNotifications(newAcknowledged);
  };

  const handleMinimize = (listingId: string) => {
    const newMinimized = { ...minimizedNotifications, [listingId]: true };
    setMinimizedNotifications(newMinimized);
    saveMinimizedNotifications(newMinimized);
  };

  const handleExpand = (listingId: string) => {
    const newMinimized = { ...minimizedNotifications };
    delete newMinimized[listingId];
    setMinimizedNotifications(newMinimized);
    saveMinimizedNotifications(newMinimized);
  };

  // Filter listings to show notifications
  const notificationsToShow = listings.filter((listing) => {
    // Don't show if acknowledged
    if (acknowledgedNotifications[listing.id]) return false;

    // Don't show if minimized (except for final states)
    if (
      minimizedNotifications[listing.id] &&
      listing.tokenCreationStatus !== TokenCreationStatus.READY_TO_MINT &&
      listing.tokenCreationStatus !== TokenCreationStatus.MINTED
    ) {
      return false;
    }

    // Show notifications for specific states
    return (
      listing.tokenCreationStatus === TokenCreationStatus.PENDING_ADMIN_REVIEW ||
      listing.tokenCreationStatus === TokenCreationStatus.READY_TO_MINT ||
      listing.tokenCreationStatus === TokenCreationStatus.MINTED
    );
  });

  // Filter for minimized indicators
  const minimizedIndicatorsToShow = listings.filter((listing) => {
    return (
      minimizedNotifications[listing.id] &&
      !acknowledgedNotifications[listing.id] &&
      listing.tokenCreationStatus === TokenCreationStatus.PENDING_ADMIN_REVIEW
    );
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case TokenCreationStatus.PENDING_ADMIN_REVIEW:
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case TokenCreationStatus.READY_TO_MINT:
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case TokenCreationStatus.MINTED:
        return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10 border-[#DCDDCC]/20';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case TokenCreationStatus.PENDING_ADMIN_REVIEW:
        return <Clock className="w-4 h-4 text-blue-400" />;
      case TokenCreationStatus.READY_TO_MINT:
        return <Settings className="w-4 h-4 text-green-400" />;
      case TokenCreationStatus.MINTED:
        return <Coins className="w-4 h-4 text-purple-400" />;
      default:
        return <FileText className="w-4 h-4 text-[#DCDDCC]" />;
    }
  };

  const getStatusMessage = (listing: ListingWithTokenStatus) => {
    switch (listing.tokenCreationStatus) {
      case TokenCreationStatus.PENDING_ADMIN_REVIEW:
        return {
          title: 'Token Parameters Under Review',
          message:
            "Your token creation request is being reviewed by our team. You'll be notified once parameters are approved.",
        };
      case TokenCreationStatus.READY_TO_MINT:
        return {
          title: 'Ready to Mint Your Token!',
          message:
            'Your token parameters have been approved. You can now mint your token and launch it for trading.',
          actionText: 'Mint Token',
          actionUrl: `/listings/${listing.id}/mint`,
        };
      case TokenCreationStatus.MINTED:
        return {
          title: 'Token Successfully Minted!',
          message: 'Congratulations! Your token has been minted and is now live for trading.',
          actionText: 'View Token',
          actionUrl: `/rwa/${listing.symbol}`,
        };
      default:
        return {
          title: 'Token Creation Update',
          message: 'Your token creation status has been updated.',
        };
    }
  };

  const getStatusBadgeText = (status: string | null) => {
    switch (status) {
      case TokenCreationStatus.PENDING_ADMIN_REVIEW:
        return 'Under Review';
      case TokenCreationStatus.READY_TO_MINT:
        return 'Ready to Mint';
      case TokenCreationStatus.MINTED:
        return 'Minted';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-[#D7BF75]" />
        <span className="ml-2 text-[#DCDDCC]">Loading token creation status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-400/20 bg-red-400/10">
        <AlertDescription className="text-red-400">{error}</AlertDescription>
      </Alert>
    );
  }

  // Show minimized indicators
  if (minimizedIndicatorsToShow.length > 0 && notificationsToShow.length === 0) {
    return (
      <div className="space-y-2">
        {minimizedIndicatorsToShow.map((listing) => (
          <div
            key={listing.id}
            className="flex items-center justify-between p-3 bg-blue-400/10 border border-blue-400/20 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400">
                Token creation in progress for &quot;{listing.title}&quot;
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExpand(listing.id)}
              className="text-blue-400 hover:bg-blue-400/20"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  if (notificationsToShow.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {notificationsToShow.map((listing) => {
        const statusInfo = getStatusMessage(listing);
        const isMinimized = minimizedNotifications[listing.id];

        if (isMinimized) {
          return (
            <div
              key={listing.id}
              className="flex items-center justify-between p-3 bg-blue-400/10 border border-blue-400/20 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400">
                  Token creation in progress for &quot;{listing.title}&quot;
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExpand(listing.id)}
                className="text-blue-400 hover:bg-blue-400/20"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
          );
        }

        return (
          <Alert
            key={listing.id}
            className={`border ${getStatusColor(listing.tokenCreationStatus)} relative`}
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(listing.tokenCreationStatus)}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{statusInfo.title}</h4>
                    <Badge
                      variant="outline"
                      className={getStatusColor(listing.tokenCreationStatus)}
                    >
                      {getStatusBadgeText(listing.tokenCreationStatus)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {listing.tokenCreationStatus === TokenCreationStatus.PENDING_ADMIN_REVIEW && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMinimize(listing.id)}
                        className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <AlertDescription className="text-[#DCDDCC]">
                  <div className="space-y-2">
                    <p>{statusInfo.message}</p>

                    <div className="flex items-center justify-between text-xs text-[#DCDDCC]/70">
                      <span>
                        {listing.title} ({listing.symbol}) • Updated {formatDate(listing.updatedAt)}
                      </span>
                    </div>
                  </div>
                </AlertDescription>

                <div className="flex items-center gap-2 pt-2">
                  {statusInfo.actionText && statusInfo.actionUrl && (
                    <Button
                      size="sm"
                      onClick={() => router.push(statusInfo.actionUrl!)}
                      className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
                    >
                      {statusInfo.actionText}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAcknowledge(listing.id)}
                    className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
