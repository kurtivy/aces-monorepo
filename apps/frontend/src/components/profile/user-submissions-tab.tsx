'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { SubmissionsApi, type UserSubmission } from '@/lib/api/submissions';
import type { CreateSubmissionRequest } from '@aces/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SimpleListingsTab } from '@/components/profile/simple-listings-tab';
import { OffersTab } from '@/components/profile/offers-tab';
import { ListingsApi, type ListingData } from '@/lib/api/listings';
import {
  TokenCreationApi,
  TokenCreationStatus,
  type ListingWithTokenStatus,
} from '@/lib/api/token-creation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Check,
  Clock,
  Coins,
  Edit,
  Eye,
  MoreHorizontal,
  Save,
  X,
  XCircle,
  Loader2,
  Upload,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type EnhancedListing = ListingData & {
  tokenCreationStatus: string | null;
  tokenMinted: boolean;
};

const enhanceListings = (
  listings: ListingData[],
  tokenStatuses: ListingWithTokenStatus[],
): EnhancedListing[] => {
  return listings.map((listing) => {
    const tokenStatus = tokenStatuses.find((status) => status.id === listing.id);
    const tokenCreationStatus =
      tokenStatus?.tokenCreationStatus ?? listing.tokenCreationStatus ?? null;

    return {
      ...listing,
      tokenCreationStatus,
      tokenMinted: tokenCreationStatus === TokenCreationStatus.MINTED,
    };
  });
};

type SubmissionStage =
  | 'PENDING'
  | 'AWAITING_DETAILS'
  | 'UNDER_REVIEW'
  | 'READY_TO_MINT'
  | 'FAILED'
  | 'REJECTED'
  | 'LIVE';

interface SubmissionRow {
  submission: SubmissionWithDetails;
  listing?: EnhancedListing;
  stage: SubmissionStage;
}

type StageMeta = {
  label: string;
  badgeClass: string;
  Icon: LucideIcon;
};

type RowAction = {
  label: string;
  icon: LucideIcon;
  handler: () => void;
  disabled?: boolean;
};

type AssetDetails = Record<string, string>;

interface FinalizeFormData {
  title: string;
  symbol: string;
  description: string;
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

type SubmissionWithDetails = UserSubmission & {
  brand?: string | null;
  location?: string | null;
  story?: string | null;
  details?: string | null;
  provenance?: string | null;
  hypeSentence?: string | null;
  value?: string | null;
  reservePrice?: string | null;
  startingBidPrice?: string | null;
  assetDetails?: AssetDetails | null;
  updatedAt?: string | null;
};

export function UserSubmissionsTab() {
  const { getAccessToken } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [listingsBySubmissionId, setListingsBySubmissionId] = useState<
    Record<string, EnhancedListing>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<{
    submission: SubmissionWithDetails;
    details: SubmissionWithDetails | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [finalizeListing, setFinalizeListing] = useState<EnhancedListing | null>(null);
  const [finalizeMode, setFinalizeMode] = useState<'edit' | 'view'>('edit');
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const isFinalizeReadOnly = finalizeMode === 'view';
  const [finalizeForm, setFinalizeForm] = useState<FinalizeFormData>({
    title: '',
    symbol: '',
    description: '',
    assetDetails: {},
    reservePrice: '',
    startingBidPrice: '',
    imageGallery: [],
  });
  const [isFinalizeSubmitting, setIsFinalizeSubmitting] = useState(false);
  const [finalizeFeedback, setFinalizeFeedback] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [showFinalizeSuccess, setShowFinalizeSuccess] = useState(false);
  const [symbolCheck, setSymbolCheck] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken' | 'error';
    message?: string;
  }>({ status: 'idle' });
  const symbolCheckTimeout = useRef<number | null>(null);
  const LISTING_PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#231F20"/><text x="50" y="50" font-family="Arial" font-size="14" fill="#D0B284" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>',
    );

