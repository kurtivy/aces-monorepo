// backend/src/services/listing-service.ts - V1 Clean Implementation
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
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
import { TokenParameters } from '@aces/utils';
import { TokenService } from './token-service';
import { EmailService } from '../lib/email-service';
import { ethers } from 'ethers';

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
    private fastify?: FastifyInstance,
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
        fastify: this.fastify,
      });
    } catch (error) {
      // console.error('[ListingService] Failed to initialize AerodromeDataService:', error);
      this.aerodromeDataService = undefined;
    }
  }

  private addSubmissionAlias<T extends { submissionId?: string; rwaSubmissionId?: string }>(
    listing: T,
  ): T & { rwaSubmissionId: string | null } {
    if (!listing) {
      return listing as T & { rwaSubmissionId: string | null };
    }

    const rwaSubmissionId = (listing as any).rwaSubmissionId ?? listing.submissionId ?? null;

    return {
      ...listing,
      rwaSubmissionId,
    };
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
          tokenCreationStatus: 'AWAITING_USER_DETAILS', // Set initial token creation status
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

      return this.addSubmissionAlias(listing);
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

      return this.addSubmissionAlias(listing);
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

      return this.addSubmissionAlias(updated);
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

      return this.addSubmissionAlias(listing);
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

      return this.addSubmissionAlias(listing);
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

    // Add timeout to signed URL generation (max 5 seconds)
    let imageGallery: string[];
    try {
      imageGallery = await Promise.race([
        ProductStorageService.convertToSignedUrls(listing.imageGallery),
        new Promise<string[]>((_, reject) =>
          setTimeout(() => reject(new Error('Signed URL timeout')), 5000),
        ),
      ]);
    } catch (error) {
      // console.warn('[ListingService] Failed to convert image URLs, using originals:', error);
      // Fallback to original URLs if signed URL generation fails or times out
      imageGallery = listing.imageGallery || [];
    }

    const safeListing = this.addSubmissionAlias({
      ...listing,
      commentCount,
      imageGallery,
    });

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
        // Add timeout to pool state fetch (max 3 seconds)
        poolState = await Promise.race([
          this.aerodromeDataService.getPoolState(token.contractAddress),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
      } catch (error) {
        // console.warn(
        //   `[ListingService] Failed to fetch pool state for ${token.contractAddress}:`,
        //   error,
        // );
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

  /**
   * Finalize user details - User confirms listing ready for admin review
   */
  async finalizeUserDetails(listingId: string, userId: string) {
    // Verify listing exists and user owns it
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });

    if (!listing) {
      throw errors.notFound('Listing');
    }

    if (listing.ownerId !== userId) {
      throw errors.forbidden('You do not own this listing');
    }

    // Check if listing is in correct status
    // Allow null status for backwards compatibility with existing listings
    if (listing.tokenCreationStatus && listing.tokenCreationStatus !== 'AWAITING_USER_DETAILS') {
      throw errors.validation(
        `Listing is not awaiting user details. Current status: ${listing.tokenCreationStatus}`,
      );
    }

    // Update status to PENDING_ADMIN_REVIEW
    const updatedListing = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        tokenCreationStatus: 'PENDING_ADMIN_REVIEW',
        updatedAt: new Date(),
      },
      include: {
        owner: true,
        submission: true,
      },
    });

    // console.log(`[ListingService] Listing ${listingId} finalized by user, pending admin review`);

    return this.addSubmissionAlias(updatedListing);
  }

  /**
   * Save token parameters - Admin configures token creation parameters
   */
  async saveTokenParameters(listingId: string, tokenParameters: TokenParameters) {
    // Verify listing exists
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw errors.notFound('Listing');
    }

    // Update tokenParameters
    const updatedListing = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        tokenParameters: tokenParameters as any, // Prisma Json type
        updatedAt: new Date(),
      },
      include: {
        owner: true,
        submission: true,
      },
    });

    // console.log(`[ListingService] Token parameters saved for listing ${listingId}`);

    return this.addSubmissionAlias(updatedListing);
  }

  /**
   * Prepare for minting - Admin finalizes, predicts addresses, adds to DB, notifies user
   */
  async prepareForMinting(listingId: string) {
    // Verify listing exists and has token parameters
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });

    if (!listing) {
      throw errors.notFound('Listing');
    }

    if (!listing.tokenParameters) {
      throw {
        statusCode: 400,
        code: 'MISSING_TOKEN_PARAMETERS',
        message: 'Token parameters must be configured before preparing for minting',
      };
    }

    const tokenParams = listing.tokenParameters as any;

    // Ensure name and symbol are set (use listing values as fallback)
    if (!tokenParams.name) {
      tokenParams.name = listing.title;
    }
    if (!tokenParams.symbol) {
      tokenParams.symbol = listing.symbol;
    }

    // console.log(`[ListingService] Preparing listing ${listingId} for minting...`);
    // console.log(`[ListingService] Token params:`, {
    //   curve: tokenParams.curve,
    //   steepness: tokenParams.steepness,
    //   floor: tokenParams.floor,
    //   name: tokenParams.name,
    //   symbol: tokenParams.symbol,
    //   salt: tokenParams.salt,
    //   tokensBondedAt: tokenParams.tokensBondedAt,
    //   chainId: tokenParams.chainId,
    // });

    try {
      // Step 1: Get the predicted token address
      // If it was already predicted during salt mining, use that
      // Otherwise, try to predict it using the factory contract
      let predictedTokenAddress: string;

      if (tokenParams.predictedAddress) {
        // console.log(`[ListingService] Using pre-computed predicted address from salt mining`);
        predictedTokenAddress = tokenParams.predictedAddress;
      } else {
        // console.log(`[ListingService] Predicting token address using factory contract...`);
        predictedTokenAddress = await this.predictTokenAddress(tokenParams);
      }

      // console.log(`[ListingService] Predicted token address: ${predictedTokenAddress}`);

      // Step 2: Predict the pool address (token paired with ACES)
      const predictedPoolAddress = await this.predictPoolAddress(predictedTokenAddress);
      // console.log(`[ListingService] Predicted pool address: ${predictedPoolAddress}`);

      // Step 3: Add token to database with predicted addresses
      const tokenService = new TokenService(this.prisma);

      // Check if token already exists
      let token = await this.prisma.token.findUnique({
        where: { contractAddress: predictedTokenAddress.toLowerCase() },
      });

      if (!token) {
        // Create token with predicted data
        token = await this.prisma.token.create({
          data: {
            contractAddress: predictedTokenAddress.toLowerCase(),
            symbol: tokenParams.symbol || listing.symbol,
            name: tokenParams.name || listing.title,
            decimals: 18, // Standard for ERC20
            currentPrice: '0',
            currentPriceACES: '0',
            volume24h: '0',
            phase: 'BONDING_CURVE', // Starts in bonding phase
            isActive: false, // Not active until minted
            chainId: tokenParams.chainId || 8453, // Base Mainnet
            poolAddress: predictedPoolAddress?.toLowerCase() || null,
            listingId: listingId, // Link to listing
          },
        });
        // console.log(`[ListingService] Token added to database: ${token.contractAddress}`);
      } else {
        // Update existing token with pool address and listing link
        token = await this.prisma.token.update({
          where: { contractAddress: predictedTokenAddress.toLowerCase() },
          data: {
            poolAddress: predictedPoolAddress?.toLowerCase() || null,
            listingId: listingId,
          },
        });
        // console.log(`[ListingService] Token updated in database: ${token.contractAddress}`);
      }

      // Step 4: Update listing status to READY_TO_MINT
      const updatedListing = await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          tokenCreationStatus: 'READY_TO_MINT',
          updatedAt: new Date(),
        },
        include: {
          owner: true,
          submission: true,
          token: true,
        },
      });

      // Step 5: Send notification and email to user
      const notificationService = new NotificationService(this.prisma);
      const emailService = new EmailService();

      try {
        await notificationService.createNotification({
          userId: listing.ownerId,
          listingId: listing.id,
          type: NotificationType.READY_TO_MINT,
          title: 'Your token is ready to mint!',
          message: `Your listing "${listing.title}" has been configured and is ready for you to mint the token.`,
          actionUrl: `/profile`,
        });

        // Send email notification
        if (listing.owner.email) {
          await emailService.sendReadyToMintEmail({
            email: listing.owner.email,
            listingTitle: listing.title,
            listingSymbol: listing.symbol,
          });
        }
      } catch (error) {
        // console.error('[ListingService] Failed to send notification/email:', error);
        // Don't fail the operation if notification fails
      }

      // console.log(
      //   `[ListingService] Listing ${listingId} prepared for minting with predicted addresses`,
      // );

      return this.addSubmissionAlias(updatedListing);
    } catch (error) {
      console.error('[ListingService] Error preparing for minting:', error);
      throw error;
    }
  }

  /**
   * Predict token address using CREATE2
   */
  private async predictTokenAddress(tokenParams: any): Promise<string> {
    const chainId = tokenParams.chainId || 8453;
    const networkConfig = getNetworkConfig(chainId as 8453 | 84532);
    const provider = createProvider(chainId as 8453 | 84532);

    if (!provider) {
      throw new Error('Failed to create provider');
    }

    if (!networkConfig.acesFactoryProxy) {
      throw new Error('Factory address not configured');
    }

    const factoryAbi = [
      'function predictTokenAddress(uint8 curve, uint256 steepness, uint256 floor, string name, string symbol, bytes32 salt, uint256 tokensBondedAt) view returns (address)',
    ];

    const factory = new ethers.Contract(networkConfig.acesFactoryProxy, factoryAbi, provider);

    try {
      const predictedAddress = await factory.predictTokenAddress(
        tokenParams.curve,
        tokenParams.steepness,
        tokenParams.floor,
        tokenParams.name,
        tokenParams.symbol,
        tokenParams.salt,
        tokenParams.tokensBondedAt,
      );

      return predictedAddress;
    } catch (error) {
      // console.error('[ListingService] Error predicting token address:', error);
      throw new Error('Failed to predict token address');
    }
  }

  /**
   * Predict pool address on Aerodrome (token paired with ACES)
   */
  private async predictPoolAddress(tokenAddress: string): Promise<string | null> {
    try {
      const ACES_TOKEN_ADDRESS = '0x55337650856299363c496065C836B9C6E9dE0367'; // Base Mainnet ACES
      const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da'; // Base Mainnet

      const networkConfig = getNetworkConfig(8453); // Base Mainnet
      const provider = createProvider(8453);

      if (!provider) {
        // console.log('[ListingService] Failed to create provider for pool prediction');
        return null;
      }

      const factoryAbi = [
        'function getPair(address tokenA, address tokenB, bool stable) view returns (address)',
      ];

      const factory = new ethers.Contract(AERODROME_FACTORY, factoryAbi, provider);

      // Try volatile pool first (default for RWA tokens)
      const volatilePool = await factory.getPair(tokenAddress, ACES_TOKEN_ADDRESS, false);

      if (volatilePool && volatilePool !== ethers.ZeroAddress) {
        return volatilePool;
      }

      // Fallback: try stable pool
      const stablePool = await factory.getPair(tokenAddress, ACES_TOKEN_ADDRESS, true);

      if (stablePool && stablePool !== ethers.ZeroAddress) {
        return stablePool;
      }

      // Pool doesn't exist yet - return null
      // console.log('[ListingService] Pool does not exist yet for', tokenAddress);
      return null;
    } catch (error) {
      console.error('[ListingService] Error predicting pool address:', error);
      return null;
    }
  }

  /**
   * Complete minting - User has minted the token, link it and go live
   */
  async completeMinting(listingId: string, contractAddress: string, userId: string) {
    // Verify listing exists and user owns it
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });

    if (!listing) {
      throw errors.notFound('Listing');
    }

    if (listing.ownerId !== userId) {
      throw errors.forbidden('You do not own this listing');
    }

    // Check if listing is in correct status
    if (listing.tokenCreationStatus !== 'READY_TO_MINT') {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS',
        message: 'Listing is not ready for minting',
      };
    }

    // Add token to database
    const tokenService = new TokenService(this.prisma);
    const token = await tokenService.getOrCreateToken(contractAddress);
    await tokenService.fetchAndUpdateTokenData(contractAddress);

    // Link token to listing and set isLive = true, status = MINTED
    const updatedListing = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        isLive: true,
        tokenCreationStatus: 'MINTED',
        updatedAt: new Date(),
      },
      include: {
        owner: true,
        submission: true,
        token: true,
      },
    });

    // Update token with listing reference
    await this.prisma.token.update({
      where: { contractAddress: contractAddress.toLowerCase() },
      data: { listingId: listingId },
    });

    // Send success notification and email
    const notificationService = new NotificationService(this.prisma);
    const emailService = new EmailService();

    try {
      await notificationService.createNotification({
        userId: listing.ownerId,
        listingId: listing.id,
        type: NotificationType.TOKEN_MINTED_SUCCESS,
        title: 'Token minted successfully!',
        message: `Your token for "${listing.title}" has been minted and is now live!`,
        actionUrl: `/token/${contractAddress}`,
      });

      // Send email notification
      if (listing.owner.email) {
        await emailService.sendTokenMintedEmail({
          email: listing.owner.email,
          listingTitle: listing.title,
          listingSymbol: listing.symbol,
          contractAddress: contractAddress,
        });
      }
    } catch (error) {
      // console.error('[ListingService] Failed to send notification/email:', error);
      // Don't fail the operation if notification fails
    }

    // console.log(
    //   `[ListingService] Token ${contractAddress} minted for listing ${listingId}, now live`,
    // );

    return {
      listing: updatedListing,
      token,
    };
  }
}
