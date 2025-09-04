'use client';

import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SellerDashboardOverlay } from './seller-dashboard-overlay';
import Image from 'next/image';
import { useState } from 'react';
import { useAcesTokenBalance } from '@/hooks/use-aces-token-balance';

export function TokenListTab() {
  const [isSellerDashboardOpen, setIsSellerDashboardOpen] = useState(false);
  const { tokenData, hasTokens, isLoading, error, isWalletConnected } = useAcesTokenBalance();

  // Format contract address for display (show first 6 and last 4 characters)
  const formatAddress = (address: string) => {
    if (address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Create tokens array based on user's ACES balance
  const userTokens = hasTokens
    ? [
        {
          id: 'aces',
          title: tokenData.name,
          ticker: `$${tokenData.symbol}`,
          image: '/aces-logo.png', // Using ACES logo as the token image
          contractAddress: formatAddress(tokenData.address),
          amount: parseFloat(tokenData.formattedBalance),
          totalValue: 0, // TODO: Add USD value calculation when price feed is available
        },
      ]
    : [];

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

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-[#E6E3D3]">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#C9AE6A]"></div>
                  <span className="text-sm">Loading your tokens...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-red-400 text-sm mb-2">Error loading token data</div>
                  <div className="text-[#E6E3D3]/60 text-xs">{error.message}</div>
                </div>
              </div>
            )}

            {/* Wallet Not Connected State */}
            {!isWalletConnected && !isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-[#E6E3D3] text-sm mb-2">
                    Connect your wallet to view tokens
                  </div>
                  <div className="text-[#E6E3D3]/60 text-xs">
                    Connect your wallet to see your ACES token holdings
                  </div>
                </div>
              </div>
            )}

            {/* No Tokens State */}
            {isWalletConnected && !hasTokens && !isLoading && !error && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-[#E6E3D3] text-sm mb-2">No ACES tokens found</div>
                  <div className="text-[#E6E3D3]/60 text-xs">You don't own any ACES tokens yet</div>
                </div>
              </div>
            )}

            {/* Table Rows */}
            {isWalletConnected && !isLoading && !error && userTokens.length > 0 && (
              <div className="space-y-4">
                {userTokens.map((token) => (
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
                        {token.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 4,
                        })}{' '}
                        Tokens
                      </span>
                    </div>

                    {/* Total */}
                    <div className="text-center">
                      <span className="text-[#E6E3D3] text-sm">
                        {token.totalValue > 0 ? `$${token.totalValue.toFixed(2)}` : 'N/A'}
                      </span>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
