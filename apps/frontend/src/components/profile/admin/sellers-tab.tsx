'use client';

import React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  Search,
  Eye,
  MessageCircle,
  UserX,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  MapPin,
  Mail,
  Wallet,
  TrendingUp,
  Package,
  DollarSign,
} from 'lucide-react';
import Image from 'next/image';

interface SellerListing {
  id: string;
  name: string;
  ticker: string;
  image: string;
  contractAddress: string;
  category: string;
  volume: string;
  volumeUSD: string;
  marketCap: string;
  marketCapUSD: string;
  tokenPrice: string;
  holders: number;
  feesMade: string;
  feesUSD: string;
  status: 'active' | 'sold';
  listedAt: string;
  soldAt?: string;
}

interface SellerData {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  location: string;
  verificationDate: string;
  totalListedValue: string;
  totalListedValueUSD: string;
  totalListedItems: number;
  activeListing: number;
  soldItems: number;
  totalSalesVolume: string;
  totalSalesVolumeUSD: string;
  feesGenerated: string;
  feesGeneratedUSD: string;
  performanceScore: number;
  listings: SellerListing[];
}

const SAMPLE_SELLERS: SellerData[] = [
  {
    id: '1',
    name: 'John Ferrari',
    email: 'collector@example.com',
    walletAddress: '0x8ac9...07b506',
    location: 'Beverly Hills, CA',
    verificationDate: '2024-06-15',
    totalListedValue: '2,847.5 ETH',
    totalListedValueUSD: '$9,315,375',
    totalListedItems: 8,
    activeListing: 3,
    soldItems: 5,
    totalSalesVolume: '1,923.4 ETH',
    totalSalesVolumeUSD: '$6,291,612',
    feesGenerated: '192.34 ETH',
    feesGeneratedUSD: '$629,161',
    performanceScore: 94,
    listings: [
      {
        id: 'l1',
        name: '1991 Porsche 964 Turbo',
        ticker: '$P964',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0x8ac9...07b506',
        category: 'Cars',
        volume: '125.4 ETH',
        volumeUSD: '$410,556',
        marketCap: '2.1M',
        marketCapUSD: '$6,873,000',
        tokenPrice: '0.0045 ETH',
        holders: 1247,
        feesMade: '12.54 ETH',
        feesUSD: '$41,056',
        status: 'active',
        listedAt: '2024-07-20',
      },
      {
        id: 'l2',
        name: '1962 Ferrari 250 GTO',
        ticker: '$F250GTO',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0x9bc8...18a507',
        category: 'Cars',
        volume: '1,247.8 ETH',
        volumeUSD: '$4,084,454',
        marketCap: '15.2M',
        marketCapUSD: '$49,776,000',
        tokenPrice: '0.0892 ETH',
        holders: 3421,
        feesMade: '124.78 ETH',
        feesUSD: '$408,445',
        status: 'sold',
        listedAt: '2024-06-18',
        soldAt: '2024-07-15',
      },
      {
        id: 'l3',
        name: '1970 Porsche 917K',
        ticker: '$P917K',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0x7cd6...29b408',
        category: 'Cars',
        volume: '445.6 ETH',
        volumeUSD: '$1,459,212',
        marketCap: '8.9M',
        marketCapUSD: '$29,137,000',
        tokenPrice: '0.0234 ETH',
        holders: 1876,
        feesMade: '44.56 ETH',
        feesUSD: '$145,921',
        status: 'active',
        listedAt: '2024-07-10',
      },
    ],
  },
  {
    id: '2',
    name: 'Sarah Timepiece',
    email: 'watchcollector@example.com',
    walletAddress: '0xbf85...298c36',
    location: 'London, UK',
    verificationDate: '2024-06-22',
    totalListedValue: '1,456.8 ETH',
    totalListedValueUSD: '$4,765,824',
    totalListedItems: 5,
    activeListing: 2,
    soldItems: 3,
    totalSalesVolume: '892.4 ETH',
    totalSalesVolumeUSD: '$2,922,212',
    feesGenerated: '89.24 ETH',
    feesGeneratedUSD: '$292,221',
    performanceScore: 87,
    listings: [
      {
        id: 'l4',
        name: 'Audemars Piguet Royal Oak KAWS',
        ticker: '$APKAWS',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0xbf85...298c36',
        category: 'Watches',
        volume: '89.2 ETH',
        volumeUSD: '$292,156',
        marketCap: '1.8M',
        marketCapUSD: '$5,886,000',
        tokenPrice: '0.0067 ETH',
        holders: 892,
        feesMade: '8.92 ETH',
        feesUSD: '$29,216',
        status: 'active',
        listedAt: '2024-07-19',
      },
      {
        id: 'l5',
        name: 'Patek Philippe Grandmaster Chime',
        ticker: '$PPGMC',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0xac74...39d517',
        category: 'Watches',
        volume: '756.9 ETH',
        volumeUSD: '$2,481,147',
        marketCap: '12.4M',
        marketCapUSD: '$40,596,000',
        tokenPrice: '0.0756 ETH',
        holders: 2134,
        feesMade: '75.69 ETH',
        feesUSD: '$248,115',
        status: 'sold',
        listedAt: '2024-06-25',
        soldAt: '2024-07-18',
      },
    ],
  },
  {
    id: '3',
    name: 'Art Gallery NYC',
    email: 'artdealer@example.com',
    walletAddress: '0x60b0...3be80f',
    location: 'New York, NY',
    verificationDate: '2024-05-30',
    totalListedValue: '3,247.9 ETH',
    totalListedValueUSD: '$10,636,871',
    totalListedItems: 12,
    activeListing: 4,
    soldItems: 8,
    totalSalesVolume: '2,156.3 ETH',
    totalSalesVolumeUSD: '$7,061,142',
    feesGenerated: '215.63 ETH',
    feesGeneratedUSD: '$706,114',
    performanceScore: 96,
    listings: [
      {
        id: 'l6',
        name: 'Andy Warhol Marilyn Monroe',
        ticker: '$WARHOL',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0x60b0...3be80f',
        category: 'Art',
        volume: '634.7 ETH',
        volumeUSD: '$2,079,591',
        marketCap: '5.2M',
        marketCapUSD: '$17,030,000',
        tokenPrice: '0.0234 ETH',
        holders: 2156,
        feesMade: '63.47 ETH',
        feesUSD: '$207,959',
        status: 'sold',
        listedAt: '2024-07-15',
        soldAt: '2024-07-22',
      },
      {
        id: 'l7',
        name: 'Basquiat Untitled (Skull)',
        ticker: '$BASQUIAT',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0x71c1...4cf90g',
        category: 'Art',
        volume: '892.4 ETH',
        volumeUSD: '$2,922,612',
        marketCap: '7.8M',
        marketCapUSD: '$25,554,000',
        tokenPrice: '0.0445 ETH',
        holders: 1789,
        feesMade: '89.24 ETH',
        feesUSD: '$292,261',
        status: 'active',
        listedAt: '2024-07-12',
      },
    ],
  },
  {
    id: '4',
    name: 'Watch Dealer Pro',
    email: 'watchdealer@example.com',
    walletAddress: '0x4f9f...d1a826',
    location: 'Geneva, Switzerland',
    verificationDate: '2024-07-01',
    totalListedValue: '987.3 ETH',
    totalListedValueUSD: '$3,230,892',
    totalListedItems: 6,
    activeListing: 3,
    soldItems: 3,
    totalSalesVolume: '456.8 ETH',
    totalSalesVolumeUSD: '$1,495,744',
    feesGenerated: '45.68 ETH',
    feesGeneratedUSD: '$149,574',
    performanceScore: 82,
    listings: [
      {
        id: 'l8',
        name: 'Richard Mille RM-88 Smiley',
        ticker: '$RM88',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0x4f9f...d1a826',
        category: 'Watches',
        volume: '76.8 ETH',
        volumeUSD: '$251,664',
        marketCap: '1.2M',
        marketCapUSD: '$3,930,000',
        tokenPrice: '0.0089 ETH',
        holders: 634,
        feesMade: '7.68 ETH',
        feesUSD: '$25,166',
        status: 'active',
        listedAt: '2024-07-18',
      },
    ],
  },
  {
    id: '5',
    name: 'Fashion House',
    email: 'luxury@example.com',
    walletAddress: '0x6ea5...78c3af',
    location: 'Paris, France',
    verificationDate: '2024-06-08',
    totalListedValue: '678.9 ETH',
    totalListedValueUSD: '$2,222,427',
    totalListedItems: 4,
    activeListing: 2,
    soldItems: 2,
    totalSalesVolume: '289.4 ETH',
    totalSalesVolumeUSD: '$947,782',
    feesGenerated: '28.94 ETH',
    feesGeneratedUSD: '$94,778',
    performanceScore: 79,
    listings: [
      {
        id: 'l9',
        name: 'Hermès Himalaya Kelly Retourne 32',
        ticker: '$HIMALY',
        image: '/placeholder.svg?height=40&width=40',
        contractAddress: '0x6ea5...78c3af',
        category: 'Luxury Goods',
        volume: '145.6 ETH',
        volumeUSD: '$476,912',
        marketCap: '892K',
        marketCapUSD: '$2,921,160',
        tokenPrice: '0.0156 ETH',
        holders: 567,
        feesMade: '14.56 ETH',
        feesUSD: '$47,691',
        status: 'active',
        listedAt: '2024-07-14',
      },
    ],
  },
];

