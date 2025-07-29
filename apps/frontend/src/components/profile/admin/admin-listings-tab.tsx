'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { ListingsApi, ListingData } from '@/lib/api/listings';

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

// Helper function to determine listing status
const getListingStatus = (listing: ListingData): 'active' | 'pending' | 'suspended' | 'sold' => {
  if (!listing.isLive) {
    return 'pending';
  }
  // For now, we'll consider live listings as active
  // In a real implementation, you'd check for sold status, expiration, etc.
  return 'active';
};

// Helper function to format listing data for admin display
const formatListingForAdminDisplay = (listing: ListingData): AdminListingData => {
  const status = getListingStatus(listing);
  const imageUrl = listing.imageGallery?.[0] || '/placeholder.svg?height=40&width=40';
  const sellerName = listing.owner?.displayName || 'Unknown';
  const sellerAddress = listing.owner?.walletAddress || '0x0000...0000';

  return {
    id: listing.id,
    name: listing.title,
    ticker: listing.symbol,
    image: imageUrl,
    seller: sellerName,
    sellerAddress: sellerAddress,
    category: 'RWA', // Default category since it's not in the schema
    volume: '0 ETH', // Placeholder - would need to calculate from transactions
    marketCap: '0', // Placeholder - would need to calculate from token data
    tokenPrice: '0 ETH', // Placeholder - would need to calculate from token data
    holders: 0, // Placeholder - would need to get from token data
    status,
    listedAt: new Date(listing.createdAt).toLocaleString(),
    lastActivity: new Date(listing.updatedAt).toLocaleString(),
  };
};

export function AdminListingsTab() {
  const { getAccessToken } = useAuth();
  const [listings, setListings] = useState<AdminListingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'seller' | 'volume'>('latest');

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

        const result = await ListingsApi.getAllListingsForAdmin(token);

        if (result.success) {
          console.log('Admin listings API response:', result.data);
          const formattedListings = result.data.map(formatListingForAdminDisplay);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Listings</h2>
        </div>
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-[#D0B284]/10 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Listings</h2>
        </div>
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="text-center py-8">
              <p className="text-red-400 font-jetbrains">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              {filteredAndSortedListings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <p className="text-[#DCDDCC] font-jetbrains">No listings found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedListings.map((listing) => (
                  <tr
                    key={listing.id}
                    className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5"
                  >
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
                      <span className="text-[#DCDDCC] text-sm">
                        {listing.listedAt.split(' ')[0]}
                      </span>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
