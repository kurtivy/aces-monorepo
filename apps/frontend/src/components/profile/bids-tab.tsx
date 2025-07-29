'use client';

import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { BidsApi, BidData } from '@/lib/api/bids';

interface DisplayBidData {
  id: string;
  itemName: string;
  ticker: string;
  image: string;
  category: string;
  bidAmount: string;
  status: 'active' | 'outbid' | 'won' | 'expired';
  expiryDate: string;
  currentPrice: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-[#D7BF75] bg-[#D7BF75]/10';
    case 'won':
      return 'text-[#184D37] bg-[#184D37]/10';
    case 'outbid':
      return 'text-red-400 bg-red-400/10';
    case 'expired':
      return 'text-[#928357] bg-[#928357]/10';
    default:
      return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
  }
};

// Helper function to determine bid status based on listing state and bid data
const getBidStatus = (bid: BidData): 'active' | 'outbid' | 'won' | 'expired' => {
  if (!bid.listing.isLive) {
    return 'expired';
  }

  // For now, we'll consider all live bids as active
  // In a real implementation, you'd compare with current highest bid
  return 'active';
};

// Helper function to format bid data for display
const formatBidForDisplay = (bid: BidData): DisplayBidData => {
  const status = getBidStatus(bid);
  const imageUrl = bid.listing.imageGallery?.[0] || '/placeholder.svg?height=40&width=40';

  return {
    id: bid.id,
    itemName: bid.listing.title,
    ticker: bid.listing.symbol,
    image: imageUrl,
    category: 'Asset', // You might want to add category to the listing model
    bidAmount: `${bid.amount} ${bid.currency}`,
    status,
    expiryDate: bid.expiresAt ? new Date(bid.expiresAt).toLocaleDateString() : 'No expiry',
    currentPrice: `${bid.amount} ${bid.currency}`, // For now, same as bid amount
  };
};

export function BidsTab() {
  const { getAccessToken } = useAuth();
  const [bids, setBids] = useState<DisplayBidData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        if (result.success) {
          const formattedBids = result.data.map(formatBidForDisplay);
          setBids(formattedBids);
        } else {
          setError(result.error || 'Failed to fetch bids');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching bids');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBids();
  }, [getAccessToken]);

  if (isLoading) {
    return (
      <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">Your Bids</h2>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-[#D0B284]/10 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">Your Bids</h2>
          <div className="text-center py-8">
            <p className="text-red-400 font-jetbrains">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">Your Bids</h2>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 pb-4 border-b border-[#D0B284]/20 mb-4">
          <div className="col-span-4 text-[#DCDDCC] text-sm font-jetbrains uppercase">Item</div>
          <div className="col-span-2 text-center text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Your Bid
          </div>
          <div className="col-span-2 text-center text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Current Price
          </div>
          <div className="col-span-2 text-center text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Status
          </div>
          <div className="col-span-2 text-right text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Expires
          </div>
        </div>

        {/* Bid Rows */}
        <div className="space-y-4">
          {bids.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#DCDDCC] font-jetbrains">No bids found</p>
            </div>
          ) : (
            bids.map((bid) => (
              <div
                key={bid.id}
                className="grid grid-cols-12 gap-4 items-center py-3 hover:bg-[#D0B284]/5 transition-colors duration-200 rounded-lg"
              >
                {/* Item Info */}
                <div className="col-span-4 flex items-center space-x-4">
                  <Image
                    src={bid.image || '/placeholder.svg'}
                    alt={bid.itemName}
                    className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                    width={40}
                    height={40}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-white font-medium truncate">
                        {bid.itemName.split(' ').slice(0, 3).join(' ')}
                      </h3>
                      <span className="text-[#DCDDCC] font-jetbrains text-sm">{bid.ticker}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-[#D0B284]/10 text-[#D0B284] text-xs px-2 py-0.5"
                    >
                      {bid.category}
                    </Badge>
                  </div>
                </div>

                {/* Your Bid */}
                <div className="col-span-2 text-center">
                  <span className="text-[#D0B284] font-medium">{bid.bidAmount}</span>
                </div>

                {/* Current Price */}
                <div className="col-span-2 text-center">
                  <span className="text-white font-medium">{bid.currentPrice}</span>
                </div>

                {/* Status */}
                <div className="col-span-2 text-center">
                  <Badge className={`${getStatusColor(bid.status)} border-none font-medium`}>
                    {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                  </Badge>
                </div>

                {/* Expires */}
                <div className="col-span-2 text-right">
                  <span className="text-[#DCDDCC] text-sm">{bid.expiryDate}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