export function SellersTab() {
  const [sellers, setSellers] = useState(SAMPLE_SELLERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [performanceFilter, setPerformanceFilter] = useState('ALL');
  const [timePeriod, setTimePeriod] = useState('all_time');
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'performance' | 'volume' | 'items' | 'fees'>('performance');

  // Get unique locations for filter
  const locations = [
    'ALL',
    ...Array.from(new Set(sellers.map((s) => s.location.split(', ')[1] || s.location))),
  ];

  const filteredSellers = sellers
    .filter((seller) => {
      const matchesSearch =
        seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seller.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seller.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLocation = locationFilter === 'ALL' || seller.location.includes(locationFilter);

      const matchesPerformance =
        performanceFilter === 'ALL' ||
        (performanceFilter === 'excellent' && seller.performanceScore >= 90) ||
        (performanceFilter === 'good' &&
          seller.performanceScore >= 80 &&
          seller.performanceScore < 90) ||
        (performanceFilter === 'average' && seller.performanceScore < 80);

      return matchesSearch && matchesLocation && matchesPerformance;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'performance':
          return b.performanceScore - a.performanceScore;
        case 'volume':
          return (
            Number.parseFloat(b.totalSalesVolume.replace(/[^\d.]/g, '')) -
            Number.parseFloat(a.totalSalesVolume.replace(/[^\d.]/g, ''))
          );
        case 'items':
          return b.totalListedItems - a.totalListedItems;
        case 'fees':
          return (
            Number.parseFloat(b.feesGenerated.replace(/[^\d.]/g, '')) -
            Number.parseFloat(a.feesGenerated.replace(/[^\d.]/g, ''))
          );
        default:
          return 0;
      }
    });

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-[#184D37] bg-[#184D37]/10';
    if (score >= 80) return 'text-[#D7BF75] bg-[#D7BF75]/10';
    return 'text-orange-400 bg-orange-400/10';
  };

  const getPerformanceLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    return 'Average';
  };

  const handleContactSeller = (sellerId: string) => {
    console.log('Contact seller:', sellerId);
    // Implement contact functionality
  };

  const handleSuspendSeller = (sellerId: string) => {
    console.log('Suspend seller:', sellerId);
    // Implement suspend functionality
  };

  const toggleSellerExpansion = (sellerId: string) => {
    setExpandedSeller(expandedSeller === sellerId ? null : sellerId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">Verified Sellers</h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-[#184D37] rounded-full" />
          <span className="text-[#DCDDCC] text-sm">Active Verified Sellers Only</span>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Search and Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#D0B284] mb-4">Search & Filter</h3>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
              <Input
                placeholder="Search by name, email, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black/50 border-[#D0B284]/20 text-white"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="bg-black/50 border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
              >
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location === 'ALL' ? 'All Locations' : location}
                  </option>
                ))}
              </select>

              <select
                value={performanceFilter}
                onChange={(e) => setPerformanceFilter(e.target.value)}
                className="bg-black/50 border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
              >
                <option value="ALL">All Performance</option>
                <option value="excellent">Excellent (90+)</option>
                <option value="good">Good (80-89)</option>
                <option value="average">Average (&lt;80)</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'performance' | 'volume' | 'items' | 'fees')
                }
                className="bg-black/50 border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
              >
                <option value="performance">Sort by Performance</option>
                <option value="volume">Sort by Volume</option>
                <option value="items">Sort by Items</option>
                <option value="fees">Sort by Fees</option>
              </select>
            </div>
          </div>

          {/* Right Column - Time Period */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#D0B284] mb-4">Time Period</h3>

            {/* Time Period Dropdown */}
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              className="w-full bg-black/50 border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
            >
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="last_year">Last Year</option>
              <option value="all_time">All Time</option>
              <option value="custom">Custom Range</option>
            </select>

            {/* Custom Date Range */}
            {timePeriod === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left font-normal bg-black/50 border-[#D0B284]/20 text-white"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange.from ? format(customDateRange.from, 'PPP') : 'From date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateRange.from}
                      onSelect={(date) => setCustomDateRange((prev) => ({ ...prev, from: date }))}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left font-normal bg-black/50 border-[#D0B284]/20 text-white"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange.to ? format(customDateRange.to, 'PPP') : 'To date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDateRange.to}
                      onSelect={(date) => setCustomDateRange((prev) => ({ ...prev, to: date }))}
                      disabled={(date) => {
                        if (date > new Date()) return true;
                        if (customDateRange.from) return date < customDateRange.from;
                        return false;
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
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
                  Listed Value
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Items
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Sales Volume
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Fees Generated
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Performance
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSellers.map((seller) => (
                <React.Fragment key={seller.id}>
                  {/* Main Seller Row */}
                  <tr className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 transition-colors duration-200">
                    {/* Seller Info */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#D0B284] rounded-full flex items-center justify-center text-black font-bold">
                          {seller.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{seller.name}</h3>
                          <div className="flex items-center space-x-4 text-xs text-[#DCDDCC] mt-1">
                            <div className="flex items-center space-x-1">
                              <Mail className="w-3 h-3" />
                              <span>{seller.email}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Wallet className="w-3 h-3" />
                              <span>{seller.walletAddress}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-[#DCDDCC] mt-1">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{seller.location}</span>
                            </div>
                            <span>Verified: {seller.verificationDate}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Listed Value */}
                    <td className="py-4 px-4 text-center">
                      <div>
                        <div className="text-[#D0B284] font-medium">{seller.totalListedValue}</div>
                        <div className="text-[#DCDDCC] text-sm">{seller.totalListedValueUSD}</div>
                      </div>
                    </td>

                    {/* Items */}
                    <td className="py-4 px-4 text-center">
                      <div>
                        <div className="text-white font-medium">
                          {seller.totalListedItems} Total
                        </div>
                        <div className="text-sm">
                          <span className="text-[#184D37]">{seller.activeListing} Active</span>
                          <span className="text-[#DCDDCC] mx-1">•</span>
                          <span className="text-[#D0B284]">{seller.soldItems} Sold</span>
                        </div>
                      </div>
                    </td>

                    {/* Sales Volume */}
                    <td className="py-4 px-4 text-center">
                      <div>
                        <div className="text-white font-medium">{seller.totalSalesVolume}</div>
                        <div className="text-[#DCDDCC] text-sm">{seller.totalSalesVolumeUSD}</div>
                      </div>
                    </td>

                    {/* Fees Generated */}
                    <td className="py-4 px-4 text-center">
                      <div>
                        <div className="text-[#184D37] font-medium">{seller.feesGenerated}</div>
                        <div className="text-[#DCDDCC] text-sm">{seller.feesGeneratedUSD}</div>
                      </div>
                    </td>

                    {/* Performance */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Badge
                          className={`${getPerformanceColor(seller.performanceScore)} border-none`}
                        >
                          {seller.performanceScore}% {getPerformanceLabel(seller.performanceScore)}
                        </Badge>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#D0B284] hover:bg-[#D0B284]/10"
                          onClick={() => toggleSellerExpansion(seller.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Listings ({seller.listings.length})
                          {expandedSeller === seller.id ? (
                            <ChevronUp className="w-4 h-4 ml-1" />
                          ) : (
                            <ChevronDown className="w-4 h-4 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-400 hover:bg-blue-400/10"
                          onClick={() => handleContactSeller(seller.id)}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Contact
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-400/10"
                          onClick={() => handleSuspendSeller(seller.id)}
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Suspend
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Listings Subtable */}
                  {expandedSeller === seller.id && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div className="bg-[#184D37]/10 border-t border-[#184D37]/20 animate-in slide-in-from-top-2 duration-300">
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-[#D0B284] font-medium">
                                {seller.name}&apos;s Listings ({seller.listings.length} items)
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                                onClick={() => setExpandedSeller(null)}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Listings Sub-table */}
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-[#D0B284]/10">
                                    <th className="text-left text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Asset
                                    </th>
                                    <th className="text-center text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Contract
                                    </th>
                                    <th className="text-center text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Volume
                                    </th>
                                    <th className="text-center text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Market Cap
                                    </th>
                                    <th className="text-center text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Token Price
                                    </th>
                                    <th className="text-center text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Holders
                                    </th>
                                    <th className="text-center text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Fees Made
                                    </th>
                                    <th className="text-center text-[#DCDDCC] text-xs font-jetbrains uppercase py-3 px-2">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {seller.listings.map((listing) => (
                                    <tr
                                      key={listing.id}
                                      className="border-b border-[#D0B284]/5 hover:bg-[#D0B284]/5"
                                    >
                                      {/* Asset */}
                                      <td className="py-3 px-2">
                                        <div className="flex items-center space-x-2">
                                          <Image
                                            src={listing.image || '/placeholder.svg'}
                                            alt={listing.name}
                                            className="w-8 h-8 rounded-full object-cover border border-[#D0B284]/20"
                                            width={32}
                                            height={32}
                                          />
                                          <div>
                                            <h5 className="text-white font-medium text-sm">
                                              {listing.name.split(' ').slice(0, 2).join(' ')}
                                            </h5>
                                            <div className="flex items-center space-x-2">
                                              <span className="text-[#DCDDCC] font-jetbrains text-xs">
                                                {listing.ticker}
                                              </span>
                                              <Badge
                                                variant="secondary"
                                                className="bg-[#D0B284]/10 text-[#D0B284] text-xs px-1 py-0"
                                              >
                                                {listing.category}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                      </td>

                                      {/* Contract */}
                                      <td className="py-3 px-2 text-center">
                                        <span className="text-[#DCDDCC] font-jetbrains text-xs">
                                          {listing.contractAddress}
                                        </span>
                                      </td>

                                      {/* Volume */}
                                      <td className="py-3 px-2 text-center">
                                        <div>
                                          <div className="text-white font-medium text-sm">
                                            {listing.volume}
                                          </div>
                                          <div className="text-[#DCDDCC] text-xs">
                                            {listing.volumeUSD}
                                          </div>
                                        </div>
                                      </td>

                                      {/* Market Cap */}
                                      <td className="py-3 px-2 text-center">
                                        <div>
                                          <div className="text-white font-medium text-sm">
                                            {listing.marketCap}
                                          </div>
                                          <div className="text-[#DCDDCC] text-xs">
                                            {listing.marketCapUSD}
                                          </div>
                                        </div>
                                      </td>

                                      {/* Token Price */}
                                      <td className="py-3 px-2 text-center">
                                        <span className="text-[#D0B284] font-medium text-sm">
                                          {listing.tokenPrice}
                                        </span>
                                      </td>

                                      {/* Holders */}
                                      <td className="py-3 px-2 text-center">
                                        <span className="text-white font-medium text-sm">
                                          {listing.holders.toLocaleString()}
                                        </span>
                                      </td>

                                      {/* Fees Made */}
                                      <td className="py-3 px-2 text-center">
                                        <div>
                                          <div className="text-[#184D37] font-medium text-sm">
                                            {listing.feesMade}
                                          </div>
                                          <div className="text-[#DCDDCC] text-xs">
                                            {listing.feesUSD}
                                          </div>
                                        </div>
                                      </td>

                                      {/* Status */}
                                      <td className="py-3 px-2 text-center">
                                        <Badge
                                          className={`${listing.status === 'active' ? 'text-[#184D37] bg-[#184D37]/10' : 'text-[#D0B284] bg-[#D0B284]/10'} border-none text-xs`}
                                        >
                                          {listing.status === 'active' ? 'Active' : 'Sold'}
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-5 h-5 text-[#D0B284]" />
            <span className="text-[#DCDDCC] text-sm font-jetbrains uppercase">Total Sellers</span>
          </div>
          <div className="text-2xl font-bold text-white">{filteredSellers.length}</div>
        </div>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Package className="w-5 h-5 text-[#D0B284]" />
            <span className="text-[#DCDDCC] text-sm font-jetbrains uppercase">Total Items</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {filteredSellers.reduce((sum, seller) => sum + seller.totalListedItems, 0)}
          </div>
        </div>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-5 h-5 text-[#D0B284]" />
            <span className="text-[#DCDDCC] text-sm font-jetbrains uppercase">Total Volume</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {filteredSellers
              .reduce(
                (sum, seller) =>
                  sum + Number.parseFloat(seller.totalSalesVolume.replace(/[^\d.]/g, '')),
                0,
              )
              .toLocaleString()}{' '}
            ETH
          </div>
        </div>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-5 h-5 text-[#D0B284]" />
            <span className="text-[#DCDDCC] text-sm font-jetbrains uppercase">Total Fees</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {filteredSellers
              .reduce(
                (sum, seller) =>
                  sum + Number.parseFloat(seller.feesGenerated.replace(/[^\d.]/g, '')),
                0,
              )
              .toLocaleString()}{' '}
            ETH
          </div>
        </div>
      </div>
    </div>
  );
}
