'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Coins, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

export function UserAssetsCard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Replace with real data from the backend
  const mockAssets = [
    {
      id: '1',
      name: 'Ruby Stone Porsche',
      symbol: 'RSP',
      imageUrl:
        '/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
      quantity: '0.25',
      value: '125000',
    },
    {
      id: '2',
      name: 'McLaren F1',
      symbol: 'MCF1',
      imageUrl: '/canvas-images/2009-F1-McLaren-MP4-24.webp',
      quantity: '0.1',
      value: '75000',
    },
  ];

  return (
    <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[#D0B284] text-2xl font-bold">Your Assets</h2>
          <p className="text-[#DCDDCC] text-sm">Tokens you own on our platform</p>
        </div>
        <Button
          variant="ghost"
          className="text-[#D0B284] hover:bg-[#D0B284]/20"
          onClick={() => setIsLoading(true)}
          disabled={isLoading}
        >
          <Coins className="w-4 h-4 mr-2" />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockAssets.map((asset) => (
          <div
            key={asset.id}
            className="bg-black/50 rounded-lg p-4 border border-[#D0B284]/10 hover:border-[#D0B284]/30 transition-colors"
          >
            <div className="flex gap-4">
              {/* Asset Image */}
              <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                <Image src={asset.imageUrl} alt={asset.name} fill className="object-cover" />
              </div>

              {/* Asset Info */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-bold">{asset.name}</h3>
                    <p className="text-[#DCDDCC] text-sm">{asset.symbol}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#D0B284] hover:bg-[#D0B284]/20"
                    onClick={() => window.open(`/asset/${asset.id}`, '_blank')}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-2">
                  <p className="text-[#DCDDCC] text-sm">Owned</p>
                  <p className="text-white font-mono">{asset.quantity} tokens</p>
                </div>

                <div className="mt-2">
                  <p className="text-[#DCDDCC] text-sm">Value</p>
                  <p className="text-[#D0B284] font-mono">
                    ${Number(asset.value).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {mockAssets.length === 0 && (
          <div className="col-span-2 text-center py-12 bg-black/30 rounded-lg">
            <p className="text-[#DCDDCC]">No assets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
