import { notFound } from 'next/navigation';
import PictureGallery from '@/components/rwa/picture-gallery';
import TokenGraph from '@/components/rwa/token-graph';
import SwapInterface from '@/components/rwa/swap-interface';
import ProductDescription from '@/components/rwa/product-description';
import BiddingSystem from '@/components/rwa/bids-section';
import TokenInformation from '@/components/rwa/token-information';

// TODO: Replace with your actual API/database call
async function getItemData(itemId: string) {
  // Mock data structure matching your metadata format
  const mockItems: Record<string, any> = {
    '1': {
      id: '1',
      title: '10x South African Gold Krugerrands',
      description: `A pristine collection of ten 1oz Gold Krugerrands from South Africa. First minted in 1967 to help market South African gold, the Krugerrand is one of the most recognized and liquid gold bullion coins in the world, making it a cornerstone for any serious hard asset portfolio. This set represents a significant and easily transferable store of value, prized by both collectors and investors for its history and 22-karat gold purity.`,
      date: '2024-03-15',
      ticker: '$KRUGER',
      image: '/canvas-images/10xSouth-African-Gold-Krugerrands.webp',
      rrp: 24000,
      tokenPrice: 0.27365,
      marketCap: 27365,
      tokenSupply: 100000,
    },
  };

  // Handle placeholder route for design preview
  if (itemId === '[itemId]') {
    return mockItems['1']; // Return sample data for preview
  }

  // TODO: Replace with your actual data fetching logic
  return mockItems[itemId] || null;
}

// Helper function to transform your metadata into component props
function transformItemData(itemData: any) {
  // Calculate derived values
  const fdv = `$${(itemData.marketCap / 1000).toFixed(1)}K`;
  const volume24h = `$${((itemData.marketCap * 0.05) / 1000).toFixed(1)}K`;
  const holders = Math.floor(itemData.tokenSupply / 1000);
  const liquidity = `$${((itemData.marketCap * 0.1) / 1000).toFixed(1)}K`;
  const priceChange24h = (Math.random() - 0.5) * 20;

  return {
    // Basic info
    id: itemData.id,
    title: itemData.title,
    description: itemData.description,
    category: 'Precious Metals',
    brand: 'South African Mint',
    condition: 'Mint Condition',
    authenticity: 'Certified Authentic',

    // Images
    images: [itemData.image, itemData.image, itemData.image],

    // Token information
    tokenSymbol: itemData.ticker.replace('$', ''),
    tokenPrice: itemData.tokenPrice,
    priceChange24h: priceChange24h,
    fdv: fdv,
    holders: holders,
    liquidity: liquidity,
    volume24h: volume24h,
    tokenSupply: itemData.tokenSupply,
    marketCap: itemData.marketCap,
    rrp: itemData.rrp,

    // Mock bidding data
    currentHighestBid: (itemData.rrp * 0.8) / 2400,
    minimumBid: (itemData.rrp * 0.82) / 2400,
    totalBids: Math.floor(Math.random() * 20) + 5,
    bids: [
      {
        id: '1',
        bidder: '0x1234...5678',
        amount: (itemData.rrp * 0.8) / 2400,
        timestamp: '5 min ago',
        isWinning: true,
      },
      {
        id: '2',
        bidder: '0x8765...4321',
        amount: (itemData.rrp * 0.75) / 2400,
        timestamp: '12 min ago',
      },
    ],

    // Mock transaction data
    recentTransactions: [
      {
        type: 'buy' as const,
        amount: '1,250',
        price: itemData.tokenPrice.toFixed(5),
        time: '3m ago',
        hash: '0x1234...5678',
      },
      {
        type: 'sell' as const,
        amount: '890',
        price: (itemData.tokenPrice * 0.98).toFixed(5),
        time: '8m ago',
        hash: '0x8765...4321',
      },
    ],

    // Social links
    website: 'https://example.com',
    social: {
      twitter: 'https://twitter.com/example',
    },
  };
}

interface PageProps {
  params: {
    itemId: string;
  };
}

