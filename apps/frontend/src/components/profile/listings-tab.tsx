'use client';

import React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Eye, MoreHorizontal, X, Check, MessageCircle, Clock } from 'lucide-react';
import Image from 'next/image';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OfferData {
  id: string;
  offerAmount: string;
  fromAddress: string;
  fromDisplayName?: string;
  timestamp: string;
  status: 'active' | 'expired';
}

interface ListingData {
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
  offers: OfferData[];
}

interface ListingsTabProps {
  listings?: ListingData[];
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

const SAMPLE_LISTINGS: ListingData[] = [
  {
    id: '1',
    name: '1991 Porsche 964 Turbo',
    ticker: '$P964',
    image: '/canvas-image/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
    contractAddress: '0x8ac9...07b506',
    volume: '125.4 ETH',
    marketCap: '2.1M',
    tokenPrice: '0.0045 ETH',
    holders: 1247,
    feesMade: '12.54 ETH',
    status: 'active',
    offers: [
      {
        id: 'o1',
        offerAmount: '45.5 ETH',
        fromAddress: '0x742d...35c3',
        fromDisplayName: 'PorscheCollector',
        timestamp: '2024-07-23 14:30',
        status: 'active',
      },
      {
        id: 'o2',
        offerAmount: '42.0 ETH',
        fromAddress: '0x9d4b...1a2c',
        fromDisplayName: 'CryptoTrader',
        timestamp: '2024-07-22 09:15',
        status: 'active',
      },
      {
        id: 'o3',
        offerAmount: '38.5 ETH',
        fromAddress: '0x1f8e...6b9a',
        timestamp: '2024-07-21 16:45',
        status: 'expired',
      },
    ],
  },
  {
    id: '2',
    name: 'Audemars Piguet Royal Oak',
    ticker: '$APKAWS',
    image:
      '/canvas-image/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp',
    contractAddress: '0xbf85...298c36',
    volume: '89.2 ETH',
    marketCap: '1.8M',
    tokenPrice: '0.0067 ETH',
    holders: 892,
    feesMade: '8.92 ETH',
    status: 'active',
    offers: [
      {
        id: 'o4',
        offerAmount: '28.2 ETH',
        fromAddress: '0x8f1a...92b4',
        fromDisplayName: 'WatchEnthusiast',
        timestamp: '2024-07-23 11:20',
        status: 'active',
      },
    ],
  },
  {
    id: '3',
    name: 'Andy Warhol Marilyn Monroe',
    ticker: '$WARHOL',
    image: '/canvas-image/Andy-Warhol-Marilyn-Monroe-Limited-Edition-Print.webp',
    contractAddress: '0x60b0...3be80f',
    volume: '234.7 ETH',
    marketCap: '5.2M',
    tokenPrice: '0.0234 ETH',
    holders: 2156,
    feesMade: '23.47 ETH',
    status: 'sold',
    offers: [],
  },
];

export function ListingsTab({ listings = SAMPLE_LISTINGS }: ListingsTabProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleOffers = (listingId: string) => {
    setExpandedRow(expandedRow === listingId ? null : listingId);
  };

  return (
    <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#D0B284] font-libre-caslon">Your Listings</h2>
          <Button className="bg-[#D0B284] text-black hover:bg-[#D7BF75]">Create New Listing</Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  RWA / Ticker
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Contract
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Volume
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Market Cap
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Token Price
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Holders
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Fees Made
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {listings.map((listing) => (
                <React.Fragment key={listing.id}>
                  {/* Main Listing Row */}
                  <tr className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 transition-colors duration-200">
                    {/* RWA Info */}
                    <td className="py-4 px-2">
                      <div className="flex items-center space-x-3">
                        <Image
                          src={listing.image || '/placeholder.svg'}
                          alt={listing.name}
                          className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                          width={40}
                          height={40}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate text-sm">
                            {listing.name.split(' ').slice(0, 2).join(' ')}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[#DCDDCC] font-jetbrains text-xs">
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
                      <span className="text-[#DCDDCC] font-jetbrains text-xs">
                        {listing.contractAddress}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="py-4 px-2 text-center">
                      <span className="text-white font-medium text-sm">{listing.volume}</span>
                    </td>

                    {/* Market Cap */}
                    <td className="py-4 px-2 text-center">
                      <span className="text-white font-medium text-sm">{listing.marketCap}</span>
                    </td>

                    {/* Token Price */}
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#D0B284] font-medium text-sm">
                        {listing.tokenPrice}
                      </span>
                    </td>

                    {/* Holders */}
                    <td className="py-4 px-2 text-center">
                      <span className="text-white font-medium text-sm">
                        {listing.holders.toLocaleString()}
                      </span>
                    </td>

                    {/* Fees Made */}
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#184D37] font-medium text-sm">{listing.feesMade}</span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-2 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#D0B284] hover:bg-[#D0B284]/10 text-xs"
                          onClick={() => toggleOffers(listing.id)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View Offers ({listing.offers.length})
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