  const normalizeImageUrl = useCallback((url: string | undefined) => {
    if (!url) return '';
    try {
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

  const isProductImageUrl = useCallback(
    (url?: string) => {
      if (typeof url !== 'string') return false;
      const normalized = normalizeImageUrl(url);
      return normalized.includes('aces-product-images/');
    },
    [normalizeImageUrl],
  );

  const onlyProductImages = useCallback(
    (urls: string[] | undefined) =>
      (urls || []).filter((u) => isProductImageUrl(u)).map(stripQuery),
    [isProductImageUrl, stripQuery],
  );

  type FinalizeImageGalleryEditorProps = {
    value: string[];
    onChange: (gallery: string[]) => void;
  };

  const FinalizeImageGalleryEditor = ({ value, onChange }: FinalizeImageGalleryEditorProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const MAX_IMAGES = 6;
    const currentImages = value || [];

    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files && input.files.length > 0 ? input.files[0] : undefined;
      if (!file) return;

      if (currentImages.length >= MAX_IMAGES) {
        setUploadError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      const MAX_SIZE = 2 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        setUploadError('File size exceeds 2MB limit');
        return;
      }

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

        const formData = new FormData();
        formData.append('file', file);

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
          onChange([...currentImages, result.imageUrl]);
        } else {
          setUploadError(result.error || 'Upload failed');
        }
      } catch (err) {
        console.error('Upload error:', err);
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        input.value = '';
      }
    };

    const removeImage = (index: number) => {
      const updated = currentImages.filter((_, i) => i !== index);
      onChange(updated);
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-[#D0B284]">
            Image Gallery ({currentImages.length}/{MAX_IMAGES})
          </Label>
          {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
        </div>
        {currentImages.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {currentImages.map((imageUrl, index) => (
              <div
                key={index}
                className="relative flex-none w-32 sm:w-40 p-2 bg-black/30 rounded-lg border border-[#D0B284]/20"
              >
                <Image
                  src={normalizeImageUrl(imageUrl) || LISTING_PLACEHOLDER}
                  alt={`Gallery image ${index + 1}`}
                  className="h-24 sm:h-28 w-full rounded-lg object-cover"
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
        ) : (
          <div className="p-8 text-center border-2 border-dashed border-[#D0B284]/20 rounded-lg text-sm text-[#DCDDCC]/70">
            No images uploaded yet
          </div>
        )}

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
                  id="finalize-file-upload"
                />
                <label
                  htmlFor="finalize-file-upload"
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
  const stageMetadata: Record<SubmissionStage, StageMeta> = useMemo(
    () => ({
      PENDING: {
        label: 'Pending Admin Approval',
        badgeClass: 'bg-[#D7BF75]/10 text-[#D7BF75]',
        Icon: Clock,
      },
      AWAITING_DETAILS: {
        label: 'Awaiting Your Details',
        badgeClass: 'bg-orange-500/15 text-orange-300',
        Icon: Edit,
      },
      UNDER_REVIEW: {
        label: 'Under Admin Review',
        badgeClass: 'bg-blue-500/10 text-blue-300',
        Icon: Clock,
      },
      READY_TO_MINT: {
        label: 'Ready to Launch',
        badgeClass: 'bg-[#184D37]/20 text-green-300',
        Icon: Coins,
      },
      FAILED: {
        label: 'Action Required',
        badgeClass: 'bg-yellow-500/10 text-yellow-200',
        Icon: AlertTriangle,
      },
      REJECTED: {
        label: 'Rejected',
        badgeClass: 'bg-red-500/10 text-red-300',
        Icon: XCircle,
      },
      LIVE: {
        label: 'Live',
        badgeClass: 'bg-green-500/10 text-green-300',
        Icon: Check,
      },
    }),
    [],
  );

  const determineStage = useCallback(
    (submission: SubmissionWithDetails, listing?: EnhancedListing): SubmissionStage => {
      // Handle rejected submissions
      if (submission.status === 'REJECTED') {
        return 'REJECTED';
      }

      // Handle live submissions
      if (submission.status === 'LIVE') {
        return 'LIVE';
      }

      // If listing exists, determine stage from tokenCreationStatus
      if (listing) {
        if (listing.isLive || listing.tokenMinted) {
          return 'LIVE';
        }

        const tokenStatus = listing.tokenCreationStatus as TokenCreationStatus | null;

        console.log('[DEBUG] Determining stage for listing:', {
          listingId: listing.id,
          submissionId: submission.id,
          tokenStatus,
          submissionStatus: submission.status,
        });

        // No status or awaiting user details = needs user input
        if (!tokenStatus || tokenStatus === TokenCreationStatus.AWAITING_USER_DETAILS) {
          console.log(
            '[DEBUG] -> Stage: AWAITING_DETAILS (no token status or explicitly awaiting)',
          );
          return 'AWAITING_DETAILS';
        }

        // Map token creation status to submission stage
        switch (tokenStatus) {
          case TokenCreationStatus.PENDING_ADMIN_REVIEW:
            console.log('[DEBUG] -> Stage: UNDER_REVIEW');
            return 'UNDER_REVIEW';
          case TokenCreationStatus.READY_TO_MINT:
            console.log('[DEBUG] -> Stage: READY_TO_MINT');
            return 'READY_TO_MINT';
          case TokenCreationStatus.MINTED:
            console.log('[DEBUG] -> Stage: LIVE');
            return 'LIVE';
          case TokenCreationStatus.FAILED:
            console.log('[DEBUG] -> Stage: FAILED');
            return 'FAILED';
          default:
            console.log('[DEBUG] -> Stage: AWAITING_DETAILS (default)');
            return 'AWAITING_DETAILS';
        }
      }

      // If submission is approved but no listing yet, awaiting details
      if (submission.status === 'APPROVED') {
        console.log('[DEBUG] -> Stage: AWAITING_DETAILS (approved, no listing)');
        return 'AWAITING_DETAILS';
      }

      // Default to pending for new submissions
      console.log('[DEBUG] -> Stage: PENDING (default)');
      return 'PENDING';
    },
    [],
  );

  const submissionRows = useMemo<SubmissionRow[]>(() => {
    return submissions.map((submission) => {
      const listing = listingsBySubmissionId[submission.id];

      return {
        submission,
        listing,
        stage: determineStage(submission, listing),
      };
    });
  }, [determineStage, listingsBySubmissionId, submissions]);

  const visibleRows = useMemo(
    () => submissionRows.filter((row) => row.stage !== 'LIVE'),
    [submissionRows],
  );
  const shouldRenderSubmissionCard = loading || visibleRows.length > 0;

  const scrollToSimpleListings = useCallback(() => {
    if (typeof document === 'undefined') return;
    const section = document.getElementById('simple-listings-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openListingPanel = useCallback(
    (listingId: string, mode: 'view' | 'edit') => {
      scrollToSimpleListings();
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent('aces:simple-listings:open', {
          detail: {
            listingId,
            mode,
            scroll: true,
          },
        }),
      );
    },
    [scrollToSimpleListings],
  );

  const triggerLaunchToken = useCallback(
    (listingId: string) => {
      scrollToSimpleListings();
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent('aces:simple-listings:launch', {
          detail: { listingId },
        }),
      );
    },
    [scrollToSimpleListings],
  );

  const openSubmissionDetails = useCallback(
    async (submission: SubmissionWithDetails) => {
      setViewingSubmission({
        submission,
        details: null,
        loading: true,
        error: null,
      });

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Authentication required');
        }
        const res = await SubmissionsApi.getSubmissionById(submission.id, token);

        setViewingSubmission((prev) => {
          if (!prev || prev.submission.id !== submission.id) {
            return prev;
          }

          if (res.success) {
            return {
              submission: prev.submission,
              details: (res.data as SubmissionWithDetails | null) ?? null,
              loading: false,
              error: null,
            };
          }

          const errorMessage =
            typeof res.error === 'string'
              ? res.error
              : res.error?.message || 'Failed to load submission details';

          return {
            submission: prev.submission,
            details: null,
            loading: false,
            error: errorMessage,
          };
        });
      } catch (err) {
        setViewingSubmission((prev) => {
          if (!prev || prev.submission.id !== submission.id) {
            return prev;
          }
          return {
            submission: prev.submission,
            details: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load submission details',
          };
        });
      }
    },
    [getAccessToken],
  );

  const closeSubmissionDetails = useCallback(() => {
    setViewingSubmission(null);
  }, []);

  const openFinalizeModal = useCallback(
    (listing: EnhancedListing, mode: 'edit' | 'view', submission?: SubmissionWithDetails) => {
      console.log('[DEBUG] Opening finalize modal:', {
        mode,
        listingId: listing.id,
        tokenCreationStatus: listing.tokenCreationStatus,
        title: listing.title,
        hasSubmission: !!submission,
      });

      setFinalizeMode(mode);
      setFinalizeListing(listing);
      setFinalizeFeedback({ status: 'idle', message: '' });

      // For temporary listings, use submission images; otherwise keep the signed listing URLs so they render
      const isTempListing = listing.id.startsWith('temp-');
      const rawImageGallery =
        isTempListing && submission?.imageGallery
          ? submission.imageGallery
          : listing.imageGallery || [];

      setFinalizeForm({
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
        assetDetails: (listing.assetDetails ?? {}) as AssetDetails,
        reservePrice: listing.reservePrice || '',
        startingBidPrice: listing.startingBidPrice || '',
        // Keep signed URLs for display; saving will sanitize before persisting
        imageGallery: rawImageGallery || [],
      });
      if (symbolCheckTimeout.current) {
        window.clearTimeout(symbolCheckTimeout.current);
        symbolCheckTimeout.current = null;
      }
      setSymbolCheck({ status: 'idle' });
      setIsFinalizeOpen(true);
    },
    [],
  );

  const handleCloseFinalize = useCallback(() => {
    setIsFinalizeOpen(false);
    setFinalizeListing(null);
    setFinalizeMode('edit');
    if (symbolCheckTimeout.current) {
      window.clearTimeout(symbolCheckTimeout.current);
      symbolCheckTimeout.current = null;
    }
    setFinalizeFeedback({ status: 'idle', message: '' });
    setSymbolCheck({ status: 'idle' });
  }, []);

  const buildActions = useCallback(
    (row: SubmissionRow): RowAction[] => {
      const { submission, listing, stage } = row;
      const actions: RowAction[] = [];

      console.log('[DEBUG] Building actions for row:', {
        submissionId: submission.id,
        stage,
        hasListing: !!listing,
        listingId: listing?.id,
        tokenCreationStatus: listing?.tokenCreationStatus,
      });

      switch (stage) {
        case 'PENDING':
          // User can only view their submission while waiting for admin approval
          actions.push({
            label: 'View details',
            icon: Eye,
            handler: () => openSubmissionDetails(submission),
          });
          break;

        case 'AWAITING_DETAILS':
          // Admin approved - user can now edit and finalize details
          if (listing) {
            actions.push({
              label: 'Edit & Submit Details',
              icon: Edit,
              handler: () => {
                console.log('[DEBUG] Edit & Submit Details clicked for listing:', listing.id);
                openFinalizeModal(listing, 'edit');
              },
            });
          } else {
            // Create a temporary listing-like object from submission data
            const tempListing: EnhancedListing = {
              id: `temp-${submission.id}`,
              rwaSubmissionId: submission.id,
              title: submission.title || '',
              symbol: submission.symbol || '',
              brand: submission.brand ?? undefined,
              description: submission.details || submission.story || '',
              location: submission.location ?? undefined,
              story: submission.story ?? undefined,
              details: submission.details ?? undefined,
              provenance: submission.provenance ?? undefined,
              hypeSentence: submission.hypeSentence ?? undefined,
              value: submission.value ?? undefined,
              reservePrice: submission.reservePrice ?? undefined,
              startingBidPrice: submission.startingBidPrice ?? undefined,
              imageGallery: submission.imageGallery?.length ? submission.imageGallery : [],
              assetDetails: submission.assetDetails ?? undefined,
              tokenCreationStatus: null,
              tokenMinted: false,
              isLive: false,
              createdAt: submission.createdAt,
              updatedAt: submission.updatedAt ?? submission.createdAt,
              ownerId: '',
            };

            actions.push({
              label: 'Add Details & Submit',
              icon: Edit,
              handler: () => {
                console.log('[DEBUG] Add Details & Submit clicked for submission:', submission.id);
                openFinalizeModal(tempListing, 'edit', submission);
              },
            });
          }
          break;

        case 'UNDER_REVIEW':
          // Submitted for admin review - user can only view
          if (listing) {
            actions.push({
              label: 'View details',
              icon: Eye,
              handler: () => openFinalizeModal(listing, 'view'),
            });
          }
          break;

        case 'READY_TO_MINT':
          // Admin approved final details - user can launch
          if (listing) {
            actions.push({
              label: 'Launch Token',
              icon: Coins,
              handler: () => triggerLaunchToken(listing.id),
            });
            actions.push({
              label: 'View details',
              icon: Eye,
              handler: () => openListingPanel(listing.id, 'view'),
            });
          }
          break;

        case 'FAILED':
          // Something went wrong - user needs to fix and resubmit
          if (listing) {
            actions.push({
              label: 'Fix & Resubmit',
              icon: Edit,
              handler: () => openFinalizeModal(listing, 'edit'),
            });
          } else {
            actions.push({
              label: 'View details',
              icon: Eye,
              handler: () => openSubmissionDetails(submission),
            });
          }
          break;

        case 'REJECTED':
          // Submission rejected by admin
          actions.push({
            label: 'View details',
            icon: Eye,
            handler: () => openSubmissionDetails(submission),
          });
          break;

        default:
          break;
      }

      return actions;
    },
    [openFinalizeModal, openListingPanel, openSubmissionDetails, triggerLaunchToken],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setSubmissions([]);
        return;
      }
      const [submissionsRes, listingsRes, tokenStatusRes] = await Promise.all([
        SubmissionsApi.getUserSubmissions({ limit: 100 }, token),
        ListingsApi.getMyListings(token),
        TokenCreationApi.getUserTokenCreationStatus(token),
      ]);

      setSubmissions((submissionsRes.data || []) as SubmissionWithDetails[]);

      const listings = listingsRes.success ? listingsRes.data || [] : [];
      const tokenStatuses =
        tokenStatusRes.success && tokenStatusRes.data ? tokenStatusRes.data : [];

      const enhancedListings = enhanceListings(listings, tokenStatuses);

      const bySubmission = enhancedListings.reduce<Record<string, EnhancedListing>>((acc, l) => {
        if (l.rwaSubmissionId) {
          acc[l.rwaSubmissionId] = l;
        }
        return acc;
      }, {});

      setListingsBySubmissionId(bySubmission);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const persistFinalizeUpdates = useCallback(
    async (token: string) => {
      if (!finalizeListing) return false;

      // Check if this is a temporary listing (no real listing exists yet)
      const isTempListing = finalizeListing.id.startsWith('temp-');

      if (isTempListing) {
        // Update the submission directly
        const submissionId = finalizeListing.id.replace('temp-', '');
        const submissionPayload: Record<string, unknown> = {
          title: finalizeForm.title,
          symbol: finalizeForm.symbol,
          brand: finalizeForm.brand,
          location: finalizeForm.location,
          story: finalizeForm.story,
          details: finalizeForm.details ?? finalizeForm.description,
          provenance: finalizeForm.provenance,
          hypeSentence: finalizeForm.hypeSentence,
          value: finalizeForm.value,
          reservePrice: finalizeForm.reservePrice || undefined,
          startingBidPrice: finalizeForm.startingBidPrice || undefined,
          imageGallery: onlyProductImages(finalizeForm.imageGallery),
          assetDetails: finalizeForm.assetDetails,
        };

        const updateResult = await SubmissionsApi.updateSubmission(
          submissionId,
          submissionPayload as Partial<CreateSubmissionRequest>,
          token,
        );

        if (!updateResult.success) {
          const message =
            typeof updateResult.error === 'string'
              ? updateResult.error
              : updateResult.error?.message || 'Failed to save submission';
          setError(message);
          return false;
        }
      } else {
        // Update existing listing
        const saveResult = await ListingsApi.updateMyListing(
          finalizeListing.id,
          {
            title: finalizeForm.title,
            symbol: finalizeForm.symbol,
            brand: finalizeForm.brand,
            location: finalizeForm.location,
            story: finalizeForm.story,
            details: finalizeForm.details ?? finalizeForm.description,
            provenance: finalizeForm.provenance,
            hypeSentence: finalizeForm.hypeSentence,
            value: finalizeForm.value,
            assetDetails: finalizeForm.assetDetails,
            reservePrice: finalizeForm.reservePrice || undefined,
            startingBidPrice: finalizeForm.startingBidPrice || undefined,
            imageGallery: onlyProductImages(finalizeForm.imageGallery),
          },
          token,
        );

        if (!saveResult.success) {
          setError(saveResult.error || 'Failed to save listing');
          return false;
        }
      }

      return true;
    },
    [finalizeForm, finalizeListing, onlyProductImages],
  );

  const handleSaveFinalize = useCallback(async () => {
    if (!finalizeListing) return;

    try {
      setIsFinalizeSubmitting(true);
      setFinalizeFeedback({ status: 'idle', message: '' });
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const saved = await persistFinalizeUpdates(token);
      if (!saved) {
        setFinalizeFeedback({
          status: 'error',
          message: 'We couldn’t save your changes. Please fix any errors and try again.',
        });
        return;
      }

      await load();
      setFinalizeFeedback({
        status: 'success',
        message: 'Changes saved as draft.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save listing');
      setFinalizeFeedback({
        status: 'error',
        message: 'Something went wrong while saving your draft.',
      });
    } finally {
      setIsFinalizeSubmitting(false);
    }
  }, [finalizeListing, getAccessToken, load, persistFinalizeUpdates]);

  const handleSubmitFinalize = useCallback(async () => {
    if (!finalizeListing) return;

    try {
      setIsFinalizeSubmitting(true);
      setFinalizeFeedback({ status: 'idle', message: '' });
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const saved = await persistFinalizeUpdates(token);
      if (!saved) {
        setFinalizeFeedback({
          status: 'error',
          message: 'We couldn’t submit your details. Please fix any errors and try again.',
        });
        return;
      }

      // Check if this is a temporary listing (no real listing exists yet)
      const isTempListing = finalizeListing.id.startsWith('temp-');

      if (isTempListing) {
        // For temporary listings (no listing created yet), we've already saved the submission details
        // The submission is now ready for admin review - they will create the listing when they review it
        console.log('[DEBUG] Submission details saved, ready for admin review');
      } else {
        // For existing listings, finalize the details
        const finalizeResult = await ListingsApi.finalizeUserDetails(finalizeListing.id, token);
        if (!finalizeResult.success) {
          setError(finalizeResult.error || 'Failed to finalize details');
          setFinalizeFeedback({
            status: 'error',
            message: 'We couldn’t submit your details. Please try again.',
          });
          return;
        }
      }

      await load();
      handleCloseFinalize();
      setShowFinalizeSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize details');
      setFinalizeFeedback({
        status: 'error',
        message: 'We couldn’t submit your details. Please try again.',
      });
    } finally {
      setIsFinalizeSubmitting(false);
    }
  }, [
    finalizeListing,
    getAccessToken,
    handleCloseFinalize,
    load,
    persistFinalizeUpdates,
    finalizeForm,
    onlyProductImages,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleListingsUpdated = () => {
      load();
    };

    window.addEventListener('aces:simple-listings:updated', handleListingsUpdated);
    return () => {
      window.removeEventListener('aces:simple-listings:updated', handleListingsUpdated);
    };
  }, [load]);

  const [isOffersOpen, setIsOffersOpen] = useState(false);

  const renderSubmissions = (rows: SubmissionRow[]) => {
    return (
      <div className="bg-[#0A120B] rounded-lg border-t border-dashed border-[#D7BF75]/25 relative h-full">
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
              Your Submissions
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-[#D7BF75]/10 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-[#DCDDCC]/70 text-sm py-6">
              No submissions require your attention.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dashed border-[#D7BF75]/25">
                    <th className="text-left text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      RWA / Ticker
                    </th>
                    <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      Status
                    </th>
                    <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      Submitted
                    </th>
                    <th className="text-right text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const { submission, listing, stage } = row;
                    const meta = stageMetadata[stage];
                    const actions = buildActions(row);

                    const primaryImage =
                      listing?.imageGallery?.[0] ||
                      submission.imageGallery?.[0] ||
                      '/placeholder.svg';
                    const title = submission.title || listing?.title || submission.symbol;
                    const symbol = submission.symbol || listing?.symbol || 'N/A';
                    const submittedDate = new Date(submission.createdAt).toLocaleDateString(
                      'en-US',
                      {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      },
                    );

                    return (
                      <tr
                        key={submission.id}
                        className="border-b border-dashed border-[#D7BF75]/10"
                      >
                        <td className="py-4 px-2">
                          <div className="flex items-center space-x-3">
                            <Image
                              src={primaryImage}
                              alt={title}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                            />
                            <div className="min-w-0">
                              <div className="text-[#E6E3D3] text-sm font-medium truncate">
                                {title}
                              </div>
                              <div className="text-[#E6E3D3] font-mono text-xs">${symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge
                              className={`flex items-center gap-1 text-xs font-medium ${meta.badgeClass}`}
                            >
                              <meta.Icon className="w-3 h-3" />
                              {meta.label}
                            </Badge>
                            {stage === 'REJECTED' && submission.rejectionReason && (
                              <div className="text-xs text-red-300 max-w-xs">
                                {submission.rejectionReason}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center">
                          <span className="text-[#E6E3D3] text-sm">{submittedDate}</span>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="flex items-center justify-end">
                            {actions.length === 0 ? (
                              <span className="text-[#DCDDCC]/60 text-xs">No actions</span>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-[#D0B284] hover:bg-[#D0B284]/10"
                                    aria-label="Submission actions"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-[#0f1511] border border-[#D7BF75]/20 text-[#E6E3D3] w-48"
                                >
                                  {actions.map((action) => (
                                    <DropdownMenuItem
                                      key={action.label}
                                      onSelect={() => {
                                        if (!action.disabled) {
                                          action.handler();
                                        }
                                      }}
                                      className="flex items-center gap-2 text-sm focus:bg-[#D7BF75]/10"
                                      disabled={action.disabled}
                                    >
                                      <action.icon className="w-4 h-4" />
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-2">
      {/* Offers Modal */}
      {/* Staged submissions */}
      {shouldRenderSubmissionCard && renderSubmissions(visibleRows)}

      {/* Listings section handles approved → finalize → launch flow and shows live listings */}
      <div id="simple-listings-section">
        <SimpleListingsTab defaultShowPending={true} />
      </div>

      {/* Read-only submission details */}
      {viewingSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="bg-[#0f1511] rounded-2xl border border-[#D7BF75]/25 w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-[#D7BF75]/15">
                <h3 className="text-[#D0B284] text-lg font-semibold">
                  {viewingSubmission.submission.title || viewingSubmission.submission.symbol}
                </h3>
                <button
                  onClick={closeSubmissionDetails}
                  className="text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10 rounded p-1"
                  aria-label="Close submission details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
                {viewingSubmission.loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, idx) => (
                      <div key={idx} className="h-10 bg-[#D7BF75]/10 rounded" />
                    ))}
                  </div>
                ) : viewingSubmission.error ? (
                  <div className="text-red-400 text-sm">{viewingSubmission.error}</div>
                ) : (
                  (() => {
                    const details = viewingSubmission.details || viewingSubmission.submission;
                    const imageGallery: string[] = details.imageGallery || [];
                    const infoPairs: Array<{ label: string; value?: string | null }> = [
                      { label: 'Status', value: details.status },
                      { label: 'Symbol', value: details.symbol },
                      { label: 'Brand', value: details.brand },
                      { label: 'Location', value: details.location },
                      { label: 'Reserve Price', value: details.reservePrice },
                      { label: 'Declared Value', value: details.value },
                      { label: 'Story', value: details.story || details.details },
                      { label: 'Provenance', value: details.provenance },
                      { label: 'Hype Sentence', value: details.hypeSentence },
                    ];

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {infoPairs
                            .filter((pair) => pair.value)
                            .map((pair) => (
                              <div key={pair.label} className="space-y-1">
                                <div className="text-[#D0B284] text-xs uppercase tracking-wide">
                                  {pair.label}
                                </div>
                                <div className="text-[#E6E3D3] text-sm whitespace-pre-line">
                                  {pair.value}
                                </div>
                              </div>
                            ))}
                        </div>

                        {imageGallery.length > 0 && (
                          <div>
                            <div className="text-[#D0B284] text-xs uppercase tracking-wide mb-3">
                              Images
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {imageGallery.map((url) => (
                                <div
                                  key={url}
                                  className="relative aspect-square overflow-hidden rounded-lg border border-[#D7BF75]/20"
                                >
                                  <Image
                                    src={url}
                                    alt={details.title || details.symbol}
                                    fill
                                    sizes="200px"
                                    className="object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
        </div>
      ) : null}

      {/* Editable finalize modal */}
      {isFinalizeOpen && finalizeListing ? (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md overflow-y-auto">
            <div className="min-h-full flex justify-center px-4 py-10">
              <div className="relative w-full max-w-6xl rounded-3xl border border-[#D7BF75]/25 bg-[#0f1511] shadow-2xl">
              <div className="flex items-start justify-between p-6 border-b border-[#D7BF75]/15">
                <div>
                  <h3 className="text-[#D0B284] text-xl font-semibold">
                    {isFinalizeReadOnly ? 'Listing Details' : 'Edit & Finalize Listing Details'}
                  </h3>
                  <p className="text-xs text-[#DCDDCC]/70 mt-1">
                    {finalizeListing.title} • {finalizeListing.symbol}
                  </p>
                  {!isFinalizeReadOnly && (
                    <p className="text-xs text-orange-300 mt-2 flex items-center gap-1">
                      <Edit className="w-3 h-3" />
                      You can now edit all fields below
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseFinalize}
                  className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
                  aria-label="Close finalize modal"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-6">
                {(isFinalizeSubmitting || finalizeFeedback.status !== 'idle') && (
                  <div className="space-y-3">
                    {isFinalizeSubmitting && (
                      <div className="flex items-center gap-2 rounded-md border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-sm text-purple-100">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Finalizing your listing details...
                      </div>
                    )}
                    {!isFinalizeSubmitting && finalizeFeedback.status !== 'idle' && (
                      <div
                        className={`rounded-md border px-3 py-2 text-sm ${
                          finalizeFeedback.status === 'success'
                            ? 'border-green-400/40 bg-green-500/10 text-green-200'
                            : 'border-red-400/40 bg-red-500/10 text-red-200'
                        }`}
                      >
                        {finalizeFeedback.message}
                      </div>
                    )}
                  </div>
                )}

                <fieldset
                  disabled={isFinalizeReadOnly}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  <div className="space-y-4">
                    <div>
                      <Label className="text-[#D0B284]">Asset Title</Label>
                      <Input
                        value={finalizeForm.title}
                        onChange={(e) =>
                          setFinalizeForm((prev) => ({
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
                          value={finalizeForm.symbol}
                          onChange={(e) => {
                            const next = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                            setFinalizeForm((prev) => ({
                              ...prev,
                              symbol: next,
                            }));
                            if (symbolCheckTimeout.current) {
                              window.clearTimeout(symbolCheckTimeout.current);
                              symbolCheckTimeout.current = null;
                            }
                            setSymbolCheck({ status: 'checking' });
                            symbolCheckTimeout.current = window.setTimeout(async () => {
                              try {
                                if (!next) {
                                  setSymbolCheck({ status: 'idle' });
                                  return;
                                }
                                const res = await ListingsApi.getListingBySymbol(next);
                                if ((res as any).success && (res as any).data) {
                                  setSymbolCheck({
                                    status: 'taken',
                                    message: 'Symbol already exists',
                                  });
                                } else {
                                  setSymbolCheck({
                                    status: 'available',
                                    message: 'Symbol available',
                                  });
                                }
                              } catch (err) {
                                setSymbolCheck({ status: 'available' });
                              }
                            }, 400);
                          }}
                          className="mt-1 bg-black/30 border-[#D0B284]/20 text-white font-mono pl-7"
                        />
                        {symbolCheck.status !== 'idle' && (
                          <div className="mt-1 text-xs">
                            {symbolCheck.status === 'checking' && (
                              <span className="text-[#D0B284]">Checking availability…</span>
                            )}
                            {symbolCheck.status === 'available' && (
                              <span className="text-green-400">Symbol available</span>
                            )}
                            {symbolCheck.status === 'taken' && (
                              <span className="text-red-400">Symbol already in use</span>
                            )}
                            {symbolCheck.status === 'error' && (
                              <span className="text-yellow-300">Could not verify symbol</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[#D0B284]">Brand</Label>
                      <Input
                        value={finalizeForm.brand ?? ''}
                        onChange={(e) =>
                          setFinalizeForm((prev) => ({
                            ...prev,
                            brand: e.target.value,
                          }))
                        }
                        className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[#D0B284]">Location</Label>
                      <Input
                        value={finalizeForm.location ?? ''}
                        onChange={(e) =>
                          setFinalizeForm((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[#D0B284]">Story</Label>
                      <Textarea
                        value={finalizeForm.story ?? ''}
                        onChange={(e) =>
                          setFinalizeForm((prev) => ({
                            ...prev,
                            story: e.target.value,
                          }))
                        }
                        className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                        rows={4}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-[#D0B284]">Details</Label>
                      <Textarea
                        value={finalizeForm.details ?? ''}
                        onChange={(e) =>
                          setFinalizeForm((prev) => ({
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
                        value={finalizeForm.provenance ?? ''}
                        onChange={(e) =>
                          setFinalizeForm((prev) => ({
                            ...prev,
                            provenance: e.target.value,
                          }))
                        }
                        className="mt-1 bg-black/30 border-[#D0B284]/20 text-white"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="text-[#D0B284]">Hype Sentence</Label>
                      <Input
                        value={finalizeForm.hypeSentence ?? ''}
                        onChange={(e) =>
                          setFinalizeForm((prev) => ({
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
                              finalizeForm.startingBidPrice
                                ? parseInt(finalizeForm.startingBidPrice, 10).toLocaleString()
                                : ''
                            }
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              setFinalizeForm((prev) => ({
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
                              finalizeForm.reservePrice
                                ? parseInt(finalizeForm.reservePrice, 10).toLocaleString()
                                : ''
                            }
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              setFinalizeForm((prev) => ({
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
                            finalizeForm.value
                              ? parseInt(finalizeForm.value, 10).toLocaleString()
                              : ''
                          }
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setFinalizeForm((prev) => ({
                              ...prev,
                              value: value,
                            }));
                          }}
                          className="mt-1 bg-black/30 border-[#D0B284]/20 text-white pl-7"
                          placeholder="15,000"
                        />
                      </div>
                    </div>
                  </div>
                </fieldset>

                <FinalizeImageGalleryEditor
                  value={finalizeForm.imageGallery}
                  onChange={(gallery) =>
                    setFinalizeForm((prev) => ({
                      ...prev,
                      imageGallery: gallery,
                    }))
                  }
                />

                {!isFinalizeReadOnly && (
                  <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-3 pt-4 border-t border-[#D0B284]/20">
                    <Button
                      variant="ghost"
                      onClick={handleCloseFinalize}
                      className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                    >
                      Cancel
                    </Button>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleSaveFinalize}
                        disabled={isFinalizeSubmitting}
                        className="bg-[#231F20] hover:bg-[#231F20]/80 text-[#D0B284] border border-[#D0B284]/30"
                      >
                        {isFinalizeSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Draft
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleSubmitFinalize}
                        disabled={isFinalizeSubmitting || symbolCheck.status === 'taken'}
                        className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
                      >
                        {isFinalizeSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Submit for Review
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={showFinalizeSuccess} onOpenChange={setShowFinalizeSuccess}>
        <DialogContent className="bg-[#101710] border border-[#D7BF75]/30 text-[#DCDDCC]">
          <DialogHeader>
            <DialogTitle className="text-[#D0B284]">Details submitted</DialogTitle>
            <DialogDescription className="text-[#DCDDCC]/80">
              An admin will review your listing and prepare the token parameters. We’ll let you know
              when it’s time to launch your token.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              onClick={() => setShowFinalizeSuccess(false)}
              className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
