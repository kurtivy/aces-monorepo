'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  BarChart3,
  Gavel,
  ShoppingCart,
  Calendar,
} from 'lucide-react';
import { mockAnalyticsData, type PlatformAnalytics, type TimePeriod } from '@/data/admin-analytics';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';

const COLORS = ['#D0B284', '#184D37', '#D7BF75', '#928357', '#DCDDCC', '#666'];

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  period: string;
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, period, icon }: MetricCardProps) {
  const isPositive = change > 0;

  return (
    <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6 hover:border-[#D0B284]/40 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[#DCDDCC] text-sm font-jetbrains uppercase">{title}</div>
        <div className="text-[#D0B284]">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white mb-2">{value}</div>
      <div className="flex items-center space-x-2">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-[#184D37]" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        )}
        <span className={`text-sm ${isPositive ? 'text-[#184D37]' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}
          {change}%
        </span>
        <span className="text-[#DCDDCC] text-sm">{period}</span>
      </div>
    </div>
  );
}

export function AnalyticsTab() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1_month');
  const [data, setData] = useState<PlatformAnalytics>(mockAnalyticsData);
  const [isLoading, setIsLoading] = useState(false);

  const timePeriodOptions = [
    { value: '1_hour' as TimePeriod, label: '1 Hour' },
    { value: '1_day' as TimePeriod, label: '1 Day' },
    { value: '1_week' as TimePeriod, label: '1 Week' },
    { value: '1_month' as TimePeriod, label: '1 Month' },
    { value: '3_months' as TimePeriod, label: '3 Months' },
    { value: '6_months' as TimePeriod, label: '6 Months' },
    { value: '1_year' as TimePeriod, label: '1 Year' },
    { value: 'ytd' as TimePeriod, label: 'YTD' },
  ];

  // Simulate data loading when period changes
  useEffect(() => {
    setIsLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      // Update data based on selected period
      setData((prevData) => ({
        ...prevData,
        // Simulate different data for different periods
        totalVolume: {
          ...prevData.totalVolume,
          period: `vs last ${selectedPeriod.replace('_', ' ')}`,
          change: prevData.totalVolume.change + (Math.random() - 0.5) * 10,
        },
        totalFees: {
          ...prevData.totalFees,
          period: `vs last ${selectedPeriod.replace('_', ' ')}`,
          change: prevData.totalFees.change + (Math.random() - 0.5) * 8,
        },
        totalListings: {
          ...prevData.totalListings,
          period: `vs last ${selectedPeriod.replace('_', ' ')}`,
          change: prevData.totalListings.change + (Math.random() - 0.5) * 15,
        },
        totalValue: {
          ...prevData.totalValue,
          period: `vs last ${selectedPeriod.replace('_', ' ')}`,
          change: prevData.totalValue.change + (Math.random() - 0.5) * 12,
        },
        totalSellers: {
          ...prevData.totalSellers,
          period: `vs last ${selectedPeriod.replace('_', ' ')}`,
          change: prevData.totalSellers.change + (Math.random() - 0.5) * 20,
        },
        historicBids: {
          ...prevData.historicBids,
          period: `vs last ${selectedPeriod.replace('_', ' ')}`,
          change: prevData.historicBids.change + (Math.random() - 0.5) * 18,
        },
        rwaAssetsSold: {
          ...prevData.rwaAssetsSold,
          period: `vs last ${selectedPeriod.replace('_', ' ')}`,
          change: prevData.rwaAssetsSold.change + (Math.random() - 0.5) * 25,
        },
      }));
      setIsLoading(false);
    }, 500);
  }, [selectedPeriod]);

  // Simulate real-time updates every 15 minutes
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (selectedPeriod === '1_hour') {
          setIsLoading(true);
          setTimeout(() => {
            setData((prevData) => ({
              ...prevData,
              totalVolume: {
                ...prevData.totalVolume,
                change: prevData.totalVolume.change + (Math.random() - 0.5) * 2,
              },
            }));
            setIsLoading(false);
          }, 500);
        }
      },
      15 * 60 * 1000,
    ); // 15 minutes

    return () => clearInterval(interval);
  }, [selectedPeriod]);

  return (
    <div className="space-y-6">
      {/* Header with Time Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">Platform Analytics</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#D0B284]" />
            <span className="text-[#DCDDCC] text-sm">Time Period:</span>
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as TimePeriod)}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-4 py-2 min-w-[120px] focus:border-[#D0B284] focus:outline-none"
          >
            {timePeriodOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#231F20]">
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-[#184D37]'}`}
            />
            <span className="text-[#DCDDCC] text-sm">
              {isLoading ? 'Updating...' : 'Live Data'}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6">
        <MetricCard
          title="Total Volume"
          value={data.totalVolume.value}
          change={data.totalVolume.change}
          period={data.totalVolume.period}
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Fees"
          value={data.totalFees.value}
          change={data.totalFees.change}
          period={data.totalFees.period}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Listings"
          value={data.totalListings.value}
          change={data.totalListings.change}
          period={data.totalListings.period}
          icon={<Package className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Value"
          value={data.totalValue.value}
          change={data.totalValue.change}
          period={data.totalValue.period}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Sellers"
          value={data.totalSellers.value}
          change={data.totalSellers.change}
          period={data.totalSellers.period}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Historic Bids"
          value={data.historicBids.value}
          change={data.historicBids.change}
          period={data.historicBids.period}
          icon={<Gavel className="w-5 h-5" />}
        />
        <MetricCard
          title="RWA Assets Sold"
          value={data.rwaAssetsSold.value}
          change={data.rwaAssetsSold.change}
          period={data.rwaAssetsSold.period}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
      </div>

      {/* Original Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Chart */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-[#D0B284] mb-4">Token Volume & Fees Over Time</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.volumeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D0B284" opacity={0.1} />
                <XAxis dataKey="date" stroke="#DCDDCC" />
                <YAxis stroke="#DCDDCC" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#231F20',
                    border: '1px solid #D0B284',
                    borderRadius: '8px',
                    color: '#DCDDCC',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#D0B284"
                  strokeWidth={2}
                  name="Token Volume (ETH)"
                />
                <Line
                  type="monotone"
                  dataKey="fees"
                  stroke="#184D37"
                  strokeWidth={2}
                  name="Fees (ETH)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-[#D0B284] mb-4">Category Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#231F20',
                    border: '1px solid #D0B284',
                    borderRadius: '8px',
                    color: '#DCDDCC',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* New Charts Row - 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historic Bids Chart */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-[#D0B284] mb-4">Historic Bids Over Time</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.historicBidsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D0B284" opacity={0.1} />
                <XAxis dataKey="date" stroke="#DCDDCC" />
                <YAxis stroke="#DCDDCC" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#231F20',
                    border: '1px solid #D0B284',
                    borderRadius: '8px',
                    color: '#DCDDCC',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalBids"
                  stroke="#D7BF75"
                  fill="#D7BF75"
                  fillOpacity={0.3}
                  name="Total Bid Value (ETH)"
                />
                <Area
                  type="monotone"
                  dataKey="activeBids"
                  stroke="#184D37"
                  fill="#184D37"
                  fillOpacity={0.3}
                  name="Active Bids (ETH)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RWA Assets Sold Chart */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-[#D0B284] mb-4">RWA Assets Sold Over Time</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rwaAssetsSoldChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D0B284" opacity={0.1} />
                <XAxis dataKey="date" stroke="#DCDDCC" />
                <YAxis stroke="#DCDDCC" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#231F20',
                    border: '1px solid #D0B284',
                    borderRadius: '8px',
                    color: '#DCDDCC',
                  }}
                />
                <Bar dataKey="assetsSold" fill="#D0B284" name="Assets Sold (ETH)" />
                <Bar dataKey="assetsCount" fill="#928357" name="Number of Assets" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bid Success Rate Chart */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-[#D0B284] mb-4">Bid Success Rate</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.bidSuccessChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D0B284" opacity={0.1} />
                <XAxis dataKey="date" stroke="#DCDDCC" />
                <YAxis stroke="#DCDDCC" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#231F20',
                    border: '1px solid #D0B284',
                    borderRadius: '8px',
                    color: '#DCDDCC',
                  }}
                  formatter={(value) => [`${value}%`, 'Success Rate']}
                />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  stroke="#184D37"
                  strokeWidth={3}
                  name="Success Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Sale Time Chart */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-[#D0B284] mb-4">Average Sale Time</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.averageSaleTimeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D0B284" opacity={0.1} />
                <XAxis dataKey="date" stroke="#DCDDCC" />
                <YAxis stroke="#DCDDCC" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#231F20',
                    border: '1px solid #D0B284',
                    borderRadius: '8px',
                    color: '#DCDDCC',
                  }}
                  formatter={(value) => [`${value} days`, 'Average Sale Time']}
                />
                <Area
                  type="monotone"
                  dataKey="averageDays"
                  stroke="#928357"
                  fill="#928357"
                  fillOpacity={0.3}
                  name="Average Days to Sale"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Listings */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#D0B284] mb-4">Top Performing Listings</h3>
        <div className="space-y-3">
          {data.topListings.slice(0, 10).map((listing, index) => (
            <div
              key={listing.id}
              className="flex items-center justify-between p-3 bg-[#D0B284]/5 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#D0B284] rounded-full flex items-center justify-center text-black font-bold">
                  {index + 1}
                </div>
                <span className="text-white font-medium">{listing.name}</span>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <div className="text-[#D0B284] font-medium">{listing.volume}</div>
                  <div className="text-[#DCDDCC] text-sm">Token Volume</div>
                </div>
                <div className="text-right">
                  <div className="text-[#184D37] font-medium">{listing.fees}</div>
                  <div className="text-[#DCDDCC] text-sm">Fees</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
