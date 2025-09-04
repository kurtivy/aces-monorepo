'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Eye, MoreHorizontal, X, Check, MessageCircle, Clock } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { ListingsApi, ListingData } from '@/lib/api/listings';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DisplayListingData {
  id: string;
  name: string;
  ticker: string;
  image: string;
  contractAddress: string;
  volume: string;
  marketCap: string;
  tokenPrice: string;
  holders: number;
  feesMade: string;
  status: 'active' | 'pending' | 'sold' | 'expired';
  offers: Array<{
    id: string;
    offerAmount: string;
    fromAddress: string;
    fromDisplayName?: string;
    timestamp: string;
    status: 'active' | 'expired';
  }>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-[#184D37] bg-[#184D37]/10';
    case 'pending':
      return 'text-[#D7BF75] bg-[#D7BF75]/10';
    case 'sold':
      return 'text-[#D0B284] bg-[#D0B284]/10';
    case 'expired':
      return 'text-red-400 bg-red-400/10';
    default:
      return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
  }
};

const getOfferStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-[#184D37] bg-[#184D37]/10';
    case 'expired':
      return 'text-[#928357] bg-[#928357]/10';
    default:
      return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
  }
};

// Helper function to determine listing status
const getListingStatus = (listing: ListingData): 'active' | 'pending' | 'sold' | 'expired' => {
  if (!listing.isLive) {
    return 'pending';
  }

  // For now, we'll consider live listings as active
  // In a real implementation, you'd check for sold status, expiration, etc.
  return 'active';
};

// Helper function to format listing data for display
const formatListingForDisplay = (listing: ListingData): DisplayListingData => {
  const status = getListingStatus(listing);
  const imageUrl = listing.imageGallery?.[0] || '/placeholder.svg?height=40&width=40';

  // Convert bids to offers format for display
  const offers =
    listing.bids?.map((bid) => {
      return {
        id: bid.id,
        offerAmount: `${bid.amount} ${bid.currency}`,
        fromAddress: bid.bidder?.id || 'Unknown',
        fromDisplayName: bid.bidder?.displayName || undefined,
        timestamp: new Date(bid.createdAt).toLocaleDateString(),
        status: 'active' as const, // For now, all bids are considered active
      };
    }) || [];

  return {
    id: listing.id,
    name: listing.title,
    ticker: listing.symbol,
    image: imageUrl,
    contractAddress: listing.contractAddress || '0x0000...0000',
    volume: '0 ETH', // Placeholder - would need to calculate from transactions
    marketCap: '0', // Placeholder - would need to calculate from token data
    tokenPrice: '0 ETH', // Placeholder - would need to calculate from token data
    holders: 0, // Placeholder - would need to get from token data
    feesMade: '0 ETH', // Placeholder - would need to calculate from transactions
    status,
    offers,
  };
};

