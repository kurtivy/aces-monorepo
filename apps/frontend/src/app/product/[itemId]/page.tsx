import { notFound } from 'next/navigation';
import Image from 'next/image';
import { SAMPLE_METADATA } from '@/data/metadata';
import PictureGallery from '@/components/rwa/picture-gallery';
import TokenGraph from '@/components/rwa/token-graph';
import SwapInterface from '@/components/rwa/swap-interface';
import ProductDescription from '@/components/rwa/product-description';
import BidsSection from '@/components/rwa/bids-section';
import TokenInformation from '@/components/rwa/token-information';
import { Button } from '@/components/ui/button';
import { ExternalLink, Globe, Twitter, Instagram, MessageCircle } from 'lucide-react';

type TransactionType = 'buy' | 'sell';

// Helper function to get item data
async function getItemData(itemId: string) {
  // Find the item in our metadata
  const item = SAMPLE_METADATA.find((item) => item.id === itemId);

  if (!item || !item.marketCap || !item.tokenPrice || !item.ticker || !item.image) {
    return null;
  }

  // Transform metadata to match our component props
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: 'Luxury Assets', // We can expand this later
    brand: '', // Can be added to metadata later
    condition: 'Excellent', // Can be added to metadata later
    authenticity: 'Certified Authentic', // Can be added to metadata later
    images: [item.image], // For now we only have one image
    tokenSymbol: item.ticker,
    tokenPrice: item.tokenPrice,
    priceChange24h: 0, // To be implemented
    fdv: `$${item.marketCap.toLocaleString()}`,
    holders: Math.floor(Math.random() * 1000), // Placeholder
    liquidity: `$${Math.floor(item.marketCap * 0.1).toLocaleString()}`, // Placeholder
    volume24h: `$${Math.floor(item.marketCap * 0.05).toLocaleString()}`, // Placeholder
    currentHighestBid: item.tokenPrice * 1000, // Placeholder
    minimumBid: item.tokenPrice * 1100, // Placeholder
    totalBids: Math.floor(Math.random() * 20), // Placeholder
    website: 'https://example.com', // Placeholder
    social: {
      twitter: 'https://twitter.com/example',
      instagram: 'https://instagram.com/example',
      discord: 'https://discord.gg/example',
    }, // Placeholder socials
    bids: [
      {
        id: '1',
        bidder: '0x1234...5678',
        amount: item.tokenPrice * 1000,
        timestamp: '5 min ago',
        isWinning: true,
      },
      { id: '2', bidder: '0x8765...4321', amount: item.tokenPrice * 950, timestamp: '12 min ago' },
      { id: '3', bidder: '0x9876...1234', amount: item.tokenPrice * 900, timestamp: '25 min ago' },
    ],
    recentTransactions: [
      {
        type: 'buy' as TransactionType,
        amount: '2,150',
        price: item.tokenPrice.toFixed(5),
        time: '3m ago',
        hash: '0x1234...5678',
      },
      {
        type: 'sell' as TransactionType,
        amount: '890',
        price: (item.tokenPrice * 0.99).toFixed(5),
        time: '8m ago',
        hash: '0x8765...4321',
      },
      {
        type: 'buy' as TransactionType,
        amount: '1,200',
        price: (item.tokenPrice * 1.01).toFixed(5),
        time: '15m ago',
        hash: '0x9876...1234',
      },
    ],
  };
}

interface PageProps {
  params: Promise<{
    itemId: string;
  }>;
}

