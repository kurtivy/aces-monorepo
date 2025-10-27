'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, MessageCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { OffersApi, OfferData } from '@/lib/api/offers';
import { Input } from '@/components/ui/input';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'text-[#184D37] bg-[#184D37]/10';
    case 'EXPIRED':
      return 'text-[#928357] bg-[#928357]/10';
    case 'ACCEPTED':
      return 'text-[#D0B284] bg-[#D0B284]/10';
    case 'REJECTED':
      return 'text-red-400 bg-red-400/10';
    default:
      return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
  }
};

// Helper function to format bid data as offer data
const formatBidAsOffer = (bid: {
  id: string;
  amount: string;
  message?: string;
  listingId: string;
  bidderId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
  expiresAt: string;
  respondedAt?: string;
  responseMessage?: string;
  createdAt: string;
  updatedAt: string;
  bidder: {
    id: string;
    username?: string;
    walletAddress?: string;
    email?: string;
  };
  listing: {
    id: string;
    title: string;
    symbol: string;
    ownerId: string;
    isLive: boolean;
    startingBidPrice?: string;
    reservePrice?: string;
    imageGallery?: string[];
  };
}): OfferData => {
  return {
    id: bid.id,
    itemName: bid.listing.title,
    ticker: bid.listing.symbol,
    image: bid.listing.imageGallery?.[0] || '/placeholder.svg',
    offerAmount: `$${parseFloat(bid.amount).toLocaleString()}`,
    fromAddress: bid.bidder.walletAddress || bid.bidder.id,
    fromDisplayName: bid.bidder.username || undefined,
    expiration: new Date(bid.expiresAt).toLocaleDateString(),
    status:
      bid.status === 'PENDING'
        ? 'active'
        : bid.status === 'ACCEPTED'
          ? 'accepted'
          : bid.status === 'REJECTED'
            ? 'declined'
            : 'expired',
    createdAt: new Date(bid.createdAt).toLocaleDateString(),
  };
};