export default async function ItemPage({ params }: PageProps) {
  const { itemId } = params;
  const rawItemData = await getItemData(itemId);

  if (!rawItemData) {
    notFound();
  }

  const itemData = transformItemData(rawItemData);

  return (
    <div className="h-screen w-screen bg-[#231F20] flex">
      {/* Main Container - no padding to match infinite canvas */}
      <div className="w-full h-full flex">
        {/* Left Section - 63.8% width */}
        <div className="w-[63.8%] h-full flex flex-col">
          {/* Chart Section with Title - 62% height */}
          <div className="h-[62%] relative">
            <TokenGraph
              tokenSymbol={itemData.tokenSymbol}
              currentPrice={itemData.tokenPrice}
              priceChange={itemData.priceChange24h}
              volume={itemData.volume24h}
            />
          </div>

          {/* Bottom Section - 38% height, split into two */}
          <div className="h-[38%] flex">
            {/* Product Description - 50% of bottom section */}
            <div className="w-1/2 h-full bg-[#DCDDCC] border-2 border-[#D0B264]">
              <ProductDescription
                title={itemData.title}
                description={itemData.description}
                category={itemData.category}
                brand={itemData.brand}
                condition={itemData.condition}
                authenticity={itemData.authenticity}
                website={itemData.website}
                social={itemData.social}
              />
            </div>
            {/* Swap Interface - 50% of bottom section */}
            <div className="w-1/2 h-full bg-[#184D37] border-2 border-[#D0B264]">
              <SwapInterface tokenSymbol={itemData.tokenSymbol} />
            </div>
          </div>
        </div>

        {/* Right Section - 36.2% width */}
        <div className="w-[36.2%] h-full flex flex-col">
          {/* Token Info - 39% height */}
          <div className="h-[39%] bg-[#184D37] border-2 border-[#D0B264]">
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

          {/* Bottom Section Container */}
          <div className="flex-1 flex">
            {/* Main Content Column - 73.2% of bottom section */}
            <div className="w-[73.2%] h-full flex flex-col">
              {/* Gallery - 34.7% of total height */}
              <div className="h-[56.9%] bg-[#928357] border-2 border-[#D0B264]">
                <PictureGallery images={itemData.images} title={itemData.title} />
              </div>
              {/* Bids - Remaining height */}
              <div className="flex-1 bg-[#928357] border-2 border-[#D0B264]">
                <BiddingSystem
                  currentHighestBid={itemData.currentHighestBid}
                  minimumBid={itemData.minimumBid}
                  totalBids={itemData.totalBids}
                  bids={itemData.bids}
                />
              </div>
            </div>

            {/* Right Column - 26.8% of bottom section */}
            <div className="w-[26.8%] h-full flex flex-col">
              {/* NFT Login - 23% of total height */}
              <div className="h-[37.7%] bg-[#D7BF75] border-2 border-[#D0B264]">
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs text-[#231F20] font-medium mb-1">Own this item?</p>
                    <button className="text-xs bg-[#231F20] text-[#FFFFFF] px-3 py-1 rounded-lg font-medium hover:bg-[#184D37] transition-colors">
                      Login
                    </button>
                  </div>
                </div>
              </div>
              {/* Search Similar - 23% of total height */}
              <div className="h-[37.7%] bg-[#D7BF75] border-2 border-[#D0B264]">
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs text-[#231F20] font-medium mb-1">Search Similar</p>
                    <button className="text-xs bg-[#231F20] text-[#FFFFFF] px-3 py-1 rounded-lg hover:bg-[#184D37] transition-colors">
                      Find
                    </button>
                  </div>
                </div>
              </div>
              {/* Empty Space - Remaining height */}
              <div className="flex-1 bg-[#231F20] border-2 border-[#D0B264]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { itemId } = params;
  const rawItemData = await getItemData(itemId);

  if (!rawItemData) {
    return {
      title: 'Item Not Found',
    };
  }

  return {
    title: `${rawItemData.title} - RWA Marketplace`,
    description: rawItemData.description,
  };
}
