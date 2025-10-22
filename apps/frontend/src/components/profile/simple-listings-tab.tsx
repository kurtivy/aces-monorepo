'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Edit,
  Eye,
  MoreHorizontal,
  Clock,
  Check,
  Coins,
  FileText,
  Plus,
  X,
  Save,
  Loader2,
  Upload,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { ListingsApi } from '@/lib/api/listings';
import { TokenCreationApi, TokenCreationStatus } from '@/lib/api/token-creation';
import { useRouter } from 'next/navigation';
import { useAcesFactoryContract } from '@/hooks/contracts/use-aces-factory-contract';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { useTokenMetrics } from '@/hooks/use-token-metrics';

// Type definitions
interface AssetDetails {
  [key: string]: string;
}

interface FormData {
  title: string;
  symbol: string;
  description: string; // maps to details/story below for backward compatibility display
  brand?: string;
  location?: string;
  story?: string;
  details?: string;
  provenance?: string;
  hypeSentence?: string;
  value?: string;
  assetDetails: AssetDetails;
  reservePrice: string;
  startingBidPrice: string;
  imageGallery: string[];
}

interface Bid {
  id: string;
  amount: string;
  bidder?: {
    id: string;
  };
}

interface EnhancedListing {
  id: string;
  title: string;
  symbol: string;
  description: string;
  brand?: string | null;
  story?: string | null;
  details?: string | null;
  provenance?: string | null;
  hypeSentence?: string | null;
  value?: string | null;
  imageGallery: string[];
  contractAddress?: string;
  location?: string;
  reservePrice?: string;
  startingBidPrice?: string;
  assetDetails?: AssetDetails;
  isLive: boolean;
  tokenCreationStatus: string | null;
  tokenParameters?: any; // Token parameters set by admin
  tokenMinted: boolean;
  bids?: Bid[];
  token?: {
    id?: string;
    contractAddress: string;
    symbol?: string;
    name?: string;
    totalSupply?: string;
  };
  [key: string]: unknown;
}

// AssetDetailsEditor was removed from this section

interface ImageGalleryEditorProps {
  value: string[];
  onChange: (gallery: string[]) => void;
}

// Utility functions for formatting metrics
const formatNumber = (num: number): string => {
  if (!Number.isFinite(num) || num === 0) return '0';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
};

const formatPrice = (price: number): string => {
  if (!Number.isFinite(price) || price === 0) return '0';
  if (price < 0.000001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
};

// Truncate contract address (0x758...434)
const truncateAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 5)}...${address.slice(-3)}`;
};

// Copy to clipboard helper
const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

// ListingRow component to handle metrics fetching per listing
interface ListingRowProps {
  listing: EnhancedListing;
  onlyProductImages: (urls: string[] | undefined) => string[];
  getStatusBadge: (listing: EnhancedListing) => React.ReactElement;
  getActionButton: (listing: EnhancedListing) => React.ReactElement;
  router: ReturnType<typeof useRouter>;
}

function ListingRow({
  listing,
  onlyProductImages,
  getStatusBadge,
  getActionButton,
  router,
}: ListingRowProps) {
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Get contract address from the linked token (if it exists)
  const contractAddress = listing.token?.contractAddress;

  // Fetch real-time metrics for this listing's token
  const { metrics, loading: metricsLoading } = useTokenMetrics(
    contractAddress && contractAddress !== '0x0000...0000' ? contractAddress : undefined,
  );

  const LISTING_PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#231F20"/><text x="50" y="50" font-family="Arial" font-size="14" fill="#D0B284" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>',
    );

  return (
    <tr className="border-b border-dashed border-[#D7BF75]/10">
      {/* RWA Info */}
      <td className="py-4 px-2">
        <div className="flex items-center space-x-3">
          <Image
            src={onlyProductImages(listing.imageGallery)[0] || LISTING_PLACEHOLDER}
            alt={listing.title}
            className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
            width={40}
            height={40}
            onError={(e) => {
              const target = e.target as unknown as { src: string };
              target.src = LISTING_PLACEHOLDER;
            }}
          />
          <div>
            <h3 className="text-[#E6E3D3] font-medium text-sm">{listing.title}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-[#E6E3D3] font-mono text-xs">{listing.symbol}</span>
              {getStatusBadge(listing)}
            </div>
          </div>
        </div>
      </td>

      {/* Contract */}
      <td className="py-4 px-2 text-center">
        {contractAddress ? (
          <button
            onClick={async () => {
              await copyToClipboard(contractAddress);
              setCopiedAddress(true);
              setTimeout(() => setCopiedAddress(false), 2000);
            }}
            className="text-[#E6E3D3] font-mono text-xs hover:text-[#D7BF75] transition-colors cursor-pointer relative group"
            title={`Click to copy: ${contractAddress}`}
          >
            {copiedAddress ? (
              <span className="text-green-400">✓ Copied!</span>
            ) : (
              truncateAddress(contractAddress)
            )}
          </button>
        ) : (
          <span className="text-[#E6E3D3] font-mono text-xs">-</span>
        )}
      </td>

      {/* Volume - Real-time data */}
      <td className="py-4 px-2 text-center">
        <span className="text-[#E6E3D3] text-sm">
          {metricsLoading ? (
            <span className="text-[#D7BF75]/50">...</span>
          ) : metrics?.volume24hUsd ? (
            `$${formatNumber(metrics.volume24hUsd)}`
          ) : (
            '-'
          )}
        </span>
      </td>

      {/* Market Cap - Real-time data */}
      <td className="py-4 px-2 text-center">
        <span className="text-[#E6E3D3] text-sm">
          {metricsLoading ? (
            <span className="text-[#D7BF75]/50">...</span>
          ) : metrics?.marketCapUsd ? (
            `$${formatNumber(metrics.marketCapUsd)}`
          ) : (
            '-'
          )}
        </span>
      </td>

      {/* Token Price - Real-time data */}
      <td className="py-4 px-2 text-center">
        <span className="text-[#E6E3D3] text-sm">
          {metricsLoading ? (
            <span className="text-[#D7BF75]/50">...</span>
          ) : metrics?.tokenPriceUsd ? (
            `$${formatPrice(metrics.tokenPriceUsd)}`
          ) : (
            '-'
          )}
        </span>
      </td>

      {/* Holders - Real-time data */}
      <td className="py-4 px-2 text-center">
        <span className="text-[#E6E3D3] text-sm">
          {metricsLoading ? (
            <span className="text-[#D7BF75]/50">...</span>
          ) : metrics?.holderCount !== undefined ? (
            metrics.holderCount.toLocaleString()
          ) : (
            '-'
          )}
        </span>
      </td>

      {/* Fees Made - Real-time data */}
      <td className="py-4 px-2 text-center">
        <span className="text-[#E6E3D3] text-sm">
          {metricsLoading ? (
            <span className="text-[#D7BF75]/50">...</span>
          ) : metrics?.totalFeesUsd ? (
            <>
              ${formatNumber(metrics.totalFeesUsd)} (
              {formatNumber(parseFloat(metrics.totalFeesAces))} ACES)
            </>
          ) : (
            '-'
          )}
        </span>
      </td>

      {/* Actions */}
      <td className="py-4 px-2 text-right">
        <div className="flex items-center justify-end space-x-2">
          {getActionButton(listing)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-[#DCDDCC] hover:bg-[#D0B284]/10">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black border-[#D0B284]/20">
              <DropdownMenuItem
                onClick={() => router.push(`/rwa/${listing.symbol}`)}
                className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

// AssetPair unused in this component after UI simplification

const LISTING_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="#231F20" rx="4"/>
    <rect x="8" y="8" width="24" height="24" fill="#184D37" fill-opacity="0.2" rx="2"/>
    <path d="M16 22L20 18L24 22L28 18" stroke="#D0B284" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18" cy="16" r="1.5" fill="#D0B284"/>
  </svg>
`);

