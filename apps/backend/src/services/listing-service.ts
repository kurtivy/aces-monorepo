// backend/src/services/listing-service.ts - V1 Clean Implementation
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, Prisma, User } from '@prisma/client';
import { AssetType, SubmissionStatus } from '../lib/prisma-enums';
import { ProductStorageService } from '../lib/product-storage-utils';
import { errors } from '../lib/errors';
import {
  NotificationService,
  NotificationType,
  NotificationTemplates,
} from './notification-service';
import { AerodromeDataService, AerodromePoolState } from './aerodrome-data-service';
import { createProvider, getNetworkConfig } from '../config/network.config';

// Type for listings with relations - using simpler type due to TypeScript language server caching
type ListingWithRelations = {
  id: string;
  title: string;
  symbol: string;
  description: string;
  assetType: keyof typeof AssetType;
  imageGallery: string[];
  location: string | null;
  email: string | null;
  isLive: boolean;
  launchDate: Date | null;
  submissionId: string;
  ownerId: string;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: User;
  submission: any; // Will be properly typed when language server updates
  approvedByUser?: User | null;
  token?: {
    id: string;
    contractAddress: string;
    symbol: string;
    name: string;
    decimals: number;
    currentPrice: string;
    currentPriceACES: string;
    volume24h: string;
    phase: string;
    isActive: boolean;
    holderCount?: number | null;
    holdersCount?: number | null;
    chainId?: number | null;
  } | null;
  dex?: {
    poolAddress: string | null;
    isDexLive: boolean;
    dexLiveAt: Date | null;
    priceSource: string;
    lastUpdated: Date | null;
    bondingCutoff: Date | null;
  } | null;
  commentCount?: number | null;
};

// Type for listings with minimal submission data
type ListingWithMinimalSubmission = {
  id: string;
  title: string;
  symbol: string;
  description: string;
  assetType: keyof typeof AssetType;
  imageGallery: string[];
  location: string | null;
  email: string | null;
  isLive: boolean;
  launchDate: Date | null;
  submissionId: string;
  ownerId: string;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    privyDid: string;
    walletAddress: string | null;
    email: string | null;
  };
  submission: {
    id: string;
    status: keyof typeof SubmissionStatus;
    createdAt: Date;
  };
  approvedByUser?: {
    id: string;
    privyDid: string;
  } | null;
  token?: ListingWithRelations['token'];
  dex?: ListingWithRelations['dex'];
  commentCount?: number | null;
};

export interface CreateListingFromSubmissionRequest {
  submissionId: string;
  adminId: string;
}

export interface UpdateListingRequest {
  title?: string;
  symbol?: string;
  description?: string;
  assetType?: keyof typeof AssetType;
  imageGallery?: string[];
  location?: string;
  email?: string;
  launchDate?: Date | null;
}

export interface OwnerUpdateListingRequest {
  title?: string;
  symbol?: string;
  brand?: string | null;
  story?: string | null;
  details?: string | null;
  provenance?: string | null;
  value?: string | null;
  reservePrice?: string | null;
  hypeSentence?: string | null;
  assetType?: keyof typeof AssetType;
  imageGallery?: string[];
  location?: string | null;
  assetDetails?: Record<string, string>;
  startingBidPrice?: string | null;
}

export class ListingService {
  private notificationService: NotificationService;
  private aerodromeDataService?: AerodromeDataService;