export function OffersTab() {
  const { getAccessToken, user } = useAuth();
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getAccessToken();
        if (!token) {
          setError('Authentication required');
          return;
        }

        const result = await OffersApi.getOffersForMyListings(token);

        if (result.success && result.data) {
          const formattedOffers = result.data.map(formatBidAsOffer);
          setOffers(formattedOffers);
        } else {
          setError(result.error || 'Failed to fetch offers');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching offers');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchOffers();
    }
  }, [getAccessToken, user]);

  // Order by most recent first
  const orderedOffers = [...offers].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  // Simple search like Bids tab
  const filteredAllOffers = orderedOffers.filter((offer) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const name = offer.itemName.toLowerCase();
    const from = (offer.fromDisplayName || offer.fromAddress || '').toLowerCase();
    return name.includes(q) || from.includes(q) || offer.ticker.toLowerCase().includes(q);
  });

  // Handler functions for offer actions
  const handleAcceptOffer = async (offerId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const result = await OffersApi.acceptOffer(offerId, token);
      if (result.success) {
        // Refresh offers after successful acceptance
        const refreshResult = await OffersApi.getOffersForMyListings(token);
        if (refreshResult.success && refreshResult.data) {
          const formattedOffers = refreshResult.data.map(formatBidAsOffer);
          setOffers(formattedOffers);
        }
      } else {
        setError(result.error || 'Failed to accept offer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while accepting offer');
    }
  };

  const handleDeclineOffer = async (offerId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const result = await OffersApi.declineOffer(offerId, token);
      if (result.success) {
        // Refresh offers after successful decline
        const refreshResult = await OffersApi.getOffersForMyListings(token);
        if (refreshResult.success && refreshResult.data) {
          const formattedOffers = refreshResult.data.map(formatBidAsOffer);
          setOffers(formattedOffers);
        }
      } else {
        setError(result.error || 'Failed to decline offer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while declining offer');
    }
  };

  const handleCounterOffer = async (offerId: string, counterAmount: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const result = await OffersApi.counterOffer(offerId, counterAmount, 'ETH', token);
      if (result.success) {
        // Refresh offers after successful counter
        const refreshResult = await OffersApi.getOffersForMyListings(token);
        if (refreshResult.success && refreshResult.data) {
          const formattedOffers = refreshResult.data.map(formatBidAsOffer);
          setOffers(formattedOffers);
        }
      } else {
        setError(result.error || 'Failed to counter offer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while countering offer');
    }
  };

  // Authentication check
  if (!user) {
    return (
      <div className="bg-[#151c16] rounded-lg border border-dashed border-[#E6E3D3]/25 relative">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-[#E6E3D3] font-jetbrains">
              Please connect your wallet to view offers
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-[#151c16] rounded-lg border border-dashed border-[#E6E3D3]/25 relative h-full">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        <div className="p-6">
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
      <div className="bg-[#0f1511] rounded-lg border border-dashed border-[#E6E3D3]/25 relative h-full">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-red-400 font-jetbrains">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#0f1511] rounded-lg border border-dashed border-[#E6E3D3]/25 relative">
      {/* Corner ticks */}
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

      <div className="p-6 space-y-6 h-full overflow-y-auto">
        {/* Simple search like Bids tab */}
        <div className="flex justify-end mb-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search offers..."
            className="bg-[#151c16] border-[#D0B284]/20 text-white w-64"
          />
        </div>

        {filteredAllOffers.some((o) => o.status === 'active') && (
          <div className="rounded-xl bg-[#151c16] border border-[#D0B284]/20 shadow-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">
                Active Offers ({filteredAllOffers.filter((o) => o.status === 'active').length})
              </h2>

              <div className="space-y-4">
                {filteredAllOffers
                  .filter((o) => o.status === 'active')
                  .map((offer) => (
                    <div
                      key={offer.id}
                      className="flex items-center justify-between p-4 bg-[#184D37]/10 border border-[#184D37]/20 rounded-lg hover:bg-[#184D37]/20 transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-4">
                        <Image
                          src={offer.image || '/placeholder.svg'}
                          alt={offer.itemName}
                          className="w-12 h-12 rounded-full object-cover border border-[#D0B284]/20"
                          width={40}
                          height={40}
                        />
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-white font-medium">
                              {offer.itemName.split(' ').slice(0, 3).join(' ')}
                            </h3>
                            <span className="text-[#DCDDCC] font-jetbrains text-sm">
                              {offer.ticker}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-[#D0B284] font-medium">{offer.offerAmount}</span>
                            <span className="text-[#DCDDCC]">
                              from{' '}
                              {offer.fromDisplayName ||
                                `${offer.fromAddress.slice(0, 6)}...${offer.fromAddress.slice(-4)}`}
                            </span>
                            <div className="flex items-center space-x-1 text-[#DCDDCC]">
                              <Clock className="w-3 h-3" />
                              <span>Expires {offer.expiration}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#DCDDCC] hover:bg-[#D0B284]/10 border border-[#DCDDCC]/20"
                          onClick={() => {
                            const counterAmount = prompt('Enter counter offer amount:');
                            if (counterAmount && !isNaN(parseFloat(counterAmount))) {
                              handleCounterOffer(offer.id, counterAmount);
                            }
                          }}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Counter
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:bg-red-400/10 border border-red-400/20"
                          onClick={() => handleDeclineOffer(offer.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                          onClick={() => handleAcceptOffer(offer.id)}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Accept
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-[#151c16] border border-[#D0B284]/20 shadow-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">
              Offer History ({filteredAllOffers.length})
            </h2>

            {filteredAllOffers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#DCDDCC] font-jetbrains">
                  {searchTerm ? 'No offers match your current search' : 'No offers found'}
                </p>
                {searchTerm && (
                  <Button
                    variant="ghost"
                    onClick={() => setSearchTerm('')}
                    className="text-[#D0B284] hover:bg-[#D0B284]/10 mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#D0B284]/20">
                      <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                        Item
                      </th>
                      <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                        Offer Amount
                      </th>
                      <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                        From
                      </th>
                      <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                        Expiration
                      </th>
                      <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                        Status
                      </th>
                      <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                        Date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAllOffers.map((offer) => (
                      <tr
                        key={offer.id}
                        className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 transition-colors duration-200"
                      >
                        <td className="py-4 px-2">
                          <div className="flex items-center space-x-3">
                            <Image
                              src={offer.image || '/placeholder.svg'}
                              alt={offer.itemName}
                              className="w-8 h-8 rounded-full object-cover border border-[#D0B284]/20"
                              width={40}
                              height={40}
                            />
                            <div>
                              <h3 className="text-white font-medium text-sm">
                                {offer.itemName.split(' ').slice(0, 2).join(' ')}
                              </h3>
                              <span className="text-[#DCDDCC] font-jetbrains text-xs">
                                {offer.ticker}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-2 text-center">
                          <span className="text-[#D0B284] font-medium text-sm">
                            {offer.offerAmount}
                          </span>
                        </td>

                        <td className="py-4 px-2 text-center">
                          <span className="text-white text-sm">
                            {offer.fromDisplayName ||
                              `${offer.fromAddress.slice(0, 6)}...${offer.fromAddress.slice(-4)}`}
                          </span>
                        </td>

                        <td className="py-4 px-2 text-center">
                          <span className="text-[#DCDDCC] text-sm">{offer.expiration}</span>
                        </td>

                        <td className="py-4 px-2 text-center">
                          <Badge className={`${getStatusColor(offer.status)} border-none text-xs`}>
                            {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                          </Badge>
                        </td>

                        <td className="py-4 px-2 text-right">
                          <span className="text-[#DCDDCC] text-sm">{offer.createdAt}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