// Wagmi-to-Ethers signer hook for Privy Smart Wallet support
function useWagmiEthersSigner() {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);

  useEffect(() => {
    async function getSignerFromWagmi() {
      if (!walletClient) {
        console.log('⏸️ No Wagmi wallet client available');
        setSigner(null);
        setProvider(null);
        return;
      }

      try {
        console.log('🔗 Getting signer from Wagmi wallet client');
        console.log('Wallet client details:', {
          address: walletClient.account.address,
          chainId: walletClient.chain.id,
          chainName: walletClient.chain.name,
        });

        // Convert Viem wallet client to ethers signer
        const { chain } = walletClient;

        // Create a provider from the transport
        const network = {
          chainId: chain.id,
          name: chain.name,
        };

        // Create ethers provider from wallet client transport
        const ethersProvider = new ethers.providers.Web3Provider(
          walletClient.transport as unknown as ethers.providers.ExternalProvider,
          network,
        );

        // Get signer from provider
        const ethersSigner = ethersProvider.getSigner();

        // Verify signer works
        const signerAddress = await ethersSigner.getAddress();
        console.log('✅ Wagmi signer obtained and verified:', signerAddress);

        setSigner(ethersSigner);
        setProvider(ethersProvider);
      } catch (error) {
        console.error('❌ Failed to get Wagmi signer:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
        setSigner(null);
        setProvider(null);
      }
    }

    getSignerFromWagmi();
  }, [walletClient]);

  return { signer, provider };
}

