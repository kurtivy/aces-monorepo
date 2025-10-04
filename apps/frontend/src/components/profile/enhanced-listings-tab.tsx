'use client';

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Edit,
  Eye,
  MoreHorizontal,
  Settings,
  Clock,
  Check,
  Coins,
  FileText,
  Plus,
  ExternalLink,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { ListingsApi, ListingData } from '@/lib/api/listings';
import {
  TokenCreationApi,
  ListingWithTokenStatus,
  TokenCreationStatus,
} from '@/lib/api/token-creation';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Placeholder image for when listing images fail to load or are missing
const LISTING_PLACEHOLDER =
  'data:image/svg+xml;base64,' +
  btoa(`
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="#231F20" rx="4"/>
    <rect x="8" y="8" width="24" height="24" fill="#184D37" fill-opacity="0.2" rx="2"/>
    <path d="M16 22L20 18L24 22L28 18" stroke="#D0B284" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18" cy="16" r="1.5" fill="#D0B284"/>
  </svg>
`);

interface EnhancedListingData extends ListingData {
  tokenCreationStatus?: string | null;
  tokenAddress?: string;
  tokenMinted?: boolean;
}

export function EnhancedListingsTab() {
  const { getAccessToken, user } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<EnhancedListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Fetch regular listings
      const listingsResult = await ListingsApi.getMyListings(token);

      if (!listingsResult.success || !listingsResult.data) {
        setError(listingsResult.error || 'Failed to fetch listings');
        return;
      }

      // Fetch token creation status for listings
      const tokenResult = await TokenCreationApi.getUserTokenCreationStatus(token);

      // Merge token status with listings
      const enhancedListings = listingsResult.data.map((listing: ListingData) => {
        const tokenStatus =
          tokenResult.success && tokenResult.data
            ? tokenResult.data.find((t: ListingWithTokenStatus) => t.id === listing.id)
            : null;

        return {
          ...listing,
          tokenCreationStatus: tokenStatus?.tokenCreationStatus || null,
          tokenAddress: tokenStatus?.tokenParameters?.contractAddress || null,
          tokenMinted: tokenStatus?.tokenCreationStatus === TokenCreationStatus.MINTED,
        };
      });

      setListings(enhancedListings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching listings');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user?.id) {
      fetchListings();
    }
  }, [user?.id, fetchListings]);

  const getListingStatus = (
    listing: EnhancedListingData,
  ): 'live' | 'pending' | 'token-ready' | 'token-minted' => {
    if (listing.tokenMinted) return 'token-minted';
    if (listing.tokenCreationStatus === TokenCreationStatus.READY_TO_MINT) return 'token-ready';
    if (!listing.isLive) return 'pending';
    return 'live';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'pending':
        return 'text-[#D7BF75] bg-[#D7BF75]/10';
      case 'token-ready':
        return 'text-green-400 bg-green-400/10';
      case 'token-minted':
        return 'text-purple-400 bg-purple-400/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <Check className="w-3 h-3" />;
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'token-ready':
        return <Settings className="w-3 h-3" />;
      case 'token-minted':
        return <Coins className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live':
        return 'Live';
      case 'pending':
        return 'Pending';
      case 'token-ready':
        return 'Ready to Mint';
      case 'token-minted':
        return 'Token Minted';
      default:
        return 'Unknown';
    }
  };

  const getTokenCreationStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;

    const statusInfo: Record<string, { text: string; color: string; icon: React.ReactElement }> = {
      [TokenCreationStatus.AWAITING_USER_DETAILS]: {
        text: 'Complete Details',
        color: 'text-yellow-400 bg-yellow-400/10',
        icon: <FileText className="w-3 h-3" />,
      },
      [TokenCreationStatus.PENDING_ADMIN_REVIEW]: {
        text: 'Under Review',
        color: 'text-blue-400 bg-blue-400/10',
        icon: <Clock className="w-3 h-3" />,
      },
      [TokenCreationStatus.READY_TO_MINT]: {
        text: 'Ready to Mint',
        color: 'text-green-400 bg-green-400/10',
        icon: <Settings className="w-3 h-3" />,
      },
      [TokenCreationStatus.MINTED]: {
        text: 'Minted',
        color: 'text-purple-400 bg-purple-400/10',
        icon: <Coins className="w-3 h-3" />,
      },
    };

    const info = statusInfo[status];
    if (!info) return null;

    return (
      <Badge className={`${info.color} border-none text-xs flex items-center gap-1`}>
        {info.icon}
        {info.text}
      </Badge>
    );
  };

  const handleListingAction = (listing: EnhancedListingData) => {
    const status = listing.tokenCreationStatus;

    switch (status) {
      case TokenCreationStatus.AWAITING_USER_DETAILS:
        router.push(`/listings/${listing.id}/complete-details`);
        break;
      case TokenCreationStatus.READY_TO_MINT:
        router.push(`/listings/${listing.id}/mint`);
        break;
      case TokenCreationStatus.MINTED:
        router.push(`/rwa/${listing.symbol}`);
        break;
      default:
        // View listing details
        router.push(`/rwa/${listing.symbol}`);
    }
  };

  const getActionText = (listing: EnhancedListingData) => {
    const status = listing.tokenCreationStatus;

    switch (status) {
      case TokenCreationStatus.AWAITING_USER_DETAILS:
        return 'Complete Details';
      case TokenCreationStatus.READY_TO_MINT:
        return 'Mint Token';
      case TokenCreationStatus.MINTED:
        return 'View Token';
      default:
        return 'View';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#D7BF75] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-[#DCDDCC]">Loading your listings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">{error}</p>
        <Button onClick={fetchListings} className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black">
          Try Again
        </Button>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-[#DCDDCC]/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No listings yet</h3>
        <p className="text-[#DCDDCC] mb-6">
          Create your first submission to get started with token creation.
        </p>
        <Button
          onClick={() => router.push('/launch')}
          className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Submission
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-medium text-white mb-1">Your Listings</h3>
          <p className="text-sm text-[#DCDDCC]">
            Manage your submitted assets and token creation progress
          </p>
        </div>
        <Button
          onClick={() => router.push('/launch')}
          className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Submission
        </Button>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => {
          const status = getListingStatus(listing);
          const imageUrl = listing.imageGallery?.[0] || LISTING_PLACEHOLDER;

          return (
            <div
              key={listing.id}
              className="bg-[#151c16]/40 border border-[#E6E3D3]/20 rounded-xl overflow-hidden hover:border-[#D7BF75]/40 transition-all duration-200"
            >
              {/* Image */}
              <div className="relative h-48 bg-[#231F20]">
                <Image
                  src={imageUrl}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = LISTING_PLACEHOLDER;
                  }}
                />
                <div className="absolute top-3 right-3">
                  {getTokenCreationStatusBadge(listing.tokenCreationStatus)}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Title and Symbol */}
                <div>
                  <h4 className="font-medium text-white truncate">{listing.title}</h4>
                  <p className="text-sm text-[#DCDDCC] font-mono">{listing.symbol}</p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between">
                  <Badge
                    className={`${getStatusColor(status)} border-none text-xs flex items-center gap-1`}
                  >
                    {getStatusIcon(status)}
                    {getStatusText(status)}
                  </Badge>
                  <span className="text-xs text-[#DCDDCC]">
                    {new Date(listing.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-[#DCDDCC] line-clamp-2">{listing.description}</p>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => handleListingAction(listing)}
                    className="flex-1 bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black text-sm"
                  >
                    {getActionText(listing)}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-black border-[#D0B284]/20">
                      <DropdownMenuItem
                        onClick={() => router.push(`/rwa/${listing.symbol}`)}
                        className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          /* Edit functionality */
                        }}
                        className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Listing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
