'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, MessageCircle, Clock, Search, Filter } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

interface OfferData {
  id: string;
  itemName: string;
  ticker: string;
  image: string;
  offerAmount: string;
  fromAddress: string;
  fromDisplayName?: string;
  expiration: string;
  status: 'active' | 'expired' | 'accepted' | 'declined';
  createdAt: string;
}

interface OffersTabProps {
  offers?: OfferData[];
}

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

const SAMPLE_OFFERS: OfferData[] = [
  {
    id: '1',
    itemName: '1991 Porsche 964 Turbo',
    ticker: '$P964',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '45.5 ETH',
    fromAddress: '0x742d...35c3',
    fromDisplayName: 'PorscheCollector',
    expiration: '2024-07-30',
    status: 'active',
    createdAt: '2024-07-23',
  },
  {
    id: '2',
    itemName: 'Audemars Piguet Royal Oak KAWS',
    ticker: '$APKAWS',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '28.2 ETH',
    fromAddress: '0x8f1a...92b4',
    fromDisplayName: 'WatchEnthusiast',
    expiration: '2024-07-28',
    status: 'active',
    createdAt: '2024-07-22',
  },
  {
    id: '3',
    itemName: 'Andy Warhol Marilyn Monroe',
    ticker: '$WARHOL',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '125.0 ETH',
    fromAddress: '0x3c2e...7f8d',
    expiration: '2024-07-25',
    status: 'expired',
    createdAt: '2024-07-18',
  },
  {
    id: '4',
    itemName: '1991 Porsche 964 Turbo',
    ticker: '$P964',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '42.0 ETH',
    fromAddress: '0x9d4b...1a2c',
    fromDisplayName: 'CryptoTrader',
    expiration: '2024-07-26',
    status: 'declined',
    createdAt: '2024-07-20',
  },
  {
    id: '5',
    itemName: 'Audemars Piguet Royal Oak KAWS',
    ticker: '$APKAWS',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '25.8 ETH',
    fromAddress: '0x1f8e...6b9a',
    fromDisplayName: 'LuxuryCollector',
    expiration: '2024-07-24',
    status: 'accepted',
    createdAt: '2024-07-19',
  },
  {
    id: '6',
    itemName: 'Richard Mille RM-88 Smiley',
    ticker: '$RM88',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '67.5 ETH',
    fromAddress: '0x5a3b...8c9d',
    fromDisplayName: 'RMCollector',
    expiration: '2024-07-29',
    status: 'active',
    createdAt: '2024-07-21',
  },
  {
    id: '7',
    itemName: 'Andy Warhol Marilyn Monroe',
    ticker: '$WARHOL',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '118.5 ETH',
    fromAddress: '0x7e2f...4a5b',
    expiration: '2024-07-27',
    status: 'declined',
    createdAt: '2024-07-17',
  },
  {
    id: '8',
    itemName: '1991 Porsche 964 Turbo',
    ticker: '$P964',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '38.9 ETH',
    fromAddress: '0x6c4d...9e8f',
    fromDisplayName: 'CarEnthusiast',
    expiration: '2024-07-23',
    status: 'expired',
    createdAt: '2024-07-16',
  },
  {
    id: '9',
    itemName: 'Hermès Himalaya Kelly Retourne 32',
    ticker: '$HIMALY',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '15.2 ETH',
    fromAddress: '0x8b7a...3c2d',
    fromDisplayName: 'FashionCollector',
    expiration: '2024-07-31',
    status: 'active',
    createdAt: '2024-07-24',
  },
  {
    id: '10',
    itemName: 'Hermès Himalaya Kelly Retourne 32',
    ticker: '$HIMALY',
    image: '/placeholder.svg?height=40&width=40',
    offerAmount: '12.8 ETH',
    fromAddress: '0x4f6e...7d8c',
    expiration: '2024-07-22',
    status: 'accepted',
    createdAt: '2024-07-15',
  },
];

export function OffersTab({ offers = SAMPLE_OFFERS }: OffersTabProps) {
  const [listingFilter, setListingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

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