export function SimpleListingsTab({
  defaultShowPending = false,
}: {
  defaultShowPending?: boolean;
}) {
  const { getAccessToken } = useAuth();
  const router = useRouter();

  // Get signer from Wagmi for Privy Smart Wallet support
  const { signer: wagmiSigner, provider: wagmiProvider } = useWagmiEthersSigner();

  // Pass external signer to factory contract hook
  const { createToken, isReady: contractReady } = useAcesFactoryContract({
    externalSigner: wagmiSigner,
    externalProvider: wagmiProvider,
  });

  const [listings, setListings] = useState<EnhancedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedOffers, setExpandedOffers] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintingListingId, setMintingListingId] = useState<string | null>(null);
  const [showPendingListings, setShowPendingListings] = useState(defaultShowPending);

  // Normalize potentially percent-encoded signed URLs coming from storage
  const normalizeImageUrl = useCallback((url: string | undefined) => {
    if (!url) return '';
    try {
      // Only decode when it looks percent-encoded to avoid double-decoding
      return /%[0-9A-Fa-f]{2}/.test(url) ? decodeURIComponent(url) : url;
    } catch {
      return url;
    }
  }, []);

  const stripQuery = useCallback(
    (url: string | undefined) => {
      if (!url) return '';
      const normalized = normalizeImageUrl(url);
      const idx = normalized.indexOf('?');
      return idx >= 0 ? normalized.slice(0, idx) : normalized;
    },
    [normalizeImageUrl],
  );

  // Only allow public product images in this UI (exclude secure documents)
  const isProductImageUrl = useCallback((url?: string) => {
    return typeof url === 'string' && url.includes('aces-product-images/');
  }, []);

  const onlyProductImages = useCallback(
    (urls: string[] | undefined) =>
      (urls || []).filter((u) => isProductImageUrl(u)).map(stripQuery),
    [isProductImageUrl, stripQuery],
  );

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: '',
    symbol: '',
    description: '',
    assetDetails: {},
    reservePrice: '',
    startingBidPrice: '',
    imageGallery: [],
  });

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;

      // Get listings
      const listingsResult = await ListingsApi.getMyListings(token);
      if (!listingsResult.success) {
        setError(listingsResult.error);
        return;
      }

      // Get token status
      const tokenResult = await TokenCreationApi.getUserTokenCreationStatus(token);

      // Merge data and coerce nullable fields to match UI types
      const enhanced = listingsResult.data.map((listing) => {
        const tokenStatus =
          tokenResult.success && tokenResult.data
            ? tokenResult.data.find((t) => t.id === listing.id)
            : null;

        return {
          ...listing,
          tokenCreationStatus: tokenStatus?.tokenCreationStatus || null,
          tokenMinted: tokenStatus?.tokenCreationStatus === TokenCreationStatus.MINTED,
          reservePrice: listing.reservePrice ?? undefined,
          startingBidPrice: listing.startingBidPrice ?? undefined,
          location: listing.location ?? undefined,
          assetDetails: (listing as any).assetDetails ?? undefined,
        };
      });

      setListings(enhanced);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchListings();
    // Intentionally do not depend on user?.id; access token gating happens in fetchListings
  }, [fetchListings]);

  const handleExpandDetails = (listing: EnhancedListing) => {
    setExpandedRow(listing.id);
    setExpandedOffers(null);

    // Convert asset details to form format
    const assetDetails: AssetDetails = (listing.assetDetails ?? {}) as AssetDetails;

    setFormData({
      title: listing.title,
      symbol: listing.symbol,
      description: listing.details || listing.story || listing.description || '',
      brand: listing.brand || undefined,
      location: listing.location || undefined,
      story: listing.story || undefined,
      details: listing.details || undefined,
      provenance: listing.provenance || undefined,
      hypeSentence: listing.hypeSentence || undefined,
      value: listing.value || undefined,
      assetDetails,
      reservePrice: listing.reservePrice || '',
      startingBidPrice: listing.startingBidPrice || '',
      imageGallery: onlyProductImages(listing.imageGallery),
    });
  };

  const handleSubmitDetails = async () => {
    if (!expandedRow) return;

    try {
      setIsSubmitting(true);
      const token = await getAccessToken();
      if (!token) return;

      // Save listing edits (owner update)
      const saveResult = await ListingsApi.updateMyListing(
        expandedRow,
        {
          title: formData.title,
          symbol: formData.symbol,
          brand: formData.brand,
          location: formData.location,
          story: formData.story,
          details: formData.details ?? formData.description,
          provenance: formData.provenance,
          hypeSentence: formData.hypeSentence,
          value: formData.value,
          assetDetails: formData.assetDetails,
          reservePrice: formData.reservePrice || undefined,
          startingBidPrice: formData.startingBidPrice || undefined,
          imageGallery: onlyProductImages(formData.imageGallery),
        },
        token,
      );

      if (!saveResult.success) {
        setError(saveResult.error || 'Failed to save listing');
        return;
      }

      // Then finalize for admin review
      const finalizeResult = await ListingsApi.finalizeUserDetails(expandedRow, token);

      if (finalizeResult.success) {
        await fetchListings();
        setExpandedRow(null);
        alert('Details finalized! Admin will review and prepare your token for minting.');
      } else {
        setError(finalizeResult.error || 'Failed to finalize details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMintToken = async (listing: EnhancedListing) => {
    try {
      setMintingListingId(listing.id);
      setError(null); // Clear any previous errors

      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        setMintingListingId(null);
        return;
      }

      // Get token parameters from listing (admin already configured these)
      const tokenParameters = listing.tokenParameters as any;
      if (!tokenParameters) {
        setError('Token parameters not found. Please contact admin.');
        setMintingListingId(null);
        return;
      }

      console.log('🚀 Minting token with parameters:', tokenParameters);

      // Mint token using factory contract
      const result = await createToken(
        {
          curve: tokenParameters.curve,
          steepness: tokenParameters.steepness,
          floor: tokenParameters.floor,
          name: tokenParameters.name || listing.title,
          symbol: tokenParameters.symbol || listing.symbol,
          salt: tokenParameters.salt,
          tokensBondedAt: tokenParameters.tokensBondedAt,
          useVanityMining: false,
        },
        () => {}, // No progress callback needed
      );

      if (result.success && result.tokenAddress) {
        console.log('✅ Token minted successfully:', result.tokenAddress);

        // Confirm with backend - this will link token and set isLive = true
        const confirmResult = await ListingsApi.mintToken(listing.id, result.tokenAddress, token);

        if (confirmResult.success) {
          await fetchListings();
          alert(
            `🎉 Token minted successfully!\n\nYour listing is now live on ACES.\n\nContract Address: ${result.tokenAddress}`,
          );
        } else {
          setError(confirmResult.error || 'Failed to confirm token mint with backend');
        }
      } else {
        // Check if user rejected the transaction
        const errorMessage = result.error || 'Failed to mint token';
        const isUserRejection =
          errorMessage.toLowerCase().includes('user rejected') ||
          errorMessage.toLowerCase().includes('user denied') ||
          errorMessage.toLowerCase().includes('user cancelled') ||
          errorMessage.toLowerCase().includes('transaction was rejected');

        if (isUserRejection) {
          console.log('ℹ️ User cancelled the transaction');
          // Don't set error state for user cancellations - just silently reset
          // User can try again by clicking the button
        } else {
          // Only set error for actual errors (not user cancellations)
          setError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Minting error:', err);

      // Check if this is a user rejection
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      const isUserRejection =
        errorMessage.toLowerCase().includes('user rejected') ||
        errorMessage.toLowerCase().includes('user denied') ||
        errorMessage.toLowerCase().includes('user cancelled') ||
        errorMessage.toLowerCase().includes('transaction was rejected');

      if (isUserRejection) {
        console.log('ℹ️ User cancelled the transaction');
        // Don't set error state for user cancellations
      } else {
        setError(errorMessage);
      }
    } finally {
      setMintingListingId(null);
    }
  };

  const getStatusBadge = (listing: EnhancedListing) => {
    if (listing.tokenMinted) {
      return (
        <Badge className="text-purple-400 bg-purple-400/10">
          <Coins className="w-3 h-3 mr-1" />
          Minted
        </Badge>
      );
    }
    if (listing.tokenCreationStatus === TokenCreationStatus.READY_TO_MINT) {
      return (
        <Badge className="text-green-400 bg-green-400/10">
          <Check className="w-3 h-3 mr-1" />
          Ready to Mint
        </Badge>
      );
    }
    if (listing.tokenCreationStatus === TokenCreationStatus.PENDING_ADMIN_REVIEW) {
      return (
        <Badge className="text-blue-400 bg-blue-400/10">
          <Clock className="w-3 h-3 mr-1" />
          Under Review
        </Badge>
      );
    }
    if (!listing.isLive) {
      return (
        <Badge className="text-[#D7BF75] bg-[#D7BF75]/10">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge className="text-[#184D37] bg-[#184D37]/10">
        <Check className="w-3 h-3 mr-1" />
        Live
      </Badge>
    );
  };

  const getActionButton = (listing: EnhancedListing) => {
    const isMinting = mintingListingId === listing.id;

    if (listing.tokenCreationStatus === TokenCreationStatus.AWAITING_USER_DETAILS) {
      return (
        <Button
          size="sm"
          onClick={() => handleExpandDetails(listing)}
          className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black text-xs"
        >
          <Edit className="w-3 h-3 mr-1" />
          Finalize Details
        </Button>
      );
    }

    if (listing.tokenCreationStatus === TokenCreationStatus.PENDING_ADMIN_REVIEW) {
      return (
        <Button
          size="sm"
          disabled
          className="bg-blue-400/20 text-blue-400 text-xs cursor-not-allowed"
        >
          <Clock className="w-3 h-3 mr-1" />
          Under Review
        </Button>
      );
    }

    if (listing.tokenCreationStatus === TokenCreationStatus.READY_TO_MINT) {
      return (
        <Button
          size="sm"
          onClick={() => handleMintToken(listing)}
          disabled={isMinting || !contractReady}
          className="bg-[#1e3c23] hover:bg-[#1e3c23]/80 text-white text-xs"
        >
          {isMinting ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Minting...
            </>
          ) : (
            <>
              <Coins className="w-3 h-3 mr-1" />
              Launch Token
            </>
          )}
        </Button>
      );
    }

    if (listing.tokenMinted) {
      return (
        <Button
          size="sm"
          onClick={() => setExpandedOffers(expandedOffers === listing.id ? null : listing.id)}
          className="bg-[#184D37] hover:bg-[#184D37]/80 text-white text-xs"
        >
          <Eye className="w-3 h-3 mr-1" />
          VIEW OFFERS ({listing.bids?.length || 0})
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        onClick={() => handleExpandDetails(listing)}
        className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black text-xs"
      >
        <Edit className="w-3 h-3 mr-1" />
        Finalize Details
      </Button>
    );
  };

  // Completely rewritten asset details editor to eliminate state sync issues
  // const AssetDetailsEditor: React.FC<AssetDetailsEditorProps> = ({ value, onChange }) => {
  //   // Internal state that is completely independent
  //   const [pairs, setPairs] = useState<AssetPair[]>([]);

  //   // Initialize from props only once
  //   useEffect(() => {
  //     const entries = Object.entries(value || {});
  //     const newPairs =
  //       entries.length > 0
  //         ? entries.map(([key, val], i) => ({
  //             id: Date.now() + Math.random() + i,
  //             key,
  //             value: val,
  //           }))
  //         : [{ id: Date.now() + Math.random(), key: '', value: '' }];

  //     setPairs(newPairs);
  //   }, []); // Only run on mount

  //   // Convert pairs to object and notify parent
  //   const notifyParent = useCallback(
  //     (newPairs: AssetPair[]) => {
  //       const obj = newPairs.reduce((acc: AssetDetails, pair) => {
  //         if (pair.key.trim() && pair.value.trim()) {
  //           acc[pair.key.trim()] = pair.value.trim();
  //         }
  //         return acc;
  //       }, {});
  //       onChange(obj);
  //     },
  //     [onChange],
  //   );

  //   const addPair = () => {
  //     const newPairs = [...pairs, { id: Date.now() + Math.random(), key: '', value: '' }];
  //     setPairs(newPairs);
  //     notifyParent(newPairs);
  //   };

  //   const removePair = (id: number) => {
  //     const newPairs = pairs.filter((p) => p.id !== id);
  //     setPairs(newPairs);
  //     notifyParent(newPairs);
  //   };

  //   const updatePair = (id: number, field: keyof AssetPair, newValue: string) => {
  //     const newPairs = pairs.map((p) => (p.id === id ? { ...p, [field]: newValue } : p));
  //     setPairs(newPairs);
  //     notifyParent(newPairs);
  //   };

  //   return (
  //     <div className="space-y-3">
  //       <div className="flex items-center justify-between">
  //         <Label className="text-[#D0B284]">Asset Details</Label>
  //         <Button
  //           type="button"
  //           variant="ghost"
  //           size="sm"
  //           onClick={addPair}
  //           className="text-[#D0B284] hover:bg-[#D0B284]/10"
  //         >
  //           <Plus className="w-4 h-4 mr-1" />
  //           Add Detail
  //         </Button>
  //       </div>
  //       {pairs.map((pair) => (
  //         <div key={pair.id} className="flex gap-2 p-3 bg-black/30 rounded-lg">
  //           <Input
  //             placeholder="Property"
  //             value={pair.key}
  //             onChange={(e) => updatePair(pair.id, 'key', e.target.value)}
  //             className="flex-1 bg-[#151c16]/40 border-[#D0B284]/20 text-white"
  //           />
  //           <Input
  //             placeholder="Value"
  //             value={pair.value}
  //             onChange={(e) => updatePair(pair.id, 'value', e.target.value)}
  //             className="flex-1 bg-[#151c16]/40 border-[#D0B284]/20 text-white"
  //           />
  //           <Button
  //             type="button"
  //             variant="ghost"
  //             size="sm"
  //             onClick={() => removePair(pair.id)}
  //             className="text-red-400 hover:bg-red-400/10"
  //           >
  //             <X className="w-4 h-4" />
  //           </Button>
  //         </div>
  //       ))}
  //     </div>
  //   );
  // };

  // Fixed Image Gallery Editor with proper API usage
  const ImageGalleryEditor: React.FC<ImageGalleryEditorProps> = ({ value, onChange }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const MAX_IMAGES = 5;
    const currentImages = value || [];

    const handleFileUpload = async (event: any) => {
      const input = event.target as any;
      const file = input.files && input.files.length > 0 ? input.files[0] : undefined;
      if (!file) return;

      // Check limits
      if (currentImages.length >= MAX_IMAGES) {
        setUploadError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      // Validate file size (2MB limit)
      const MAX_SIZE = 2 * 1024 * 1024; // 2MB
      if (file.size > MAX_SIZE) {
        setUploadError('File size exceeds 2MB limit');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
        return;
      }

      setIsUploading(true);
      setUploadError('');

      try {
        const token = await getAccessToken();
        if (!token) {
          setUploadError('Authentication required');
          return;
        }

        // Create FormData for the upload
        const formData = new window.FormData();
        formData.append('file', file);

        // Make the API call directly to fix the 500 error
        const response = await fetch('/api/v1/product-images/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = `Upload failed with status ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();

        if (result.success && result.imageUrl) {
          const updatedGallery = [...currentImages, result.imageUrl];
          onChange(updatedGallery);
        } else {
          setUploadError(result.error || 'Upload failed');
        }
      } catch (err) {
        console.error('Upload error:', err);
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        // Clear the file input
        input.value = '';
      }
    };

    const removeImage = (index: number) => {
      const updatedGallery = currentImages.filter((_: string, i: number) => i !== index);
      onChange(updatedGallery);
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-[#D0B284]">
            Image Gallery ({currentImages.length}/{MAX_IMAGES})
          </Label>
          {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
        </div>

        {/* Existing Images - Grid 3 x 2 */}
        <div className="grid grid-cols-3 gap-3">
          {currentImages.map((imageUrl: string, index: number) => (
            <div key={index} className="relative p-2 bg-black/30 rounded-lg">
              <Image
                src={normalizeImageUrl(imageUrl) || LISTING_PLACEHOLDER}
                alt={`Gallery image ${index + 1}`}
                className="w-full h-24 rounded-lg object-cover border border-[#D0B284]/20"
                width={256}
                height={256}
                onError={(e) => {
                  const target = e.target as unknown as { src: string };
                  target.src = LISTING_PLACEHOLDER;
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 text-red-400 hover:bg-red-400/10 p-1"
                aria-label={`Remove image ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Upload New Image */}
        {currentImages.length < MAX_IMAGES && (
          <div className="space-y-2">
            <div className="flex gap-2 p-3 bg-black/30 rounded-lg border-2 border-dashed border-[#D0B284]/20">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="file-upload-input"
                />
                <label
                  htmlFor="file-upload-input"
                  className={`cursor-pointer flex items-center justify-center p-2 border border-dashed border-[#D0B284]/40 rounded text-center w-full ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#D0B284]'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span className="text-[#D0B284]">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2 text-[#D0B284]" />
                      <span className="text-[#D0B284]">Upload Image (max 2MB)</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
        )}

        {currentImages.length >= MAX_IMAGES && (
          <p className="text-xs text-[#DCDDCC]/70 text-center">
            Maximum {MAX_IMAGES} images reached. Remove an image to add another.
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-[#0A120B] rounded-lg border border-dashed border-[#D7BF75]/25 relative h-full">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-[#D7BF75]/10 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="bg-[#0A120B] rounded-lg border border-dashed border-[#D7BF75]/25 relative h-full">
        <div className="p-6 text-center">
          <FileText className="w-12 h-12 text-[#DCDDCC]/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No listings yet</h3>
          <p className="text-[#DCDDCC] mb-6">Create your first submission to get started.</p>
          <Button
            onClick={() => router.push('/launch')}
            className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Submission
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0A120B] rounded-lg border-t border-dashed border-[#D7BF75]/25 relative h-full">
      {/* Corner ticks */}
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
      {/* <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" /> */}

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
            Your Listings
          </div>
          <Button
            onClick={() => router.push('/launch')}
            className="bg-[#D7BF75] text-black hover:bg-[#D7BF75]/80 text-sm px-4 py-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Submission
          </Button>
        </div>

        {/* Error Banner - Dismissible */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-400/20 rounded-lg flex items-start justify-between">
            <div className="flex-1">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-400 hover:text-red-300 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Separate listings into Live and Pending */}
        {(() => {
          const liveListings = listings.filter((l) => l.isLive || l.tokenMinted);
          const pendingListings = listings.filter((l) => !l.isLive && !l.tokenMinted);

          return (
            <>
              {/* Live Listings Section */}
              {liveListings.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-green-400" />
                    <h3 className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
                      Live Tokens ({liveListings.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-dashed border-[#D7BF75]/25">
                          <th className="text-left text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            RWA / Ticker
                          </th>
                          <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            Contract
                          </th>
                          <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            Volume
                          </th>
                          <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            Market Cap
                          </th>
                          <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            Token Price
                          </th>
                          <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            Holders
                          </th>
                          <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            Fees Made
                          </th>
                          <th className="text-right text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveListings.map((listing) => (
                          <React.Fragment key={listing.id}>
                            {/* Main Row with Real-time Metrics */}
                            <ListingRow
                              listing={listing}
                              onlyProductImages={onlyProductImages}
                              getStatusBadge={getStatusBadge}
                              getActionButton={getActionButton}
                              router={router}
                            />

                            {/* Expandable Details Form */}
                            {expandedRow === listing.id && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-[#184D37]/10 border-t border-[#184D37]/20">
                                    <div className="p-6">
                                      <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-[#D0B284] font-medium text-lg">
                                          Finalize Listing Details
                                        </h4>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setExpandedRow(null)}
                                          className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>

                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                          <div>
                                            <Label className="text-[#D0B284]">Asset Title</Label>
                                            <Input
                                              value={formData.title}
                                              onChange={(e) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  title: e.target.value,
                                                }))
                                              }
                                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-[#D0B284]">Token Symbol</Label>
                                            <div className="relative">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white font-mono">
                                                $
                                              </span>
                                              <Input
                                                value={formData.symbol}
                                                onChange={(e) =>
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    symbol: e.target.value,
                                                  }))
                                                }
                                                className="mt-1 bg-black/30 border-[#D0B284]/20 text-white font-mono pl-7"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <Label className="text-[#D0B284]">Story</Label>
                                            <Textarea
                                              value={formData.story ?? ''}
                                              onChange={(e) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  story: e.target.value,
                                                }))
                                              }
                                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                              rows={4}
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-[#D0B284]">Details</Label>
                                            <Textarea
                                              value={formData.details ?? ''}
                                              onChange={(e) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  details: e.target.value,
                                                }))
                                              }
                                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                              rows={4}
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-[#D0B284]">Provenance</Label>
                                            <Textarea
                                              value={formData.provenance ?? ''}
                                              onChange={(e) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  provenance: e.target.value,
                                                }))
                                              }
                                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                              rows={3}
                                            />
                                          </div>
                                        </div>

                                        <div className="space-y-4">
                                          <div>
                                            <Label className="text-[#D0B284]">Hype Sentence</Label>
                                            <Input
                                              value={formData.hypeSentence ?? ''}
                                              onChange={(e) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  hypeSentence: e.target.value,
                                                }))
                                              }
                                              className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                            />
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <Label className="text-[#D0B284]">
                                                Starting Bid (USD)
                                              </Label>
                                              <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                                  $
                                                </span>
                                                <Input
                                                  value={
                                                    formData.startingBidPrice
                                                      ? parseInt(
                                                          formData.startingBidPrice,
                                                        ).toLocaleString()
                                                      : ''
                                                  }
                                                  onChange={(e) => {
                                                    const value = e.target.value.replace(
                                                      /[^0-9]/g,
                                                      '',
                                                    );
                                                    setFormData((prev) => ({
                                                      ...prev,
                                                      startingBidPrice: value,
                                                    }));
                                                  }}
                                                  className="mt-1 bg-black/30 border-[#D0B284]/20 text-white pl-7"
                                                  placeholder="1,000"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-[#D0B284]">
                                                Reserve Price (USD)
                                              </Label>
                                              <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                                  $
                                                </span>
                                                <Input
                                                  value={
                                                    formData.reservePrice
                                                      ? parseInt(
                                                          formData.reservePrice,
                                                        ).toLocaleString()
                                                      : ''
                                                  }
                                                  onChange={(e) => {
                                                    const value = e.target.value.replace(
                                                      /[^0-9]/g,
                                                      '',
                                                    );
                                                    setFormData((prev) => ({
                                                      ...prev,
                                                      reservePrice: value,
                                                    }));
                                                  }}
                                                  className="mt-1 bg-black/30 border-[#D0B284]/20 text-white pl-7"
                                                  placeholder="5,000"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                          <div>
                                            <Label className="text-[#D0B284]">
                                              Declared Value (USD)
                                            </Label>
                                            <div className="relative">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                                $
                                              </span>
                                              <Input
                                                value={
                                                  formData.value
                                                    ? parseInt(formData.value).toLocaleString()
                                                    : ''
                                                }
                                                onChange={(e) => {
                                                  const value = e.target.value.replace(
                                                    /[^0-9]/g,
                                                    '',
                                                  );
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    value: value,
                                                  }));
                                                }}
                                                className="mt-1 bg-black/30 border-[#D0B284]/20 text-white pl-7"
                                                placeholder="15,000"
                                              />
                                            </div>
                                          </div>

                                          <ImageGalleryEditor
                                            value={onlyProductImages(formData.imageGallery)}
                                            onChange={(gallery: string[]) =>
                                              setFormData((prev) => ({
                                                ...prev,
                                                imageGallery: onlyProductImages(gallery),
                                              }))
                                            }
                                          />
                                        </div>
                                      </div>

                                      <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-[#D0B284]/20">
                                        <Button
                                          variant="ghost"
                                          onClick={() => setExpandedRow(null)}
                                          className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          onClick={async () => {
                                            try {
                                              setIsSubmitting(true);
                                              const token = await getAccessToken();
                                              if (!token || !expandedRow) return;
                                              const saveOnly = await ListingsApi.updateMyListing(
                                                expandedRow,
                                                {
                                                  title: formData.title,
                                                  symbol: formData.symbol,
                                                  details: formData.description,
                                                  assetDetails: formData.assetDetails,
                                                  reservePrice: formData.reservePrice || undefined,
                                                  startingBidPrice:
                                                    formData.startingBidPrice || undefined,
                                                  imageGallery: formData.imageGallery,
                                                },
                                                token,
                                              );
                                              if (!saveOnly.success) {
                                                setError(
                                                  saveOnly.error || 'Failed to save listing',
                                                );
                                                return;
                                              }
                                              await fetchListings();
                                            } finally {
                                              setIsSubmitting(false);
                                            }
                                          }}
                                          disabled={isSubmitting}
                                          className="bg-[#231F20] hover:bg-[#231F20]/80 text-[#D0B284] border border-[#D0B284]/30"
                                        >
                                          {isSubmitting ? (
                                            <>
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                              Saving...
                                            </>
                                          ) : (
                                            <>
                                              <Save className="w-4 h-4 mr-2" />
                                              Save
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          onClick={handleSubmitDetails}
                                          disabled={isSubmitting}
                                          className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
                                        >
                                          {isSubmitting ? (
                                            <>
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                              Finalizing...
                                            </>
                                          ) : (
                                            <>
                                              <Save className="w-4 h-4 mr-2" />
                                              Finalize Details
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Expandable Offers - only for minted tokens */}
                            {expandedOffers === listing.id && listing.tokenMinted && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-[#184D37]/10 border-t border-[#184D37]/20">
                                    <div className="p-4">
                                      <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[#D0B284] font-medium text-sm">
                                          Offers for {listing.title}
                                        </h4>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setExpandedOffers(null)}
                                          className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                      {!listing.bids || listing.bids.length === 0 ? (
                                        <div className="text-center py-6">
                                          <p className="text-[#DCDDCC] text-sm">No offers yet</p>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          {listing.bids?.map((bid: Bid) => (
                                            <div
                                              key={bid.id}
                                              className="flex items-center justify-between p-3 bg-[#231F20]/50 rounded-lg"
                                            >
                                              <div>
                                                <span className="text-[#D0B284] font-medium">
                                                  ${bid.amount}
                                                </span>
                                                <p className="text-xs text-[#DCDDCC]">
                                                  from {bid.bidder?.id?.slice(0, 8)}...
                                                </p>
                                              </div>
                                              <div className="flex space-x-2">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="text-red-400 hover:bg-red-400/10 text-xs"
                                                >
                                                  Decline
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  className="bg-[#184D37] hover:bg-[#184D37]/80 text-white text-xs"
                                                >
                                                  Accept
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pending Listings Section (Collapsible) */}
              {pendingListings.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowPendingListings(!showPendingListings)}
                    className="flex items-center space-x-2 mb-4 w-full hover:opacity-80 transition-opacity"
                  >
                    <div className="h-2 w-2 rounded-full bg-yellow-400" />
                    <h3 className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
                      Pending Tokens ({pendingListings.length})
                    </h3>
                    <span className="text-[#D7BF75] text-xs ml-auto">
                      {showPendingListings ? '▼' : '▶'}
                    </span>
                  </button>

                  {showPendingListings && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-dashed border-[#D7BF75]/25">
                            <th className="text-left text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              RWA / Ticker
                            </th>
                            <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              Contract
                            </th>
                            <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              Volume
                            </th>
                            <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              Market Cap
                            </th>
                            <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              Token Price
                            </th>
                            <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              Holders
                            </th>
                            <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              Fees Made
                            </th>
                            <th className="text-right text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingListings.map((listing) => (
                            <React.Fragment key={listing.id}>
                              {/* Main Row with Real-time Metrics */}
                              <ListingRow
                                listing={listing}
                                onlyProductImages={onlyProductImages}
                                getStatusBadge={getStatusBadge}
                                getActionButton={getActionButton}
                                router={router}
                              />

                              {/* Expandable Details Form */}
                              {expandedRow === listing.id && (
                                <tr>
                                  <td colSpan={8} className="p-0">
                                    <div className="bg-[#184D37]/10 border-t border-[#184D37]/20">
                                      <div className="p-6">
                                        <div className="flex items-center justify-between mb-6">
                                          <h4 className="text-[#D0B284] font-medium text-lg">
                                            Finalize Listing Details
                                          </h4>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedRow(null)}
                                            className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                          <div className="space-y-4">
                                            <div>
                                              <Label className="text-[#D0B284]">Asset Title</Label>
                                              <Input
                                                value={formData.title}
                                                onChange={(e) =>
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    title: e.target.value,
                                                  }))
                                                }
                                                className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-[#D0B284]">Token Symbol</Label>
                                              <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white font-mono">
                                                  $
                                                </span>
                                                <Input
                                                  value={formData.symbol}
                                                  onChange={(e) =>
                                                    setFormData((prev) => ({
                                                      ...prev,
                                                      symbol: e.target.value,
                                                    }))
                                                  }
                                                  className="mt-1 bg-black/30 border-[#D0B284]/20 text-white font-mono pl-7"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-[#D0B284]">Story</Label>
                                              <Textarea
                                                value={formData.story ?? ''}
                                                onChange={(e) =>
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    story: e.target.value,
                                                  }))
                                                }
                                                className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                                rows={4}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-[#D0B284]">Details</Label>
                                              <Textarea
                                                value={formData.details ?? ''}
                                                onChange={(e) =>
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    details: e.target.value,
                                                  }))
                                                }
                                                className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                                rows={4}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-[#D0B284]">Provenance</Label>
                                              <Textarea
                                                value={formData.provenance ?? ''}
                                                onChange={(e) =>
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    provenance: e.target.value,
                                                  }))
                                                }
                                                className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                                rows={3}
                                              />
                                            </div>
                                          </div>

                                          <div className="space-y-4">
                                            <div>
                                              <Label className="text-[#D0B284]">
                                                Hype Sentence
                                              </Label>
                                              <Input
                                                value={formData.hypeSentence ?? ''}
                                                onChange={(e) =>
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    hypeSentence: e.target.value,
                                                  }))
                                                }
                                                className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                <Label className="text-[#D0B284]">
                                                  Starting Bid (USD)
                                                </Label>
                                                <div className="relative">
                                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                                    $
                                                  </span>
                                                  <Input
                                                    value={
                                                      formData.startingBidPrice
                                                        ? parseInt(
                                                            formData.startingBidPrice,
                                                          ).toLocaleString()
                                                        : ''
                                                    }
                                                    onChange={(e) => {
                                                      const value = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        '',
                                                      );
                                                      setFormData((prev) => ({
                                                        ...prev,
                                                        startingBidPrice: value,
                                                      }));
                                                    }}
                                                    className="mt-1 bg-black/30 border-[#D0B284]/20 text-white pl-7"
                                                    placeholder="1,000"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <Label className="text-[#D0B284]">
                                                  Reserve Price (USD)
                                                </Label>
                                                <div className="relative">
                                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                                    $
                                                  </span>
                                                  <Input
                                                    value={
                                                      formData.reservePrice
                                                        ? parseInt(
                                                            formData.reservePrice,
                                                          ).toLocaleString()
                                                        : ''
                                                    }
                                                    onChange={(e) => {
                                                      const value = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        '',
                                                      );
                                                      setFormData((prev) => ({
                                                        ...prev,
                                                        reservePrice: value,
                                                      }));
                                                    }}
                                                    className="mt-1 bg-black/30 border-[#D0B284]/20 text-white pl-7"
                                                    placeholder="5,000"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-[#D0B284]">
                                                Declared Value (USD)
                                              </Label>
                                              <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                                  $
                                                </span>
                                                <Input
                                                  value={
                                                    formData.value
                                                      ? parseInt(formData.value).toLocaleString()
                                                      : ''
                                                  }
                                                  onChange={(e) => {
                                                    const value = e.target.value.replace(
                                                      /[^0-9]/g,
                                                      '',
                                                    );
                                                    setFormData((prev) => ({
                                                      ...prev,
                                                      value: value,
                                                    }));
                                                  }}
                                                  className="mt-1 bg-black/30 border-[#D0B284]/20 text-white pl-7"
                                                  placeholder="15,000"
                                                />
                                              </div>
                                            </div>

                                            <ImageGalleryEditor
                                              value={onlyProductImages(formData.imageGallery)}
                                              onChange={(gallery: string[]) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  imageGallery: onlyProductImages(gallery),
                                                }))
                                              }
                                            />
                                          </div>
                                        </div>

                                        <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-[#D0B284]/20">
                                          <Button
                                            variant="ghost"
                                            onClick={() => setExpandedRow(null)}
                                            className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            onClick={async () => {
                                              try {
                                                setIsSubmitting(true);
                                                const token = await getAccessToken();
                                                if (!token || !expandedRow) return;
                                                const saveOnly = await ListingsApi.updateMyListing(
                                                  expandedRow,
                                                  {
                                                    title: formData.title,
                                                    symbol: formData.symbol,
                                                    details: formData.description,
                                                    assetDetails: formData.assetDetails,
                                                    reservePrice:
                                                      formData.reservePrice || undefined,
                                                    startingBidPrice:
                                                      formData.startingBidPrice || undefined,
                                                    imageGallery: formData.imageGallery,
                                                  },
                                                  token,
                                                );
                                                if (!saveOnly.success) {
                                                  setError(
                                                    saveOnly.error || 'Failed to save listing',
                                                  );
                                                  return;
                                                }
                                                await fetchListings();
                                              } finally {
                                                setIsSubmitting(false);
                                              }
                                            }}
                                            disabled={isSubmitting}
                                            className="bg-[#231F20] hover:bg-[#231F20]/80 text-[#D0B284] border border-[#D0B284]/30"
                                          >
                                            {isSubmitting ? (
                                              <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Saving...
                                              </>
                                            ) : (
                                              <>
                                                <Save className="w-4 h-4 mr-2" />
                                                Save
                                              </>
                                            )}
                                          </Button>
                                          <Button
                                            onClick={handleSubmitDetails}
                                            disabled={isSubmitting}
                                            className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
                                          >
                                            {isSubmitting ? (
                                              <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Finalizing...
                                              </>
                                            ) : (
                                              <>
                                                <Save className="w-4 h-4 mr-2" />
                                                Finalize Details
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* Expandable Offers */}
                              {expandedOffers === listing.id && listing.tokenMinted && (
                                <tr>
                                  <td colSpan={8} className="p-0">
                                    <div className="bg-[#184D37]/10 border-t border-[#184D37]/20">
                                      {/* Same offers content as live section */}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
