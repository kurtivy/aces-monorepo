'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import PictureGallery from '@/components/old/rwa/picture-gallery';
// import TokenGraph from '@/components/rwa/token-graph';
import SwapInterface from '@/components/old/rwa/swap-interface';
import ProductDescription from '@/components/old/rwa/product-description';
import TokenInformation from '@/components/old/rwa/token-information';
import ProfileSectionWrapper from '@/components/old/rwa/profile/profile-section-wrapper'; // Import the new wrapper component
import Footer from '@/components/ui/custom/footer';
import TermsModal from '@/components/ui/custom/terms-modal';

// Define proper types
interface ItemData {
  id: string;
  title: string;
  description: string;
  date: string;
  ticker: string;
  image: string;
  rrp: number;
  tokenPrice: number;
  marketCap: number;
  tokenSupply: number;
  ownerAddress: string;
}

// TODO: Replace with your actual API/database call
// This function can remain async as it's just a utility function
async function getItemData(itemId: string): Promise<ItemData | null> {
  // Mock data structure matching your metadata format
  const mockItems: Record<string, ItemData> = {
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
      ownerAddress: '0x1234567890123456789012345678901234567890',
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
function transformItemData(itemData: ItemData) {
  // Calculate derived values
  const fdv = `$${(itemData.marketCap / 1000).toFixed(1)}K`;
  const volume24h = `$${((itemData.marketCap * 0.05) / 1000).toFixed(1)}K`;
  const holders = Math.floor(itemData.tokenSupply / 1000);
  const liquidity = `$${((itemData.marketCap * 0.1) / 1000).toFixed(1)}K`;

  // Mock activity data for the NFT (ordered by most recent first)
  const activity = [
    {
      event: 'Bid',
      price: 2.05,
      from: 'nft_collector',
      to: 'cobramatic',
      time: '2y ago',
    },
    {
      event: 'Bid',
      price: 1.85,
      from: 'crypto_trader',
      to: 'cobramatic',
      time: '3y ago',
    },
    {
      event: 'Sale',
      price: 2.15,
      from: 'BertHoff',
      to: 'cobramatic',
      time: '4y ago',
    },
    {
      event: 'Bid',
      price: 0.95,
      from: 'art_lover',
      to: 'Pole2002',
      time: '3y ago',
    },
    {
      event: 'Sale',
      price: 1.11,
      from: 'Pole2002',
      to: 'BertHoff',
      time: '4y ago',
    },
    {
      event: 'Sale',
      price: 0.2,
      from: 'OxPYv',
      to: 'Pole2002',
      time: '4y ago',
    },
    {
      event: 'Mint',
      price: 0.03,
      from: 'NullAddress',
      to: 'OxPYv',
      time: '4y ago',
    },
  ];

  // Demo holder data for the holders table
  const demoHolders = [
    {
      rank: 1,
      address: '0x8f2a55939038a91c0b6ad856e01a7a1536d1b7d6',
      percentage: 15.23,
      amount: 152.3,
      value: 41650,
      txns: 47,
      exp: '2y ago',
    },
    {
      rank: 2,
      address: '0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6',
      percentage: 12.87,
      amount: 128.7,
      value: 35200,
      txns: 23,
      exp: '1y ago',
    },
    {
      rank: 3,
      address: '0x1234567890123456789012345678901234567890',
      percentage: 8.45,
      amount: 84.5,
      value: 23120,
      txns: 15,
      exp: '6mo ago',
    },
    {
      rank: 4,
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      percentage: 6.78,
      amount: 67.8,
      value: 18540,
      txns: 31,
      exp: '3mo ago',
    },
    {
      rank: 5,
      address: '0x9876543210987654321098765432109876543210',
      percentage: 5.92,
      amount: 59.2,
      value: 16190,
      txns: 12,
      exp: '1mo ago',
    },
    {
      rank: 6,
      address: '0x5555555555555555555555555555555555555555',
      percentage: 4.67,
      amount: 46.7,
      value: 12780,
      txns: 8,
      exp: '2w ago',
    },
    {
      rank: 7,
      address: '0x6666666666666666666666666666666666666666',
      percentage: 3.89,
      amount: 38.9,
      value: 10640,
      txns: 19,
      exp: '1w ago',
    },
    {
      rank: 8,
      address: '0x7777777777777777777777777777777777777777',
      percentage: 3.12,
      amount: 31.2,
      value: 8540,
      txns: 6,
      exp: '3d ago',
    },
    {
      rank: 9,
      address: '0x8888888888888888888888888888888888888888',
      percentage: 2.45,
      amount: 24.5,
      value: 6700,
      txns: 14,
      exp: '1d ago',
    },
    {
      rank: 10,
      address: '0x9999999999999999999999999999999999999999',
      percentage: 1.98,
      amount: 19.8,
      value: 5410,
      txns: 9,
      exp: '12h ago',
    },
  ];

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

    // Token information - proper props for components
    tokenSymbol: itemData.ticker.replace('$', ''),
    tokenPrice: itemData.tokenPrice,
    priceChange: {
      '5m': 0.04,
      '1h': -6.31,
      '6h': -6.26,
      '1d': -5.24,
    },
    fdv: fdv,
    holders: holders,
    liquidity: liquidity,
    volume: {
      '5m': `$${((itemData.marketCap * 0.02) / 1000).toFixed(1)}K`,
      '1h': `$${((itemData.marketCap * 0.05) / 1000).toFixed(1)}K`,
      '6h': `$${((itemData.marketCap * 0.08) / 1000).toFixed(1)}K`,
      '1d': volume24h,
    },
    tokenSupply: itemData.tokenSupply,
    marketCap: itemData.marketCap,
    rrp: itemData.rrp,
    ownerAddress: itemData.ownerAddress,
    imageSrc: itemData.image,
    tokenAddress: '0x7300...0219FE',
    createdAt: '2 mo ago',

    // Activity data
    activityTable: activity,
    holdersTable: demoHolders,

    // Mock transaction data
    transactions: {
      '5m': { buys: 140, sells: 17, makers: 137, buyers: 126, sellers: 11 },
      '1h': { buys: 280, sells: 34, makers: 275, buyers: 252, sellers: 23 },
      '6h': { buys: 560, sells: 68, makers: 551, buyers: 505, sellers: 46 },
      '1d': { buys: 1121, sells: 136, makers: 1102, buyers: 1010, sellers: 92 },
    },
  };
}

interface ClientPageProps {
  itemId: string;
}

export default function ClientItemPage({ itemId }: ClientPageProps) {
  const [itemDataState, setItemDataState] = useState<ReturnType<typeof transformItemData> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); // Set loading to true when fetching starts
      const rawItemData = await getItemData(itemId);

      if (!rawItemData) {
        notFound(); // This will trigger Next.js notFound()
      }

      const itemData = transformItemData(rawItemData);
      setItemDataState(itemData);
      setLoading(false); // Set loading to false when fetching is complete
    };

    fetchData();
  }, [itemId]); // Re-run effect when itemId changes

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-xl">
        Loading item data...
      </div>
    );
  }

  // If itemDataState is null after loading, it means notFound() was called.
  // This check is mostly for TypeScript, as notFound() will halt rendering.
  if (!itemDataState) {
    return null;
  }

  const itemData = itemDataState;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Row 1: Chart, Profile, Swap */}
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Chart Tile */}
        <div className="flex-1 rounded-xl overflow-hidden border border-[#D0B284]/30">
          {/* <TokenGraph
            tokenSymbol={itemData.tokenSymbol}
            currentPrice={itemData.tokenPrice}
            priceChange={itemData.priceChange['1d']}
            volume={itemData.volume['1d']}
          /> */}
        </div>

        {/* Right Column - Profile and Swap Interface */}
        <div className="flex flex-col lg:w-[36.2%]">
          {/* Profile Section - Now wrapped in ProfileSectionWrapper */}
          <div className="rounded-bl-xl overflow-hidden border-b border-l border-[#D0B284]/30">
            <ProfileSectionWrapper />
          </div>
          {/* Swap Interface */}
          <div className="flex-1 rounded-xl overflow-hidden">
            <SwapInterface tokenSymbol={itemData.tokenSymbol} />
          </div>
        </div>
      </div>

      {/* Full Width Token Information Strip */}
      <div className="w-full rounded-xl overflow-hidden px-6">
        <TokenInformation
          tokenPrice={itemData.tokenPrice}
          priceChange={itemData.priceChange}
          fdv={itemData.fdv}
          holders={itemData.holders}
          liquidity={itemData.liquidity}
          volume={itemData.volume}
          transactions={itemData.transactions}
        />
      </div>

      {/* Picture Gallery and Product Description Row */}
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Picture Gallery Tile - Square */}
        <div className="w-full lg:w-[400px] rounded-xl overflow-hidden border border-[#D0B284]/30">
          <PictureGallery images={itemData.images} />
        </div>

        {/* Product Description Tile - Full Width */}
        <div className="flex-1 rounded-xl overflow-hidden border border-[#D0B284]/30">
          <ProductDescription
            title={itemData.title}
            description={itemData.description}
            category={itemData.category}
            brand={itemData.brand}
            condition={itemData.condition}
            authenticity={itemData.authenticity}
            activity={itemData.activityTable}
            holders={itemData.holdersTable}
          />
        </div>
      </div>
      <Footer onTermsClick={() => setIsTermsModalOpen(true)} />
      <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
    </div>
  );
}
