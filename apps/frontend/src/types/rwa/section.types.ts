import type { Comment } from '@/types/comments';

export interface Section {
  id: string;
  label: string;
  isModal?: boolean;
}

export interface SectionNavigationProps {
  sections: Section[];
  activeSection: number;
  onSectionChange: (index: number) => void;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  isAnimating: boolean;
  previousActiveSection: number | null;
}

export interface CardProps {
  section: Section;
  index: number;
  isActive: boolean;
  onSectionChange: (index: number) => void;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  isAnimating: boolean;
  previousActiveSection: number | null;
}

export interface ActiveSectionContentProps {
  sectionIndex: number;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
}

export interface MiddleContentAreaProps {
  activeSection: number;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  navigationDirection: 'up' | 'down' | null;
}

export interface ImageData {
  id: number;
  src: string;
  thumbnail?: string;
  alt: string;
}

export interface ModalProps {
  onClose: () => void;
}

// Asset types - matching your Prisma enum
export type AssetType =
  | 'VEHICLE'
  | 'JEWELRY'
  | 'COLLECTIBLE'
  | 'ART'
  | 'FASHION'
  | 'ALCOHOL'
  | 'OTHER';

// Navigation direction type
export type NavigationDirection = 'up' | 'down';

// Database types - matching your Prisma Listing model with relations
export interface DatabaseListing {
  id: string;
  title: string;
  symbol: string;
  description: string;
  assetDetails: Array<{ key: string; value: string }> | null; // Structured asset details
  assetType: AssetType;
  imageGallery: string[];
  location: string | null;
  email: string | null;
  isLive: boolean;
  launchDate: string | null; // When the asset will go live for sale

  // NEW: Bidding fields
  startingBidPrice: string | null; // Minimum bid amount (USD)
  reservePrice: string | null; // Hidden reserve price (USD)

  submissionId: string;
  ownerId: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  commentCount?: number;
  // Relations
  owner?: {
    id: string;
    walletAddress: string | null;
    email: string | null;
    role: string;
  };
  // Token relationship
  token?: {
    id: string;
    contractAddress: string;
    symbol: string;
    name: string;
    decimals: number;
    currentPrice: string;
    currentPriceACES: string;
    volume24h: string;
    phase: 'BONDING_CURVE' | 'DEX_TRADING';
    isActive: boolean;
    chainId?: number;
    holderCount?: number;
    holdersCount?: number;
    priceSource?: 'BONDING_CURVE' | 'DEX';
    poolAddress?: string | null;
    dexLiveAt?: string | null;
  };
  dex?: {
    poolAddress: string | null;
    isDexLive: boolean;
    dexLiveAt: string | null;
    priceSource: 'BONDING_CURVE' | 'DEX';
    lastUpdated: string | null;
    bondingCutoff: string | null;
  };
}

// Keep DatabaseItem as alias for backwards compatibility if needed
export type DatabaseItem = DatabaseListing;

// Extended props for components that need listing data
export interface WithListingProps {
  listing?: DatabaseListing | null;
}
