'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye, Edit, Trash2 } from 'lucide-react';

interface AdminListingData {
  id: string;
  name: string;
  ticker: string;
  image: string;
  seller: string;
  sellerAddress: string;
  category: string;
  volume: string;
  marketCap: string;
  tokenPrice: string;
  holders: number;
  status: 'active' | 'pending' | 'suspended' | 'sold';
  listedAt: string;
  lastActivity: string;
}

const SAMPLE_ADMIN_LISTINGS: AdminListingData[] = [
  {
    id: '1',
    name: '1991 Porsche 964 Turbo',
    ticker: '$P964',
    image: '/placeholder.svg?height=40&width=40',
    seller: 'John Ferrari',
    sellerAddress: '0x742d...35c3',
    category: 'Cars',
    volume: '125.4 ETH',
    marketCap: '2.1M',
    tokenPrice: '0.0045 ETH',
    holders: 1247,
    status: 'active',
    listedAt: '2024-07-20 14:30',
    lastActivity: '2024-07-23 16:45',
  },
  {
    id: '2',
    name: 'Audemars Piguet Royal Oak KAWS',
    ticker: '$APKAWS',
    image: '/placeholder.svg?height=40&width=40',
    seller: 'Sarah Timepiece',
    sellerAddress: '0x8f1a...92b4',
    category: 'Watches',
    volume: '89.2 ETH',
    marketCap: '1.8M',
    tokenPrice: '0.0067 ETH',
    holders: 892,
    status: 'active',
    listedAt: '2024-07-19 11:20',
    lastActivity: '2024-07-23 14:22',
  },
  {
    id: '3',
    name: 'Andy Warhol Marilyn Monroe',
    ticker: '$WARHOL',
    image: '/placeholder.svg?height=40&width=40',
    seller: 'Art Gallery NYC',
    sellerAddress: '0x3c2e...7f8d',
    category: 'Art',
    volume: '234.7 ETH',
    marketCap: '5.2M',
    tokenPrice: '0.0234 ETH',
    holders: 2156,
    status: 'sold',
    listedAt: '2024-07-15 09:15',
    lastActivity: '2024-07-22 18:30',
  },
  {
    id: '4',
    name: 'Richard Mille RM-88 Smiley',
    ticker: '$RM88',
    image: '/placeholder.svg?height=40&width=40',
    seller: 'Watch Collector Pro',
    sellerAddress: '0x9d4b...1a2c',
    category: 'Watches',
    volume: '76.8 ETH',
    marketCap: '1.2M',
    tokenPrice: '0.0089 ETH',
    holders: 634,
    status: 'suspended',
    listedAt: '2024-07-18 16:45',
    lastActivity: '2024-07-21 12:10',
  },
];

export function AdminListingsTab() {
  const [listings, setListings] = useState(SAMPLE_ADMIN_LISTINGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'seller' | 'volume'>('latest');

  const categories = ['ALL', ...Array.from(new Set(listings.map((l) => l.category)))];

  const filteredAndSortedListings = listings
    .filter((listing) => {
      const matchesSearch =
        listing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.seller.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'ALL' || listing.category === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || listing.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime();
        case 'seller':
          return a.seller.localeCompare(b.seller);
        case 'volume':
          return (
            Number.parseFloat(b.volume.replace(' ETH', '')) -
            Number.parseFloat(a.volume.replace(' ETH', ''))
          );
        default:
          return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'pending':
        return 'text-[#D7BF75] bg-[#D7BF75]/10';
      case 'suspended':
        return 'text-red-400 bg-red-400/10';
      case 'sold':
        return 'text-[#D0B284] bg-[#D0B284]/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
    }
  };

  const handleSuspendListing = (id: string) => {
    setListings((prev) =>
      prev.map((listing) =>
        listing.id === id ? { ...listing, status: 'suspended' as const } : listing,
      ),
    );
  };

  const handleActivateListing = (id: string) => {
    setListings((prev) =>
      prev.map((listing) =>
        listing.id === id ? { ...listing, status: 'active' as const } : listing,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Listings</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
            <Input
              placeholder="Search listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#231F20] border-[#D0B284]/20 text-white w-64"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'ALL' ? 'All Categories' : category}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="ALL">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="sold">Sold</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'seller' | 'volume')}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="latest">Latest First</option>
            <option value="seller">By Seller</option>
            <option value="volume">By Volume</option>
          </select>
        </div>
      </div>

      {/* Listings Table */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Asset
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Seller
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Category
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Volume
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Holders
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Status
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Listed
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedListings.map((listing) => (
                <tr key={listing.id} className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={listing.image || '/placeholder.svg'}
                        alt={listing.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                      />
                      <div>
                        <h3 className="text-white font-medium text-sm">
                          {listing.name.split(' ').slice(0, 2).join(' ')}
                        </h3>
                        <span className="text-[#DCDDCC] font-jetbrains text-xs">
                          {listing.ticker}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div>
                      <div className="text-white font-medium text-sm">{listing.seller}</div>
                      <div className="text-[#DCDDCC] font-jetbrains text-xs">
                        {listing.sellerAddress}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="secondary" className="bg-[#D0B284]/10 text-[#D0B284] text-xs">
                      {listing.category}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-white font-medium text-sm">{listing.volume}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-white font-medium text-sm">
                      {listing.holders.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge className={`${getStatusColor(listing.status)} border-none text-xs`}>
                      {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-[#DCDDCC] text-sm">{listing.listedAt.split(' ')[0]}</span>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      {listing.status === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-400/10"
                          onClick={() => handleSuspendListing(listing.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Suspend
                        </Button>
                      ) : listing.status === 'suspended' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#184D37] hover:bg-[#184D37]/10"
                          onClick={() => handleActivateListing(listing.id)}
                        >
                          Activate
                        </Button>
                      ) : null}
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
