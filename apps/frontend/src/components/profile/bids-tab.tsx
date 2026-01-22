'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SellerDashboardOverlay } from './seller-dashboard-overlay';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { BidsApi, Bid } from '@/lib/api/bids';
import { ListingsApi, type ListingData } from '@/lib/api/listings';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

// Removed status filter tabs in favor of a search input

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'text-[#D7BF75] bg-[#D7BF75]/10';
    case 'ACCEPTED':
      return 'text-[#184D37] bg-[#184D37]/10';
    case 'REJECTED':
      return 'text-red-400 bg-red-400/10';
    case 'EXPIRED':
      return 'text-[#928357] bg-[#928357]/10';
    default:
      return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
  }
};

const formatBidAmount = (amount: string): string => {
  const numAmount = parseFloat(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function BidsTab() {
  const { getAccessToken, user } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSellerDashboardOpen, setIsSellerDashboardOpen] = useState(false);
  const [listingDetails, setListingDetails] = useState<Record<string, ListingData>>({});

  // Function to fetch listing details for bids
  const fetchListingDetails = useCallback(
    async (bidsData: Bid[]) => {
      const token = await getAccessToken();
      if (!token) return;

      const listingIds = bidsData
        .filter((bid) => !bid.listing || !bid.listing.title)
        .map((bid) => bid.listingId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

      console.log('BidsTab - Fetching listing details for:', listingIds);

      for (const listingId of listingIds) {
        try {
          const listingResult = await ListingsApi.getListingById(listingId);
          if (listingResult.success && listingResult.data) {
            setListingDetails((prev) => ({
              ...prev,
              [listingId]: listingResult.data,
            }));
            console.log(`BidsTab - Fetched listing ${listingId}:`, listingResult.data);
          }
        } catch (error) {
          console.error(`BidsTab - Error fetching listing ${listingId}:`, error);
        }
      }
    },
    [getAccessToken],
  );

  useEffect(() => {
    const fetchBids = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getAccessToken();
        if (!token) {
          setError('Authentication required');
          return;
        }

        const result = await BidsApi.getUserBids(token);

        // Debug logging
        console.log('BidsTab - API Result:', result);
        console.log('BidsTab - Result Data:', result.data);
        console.log('BidsTab - Result Data Data:', result.data?.data);

        if (result.success && result.data) {
          // Try different possible data structures
          const bidsData = result.data.data || result.data || [];
          console.log('BidsTab - Final Bids Data:', bidsData);
          console.log('BidsTab - Number of bids:', bidsData.length);

          // Log each bid to see the structure
          bidsData.forEach((bid, index) => {
            console.log(`BidsTab - Bid ${index}:`, bid);
            console.log(`BidsTab - Bid ${index} listing:`, bid.listing);
            console.log(`BidsTab - Bid ${index} imageGallery:`, bid.listing?.imageGallery);
          });

          setBids(bidsData);

          // Fetch listing details for bids that don't have them
          await fetchListingDetails(bidsData);
        } else {
          console.log('BidsTab - API Error:', result.error);
          setError(typeof result.error === 'string' ? result.error : 'Failed to fetch bids');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching bids');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBids();
  }, [getAccessToken, fetchListingDetails]);

  // Order by most recent activity
  const orderedBids = [...bids].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.respondedAt || a.expiresAt || a.createdAt).getTime();
    const bTime = new Date(b.updatedAt || b.respondedAt || b.expiresAt || b.createdAt).getTime();
    return bTime - aTime;
  });

  // Search filter by listing title or symbol (shows all statuses)
  const filteredBids = orderedBids.filter((bid) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const title = (bid.listing?.title || listingDetails[bid.listingId]?.title || '').toLowerCase();
    const symbol = (
      bid.listing?.symbol ||
      listingDetails[bid.listingId]?.symbol ||
      ''
    ).toLowerCase();
    return title.includes(q) || symbol.includes(q);
  });

  console.log('BidsTab - Total bids:', bids.length);
  console.log('BidsTab - Filtered bids:', filteredBids.length);
  console.log('BidsTab - Current filter:', searchTerm);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-[#D0B284]/10 rounded-lg" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-400 font-jetbrains">{error}</p>
        </div>
      );
    }

    return (
      <>
        {/* Search */}
        <div className="flex justify-end mb-6">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your bids..."
            className="bg-[#151c16] border-[#D0B284]/20 text-white w-64"
          />
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 pb-4 border-b border-dashed border-[#E6E3D3]/25 mb-4">
          <div className="col-span-4 text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
            Item
          </div>
          <div className="col-span-2 text-center text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
            Your Bid
          </div>
          <div className="col-span-2 text-center text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
            Status
          </div>
          <div className="col-span-2 text-center text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
            Expires
          </div>
          <div className="col-span-2 text-center text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
            Actions
          </div>
        </div>

        {/* Bid Rows */}
        <div className="space-y-4">
          {filteredBids.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#E6E3D3] font-jetbrains">
                {searchTerm === ''
                  ? 'No active bids have been placed'
                  : `No bids found matching "${searchTerm}"`}
              </p>
            </div>
          ) : (
            filteredBids.map((bid) => (
              <div
                key={bid.id}
                className="grid grid-cols-12 gap-4 items-center py-3 border-b border-dashed border-[#E6E3D3]/10 last:border-b-0"
              >
                {/* Item Info */}
                <div className="col-span-4 flex items-center space-x-4">
                  <Image
                    src={
                      bid.listing?.imageGallery?.[0] ||
                      listingDetails[bid.listingId]?.imageGallery?.[0] ||
                      '/placeholder.svg'
                    }
                    alt={
                      bid.listing?.title ||
                      listingDetails[bid.listingId]?.title ||
                      `Listing ${bid.listingId}`
                    }
                    className="w-10 h-10 rounded object-cover border border-[#D0B284]/20"
                    width={40}
                    height={40}
                    onError={(e) => {
                      console.log(
                        'Image failed to load for bid:',
                        bid.id,
                        'src:',
                        e.currentTarget.src,
                      );
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-[#E6E3D3] font-medium truncate text-sm">
                        {(bid.listing?.title || listingDetails[bid.listingId]?.title)
                          ?.split(' ')
                          .slice(0, 3)
                          .join(' ') || `Listing ${bid.listingId.slice(0, 8)}...`}
                      </h3>
                      <span className="text-[#E6E3D3] font-mono text-sm">
                        {bid.listing?.symbol || listingDetails[bid.listingId]?.symbol || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Your Bid */}
                <div className="col-span-2 text-center">
                  <span className="text-[#E6E3D3] text-sm">{formatBidAmount(bid.amount)}</span>
                </div>

                {/* Status */}
                <div className="col-span-2 text-center">
                  <Badge className={`${getStatusColor(bid.status)} border-none text-xs`}>
                    {bid.status.charAt(0).toUpperCase() + bid.status.slice(1).toLowerCase()}
                  </Badge>
                </div>

                {/* Expires */}
                <div className="col-span-2 text-center">
                  <span className="text-[#E6E3D3] text-sm">{formatDate(bid.expiresAt)}</span>
                </div>

                {/* Actions */}
                <div className="col-span-2 text-center">
                  <Link
                    href={`/rwa/${(bid.listing?.symbol || listingDetails[bid.listingId]?.symbol)?.toLowerCase()}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10 p-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  };

  return (
    <div className="relative">
      {/* Seller Dashboard Overlay - full screen overlay */}
      <SellerDashboardOverlay
        isOpen={isSellerDashboardOpen}
        onClose={() => setIsSellerDashboardOpen(false)}
      />

      {/* Main Table */}
      <div className="bg-[#0f1511] rounded-lg border border-dashed border-[#E6E3D3]/25">
        {/* Corner ticks */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

          {/* Table Content */}
          <div className="p-6">

            {/* Bids Content */}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
