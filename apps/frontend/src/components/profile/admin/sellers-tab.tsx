'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye, User, Store, TrendingUp, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { SellersApi, SellerData } from '@/lib/api/sellers';

export function SellersTab() {
  const { getAccessToken } = useAuth();
  const [sellers, setSellers] = useState<SellerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    'ALL',
  );
  const [sortBy, setSortBy] = useState<'latest' | 'name' | 'listings' | 'revenue'>('latest');

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getAccessToken();
        if (!token) {
          setError('Authentication required');
          return;
        }

        const result = await SellersApi.getAllSellers(token);

        if (result.success) {
          console.log('Sellers API response:', result.data);
          setSellers(result.data);
        } else {
          setError(result.error || 'Failed to fetch sellers');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching sellers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellers();
  }, [getAccessToken]);

  const filteredAndSortedSellers = sellers
    .filter((seller) => {
      const sellerName = seller.displayName || 'Unknown Seller';
      const sellerEmail = seller.email || '';

      const matchesSearch =
        sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sellerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (seller.walletAddress &&
          seller.walletAddress.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || seller.sellerStatus === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return (
            new Date(b.appliedAt || b.createdAt).getTime() -
            new Date(a.appliedAt || a.createdAt).getTime()
          );
        case 'name':
          const nameA = a.displayName || 'Unknown';
          const nameB = b.displayName || 'Unknown';
          return nameA.localeCompare(nameB);
        case 'listings':
          return b.listings.total - a.listings.total;
        case 'revenue':
          return b.bidStats.totalBidValue - a.bidStats.totalBidValue;
        default:
          return 0;
      }
    });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-[#D7BF75] bg-[#D7BF75]/10';
      case 'APPROVED':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'REJECTED':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
    }
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-[#D7BF75] bg-[#D7BF75]/10';
      case 'APPROVED':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'REJECTED':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Sellers</h2>
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
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Sellers</h2>
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
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Sellers</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
            <Input
              placeholder="Search sellers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#231F20] border-[#D0B284]/20 text-white w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')
            }
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'latest' | 'name' | 'listings' | 'revenue')
            }
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="latest">Latest First</option>
            <option value="name">By Name</option>
            <option value="listings">By Listings</option>
            <option value="revenue">By Revenue</option>
          </select>
        </div>
      </div>

      {/* Sellers Table */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Seller
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Status
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Verification
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Listings
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Total Bids
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Bid Value
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Applied
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedSellers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <p className="text-[#DCDDCC] font-jetbrains">No sellers found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedSellers.map((seller) => (
                  <tr key={seller.id} className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <User className="w-8 h-8 text-[#D0B284] bg-[#D0B284]/10 rounded-full p-1" />
                        <div>
                          <h3 className="text-white font-medium text-sm">
                            {seller.displayName || 'Unknown Seller'}
                          </h3>
                          <div className="text-[#DCDDCC] text-sm">{seller.email}</div>
                          <div className="text-[#DCDDCC] font-jetbrains text-xs">
                            {seller.walletAddress
                              ? `${seller.walletAddress.slice(0, 6)}...${seller.walletAddress.slice(-4)}`
                              : 'No address'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        className={`${getStatusColor(seller.sellerStatus)} border-none text-xs`}
                      >
                        {seller.sellerStatus}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {seller.accountVerification ? (
                        <Badge
                          className={`${getVerificationStatusColor(seller.accountVerification.status)} border-none text-xs`}
                        >
                          {seller.accountVerification.status}
                        </Badge>
                      ) : (
                        <Badge className="text-[#DCDDCC] bg-[#DCDDCC]/10 border-none text-xs">
                          None
                        </Badge>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Store className="w-4 h-4 text-[#D0B284]" />
                        <span className="text-white font-medium text-sm">
                          {seller.listings.total} ({seller.listings.live} live)
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-white font-medium text-sm">
                        {seller.bidStats.totalBids}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-[#D0B284]" />
                        <span className="text-white font-medium text-sm">
                          {formatCurrency(seller.bidStats.totalBidValue)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Calendar className="w-4 h-4 text-[#DCDDCC]" />
                        <span className="text-[#DCDDCC] text-sm">
                          {formatDate(seller.appliedAt)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#D0B284] hover:bg-[#D0B284]/10"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
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
