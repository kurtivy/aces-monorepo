import ClientItemPage from '@/components/rwa/client-page';

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

interface PageProps {
  params: Promise<{
    itemId: string;
  }>;
}

export default async function ItemPage({ params }: PageProps) {
  const { itemId } = await params;
  return <ClientItemPage itemId={itemId} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { itemId } = await params;
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