export default async function ItemPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { itemId } = resolvedParams;
  const itemData = await getItemData(itemId);

  if (!itemData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#D0B264]/5 via-transparent to-emerald-500/5 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] pointer-events-none" />

      <div className="relative z-10 p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto">
          {/* Asset Header */}
          <div className="mb-6">
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
              <div className="flex flex-col gap-6">
                {/* Main Header Info */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#D0B264]/30 shadow-lg relative">
                      <Image
                        src={itemData.images[0]}
                        alt={itemData.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                        priority
                      />
                    </div>
                    <div>
                      <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">
                        {itemData.title}
                      </h1>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          Live Trading
                        </span>
                        <span>•</span>
                        <span>{itemData.category}</span>
                        <span>•</span>
                        <span>{itemData.tokenSymbol}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white font-mono">
                        ${itemData.tokenPrice.toFixed(4)}
                      </div>
                      <div className="text-sm text-gray-400">Token Price</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-[#D0B264]">{itemData.fdv}</div>
                      <div className="text-sm text-gray-400">Market Cap</div>
                    </div>
                  </div>
                </div>

                {/* Social Links Section */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
                  {itemData.website && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#D0B264]/30 text-[#D0B264] hover:bg-[#D0B264]/10 bg-transparent backdrop-blur-sm"
                      asChild
                    >
                      <a href={itemData.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        Website
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}

                  {itemData.social.twitter && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent backdrop-blur-sm"
                      asChild
                    >
                      <a href={itemData.social.twitter} target="_blank" rel="noopener noreferrer">
                        <Twitter className="h-4 w-4 mr-2" />
                        Twitter
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}

                  {itemData.social.instagram && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10 bg-transparent backdrop-blur-sm"
                      asChild
                    >
                      <a href={itemData.social.instagram} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4 mr-2" />
                        Instagram
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}

                  {itemData.social.discord && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 bg-transparent backdrop-blur-sm"
                      asChild
                    >
                      <a href={itemData.social.discord} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Discord
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Trading Interface Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column - Main Trading Area */}
            <div className="lg:col-span-3 space-y-6">
              {/* Trading Chart - Full Width */}
              <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-[#D0B264] via-[#D0B264]/70 to-emerald-500/50"></div>
                <div className="p-6">
                  <TokenGraph
                    currentPrice={itemData.tokenPrice}
                    priceChange={itemData.priceChange24h}
                    volume={itemData.volume24h}
                  />
                </div>
              </div>

              {/* Product Description - Full Width */}
              <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500/50 to-[#D0B264]/70"></div>
                <div className="p-6">
                  <ProductDescription
                    description={itemData.description}
                    category={itemData.category}
                    brand={itemData.brand}
                    condition={itemData.condition}
                    authenticity={itemData.authenticity}
                    website={itemData.website}
                    social={itemData.social}
                  />
                </div>
              </div>

              {/* Gallery and Bidding Section - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Picture Gallery - 2/3 width */}
                <div className="lg:col-span-2">
                  <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden h-full">
                    <div className="h-1 bg-gradient-to-r from-[#D0B264]/70 to-emerald-500/50"></div>
                    <div className="p-6">
                      <PictureGallery images={itemData.images} title={itemData.title} />
                    </div>
                  </div>
                </div>

                {/* Bidding Section - 1/3 width */}
                <div className="lg:col-span-1">
                  <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden h-full">
                    <div className="h-1 bg-gradient-to-r from-emerald-500/50 to-[#D0B264]/70"></div>
                    <div className="p-6">
                      <BidsSection
                        currentHighestBid={itemData.currentHighestBid}
                        minimumBid={itemData.minimumBid}
                        totalBids={itemData.totalBids}
                        bids={itemData.bids}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar - Swap and Token Info Stacked */}
            <div className="lg:col-span-2 space-y-6">
              {/* Swap Interface */}
              <div>
                <SwapInterface tokenSymbol={itemData.tokenSymbol} />
              </div>

              {/* Token Information */}
              <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500/50 via-[#D0B264]/70 to-emerald-500/50"></div>
                <div className="p-6">
                  <TokenInformation
                    tokenSymbol={itemData.tokenSymbol}
                    tokenPrice={itemData.tokenPrice}
                    priceChange24h={itemData.priceChange24h}
                    fdv={itemData.fdv}
                    holders={itemData.holders}
                    liquidity={itemData.liquidity}
                    volume24h={itemData.volume24h}
                    recentTransactions={itemData.recentTransactions}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const { itemId } = resolvedParams;
  const itemData = await getItemData(itemId);

  if (!itemData) {
    return {
      title: 'Item Not Found',
    };
  }

  return {
    title: `${itemData.title} - RWA Marketplace`,
    description: itemData.description,
  };
}
