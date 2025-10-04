'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye, TrendingUp, Calendar, User } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { BidsApi, Bid } from '@/lib/api/bids';

export function BidsTab() {
  const { getAccessToken } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'amount' | 'bidder'>('latest');

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

        const result = await BidsApi.getReceivedBids(token);

        if (result.success && result.data) {
          setBids(result.data.data);
        } else {
          setError(typeof result.error === 'string' ? result.error : 'Failed to fetch bids');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching bids');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBids();
  }, [getAccessToken]);

  const filteredAndSortedBids = bids
    .filter((bid) => {
      const bidderName = bid.bidder?.username || bid.bidder?.walletAddress || 'Unknown Bidder';
      const listingTitle = bid.listing?.title || 'Unknown Listing';

      const matchesSearch =
        bidderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listingTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bid.amount.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') {
        const now = new Date();
        const expiresAt = bid.expiresAt ? new Date(bid.expiresAt) : null;
        matchesStatus = !expiresAt || expiresAt > now;
      } else if (statusFilter === 'EXPIRED') {
        const now = new Date();
        const expiresAt = bid.expiresAt ? new Date(bid.expiresAt) : null;
        matchesStatus = Boolean(expiresAt && expiresAt <= now);
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'amount':
          return parseFloat(b.amount) - parseFloat(a.amount);
        case 'bidder':
          const bidderA = a.bidder?.username || a.bidder?.walletAddress || 'Unknown';
          const bidderB = b.bidder?.username || b.bidder?.walletAddress || 'Unknown';
          return bidderA.localeCompare(bidderB);
        default:
          return 0;
      }
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getBidStatus = (bid: Bid) => {
    if (!bid.expiresAt) return { status: 'Active', color: 'text-[#184D37] bg-[#184D37]/10' };

    const now = new Date();
    const expiresAt = new Date(bid.expiresAt);

    if (expiresAt <= now) {
      return { status: 'Expired', color: 'text-red-400 bg-red-400/10' };
    }

    return { status: 'Active', color: 'text-[#184D37] bg-[#184D37]/10' };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Bids</h2>
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
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">All Bids</h2>
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'EXPIRED')}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'amount' | 'bidder')}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="latest">Latest First</option>
            <option value="amount">Highest Amount</option>
            <option value="bidder">By Bidder</option>
          </select>
        </div>
      </div>

      {/* Bids Table */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Bidder
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Listing
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Amount
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Status
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Created
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
              {filteredAndSortedBids.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <p className="text-[#DCDDCC] font-jetbrains">No bids found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedBids.map((bid) => {
                  const bidStatus = getBidStatus(bid);
                  return (
                    <tr key={bid.id} className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <User className="w-8 h-8 text-[#D0B284] bg-[#D0B284]/10 rounded-full p-1" />
                          <div>
                            <h3 className="text-white font-medium text-sm">
                              {bid.bidder?.username ||
                                bid.bidder?.walletAddress ||
                                'Unknown Bidder'}
                              {!bid.bidder && <span className="text-red-400 ml-2">(Orphaned)</span>}
                            </h3>
                            <span className="text-[#DCDDCC] font-jetbrains text-xs">
                              {bid.bidder?.walletAddress
                                ? `${bid.bidder.walletAddress.slice(0, 6)}...${bid.bidder.walletAddress.slice(-4)}`
                                : 'No address'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div>
                          <div className="text-white font-medium text-sm">
                            {bid.listing?.title || 'Unknown Listing'}
                            {!bid.listing && <span className="text-red-400 ml-2">(Orphaned)</span>}
                          </div>
                          <div className="text-[#DCDDCC] font-jetbrains text-xs">
                            {bid.listing?.symbol || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-[#D0B284]" />
                          <span className="text-white font-medium text-sm">
                            ${parseFloat(bid.amount).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge className={`${bidStatus.color} border-none text-xs`}>
                          {bidStatus.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Calendar className="w-4 h-4 text-[#DCDDCC]" />
                          <span className="text-[#DCDDCC] text-sm">
                            {formatDate(bid.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-[#DCDDCC] text-sm">
                          {bid.expiresAt ? formatDate(bid.expiresAt) : 'No expiry'}
                        </span>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
