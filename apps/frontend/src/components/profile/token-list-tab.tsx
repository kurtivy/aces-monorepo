'use client';

import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SellerDashboardOverlay } from './seller-dashboard-overlay';
import Image from 'next/image';
import { useState } from 'react';

// Mock data for testing
const mockTokens = [
  {
    id: '1',
    title: '1991 Porsche 964 Turbo',
    ticker: '$PORSCHE',
    image:
      '/canvas-images/outline/new/webp/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
    contractAddress: '0x7172...b4E1C',
    amount: 69420,
    totalValue: 4032.36,
  },
  {
    id: '2',
    title: 'Hermes Ostrich Birkin 25',
    ticker: '$BIRKIN',
    image:
      '/canvas-images/outline/new/webp/Hermes-Matte-Niloticus-Crocodile-Himalaya-Kelly-Retourne-32-White.webp',
    contractAddress: '0x7172...b4E1C',
    amount: 36096,
    totalValue: 2032.36,
  },
  {
    id: '3',
    title: '1991 Porsche 964 Turbo',
    ticker: '$PORSCHE',
    image:
      '/canvas-images/outline/new/webp/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
    contractAddress: '0x7172...b4E1C',
    amount: 69420,
    totalValue: 4032.36,
  },
  {
    id: '4',
    title: '1991 Porsche 964 Turbo',
    ticker: '$PORSCHE',
    image:
      '/canvas-images/outline/new/webp/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
    contractAddress: '0x7172...b4E1C',
    amount: 69420,
    totalValue: 4032.36,
  },
  {
    id: '5',
    title: '1991 Porsche 964 Turbo',
    ticker: '$PORSCHE',
    image:
      '/canvas-images/outline/new/webp/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
    contractAddress: '0x7172...b4E1C',
    amount: 69420,
    totalValue: 4032.36,
  },
];

export function TokenListTab() {
  const [isSellerDashboardOpen, setIsSellerDashboardOpen] = useState(false);

  return (
    <div className="relative">
      {/* Seller Dashboard Overlay - full screen overlay */}
      <SellerDashboardOverlay
        isOpen={isSellerDashboardOpen}
        onClose={() => setIsSellerDashboardOpen(false)}
      />

      {/* Main Table */}
      <div className="bg-[#0f1511] rounded-lg border border-dashed border-[#E6E3D3]/25">
        {/* Corner ticks */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

          {/* Table Content */}
          <div className="p-6">
            {/* Tab selectors and Seller Dashboard button - aligned on same line */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex-1">
                <TabsList className="bg-transparent border-none p-0 h-auto space-x-8">
                  <TabsTrigger
                    value="tokens"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    TOKENS
                  </TabsTrigger>
                  <TabsTrigger
                    value="bids"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    BIDS
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Seller Dashboard Button - aligned with tabs */}
              <Button
                onClick={() => setIsSellerDashboardOpen(true)}
                className="bg-[#C9AE6A] hover:bg-[#C9AE6A]/80 text-black font-medium text-sm px-4 py-2"
              >
                SELLER DASHBOARD
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium mb-4 pb-4 border-b border-dashed border-[#E6E3D3]/25">
              <div className="text-left">RWA</div>
              <div className="text-center">TICKER</div>
              <div className="text-center">CONTRACT</div>
              <div className="text-center">AMOUNT</div>
              <div className="text-center">TOTAL</div>
              <div className="text-right"></div>
            </div>

            {/* Table Rows */}
            <div className="space-y-4">
              {mockTokens.map((token) => (
                <div
                  key={token.id}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-center py-3 border-b border-dashed border-[#E6E3D3]/10 last:border-b-0"
                >
                  {/* RWA with Image */}
                  <div className="flex items-center gap-3">
                    <Image
                      src={token.image}
                      alt={token.title}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded object-cover border border-[#D0B284]/20"
                    />
                    <div className="min-w-0">
                      <div className="text-[#E6E3D3] text-sm font-medium truncate">
                        {token.title}
                      </div>
                    </div>
                  </div>

                  {/* Ticker */}
                  <div className="text-center">
                    <span className="text-[#E6E3D3] text-sm font-mono">{token.ticker}</span>
                  </div>

                  {/* Contract */}
                  <div className="text-center">
                    <span className="text-[#E6E3D3] text-sm font-mono">
                      {token.contractAddress}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="text-center">
                    <span className="text-[#E6E3D3] text-sm">
                      {token.amount.toLocaleString()} Tokens
                    </span>
                  </div>

                  {/* Total */}
                  <div className="text-center">
                    <span className="text-[#E6E3D3] text-sm">${token.totalValue.toFixed(2)}</span>
                  </div>

                  {/* View Asset Button */}
                  <div className="text-right">
                    <Button
                      size="sm"
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white border border-[#184D37] text-xs px-3 py-1"
                    >
                      VIEW ASSET
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
