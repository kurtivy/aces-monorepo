'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Activity, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

export function UserActivityCard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Replace with real data from the backend
  const mockActivity = [
    {
      id: '1',
      type: 'BID',
      assetName: 'Ruby Stone Porsche',
      assetSymbol: 'RSP',
      imageUrl:
        '/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
      amount: '25000',
      status: 'PENDING',
      timestamp: '2024-03-21T10:30:00Z',
    },
    {
      id: '2',
      type: 'PURCHASE',
      assetName: 'McLaren F1',
      assetSymbol: 'MCF1',
      imageUrl: '/canvas-images/2009-F1-McLaren-MP4-24.webp',
      amount: '75000',
      status: 'COMPLETED',
      timestamp: '2024-03-20T15:45:00Z',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-emerald-400';
      case 'PENDING':
        return 'text-yellow-400';
      case 'FAILED':
        return 'text-red-400';
      default:
        return 'text-[#DCDDCC]';
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[#D0B284] text-2xl font-bold">Recent Activity</h2>
          <p className="text-[#DCDDCC] text-sm">Your recent transactions and bids</p>
        </div>
        <Button
          variant="ghost"
          className="text-[#D0B284] hover:bg-[#D0B284]/20"
          onClick={() => setIsLoading(true)}
          disabled={isLoading}
        >
          <Activity className="w-4 h-4 mr-2" />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {mockActivity.map((activity) => (
          <div
            key={activity.id}
            className="bg-black/50 rounded-lg p-4 border border-[#D0B284]/10 hover:border-[#D0B284]/30 transition-colors"
          >
            <div className="flex gap-4">
              {/* Asset Image */}
              <div className="relative w-16 h-16 rounded-lg overflow-hidden">
                <Image
                  src={activity.imageUrl}
                  alt={activity.assetName}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Activity Info */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-bold">{activity.assetName}</h3>
                    <p className="text-[#DCDDCC] text-sm">{activity.assetSymbol}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#D0B284] hover:bg-[#D0B284]/20"
                    onClick={() => window.open(`/asset/${activity.id}`, '_blank')}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-2 flex justify-between items-end">
                  <div>
                    <p className="text-[#DCDDCC] text-sm">{activity.type}</p>
                    <p className="text-[#D0B284] font-mono">
                      ${Number(activity.amount).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`${getStatusColor(activity.status)} text-sm`}>
                      {activity.status}
                    </p>
                    <p className="text-[#DCDDCC] text-sm">{formatDate(activity.timestamp)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {mockActivity.length === 0 && (
          <div className="text-center py-12 bg-black/30 rounded-lg">
            <p className="text-[#DCDDCC]">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
