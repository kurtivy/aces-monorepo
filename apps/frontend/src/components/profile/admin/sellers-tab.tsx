'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Eye, User, Store, TrendingUp, Calendar, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { SellersApi, SellerData } from '@/lib/api/sellers';
import Image from 'next/image';

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

  // Modal state
  const [selectedSeller, setSelectedSeller] = useState<SellerData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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

  // Helper function to get seller's real name from verification
  const getSellerName = (seller: SellerData) => {
    if (seller.accountVerification?.firstName && seller.accountVerification?.lastName) {
      return `${seller.accountVerification.firstName} ${seller.accountVerification.lastName}`;
    }
    return seller.displayName || 'Unknown Seller';
  };

  // Handler for viewing seller details
  const handleViewSeller = (seller: SellerData) => {
    setSelectedSeller(seller);
    setIsDetailModalOpen(true);
  };

  const filteredAndSortedSellers = sellers
    .filter((seller) => {
      const sellerName = getSellerName(seller);
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
          const nameA = getSellerName(a);
          const nameB = getSellerName(b);
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
                            {getSellerName(seller)}
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
                        onClick={() => handleViewSeller(seller)}
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

      {/* Seller Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold text-[#D0B284] font-libre-caslon">
                Seller Details
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedSeller && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-[#231F20] border border-[#D0B284]/20">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-[#D0B284]/20 data-[state=active]:text-[#D0B284]"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="verification"
                  className="data-[state=active]:bg-[#D0B284]/20 data-[state=active]:text-[#D0B284]"
                >
                  Verification
                </TabsTrigger>
                <TabsTrigger
                  value="listings"
                  className="data-[state=active]:bg-[#D0B284]/20 data-[state=active]:text-[#D0B284]"
                >
                  Listings
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="data-[state=active]:bg-[#D0B284]/20 data-[state=active]:text-[#D0B284]"
                >
                  Performance
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-[#D0B284]">Basic Information</h3>
                    <div className="bg-[#1A1A1A] border border-[#D0B284]/10 rounded-lg p-4 space-y-3">
                      <div className="flex items-center space-x-4">
                        <User className="w-16 h-16 text-[#D0B284] bg-[#D0B284]/10 rounded-full p-3" />
                        <div>
                          <h4 className="text-white font-medium">
                            {getSellerName(selectedSeller)}
                          </h4>
                          <p className="text-[#DCDDCC] text-sm">{selectedSeller.email}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-[#DCDDCC]">Display Name:</span>
                          <span className="text-white">{selectedSeller.displayName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#DCDDCC]">Wallet Address:</span>
                          <span className="text-white font-jetbrains text-xs">
                            {selectedSeller.walletAddress || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#DCDDCC]">Seller Status:</span>
                          <Badge
                            className={`${getStatusColor(selectedSeller.sellerStatus)} border-none`}
                          >
                            {selectedSeller.sellerStatus}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#DCDDCC]">Applied At:</span>
                          <span className="text-white">{formatDate(selectedSeller.appliedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-[#D0B284]">Status Information</h3>
                    <div className="bg-[#1A1A1A] border border-[#D0B284]/10 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Verification Status:</span>
                        {selectedSeller.accountVerification ? (
                          <Badge
                            className={`${getVerificationStatusColor(selectedSeller.accountVerification.status)} border-none`}
                          >
                            {selectedSeller.accountVerification.status}
                          </Badge>
                        ) : (
                          <Badge className="text-[#DCDDCC] bg-[#DCDDCC]/10 border-none">None</Badge>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Verified At:</span>
                        <span className="text-white">{formatDate(selectedSeller.verifiedAt)}</span>
                      </div>
                      {selectedSeller.rejectedAt && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-[#DCDDCC]">Rejected At:</span>
                            <span className="text-white">
                              {formatDate(selectedSeller.rejectedAt)}
                            </span>
                          </div>
                          {selectedSeller.rejectionReason && (
                            <div className="space-y-1">
                              <span className="text-[#DCDDCC]">Rejection Reason:</span>
                              <p className="text-white text-sm bg-[#231F20] p-2 rounded border border-[#D0B284]/10">
                                {selectedSeller.rejectionReason}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Verification Tab */}
              <TabsContent value="verification" className="space-y-6 mt-6">
                <div className="bg-[#1A1A1A] border border-[#D0B284]/10 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-[#D0B284] mb-4">
                    Account Verification Details
                  </h3>
                  {selectedSeller.accountVerification ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">First Name:</span>
                        <span className="text-white">
                          {selectedSeller.accountVerification.firstName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Last Name:</span>
                        <span className="text-white">
                          {selectedSeller.accountVerification.lastName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Document Type:</span>
                        <span className="text-white">
                          {selectedSeller.accountVerification.documentType || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Status:</span>
                        <Badge
                          className={`${getVerificationStatusColor(selectedSeller.accountVerification.status)} border-none`}
                        >
                          {selectedSeller.accountVerification.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Submitted At:</span>
                        <span className="text-white">
                          {formatDate(selectedSeller.accountVerification.submittedAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Reviewed At:</span>
                        <span className="text-white">
                          {formatDate(selectedSeller.accountVerification.reviewedAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#DCDDCC]">Attempts:</span>
                        <span className="text-white">
                          {selectedSeller.accountVerification.attempts}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#DCDDCC] text-center py-8">
                      No verification data available
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Listings Tab */}
              <TabsContent value="listings" className="space-y-6 mt-6">
                <div className="bg-[#1A1A1A] border border-[#D0B284]/10 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-[#D0B284] mb-4">Seller Listings</h3>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">
                        {selectedSeller.listings.total}
                      </div>
                      <div className="text-[#DCDDCC] text-sm">Total Listings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#184D37]">
                        {selectedSeller.listings.live}
                      </div>
                      <div className="text-[#DCDDCC] text-sm">Live Listings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#D0B284]">
                        {selectedSeller.listings.total - selectedSeller.listings.live}
                      </div>
                      <div className="text-[#DCDDCC] text-sm">Inactive</div>
                    </div>
                  </div>

                  {selectedSeller.listings.recent.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-md font-semibold text-[#D0B284]">Recent Listings</h4>
                      {selectedSeller.listings.recent.map((listing) => (
                        <div
                          key={listing.id}
                          className="flex justify-between items-center p-3 bg-[#231F20] rounded-lg border border-[#D0B284]/10"
                        >
                          <div className="flex items-center space-x-3">
                            <Store className="w-8 h-8 text-[#D0B284] bg-[#D0B284]/10 rounded-full p-1" />
                            <div>
                              <p className="text-white font-medium">{listing.title}</p>
                              <p className="text-[#DCDDCC] text-sm">{listing.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge
                              className={`${listing.isLive ? 'text-[#184D37] bg-[#184D37]/10' : 'text-[#D7BF75] bg-[#D7BF75]/10'} border-none text-xs`}
                            >
                              {listing.isLive ? 'Live' : 'Inactive'}
                            </Badge>
                            <p className="text-[#DCDDCC] text-sm mt-1">
                              {formatDate(listing.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#DCDDCC] text-center py-8">No listings yet</p>
                  )}
                </div>
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="space-y-6 mt-6">
                <div className="bg-[#1A1A1A] border border-[#D0B284]/10 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-[#D0B284] mb-4">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <TrendingUp className="w-8 h-8 text-[#D0B284]" />
                        <div>
                          <div className="text-2xl font-bold text-white">
                            {selectedSeller.bidStats.totalBids}
                          </div>
                          <div className="text-[#DCDDCC] text-sm">Total Bids Received</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <TrendingUp className="w-8 h-8 text-[#184D37]" />
                        <div>
                          <div className="text-2xl font-bold text-white">
                            {formatCurrency(selectedSeller.bidStats.totalBidValue)}
                          </div>
                          <div className="text-[#DCDDCC] text-sm">Total Bid Value</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <h4 className="text-md font-semibold text-[#D0B284]">Key Dates</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#231F20] p-3 rounded-lg border border-[#D0B284]/10">
                        <div className="text-[#DCDDCC] text-sm">Joined Platform</div>
                        <div className="text-white font-medium">
                          {formatDate(selectedSeller.createdAt)}
                        </div>
                      </div>
                      <div className="bg-[#231F20] p-3 rounded-lg border border-[#D0B284]/10">
                        <div className="text-[#DCDDCC] text-sm">Last Updated</div>
                        <div className="text-white font-medium">
                          {formatDate(selectedSeller.updatedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