  constructor(
    private prisma: PrismaClient,
    notificationService?: NotificationService,
  ) {
    this.notificationService = notificationService || new NotificationService(prisma);

    const mainnetConfig = getNetworkConfig(8453);
    const provider = createProvider(8453);
    const shouldMock =
      process.env.USE_DEX_MOCKS === 'true' ||
      !mainnetConfig.rpcUrl ||
      !mainnetConfig.aerodromeFactory ||
      !mainnetConfig.aerodromeRouter;

    try {
      this.aerodromeDataService = new AerodromeDataService({
        provider: provider ?? undefined,
        rpcUrl: provider ? undefined : mainnetConfig.rpcUrl,
        factoryAddress: mainnetConfig.aerodromeFactory,
        acesTokenAddress: mainnetConfig.acesToken,
        apiBaseUrl: process.env.AERODROME_API_BASE_URL,
        apiKey: process.env.AERODROME_API_KEY,
        defaultStable: process.env.AERODROME_DEFAULT_STABLE === 'true',
        mockEnabled: shouldMock,
      });
    } catch (error) {
      console.error('[ListingService] Failed to initialize AerodromeDataService:', error);
      this.aerodromeDataService = undefined;
    }
  }

  /**
   * Create a listing from an approved submission
   */
  async createListingFromSubmission(
    submissionId: string,
    adminId: string,
  ): Promise<ListingWithRelations> {
    try {
      // Get the approved submission with all necessary data
      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true,
        },
      });

      if (!submission) {
        throw errors.notFound('Submission not found');
      }

      if (submission.status !== SubmissionStatus.APPROVED) {
        throw errors.validation(
          `Cannot create listing from submission with status: ${submission.status}. Submission must be approved first.`,
        );
      }

      // Check if listing already exists for this submission
      const existingListing = await (this.prisma as any).listing.findUnique({
        where: { submissionId: submissionId },
      });

      if (existingListing) {
        throw errors.validation('Listing already exists for this submission');
      }

      // Create the listing with data from the approved submission
      const listing = await (this.prisma as any).listing.create({
        data: {
          title: submission.title,
          symbol: submission.symbol,
          brand: submission.brand || null,
          story: submission.story || null,
          details: submission.details || null,
          provenance: submission.provenance || null,
          value: submission.value || null,
          reservePrice: submission.reservePrice || null,
          hypeSentence: submission.hypeSentence || null,
          assetType: submission.assetType,
          imageGallery: submission.imageGallery,
          location: submission.location,
          isLive: false, // Always start as not live
          submissionId: submission.id,
          ownerId: submission.ownerId,
          approvedBy: adminId,
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
        },
      });

      // Create notification for user about listing approval
      try {
        const template = NotificationTemplates[NotificationType.LISTING_APPROVED];
        await this.notificationService.createNotification({
          userId: submission.ownerId,
          listingId: listing.id,
          type: NotificationType.LISTING_APPROVED,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl(listing.id),
        });
      } catch (notificationError) {
        console.error('Error creating listing approved notification:', notificationError);
        // Don't fail the listing creation if notification fails
      }

      return listing;
    } catch (error) {
      console.error('Error creating listing from submission:', error);
      throw error;
    }
  }

  /**
   * Update listing details (admin only)
   */
  async updateListing(
    listingId: string,
    data: UpdateListingRequest,
    _adminId: string,
  ): Promise<ListingWithRelations> {
    try {
      const listing = await (this.prisma as any).listing.update({
        where: { id: listingId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
        },
      });

      return listing;
    } catch (error) {
      console.error('Error updating listing:', error);
      throw error;
    }
  }

  /**
   * Update listing details by owner (pre-launch only)
   */
  async updateListingByOwner(
    listingId: string,
    data: OwnerUpdateListingRequest,
    ownerId: string,
  ): Promise<ListingWithRelations> {
    try {
      const listing = await (this.prisma as any).listing.findUnique({ where: { id: listingId } });

      if (!listing) {
        throw errors.notFound('Listing not found');
      }

      if (listing.ownerId !== ownerId) {
        throw errors.forbidden('You do not have permission to update this listing');
      }

      if (listing.isLive) {
        throw errors.validation('Cannot update listing after it is live');
      }

      const updated = await (this.prisma as any).listing.update({
        where: { id: listingId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
        },
      });

      return updated;
    } catch (error) {
      console.error('Error updating listing by owner:', error);
      throw error;
    }
  }

  /**
   * Set listing live status (admin only)
   */
  async setListingLive(
    listingId: string,
    isLive: boolean,
    _adminId: string,
  ): Promise<ListingWithRelations> {
    try {
      const listing = await (this.prisma as any).listing.update({
        where: { id: listingId },
        data: {
          isLive,
          updatedAt: new Date(),
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
        },
      });

      return listing;
    } catch (error) {
      console.error('Error updating listing live status:', error);
      throw error;
    }
  }

  /**
   * Set listing launch date (admin only)
   */
  async setListingLaunchDate(
    listingId: string,
    launchDate: Date | null,
    _adminId: string,
  ): Promise<ListingWithRelations> {
    try {
      const listing = await (this.prisma as any).listing.update({
        where: { id: listingId },
        data: {
          launchDate,
          updatedAt: new Date(),
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
        },
      });

      return listing;
    } catch (error) {
      console.error('Error updating listing launch date:', error);
      throw error;
    }
  }

  /**
   * Get all live listings (public endpoint)
   */
  async getLiveListings(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: ListingWithMinimalSubmission[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: any = { isLive: true };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const listings = await (this.prisma as any).listing.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              privyDid: true,
              walletAddress: true,
              email: true,
            },
          },
          submission: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
          },
          approvedByUser: {
            select: {
              id: true,
              privyDid: true,
            },
          },
          // Include token relationship
          token: {
            select: {
              id: true,
              contractAddress: true,
              symbol: true,
              name: true,
              decimals: true,
              currentPrice: true,
              currentPriceACES: true,
              volume24h: true,
              phase: true,
              isActive: true,
              poolAddress: true,
              dexLiveAt: true,
              priceSource: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Take one extra to check for more
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      const enriched = await Promise.all(
        data.map((listing: any) => this.prepareListingForResponse(listing, true)),
      );

      return { data: enriched, nextCursor, hasMore };
    } catch (error) {
      console.error('Error fetching live listings:', error);
      throw error;
    }
  }

  /**
   * Get all listings (admin only)
   */
  async getAllListings(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: ListingWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where: any = {};

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const listings = await (this.prisma as any).listing.findMany({
        where,
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
          token: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      const enriched = await Promise.all(
        data.map((listing: any) => this.prepareListingForResponse(listing)),
      );

      return { data: enriched, nextCursor, hasMore };
    } catch (error) {
      console.error('Error fetching all listings:', error);
      throw error;
    }
  }

  /**
   * Get pending listings (not live yet)
   */
  async getPendingListings(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: ListingWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where: any = { isLive: false };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const listings = await (this.prisma as any).listing.findMany({
        where,
        include: {
          owner: true,
          token: true,
          submission: true,
          approvedByUser: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      const enriched = await Promise.all(
        data.map((listing: any) => this.prepareListingForResponse(listing)),
      );

      return { data: enriched, nextCursor, hasMore };
    } catch (error) {
      console.error('Error fetching pending listings:', error);
      throw error;
    }
  }

  /**
   * Get listing by ID
   */
  async getListingById(listingId: string): Promise<ListingWithRelations | null> {
    try {
      const listing = await (this.prisma as any).listing.findUnique({
        where: { id: listingId },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
          token: true,
          _count: {
            select: {
              comments: true,
            },
          },
        },
      });

      if (!listing) {
        return null;
      }

      return this.prepareListingForResponse(listing, true);
    } catch (error) {
      console.error('Error fetching listing by ID:', error);
      throw error;
    }
  }

  /**
   * Get listing by symbol (case-insensitive)
   */
  async getListingBySymbol(symbol: string): Promise<ListingWithRelations | null> {
    try {
      const listing = await (this.prisma as any).listing.findFirst({
        where: {
          symbol: {
            equals: symbol,
            mode: 'insensitive',
          },
        },
        include: {
          owner: true,
          submission: true,
          approvedByUser: true,
          token: true, // Token includes dexLiveAt, poolAddress, etc.
          _count: {
            select: {
              comments: true,
            },
          },
        },
      });

      if (!listing) {
        return null;
      }

      return this.prepareListingForResponse(listing, true);
    } catch (error) {
      console.error('Error fetching listing by symbol:', error);
      throw error;
    }
  }

  /**
   * Get listings by owner
   */
  async getListingsByOwner(
    ownerId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: ListingWithMinimalSubmission[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: any = { ownerId };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const listings = await (this.prisma as any).listing.findMany({
        where,
        include: {
          owner: true,
          submission: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
          },
          approvedByUser: true,
          token: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      const enriched = await Promise.all(
        data.map((listing: any) => this.prepareListingForResponse(listing)),
      );

      return { data: enriched, nextCursor, hasMore };
    } catch (error) {
      console.error('Error fetching listings by owner:', error);
      throw error;
    }
  }

  /**
   * Delete listing (admin only)
   */
  async deleteListing(listingId: string): Promise<void> {
    try {
      await (this.prisma as any).listing.delete({
        where: { id: listingId },
      });
    } catch (error) {
      console.error('Error deleting listing:', error);
      throw error;
    }
  }

  /**
   * Get all listings for admin dashboard
   */
  async getAllListingsForAdmin(): Promise<any[]> {
    try {
      const listings = await (this.prisma as any).listing.findMany({
        include: {
          owner: {
            include: {
              accountVerification: true,
            },
          },
          submission: true,
          approvedByUser: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const enriched = await Promise.all(
        listings.map((listing: any) => this.prepareListingForResponse(listing)),
      );

      return enriched;
    } catch (error) {
      console.error('Error fetching all listings for admin:', error);
      throw error;
    }
  }

  private async prepareListingForResponse(listing: any, includeDex = false): Promise<any> {
    const commentCount = listing?._count?.comments ?? listing?.commentCount ?? null;

    const safeListing = {
      ...listing,
      commentCount,
      imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery),
    };

    if ('_count' in safeListing) {
      delete (safeListing as { _count?: unknown })._count;
    }

    if (!includeDex) {
      return safeListing;
    }

    return this.attachDexState(safeListing);
  }

  private async attachDexState(listing: any): Promise<any> {
    const token = listing.token ? { ...listing.token } : undefined;

    let poolState: AerodromePoolState | null = null;
    if (token?.contractAddress && this.aerodromeDataService) {
      try {
        poolState = await this.aerodromeDataService.getPoolState(token.contractAddress);
      } catch (error) {
        console.warn(
          `[ListingService] Failed to fetch pool state for ${token.contractAddress}:`,
          error,
        );
      }
    }

    const initialPoolAddress = token?.poolAddress ?? null;
    const hasStoredDexPhase = (token?.phase ?? 'BONDING_CURVE') === 'DEX_TRADING';

    const resolvedPoolAddress = poolState?.poolAddress ?? initialPoolAddress ?? null;
    const isDexLive = !!poolState || hasStoredDexPhase || !!resolvedPoolAddress;
    const lastUpdated = poolState ? new Date(poolState.lastUpdated).toISOString() : null;
    const dexLiveAt = poolState ? lastUpdated : (token?.dexLiveAt ?? null);
    const priceSource = isDexLive ? 'DEX' : 'BONDING_CURVE';

    if (token) {
      token.phase = isDexLive ? 'DEX_TRADING' : (token.phase ?? 'BONDING_CURVE');
      (token as any).priceSource = priceSource;
      (token as any).poolAddress = resolvedPoolAddress;
      (token as any).dexLiveAt = dexLiveAt;
    }

    const dexMeta = {
      isDexLive,
      poolAddress: resolvedPoolAddress,
      dexLiveAt,
      priceSource,
      lastUpdated,
      bondingCutoff: dexLiveAt,
    };

    return {
      ...listing,
      token,
      dex: dexMeta,
    };
  }
}
