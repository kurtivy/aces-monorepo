'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Wallet,
  Save,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { ListingsApi, ListingData } from '@/lib/api/listings';
import Image from 'next/image';
import { TokenCreationTabContent } from './token-creation-tab-content';
import type { TokenParameters } from '@aces/utils';

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

// Helper function to fix double-encoded URLs
const fixImageUrl = (url: string): string => {
  if (!url) return '/placeholder.svg';

  try {
    // Check if URL contains encoded query parameters (e.g., %3F instead of ?)
    if (url.includes('%3F') || url.includes('%26')) {
      // Decode once to get the actual URL with proper query parameters
      return decodeURIComponent(url);
    }
    return url;
  } catch (error) {
    console.error('Error fixing image URL:', error);
    return url;
  }
};

// Helper function to format listing data for admin display
const formatListingForAdminDisplay = (listing: ListingData): AdminListingData => {
  const status = getListingStatus(listing);
  const imageUrl = fixImageUrl(listing.imageGallery?.[0] || '/placeholder.svg');

  // Get seller name from account verification first, then fallback to displayName
  let sellerName = 'Unknown';
  if (
    listing.owner?.accountVerification?.firstName &&
    listing.owner?.accountVerification?.lastName
  ) {
    sellerName = `${listing.owner.accountVerification.firstName} ${listing.owner.accountVerification.lastName}`;
  } else if (listing.owner?.username) {
    sellerName = listing.owner.username;
  }

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
  const [originalListings, setOriginalListings] = useState<ListingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'seller' | 'volume'>('latest');

  // Modal state
  const [selectedListing, setSelectedListing] = useState<ListingData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [editedListing, setEditedListing] = useState<Partial<ListingData>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Helper to check if Token Creation tab should show
  const shouldShowTokenCreationTab = (listing: ListingData) => {
    return (
      !listing.isLive &&
      (listing.tokenCreationStatus === 'PENDING_ADMIN_REVIEW' ||
        listing.tokenCreationStatus === 'READY_TO_MINT')
    );
  };

  // Helper functions for formatting
  const formatCurrency = (value?: string | null) => {
    if (!value) return '—';
    const numeric = value.replace(/[^0-9.]/g, '');
    if (!numeric) return '—';
    const integer = numeric.split('.')[0] || '0';
    return `$${Number(integer).toLocaleString('en-US')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Navigate gallery images
  const navigateGallery = (direction: 'prev' | 'next') => {
    if (!selectedListing || !selectedListing.imageGallery) return;
    const images = selectedListing.imageGallery;
    const maxIndex = images.length - 1;

    if (direction === 'prev') {
      setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else {
      setCurrentImageIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }
  };

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
          setOriginalListings(result.data);
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

  const handleViewListing = (id: string) => {
    const listing = originalListings.find((l) => l.id === id);
    if (listing) {
      setSelectedListing(listing);
      setEditedListing(listing);
      setCurrentImageIndex(0);
      setIsEditingOverview(false);
      setIsDetailModalOpen(true);
    }
  };

  const handleEditListing = (id: string) => {
    const listing = originalListings.find((l) => l.id === id);
    if (listing) {
      setSelectedListing(listing);
      setEditedListing(listing);
      setCurrentImageIndex(0);
      setIsEditingOverview(true);
      setIsDetailModalOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedListing || !editedListing) return;

    try {
      setIsSavingEdit(true);
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Call API to update listing
      const result = await ListingsApi.updateListing(selectedListing.id, editedListing, token);

      if (result.success) {
        // Refetch listings
        const listingsResult = await ListingsApi.getAllListingsForAdmin(token);
        if (listingsResult.success) {
          setOriginalListings(listingsResult.data);
          const formattedListings = listingsResult.data.map(formatListingForAdminDisplay);
          setListings(formattedListings);

          // Update selected listing
          const updatedListing = listingsResult.data.find((l) => l.id === selectedListing.id);
          if (updatedListing) {
            setSelectedListing(updatedListing);
            setEditedListing(updatedListing);
          }
        }
        setIsEditingOverview(false);
      } else {
        setError(result.error || 'Failed to update listing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating listing');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedListing(selectedListing || {});
    setIsEditingOverview(false);
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
                        <Image
                          src={listing.image || '/placeholder.svg'}
                          alt={listing.name}
                          className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                          width={40}
                          height={40}
                          unoptimized={true}
                          onError={(e) => {
                            (e.currentTarget as any).src = '/placeholder.svg';
                          }}
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
                          onClick={() => handleViewListing(listing.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                          onClick={() => handleEditListing(listing.id)}
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

      {/* Detailed Listing View Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedListing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl font-libre-caslon">
                  {selectedListing.title} (${selectedListing.symbol})
                </DialogTitle>
                <Badge
                  className={`${getStatusColor(getListingStatus(selectedListing))} border-none w-fit`}
                >
                  {getListingStatus(selectedListing).charAt(0).toUpperCase() +
                    getListingStatus(selectedListing).slice(1)}
                </Badge>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full mt-6">
                <TabsList className="bg-transparent border-none p-0 h-auto space-x-6 mb-6">
                  <TabsTrigger
                    value="overview"
                    className="bg-transparent text-[#DCDDCC] text-base font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="seller"
                    className="bg-transparent text-[#DCDDCC] text-base font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    Seller Details
                  </TabsTrigger>
                  {shouldShowTokenCreationTab(selectedListing) && (
                    <TabsTrigger
                      value="token-creation"
                      className="bg-transparent text-[#DCDDCC] text-base font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                    >
                      Token Creation
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-0">
                  {/* Edit Controls */}
                  <div className="flex justify-end space-x-2 mb-4">
                    {isEditingOverview ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#D0B284] text-[#D0B284] hover:bg-[#D0B284]/10"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#184D37] text-white hover:bg-[#184D37]/80"
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {isSavingEdit ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#D0B284] text-[#D0B284] hover:bg-[#D0B284]/10"
                        onClick={() => setIsEditingOverview(true)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit Details
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                    {/* Enhanced Image Gallery */}
                    <div className="space-y-4">
                      <div className="relative">
                        <Image
                          src={fixImageUrl(
                            selectedListing.imageGallery?.[currentImageIndex] || '/placeholder.svg',
                          )}
                          alt={`${selectedListing.title} - Image ${currentImageIndex + 1}`}
                          className="w-full h-80 object-cover rounded-lg border border-[#D0B284]/20"
                          width={500}
                          height={320}
                          unoptimized={true}
                          onError={(e) => {
                            (e.currentTarget as any).src = '/placeholder.svg';
                          }}
                        />

                        {/* Gallery Navigation */}
                        {selectedListing.imageGallery &&
                          selectedListing.imageGallery.length > 1 && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                                onClick={() => navigateGallery('prev')}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                                onClick={() => navigateGallery('next')}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>

                              {/* Image Counter */}
                              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded">
                                {currentImageIndex + 1} of {selectedListing.imageGallery.length}
                              </div>
                            </>
                          )}
                      </div>

                      {/* Image Thumbnails */}
                      {selectedListing.imageGallery && selectedListing.imageGallery.length > 1 && (
                        <div className="flex space-x-2 overflow-x-auto pb-2">
                          {selectedListing.imageGallery.map((image, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentImageIndex(index)}
                              className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                                index === currentImageIndex
                                  ? 'border-[#D0B284]'
                                  : 'border-[#D0B284]/20 hover:border-[#D0B284]/50'
                              }`}
                            >
                              <Image
                                src={fixImageUrl(image)}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                                width={64}
                                height={64}
                                unoptimized={true}
                                onError={(e) => {
                                  (e.currentTarget as any).src = '/placeholder.svg';
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Listing Details */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Symbol
                          </label>
                          {isEditingOverview ? (
                            <Input
                              value={editedListing.symbol || ''}
                              onChange={(e) =>
                                setEditedListing({ ...editedListing, symbol: e.target.value })
                              }
                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                            />
                          ) : (
                            <p className="text-white mt-1 font-medium font-jetbrains">
                              ${selectedListing.symbol}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Listed
                          </label>
                          <p className="text-white mt-1">{formatDate(selectedListing.createdAt)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Brand
                          </label>
                          {isEditingOverview ? (
                            <Input
                              value={editedListing.brand || ''}
                              onChange={(e) =>
                                setEditedListing({ ...editedListing, brand: e.target.value })
                              }
                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                            />
                          ) : (
                            <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                              {selectedListing.brand || '—'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Location
                          </label>
                          {isEditingOverview ? (
                            <Input
                              value={editedListing.location || ''}
                              onChange={(e) =>
                                setEditedListing({ ...editedListing, location: e.target.value })
                              }
                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                            />
                          ) : (
                            <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                              {selectedListing.location || '—'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Story
                        </label>
                        {isEditingOverview ? (
                          <Textarea
                            value={editedListing.story || ''}
                            onChange={(e) =>
                              setEditedListing({ ...editedListing, story: e.target.value })
                            }
                            className="mt-1 bg-black/30 border-[#D0B284]/20 text-white min-h-24"
                          />
                        ) : (
                          <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10 max-h-24 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words">
                            {selectedListing.story || '—'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Details
                        </label>
                        {isEditingOverview ? (
                          <Textarea
                            value={editedListing.details || ''}
                            onChange={(e) =>
                              setEditedListing({ ...editedListing, details: e.target.value })
                            }
                            className="mt-1 bg-black/30 border-[#D0B284]/20 text-white min-h-24"
                          />
                        ) : (
                          <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10 max-h-24 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words">
                            {selectedListing.details || '—'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Provenance
                        </label>
                        {isEditingOverview ? (
                          <Textarea
                            value={editedListing.provenance || ''}
                            onChange={(e) =>
                              setEditedListing({ ...editedListing, provenance: e.target.value })
                            }
                            className="mt-1 bg-black/30 border-[#D0B284]/20 text-white min-h-24"
                          />
                        ) : (
                          <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10 max-h-24 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words">
                            {selectedListing.provenance || '—'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Hype Sentence
                        </label>
                        {isEditingOverview ? (
                          <Input
                            value={editedListing.hypeSentence || ''}
                            onChange={(e) =>
                              setEditedListing({ ...editedListing, hypeSentence: e.target.value })
                            }
                            className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                          />
                        ) : (
                          <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                            {selectedListing.hypeSentence || '—'}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Value
                          </label>
                          {isEditingOverview ? (
                            <Input
                              value={editedListing.value || ''}
                              onChange={(e) =>
                                setEditedListing({ ...editedListing, value: e.target.value })
                              }
                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                              placeholder="$100,000"
                            />
                          ) : (
                            <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                              {formatCurrency(selectedListing.value)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Reserve Price
                          </label>
                          {isEditingOverview ? (
                            <Input
                              value={editedListing.reservePrice || ''}
                              onChange={(e) =>
                                setEditedListing({
                                  ...editedListing,
                                  reservePrice: e.target.value,
                                })
                              }
                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                              placeholder="$80,000"
                            />
                          ) : (
                            <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                              {formatCurrency(selectedListing.reservePrice)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="space-y-3">
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Contact Information
                        </label>
                        <div className="bg-black/30 p-3 rounded border border-[#D0B284]/10 space-y-2">
                          {selectedListing.email && (
                            <div className="flex items-center space-x-2">
                              <Mail className="w-4 h-4 text-[#D0B284]" />
                              <span className="text-white">{selectedListing.email}</span>
                            </div>
                          )}

                          {selectedListing.owner?.walletAddress && (
                            <div className="flex items-center space-x-2">
                              <Wallet className="w-4 h-4 text-[#D0B284]" />
                              <span className="text-white font-mono text-sm break-all">
                                {selectedListing.owner.walletAddress}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedListing.contractAddress && (
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Contract Address
                          </label>
                          <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10 font-mono text-xs break-all">
                            {selectedListing.contractAddress}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Seller Details Tab */}
                <TabsContent value="seller" className="mt-0">
                  <div className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Personal Information */}
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium text-[#D0B284] mb-4">
                            Personal Information
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                Username
                              </label>
                              <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                {selectedListing.owner?.username || 'N/A'}
                              </p>
                            </div>
                            {selectedListing.owner?.accountVerification && (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      First Name
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {selectedListing.owner.accountVerification.firstName || 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Last Name
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {selectedListing.owner.accountVerification.lastName || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}
                            <div>
                              <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                Email Address
                              </label>
                              <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                {selectedListing.email || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                Wallet Address
                              </label>
                              <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10 font-mono text-xs break-all">
                                {selectedListing.owner?.walletAddress || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Verification Information */}
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium text-[#D0B284] mb-4">
                            Verification Status
                          </h3>
                          <div className="space-y-4">
                            {selectedListing.owner?.accountVerification ? (
                              <>
                                <div>
                                  <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                    Status
                                  </label>
                                  <div className="mt-1">
                                    <Badge
                                      className={`${
                                        selectedListing.owner.accountVerification.status ===
                                        'VERIFIED'
                                          ? 'text-[#184D37] bg-[#184D37]/10'
                                          : 'text-[#D7BF75] bg-[#D7BF75]/10'
                                      } border-none`}
                                    >
                                      {selectedListing.owner.accountVerification.status}
                                    </Badge>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-[#DCDDCC]">
                                  No verification information found for this user.
                                </p>
                                <p className="text-[#DCDDCC]/60 text-sm mt-2">
                                  The user may not have submitted account verification yet.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Token Creation Tab */}
                {shouldShowTokenCreationTab(selectedListing) && (
                  <TabsContent value="token-creation" className="mt-0">
                    <div className="space-y-6 mt-6">
                      <TokenCreationTabContent
                        listing={{
                          id: selectedListing.id,
                          title: selectedListing.title,
                          symbol: selectedListing.symbol,
                          tokenCreationStatus:
                            selectedListing.tokenCreationStatus || 'AWAITING_USER_DETAILS',
                          tokenParameters:
                            (selectedListing.tokenParameters as TokenParameters) ?? null,
                          ownerWalletAddress: selectedListing.owner?.walletAddress || undefined,
                        }}
                        onSuccess={async () => {
                          // Refetch listings to get updated data
                          const token = await getAccessToken();
                          if (token) {
                            const result = await ListingsApi.getAllListingsForAdmin(token);
                            if (result.success) {
                              setOriginalListings(result.data);
                              const formattedListings = result.data.map(
                                formatListingForAdminDisplay,
                              );
                              setListings(formattedListings);
                              // Update selected listing with fresh data
                              const updatedListing = result.data.find(
                                (l) => l.id === selectedListing.id,
                              );
                              if (updatedListing) {
                                setSelectedListing(updatedListing);
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
