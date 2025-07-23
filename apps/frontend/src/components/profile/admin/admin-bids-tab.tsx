'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye, Trash2, Clock } from 'lucide-react';
import Image from 'next/image';

interface AdminBidData {
  id: string;
  listingName: string;
  listingTicker: string;
  listingImage: string;
  bidderName: string;
  bidderAddress: string;
  bidAmount: string;
  bidAmountUSD: string;
  status: 'active' | 'accepted' | 'rejected' | 'expired' | 'outbid';
  submittedAt: string;
  expiresAt: string;
  seller: string;
  sellerAddress: string;
}

const SAMPLE_ADMIN_BIDS: AdminBidData[] = [
  {
    id: '1',
    listingName: '1991 Porsche 964 Turbo',
    listingTicker: '$P964',
    listingImage: '/placeholder.svg?height=40&width=40',
    bidderName: 'PorscheCollector',
    bidderAddress: '0x742d...35c3',
    bidAmount: '45.5 ETH',
    bidAmountUSD: '$148,950',
    status: 'active',
    submittedAt: '2024-07-23 14:30',
    expiresAt: '2024-07-30 14:30',
    seller: 'John Ferrari',
    sellerAddress: '0x8ac9...07b506',
  },
  {
    id: '2',
    listingName: 'Audemars Piguet Royal Oak',
    listingTicker: '$APKAWS',
    listingImage: '/placeholder.svg?height=40&width=40',
    bidderName: 'WatchEnthusiast',
    bidderAddress: '0x8f1a...92b4',
    bidAmount: '28.2 ETH',
    bidAmountUSD: '$92,286',
    status: 'active',
    submittedAt: '2024-07-23 11:20',
    expiresAt: '2024-07-28 11:20',
    seller: 'Sarah Timepiece',
    sellerAddress: '0xbf85...298c36',
  },
  {
    id: '3',
    listingName: 'Andy Warhol Marilyn Monroe',
    listingTicker: '$WARHOL',
    listingImage: '/placeholder.svg?height=40&width=40',
    bidderName: 'ArtCollector',
    bidderAddress: '0x3c2e...7f8d',
    bidAmount: '125.0 ETH',
    bidAmountUSD: '$409,250',
    status: 'accepted',
    submittedAt: '2024-07-22 16:45',
    expiresAt: '2024-07-29 16:45',
    seller: 'Art Gallery NYC',
    sellerAddress: '0x60b0...3be80f',
  },
  {
    id: '4',
    listingName: 'Richard Mille RM-88',
    listingTicker: '$RM88',
    listingImage: '/placeholder.svg?height=40&width=40',
    bidderName: 'CryptoTrader',
    bidderAddress: '0x9d4b...1a2c',
    bidAmount: '18.7 ETH',
    bidAmountUSD: '$61,171',
    status: 'rejected',
    submittedAt: '2024-07-21 09:15',
    expiresAt: '2024-07-28 09:15',
    seller: 'Watch Collector Pro',
    sellerAddress: '0x4f9f...d1a826',
  },
  {
    id: '5',
    listingName: '1991 Porsche 964 Turbo',
    listingTicker: '$P964',
    listingImage: '/placeholder.svg?height=40&width=40',
    bidderName: 'CarEnthusiast',
    bidderAddress: '0x1f8e...6b9a',
    bidAmount: '42.0 ETH',
    bidAmountUSD: '$137,460',
    status: 'outbid',
    submittedAt: '2024-07-22 12:30',
    expiresAt: '2024-07-29 12:30',
    seller: 'John Ferrari',
    sellerAddress: '0x8ac9...07b506',
  },
];

export function AdminBidsTab() {
  const [bids, setBids] = useState(SAMPLE_ADMIN_BIDS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [listingFilter, setListingFilter] = useState('ALL');

  const listings = ['ALL', ...Array.from(new Set(bids.map((b) => b.listingName)))];

  const filteredBids = bids
    .filter((bid) => {
      const matchesSearch =
        bid.listingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bid.bidderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bid.seller.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || bid.status === statusFilter;
      const matchesListing = listingFilter === 'ALL' || bid.listingName === listingFilter;
      return matchesSearch && matchesStatus && matchesListing;
    })
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'accepted':
        return 'text-[#D0B284] bg-[#D0B284]/10';
      case 'rejected':
        return 'text-red-400 bg-red-400/10';
      case 'expired':
        return 'text-[#928357] bg-[#928357]/10';
      case 'outbid':
        return 'text-orange-400 bg-orange-400/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
    }
  };

  const handleClearBid = (id: string) => {
    setBids((prev) => prev.filter((bid) => bid.id !== id));
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expiryTime = new Date(expiresAt).getTime();
    const now = new Date().getTime();
    const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);
    return hoursUntilExpiry <= 24 && hoursUntilExpiry > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Bids</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
            <Input
              placeholder="Search bids..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#231F20] border-[#D0B284]/20 text-white w-64"
            />
          </div>
          <select
            value={listingFilter}
            onChange={(e) => setListingFilter(e.target.value)}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            {listings.map((listing) => (
              <option key={listing} value={listing}>
                {listing === 'ALL' ? 'All Listings' : listing.split(' ').slice(0, 2).join(' ')}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="active">Active Bids</option>
            <option value="ALL">All Status</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
            <option value="outbid">Outbid</option>
          </select>
        </div>
      </div>

      {/* Live Bids Alert */}
      {statusFilter === 'active' && (
        <div className="bg-[#184D37]/10 border border-[#184D37]/20 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-[#184D37] rounded-full animate-pulse" />
            <span className="text-[#184D37] font-medium">Live Bids - Updates in real-time</span>
          </div>
        </div>
      )}

      {/* Bids Table */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Listing
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Bidder
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Bid Amount
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Seller
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Status
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Expires
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBids.map((bid) => (
                <tr
                  key={bid.id}
                  className={`border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 ${
                    isExpiringSoon(bid.expiresAt) && bid.status === 'active'
                      ? 'bg-yellow-400/5'
                      : ''
                  }`}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <Image
                        src={bid.listingImage || '/placeholder.svg'}
                        alt={bid.listingName}
                        className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                        width={40}
                        height={40}
                      />
                      <div>
                        <h3 className="text-white font-medium text-sm">
                          {bid.listingName.split(' ').slice(0, 2).join(' ')}
                        </h3>
                        <span className="text-[#DCDDCC] font-jetbrains text-xs">
                          {bid.listingTicker}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div>
                      <div className="text-white font-medium text-sm">{bid.bidderName}</div>
                      <div className="text-[#DCDDCC] font-jetbrains text-xs">
                        {bid.bidderAddress}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div>
                      <div className="text-[#D0B284] font-medium text-sm">{bid.bidAmount}</div>
                      <div className="text-[#DCDDCC] text-xs">{bid.bidAmountUSD}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div>
                      <div className="text-white font-medium text-sm">{bid.seller}</div>
                      <div className="text-[#DCDDCC] font-jetbrains text-xs">
                        {bid.sellerAddress}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Badge className={`${getStatusColor(bid.status)} border-none text-xs`}>
                        {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                      </Badge>
                      {isExpiringSoon(bid.expiresAt) && bid.status === 'active' && (
                        <Clock className="w-3 h-3 text-yellow-400" aria-label="Expires soon" />
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-[#DCDDCC] text-sm">{bid.expiresAt.split(' ')[0]}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#D0B284] hover:bg-[#D0B284]/10"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {(bid.status === 'rejected' ||
                        bid.status === 'accepted' ||
                        bid.status === 'expired') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-400/10"
                          onClick={() => handleClearBid(bid.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