export function ListingsTab() {
  const { getAccessToken } = useAuth();
  const [listings, setListings] = useState<DisplayListingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getAccessToken();
        if (!token) {
          setError('Authentication required');
          return;
        }

        const result = await ListingsApi.getMyListings(token);

        if (result.success) {
          const formattedListings = result.data.map(formatListingForDisplay);
          setListings(formattedListings);
        } else {
          setError(result.error || 'Failed to fetch listings');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching listings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [getAccessToken]);

  const toggleOffers = (listingId: string) => {
    setExpandedRow(expandedRow === listingId ? null : listingId);
  };

  if (isLoading) {
    return (
      <div className="bg-[#0A120B] rounded-lg border border-dashed border-[#D7BF75]/25 relative h-full">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
              Your Listings
            </div>
            <Button className="bg-[#D7BF75] text-black hover:bg-[#D7BF75]/80 text-sm px-4 py-2">
              Create New Listing
            </Button>
          </div>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-[#D7BF75]/10 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0A120B] rounded-lg border border-dashed border-[#D7BF75]/25 relative h-full">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
              Your Listings
            </div>
            <Button className="bg-[#D7BF75] text-black hover:bg-[#D7BF75]/80 text-sm px-4 py-2">
              Create New Listing
            </Button>
          </div>
          <div className="text-center py-8">
            <p className="text-red-400 font-jetbrains">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0A120B] rounded-lg border border-dashed border-[#D7BF75]/25 relative h-full">
      {/* Corner ticks */}
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
            Your Listings
          </div>
          <Button className="bg-[#D7BF75] text-black hover:bg-[#D7BF75]/80 text-sm px-4 py-2">
            Create New Listing
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-dashed border-[#D7BF75]/25">
                <th className="text-left text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  RWA / Ticker
                </th>
                <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  Contract
                </th>
                <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  Volume
                </th>
                <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  Market Cap
                </th>
                <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  Token Price
                </th>
                <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  Holders
                </th>
                <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  Fees Made
                </th>
                <th className="text-right text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {listings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <p className="text-[#E6E3D3] font-jetbrains">No listings found</p>
                  </td>
                </tr>
              ) : (
                listings.map((listing) => (
                  <React.Fragment key={listing.id}>
                    {/* Main Listing Row */}
                    <tr className="border-b border-dashed border-[#D7BF75]/10 last:border-b-0">
                      {/* RWA Info */}
                      <td className="py-4 px-2">
                        <div className="flex items-center space-x-3">
                          <Image
                            src={listing.image || '/placeholder.svg'}
                            alt={listing.name}
                            className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                            width={40}
                            height={40}
                            unoptimized={true}
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[#E6E3D3] font-medium truncate text-sm">
                              {listing.name.split(' ').slice(0, 2).join(' ')}
                            </h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-[#E6E3D3] font-mono text-xs">
                                {listing.ticker}
                              </span>
                              <Badge
                                className={`${getStatusColor(listing.status)} border-none text-xs`}
                              >
                                {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contract */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#E6E3D3] font-mono text-xs">
                          {listing.contractAddress}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#E6E3D3] text-sm">{listing.volume}</span>
                      </td>

                      {/* Market Cap */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#E6E3D3] text-sm">{listing.marketCap}</span>
                      </td>

                      {/* Token Price */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#E6E3D3] text-sm">{listing.tokenPrice}</span>
                      </td>

                      {/* Holders */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#E6E3D3] text-sm">
                          {listing.holders.toLocaleString()}
                        </span>
                      </td>

                      {/* Fees Made */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#E6E3D3] text-sm">{listing.feesMade}</span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-2 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="bg-[#184D37] hover:bg-[#184D37]/80 text-white border border-[#184D37] text-xs px-3 py-1"
                            onClick={() => toggleOffers(listing.id)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            VIEW OFFERS ({listing.offers.length})
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
                            <DropdownMenuContent className="bg-[#231F20] border border-[#D0B284]/20">
                              <DropdownMenuItem className="text-[#DCDDCC] hover:bg-[#D0B284]/10">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Listing
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Offers Subtable */}
                    {expandedRow === listing.id && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="bg-[#184D37]/10 border-t border-[#184D37]/20 animate-in slide-in-from-top-2 duration-300">
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[#D0B284] font-medium text-sm">
                                  Offers for {listing.name.split(' ').slice(0, 2).join(' ')}
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                                  onClick={() => setExpandedRow(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>

                              {listing.offers.length === 0 ? (
                                <div className="text-center py-6">
                                  <p className="text-[#DCDDCC] text-sm">No offers yet</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {listing.offers.map((offer) => (
                                    <div
                                      key={offer.id}
                                      className="flex items-center justify-between p-3 bg-[#231F20]/50 rounded-lg border border-[#D0B284]/10"
                                    >
                                      {/* Offer Info */}
                                      <div className="flex items-center space-x-4">
                                        <div>
                                          <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-[#D0B284] font-medium text-sm">
                                              {offer.offerAmount}
                                            </span>
                                            <Badge
                                              className={`${getOfferStatusColor(offer.status)} border-none text-xs`}
                                            >
                                              {offer.status.charAt(0).toUpperCase() +
                                                offer.status.slice(1)}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center space-x-3 text-xs text-[#DCDDCC]">
                                            <span>
                                              from{' '}
                                              {offer.fromDisplayName ||
                                                `${offer.fromAddress.slice(0, 6)}...${offer.fromAddress.slice(-4)}`}
                                            </span>
                                            <div className="flex items-center space-x-1">
                                              <Clock className="w-3 h-3" />
                                              <span>{offer.timestamp}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Offer Actions */}
                                      {offer.status === 'active' && (
                                        <div className="flex items-center space-x-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-[#DCDDCC] hover:bg-[#D0B284]/10 border border-[#DCDDCC]/20 text-xs px-2 py-1"
                                          >
                                            <MessageCircle className="w-3 h-3 mr-1" />
                                            Counter
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-400 hover:bg-red-400/10 border border-red-400/20 text-xs px-2 py-1"
                                          >
                                            <X className="w-3 h-3 mr-1" />
                                            Decline
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="bg-[#184D37] hover:bg-[#184D37]/80 text-white text-xs px-2 py-1"
                                          >
                                            <Check className="w-3 h-3 mr-1" />
                                            Accept
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
