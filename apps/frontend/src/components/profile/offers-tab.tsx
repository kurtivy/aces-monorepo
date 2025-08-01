'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, MessageCircle, Clock, Search, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { OffersApi, OfferData } from '@/lib/api/offers';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-[#184D37] bg-[#184D37]/10';
    case 'expired':
      return 'text-[#928357] bg-[#928357]/10';
    case 'accepted':
      return 'text-[#D0B284] bg-[#D0B284]/10';
    case 'declined':
      return 'text-red-400 bg-red-400/10';
    default:
      return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
  }
};

// Helper function to format bid data as offer data
const formatBidAsOffer = (bid: {
  id: string;
  amount: string;
  currency: string;
  createdAt: string;
  expiresAt?: string;
  listing: {
    title: string;
    symbol: string;
    imageGallery?: string[];
  };
  bidder: {
    id: string;
    displayName?: string;
    walletAddress?: string;
  };
}): OfferData => {
  return {
    id: bid.id,
    itemName: bid.listing.title,
    ticker: bid.listing.symbol,
    image: bid.listing.imageGallery?.[0] || '/placeholder.svg?height=40&width=40',
    offerAmount: `${bid.amount} ${bid.currency}`,
    fromAddress: bid.bidder.walletAddress || bid.bidder.id,
    fromDisplayName: bid.bidder.displayName || undefined,
    expiration: bid.expiresAt ? new Date(bid.expiresAt).toLocaleDateString() : 'No expiry',
    status: 'active', // For now, all bids are considered active
    createdAt: new Date(bid.createdAt).toLocaleDateString(),
  };
};

export function OffersTab() {
  const { getAccessToken } = useAuth();
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingFilter, setListingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
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

        if (result.success) {
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

    fetchOffers();
  }, [getAccessToken]);

  const activeOffers = offers.filter((offer) => offer.status === 'active');

  // Get unique listings for filter dropdown
  const uniqueListings = Array.from(new Set(offers.map((offer) => offer.itemName)));
  const listingOptions = ['ALL', ...uniqueListings];

  // Enhanced filtering function
  const getFilteredOffers = (offersList: OfferData[]) => {
    return offersList.filter((offer) => {
      const matchesListing = listingFilter === 'ALL' || offer.itemName === listingFilter;
      const matchesStatus = statusFilter === 'ALL' || offer.status === statusFilter;
      const matchesSearch =
        offer.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offer.fromAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (offer.fromDisplayName &&
          offer.fromDisplayName.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesListing && matchesStatus && matchesSearch;
    });
  };

  const filteredActiveOffers = getFilteredOffers(activeOffers);
  const filteredAllOffers = getFilteredOffers(offers);

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-4">
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
      <div className="w-full space-y-6">
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-4">
          <div className="text-center py-8">
            <p className="text-red-400 font-jetbrains">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Filters Section */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#D0B284]">Filter Offers</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
            <input
              type="text"
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/50 border border-[#D0B284]/20 rounded-md text-white placeholder-[#DCDDCC] focus:border-[#D0B284] focus:outline-none"
            />
          </div>

          {/* Listing Filter */}
          <select
            value={listingFilter}
            onChange={(e) => setListingFilter(e.target.value)}
            className="px-3 py-2 bg-black/50 border border-[#D0B284]/20 rounded-md text-white focus:border-[#D0B284] focus:outline-none"
          >
            {listingOptions.map((listing) => (
              <option key={listing} value={listing} className="bg-[#231F20]">
                {listing === 'ALL' ? 'All Listings' : listing.split(' ').slice(0, 3).join(' ')}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-black/50 border border-[#D0B284]/20 rounded-md text-white focus:border-[#D0B284] focus:outline-none"
          >
            <option value="ALL" className="bg-[#231F20]">
              All Status
            </option>
            <option value="active" className="bg-[#231F20]">
              Active
            </option>
            <option value="expired" className="bg-[#231F20]">
              Expired
            </option>
            <option value="accepted" className="bg-[#231F20]">
              Accepted
            </option>
            <option value="declined" className="bg-[#231F20]">
              Declined
            </option>
          </select>

          {/* Clear Filters */}
          <Button
            variant="outline"
            onClick={() => {
              setListingFilter('ALL');
              setStatusFilter('ALL');
              setSearchTerm('');
            }}
            className="border-[#D0B284]/20 text-[#DCDDCC] hover:bg-[#D0B284]/10"
          >
            <Filter className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        </div>

        {/* Filter Summary */}
        {(listingFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm) && (
          <div className="mt-4 flex items-center space-x-2 text-sm">
            <span className="text-[#DCDDCC]">Active filters:</span>
            {listingFilter !== 'ALL' && (
              <Badge variant="secondary" className="bg-[#D0B284]/10 text-[#D0B284]">
                Listing: {listingFilter.split(' ').slice(0, 2).join(' ')}
              </Badge>
            )}
            {statusFilter !== 'ALL' && (
              <Badge variant="secondary" className="bg-[#D0B284]/10 text-[#D0B284]">
                Status: {statusFilter}
              </Badge>
            )}
            {searchTerm && (
              <Badge variant="secondary" className="bg-[#D0B284]/10 text-[#D0B284]">
                Search: &quot;{searchTerm}&quot;
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Active Offers */}
      {filteredActiveOffers.length > 0 && (
        <div className="rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">
              Active Offers ({filteredActiveOffers.length})
            </h2>

            <div className="space-y-4">
              {filteredActiveOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center justify-between p-4 bg-[#184D37]/10 border border-[#184D37]/20 rounded-lg hover:bg-[#184D37]/20 transition-colors duration-200"
                >
                  {/* Left side - Item and offer info */}
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

                  {/* Right side - Actions */}
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#DCDDCC] hover:bg-[#D0B284]/10 border border-[#DCDDCC]/20"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Counter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:bg-red-400/10 border border-red-400/20"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Decline
                    </Button>
                    <Button size="sm" className="bg-[#184D37] hover:bg-[#184D37]/80 text-white">
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

      {/* All Offers History */}
      <div className="rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">
            Offer History ({filteredAllOffers.length})
          </h2>

          {/* Empty State */}
          {filteredAllOffers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#DCDDCC] font-jetbrains">
                {listingFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm
                  ? 'No offers match your current filters'
                  : 'No offers found'}
              </p>
              {(listingFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setListingFilter('ALL');
                    setStatusFilter('ALL');
                    setSearchTerm('');
                  }}
                  className="text-[#D0B284] hover:bg-[#D0B284]/10 mt-2"
                >
                  Clear filters to see all offers
                </Button>
              )}
            </div>
          ) : (
            /* Table */
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Table Header */}
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

                {/* Table Body */}
                <tbody>
                  {filteredAllOffers.map((offer) => (
                    <tr
                      key={offer.id}
                      className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 transition-colors duration-200"
                    >
                      {/* Item */}
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

                      {/* Offer Amount */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#D0B284] font-medium text-sm">
                          {offer.offerAmount}
                        </span>
                      </td>

                      {/* From */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-white text-sm">
                          {offer.fromDisplayName ||
                            `${offer.fromAddress.slice(0, 6)}...${offer.fromAddress.slice(-4)}`}
                        </span>
                      </td>

                      {/* Expiration */}
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#DCDDCC] text-sm">{offer.expiration}</span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-2 text-center">
                        <Badge className={`${getStatusColor(offer.status)} border-none text-xs`}>
                          {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                        </Badge>
                      </td>

                      {/* Date */}
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
  );
}
