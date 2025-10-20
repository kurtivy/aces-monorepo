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
  tokenMinted: boolean;
  bids?: Bid[];
  [key: string]: unknown;
}

// AssetDetailsEditor was removed from this section

interface ImageGalleryEditorProps {
  value: string[];
  onChange: (gallery: string[]) => void;
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

export function SimpleListingsTab() {
  const { getAccessToken } = useAuth();
  const router = useRouter();
  const { createToken, isReady: contractReady } = useAcesFactoryContract();

  const [listings, setListings] = useState<EnhancedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedOffers, setExpandedOffers] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintingListingId, setMintingListingId] = useState<string | null>(null);

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

      // Then finalize for review (signal backend readiness)
      const finalizePayload = {
        additionalImages: formData.imageGallery,
        additionalDescription: formData.details ?? formData.description,
        technicalSpecifications: JSON.stringify(formData.assetDetails || {}),
      };
      const result = await TokenCreationApi.submitUserDetails(expandedRow, finalizePayload, token);

      if (result.success) {
        await fetchListings();
        setExpandedRow(null);
      } else {
        setError(result.error || 'Failed to submit details');
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
      const token = await getAccessToken();
      if (!token) return;

      // Get mint parameters
      const paramsResult = await TokenCreationApi.getMintParameters(listing.id, token);
      if (!paramsResult.success || !paramsResult.data) {
        setError(paramsResult.error || 'Failed to get mint parameters');
        return;
      }

      // Mint token
      const result = await createToken({
        curve: paramsResult.data.curve,
        steepness: paramsResult.data.steepness,
        floor: paramsResult.data.floor,
        name: paramsResult.data.name,
        symbol: paramsResult.data.symbol,
        salt: paramsResult.data.salt,
        tokensBondedAt: paramsResult.data.tokensBondedAt,
        useVanityMining: false,
      });

      if (result.success && result.tokenAddress) {
        // The createToken function should return a transaction hash in a complete implementation
        // For now we'll work with what we have and use the tokenAddress as confirmation
        const txHash = 'confirmed';

        // Confirm with backend
        const confirmResult = await TokenCreationApi.confirmTokenMint(
          listing.id,
          txHash,
          result.tokenAddress,
          token,
        );

        if (confirmResult.success) {
          await fetchListings();
        } else {
          setError(confirmResult.error || 'Failed to confirm token mint');
        }
      } else {
        setError(result.error || 'Failed to mint token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
          className="bg-green-500 hover:bg-green-600 text-white text-xs"
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
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const MAX_IMAGES = 5;
    const currentImages = value || [];

    const addImageUrl = () => {
      if (newImageUrl.trim() && currentImages.length < MAX_IMAGES) {
        const updatedGallery = [...currentImages, newImageUrl.trim()];
        onChange(updatedGallery);
        setNewImageUrl('');
      }
    };

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

    const updateImageUrl = (index: number, newUrl: string) => {
      const updatedGallery = [...currentImages];
      updatedGallery[index] = newUrl;
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

        {/* Existing Images */}
        {currentImages.map((imageUrl: string, index: number) => (
          <div key={index} className="flex gap-2 p-3 bg-black/30 rounded-lg">
            <div className="flex-shrink-0">
              <Image
                src={normalizeImageUrl(imageUrl) || LISTING_PLACEHOLDER}
                alt={`Gallery image ${index + 1}`}
                className="w-16 h-16 rounded-lg object-cover border border-[#D0B284]/20"
                width={64}
                height={64}
                onError={(e) => {
                  const target = e.target as unknown as { src: string };
                  target.src = LISTING_PLACEHOLDER;
                }}
              />
            </div>
            <Input
              value={imageUrl}
              onChange={(e) => updateImageUrl(index, e.target.value)}
              placeholder="Image URL"
              className="flex-1 bg-[#151c16]/40 border-[#D0B284]/20 text-white"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeImage(index)}
              className="text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

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

            {/* Or add URL manually */}
            <div className="flex gap-2">
              <Input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Or paste image URL"
                className="flex-1 bg-[#151c16]/40 border-[#D0B284]/20 text-white text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addImageUrl();
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addImageUrl}
                className="text-[#D0B284] hover:bg-[#D0B284]/10"
                disabled={!newImageUrl.trim() || currentImages.length >= MAX_IMAGES}
              >
                Add URL
              </Button>
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

  if (error) {
    return (
      <div className="bg-[#0A120B] rounded-lg border border-dashed border-[#D7BF75]/25 relative h-full">
        <div className="p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={fetchListings} className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black">
            Try Again
          </Button>
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
    <div className="bg-[#0A120B] rounded-lg border border-dashed border-[#D7BF75]/25 relative h-full">
      {/* Corner ticks */}
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
      <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />

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

        {/* Table */}
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
              {listings.map((listing) => (
                <React.Fragment key={listing.id}>
                  {/* Main Row */}
                  <tr className="border-b border-dashed border-[#D7BF75]/10">
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
                            <span className="text-[#E6E3D3] font-mono text-xs">
                              {listing.symbol}
                            </span>
                            {getStatusBadge(listing)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#E6E3D3] font-mono text-xs">-</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#E6E3D3] text-sm">-</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#E6E3D3] text-sm">-</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#E6E3D3] text-sm">-</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#E6E3D3] text-sm">-</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-[#E6E3D3] text-sm">-</span>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {getActionButton(listing)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                            >
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
                                      setFormData((prev) => ({ ...prev, title: e.target.value }))
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
                                        setFormData((prev) => ({ ...prev, symbol: e.target.value }))
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
                                    <Label className="text-[#D0B284]">Starting Bid (USD)</Label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                        $
                                      </span>
                                      <Input
                                        value={
                                          formData.startingBidPrice
                                            ? parseInt(formData.startingBidPrice).toLocaleString()
                                            : ''
                                        }
                                        onChange={(e) => {
                                          const value = e.target.value.replace(/[^0-9]/g, '');
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
                                    <Label className="text-[#D0B284]">Reserve Price (USD)</Label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">
                                        $
                                      </span>
                                      <Input
                                        value={
                                          formData.reservePrice
                                            ? parseInt(formData.reservePrice).toLocaleString()
                                            : ''
                                        }
                                        onChange={(e) => {
                                          const value = e.target.value.replace(/[^0-9]/g, '');
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
                                  <Label className="text-[#D0B284]">Declared Value (USD)</Label>
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
                                        const value = e.target.value.replace(/[^0-9]/g, '');
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
                                        startingBidPrice: formData.startingBidPrice || undefined,
                                        imageGallery: formData.imageGallery,
                                      },
                                      token,
                                    );
                                    if (!saveOnly.success) {
                                      setError(saveOnly.error || 'Failed to save listing');
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
    </div>
  );
}
