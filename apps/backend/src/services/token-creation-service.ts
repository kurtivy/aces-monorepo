import { PrismaClient } from '@prisma/client';
import { errors } from '../lib/errors';
import {
  NotificationService,
  NotificationType,
  NotificationTemplates,
} from './notification-service';

export interface UserProvidedDetails {
  additionalImages?: string[];
  technicalSpecifications?: string;
  additionalDescription?: string;
  proofDocuments?: string[];
  [key: string]: string | string[] | number | boolean | undefined; // Allow for flexible additional fields
}

export interface TokenParameters {
  steepness: string;
  floor: string;
  tokensBondedAt: string;
  curve: number; // 0 for exponential, 1 for linear, etc.
  salt?: string;
  useVanityMining?: boolean;
  vanityTarget?: string;
  [key: string]: string | number | boolean | undefined; // Index signature for JSON compatibility
}

export interface MintParameters {
  contractAddress: string;
  steepness: string;
  floor: string;
  tokensBondedAt: string;
  curve: number;
  salt: string;
  name: string;
  symbol: string;
}

export enum TokenCreationStatus {
  AWAITING_USER_DETAILS = 'AWAITING_USER_DETAILS',
  PENDING_ADMIN_REVIEW = 'PENDING_ADMIN_REVIEW',
  READY_TO_MINT = 'READY_TO_MINT',
  MINTED = 'MINTED',
  FAILED = 'FAILED',
}

// Define the base listing type with token fields
export interface ListingWithTokenStatus {
  id: string;
  title: string;
  symbol: string;
  description: string;
  assetType: string;
  imageGallery: string[];
  location: string | null;
  email: string | null;
  isLive: boolean;
  launchDate: Date | null;
  startingBidPrice: string | null;
  reservePrice: string | null;
  tokenCreationStatus: string | null;
  userProvidedDetails: UserProvidedDetails | null;
  tokenParameters: TokenParameters | null;
  submissionId: string;
  ownerId: string;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown; // For additional Prisma fields
}

/**
 * Service for managing the token creation workflow
 */
export class TokenCreationService {
  private notificationService: NotificationService;

  constructor(
    private prisma: PrismaClient,
    notificationService?: NotificationService,
  ) {
    this.notificationService = notificationService || new NotificationService(prisma);
  }

  /**
   * Submit additional details by user for token creation
   */
  async submitUserDetails(
    listingId: string,
    userId: string,
    details: UserProvidedDetails,
  ): Promise<ListingWithTokenStatus> {
    try {
      // Verify the listing exists and belongs to the user
      const listing = await this.prisma.listing.findFirst({
        where: {
          id: listingId,
          ownerId: userId,
        },
      });

      if (!listing) {
        throw errors.notFound('Listing not found or access denied');
      }

      // Check if listing is in the correct status
      const listingWithToken = listing as unknown as ListingWithTokenStatus;
      if (listingWithToken.tokenCreationStatus !== TokenCreationStatus.AWAITING_USER_DETAILS) {
        throw errors.validation(
          `Cannot submit details for listing in status: ${listingWithToken.tokenCreationStatus}`,
        );
      }

      // Update the listing with user-provided details
      const updatedListing = await (this.prisma as any).listing.update({
        where: { id: listingId },
        data: {
          userProvidedDetails: details,
          tokenCreationStatus: TokenCreationStatus.PENDING_ADMIN_REVIEW,
          updatedAt: new Date(),
        },
      });

      // Create notification for user about submission received
      try {
        const userTemplate = NotificationTemplates[NotificationType.TOKEN_PARAMETERS_SUBMITTED];
        await this.notificationService.createNotification({
          userId: userId,
          listingId: listingId,
          type: NotificationType.TOKEN_PARAMETERS_SUBMITTED,
          title: userTemplate.title,
          message: userTemplate.message,
          actionUrl: userTemplate.getActionUrl(),
        });
      } catch (notificationError) {
        console.error('Error creating user token submission notification:', notificationError);
        // Don't fail the submission if notification fails
      }

      // Create notification for admins about token review needed
      try {
        const adminUsers = await this.prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        });

        const adminTemplate = NotificationTemplates[NotificationType.ADMIN_TOKEN_REVIEW_NEEDED];
        for (const admin of adminUsers) {
          await this.notificationService.createNotification({
            userId: admin.id,
            listingId: listingId,
            type: NotificationType.ADMIN_TOKEN_REVIEW_NEEDED,
            title: adminTemplate.title,
            message: adminTemplate.message,
            actionUrl: adminTemplate.getActionUrl(),
          });
        }
      } catch (notificationError) {
        console.error('Error creating admin token review notification:', notificationError);
        // Don't fail the submission if notification fails
      }

      return updatedListing as ListingWithTokenStatus;
    } catch (error) {
      console.error('Error submitting user details:', error);
      throw error;
    }
  }

  /**
   * Admin approves token parameters and sets status to ready for minting
   */
  async approveTokenParameters(
    listingId: string,
    adminId: string,
    parameters: TokenParameters,
  ): Promise<ListingWithTokenStatus> {
    try {
      // Verify the listing exists
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!listing) {
        throw errors.notFound('Listing not found');
      }

      // Check if listing is in the correct status
      const listingWithToken = listing as unknown as ListingWithTokenStatus;
      if (listingWithToken.tokenCreationStatus !== TokenCreationStatus.PENDING_ADMIN_REVIEW) {
        throw errors.validation(
          `Cannot approve parameters for listing in status: ${listingWithToken.tokenCreationStatus}`,
        );
      }

      // Validate token parameters
      this.validateTokenParameters(parameters);

      // Update the listing with approved parameters
      const updatedListing = await (this.prisma as any).listing.update({
        where: { id: listingId },
        data: {
          tokenParameters: parameters,
          tokenCreationStatus: TokenCreationStatus.READY_TO_MINT,
          updatedAt: new Date(),
        },
      });

      // Create notification for the user
      const template = NotificationTemplates[NotificationType.READY_TO_MINT];
      await this.notificationService.createNotification({
        userId: listing.ownerId,
        listingId: listingId,
        type: NotificationType.READY_TO_MINT,
        title: template.title,
        message: template.message,
        actionUrl: template.getActionUrl(listingId),
      });

      return updatedListing as ListingWithTokenStatus;
    } catch (error) {
      console.error('Error approving token parameters:', error);
      throw error;
    }
  }

  /**
   * Get mint parameters for a listing (user-facing, readonly)
   */
  async getMintParameters(listingId: string, userId: string): Promise<MintParameters> {
    try {
      const listing = await this.prisma.listing.findFirst({
        where: {
          id: listingId,
          ownerId: userId,
        },
      });

      if (!listing) {
        throw errors.notFound('Listing not found or access denied');
      }

      const listingWithToken = listing as unknown as ListingWithTokenStatus;
      if (listingWithToken.tokenCreationStatus !== TokenCreationStatus.READY_TO_MINT) {
        throw errors.validation('Token parameters not ready for minting');
      }

      if (!listingWithToken.tokenParameters) {
        throw errors.validation('Token parameters not found');
      }

      const params = listingWithToken.tokenParameters as TokenParameters;

      return {
        contractAddress: process.env.FACTORY_PROXY_ADDRESS || '',
        steepness: params.steepness,
        floor: params.floor,
        tokensBondedAt: params.tokensBondedAt,
        curve: params.curve,
        salt: params.salt || `${listing.symbol}-${Date.now()}`,
        name: listing.title,
        symbol: listing.symbol,
      };
    } catch (error) {
      console.error('Error getting mint parameters:', error);
      throw error;
    }
  }

  /**
   * Confirm that a token has been minted (called after successful blockchain transaction)
   */
  async confirmTokenMint(
    listingId: string,
    userId: string,
    txHash: string,
    tokenAddress: string,
  ): Promise<ListingWithTokenStatus> {
    try {
      const listing = await this.prisma.listing.findFirst({
        where: {
          id: listingId,
          ownerId: userId,
        },
      });

      if (!listing) {
        throw errors.notFound('Listing not found or access denied');
      }

      const listingWithToken = listing as unknown as ListingWithTokenStatus;
      if (listingWithToken.tokenCreationStatus !== TokenCreationStatus.READY_TO_MINT) {
        throw errors.validation('Token is not ready for minting confirmation');
      }

      // Update listing status and create token record
      const result = await this.prisma.$transaction(async (tx) => {
        // Update listing status
        const updatedListing = await (tx as any).listing.update({
          where: { id: listingId },
          data: {
            tokenCreationStatus: TokenCreationStatus.MINTED,
            isLive: true, // Make the listing live once token is minted
            updatedAt: new Date(),
          },
        });

        // Create token record
        await tx.token.create({
          data: {
            contractAddress: tokenAddress,
            symbol: listing.symbol,
            name: listing.title,
            listingId: listingId,
            currentPrice: '0',
            currentPriceACES: '0',
            volume24h: '0',
          },
        });

        return updatedListing;
      });

      // Create success notification
      const template = NotificationTemplates[NotificationType.TOKEN_MINTED];
      await this.notificationService.createNotification({
        userId,
        listingId,
        type: NotificationType.TOKEN_MINTED,
        title: template.title,
        message: template.message,
        actionUrl: template.getActionUrl(listing.symbol),
      });

      return result as ListingWithTokenStatus;
    } catch (error) {
      console.error('Error confirming token mint:', error);
      throw error;
    }
  }

  /**
   * Get all listings pending admin review for token creation
   */
  async getListingsPendingReview(): Promise<ListingWithTokenStatus[]> {
    try {
      const listings = await (this.prisma as any).listing.findMany({
        where: {
          tokenCreationStatus: TokenCreationStatus.PENDING_ADMIN_REVIEW,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
            },
          },
          submission: {
            select: {
              id: true,
              assetType: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return listings as ListingWithTokenStatus[];
    } catch (error) {
      console.error('Error getting listings pending review:', error);
      throw error;
    }
  }

  /**
   * Get token creation status for a user's listings
   */
  async getUserTokenCreationStatus(userId: string): Promise<ListingWithTokenStatus[]> {
    try {
      const listings = await (this.prisma as any).listing.findMany({
        where: {
          ownerId: userId,
          tokenCreationStatus: {
            not: null,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return listings as ListingWithTokenStatus[];
    } catch (error) {
      console.error('Error getting user token creation status:', error);
      throw error;
    }
  }

  /**
   * Private method to validate token parameters
   */
  private validateTokenParameters(params: TokenParameters): void {
    const errors: string[] = [];

    // Validate steepness
    const steepness = parseFloat(params.steepness);
    if (isNaN(steepness) || steepness < 1 || steepness > 10_000_000_000_000_000) {
      errors.push('Steepness must be between 1 and 10,000,000,000,000,000');
    }

    // Validate floor
    const floor = parseFloat(params.floor);
    if (isNaN(floor) || floor < 0 || floor > 1_000_000_000) {
      errors.push('Floor must be between 0 and 1,000,000,000');
    }

    // Validate tokensBondedAt
    const tokensBondedAt = parseFloat(params.tokensBondedAt);
    if (isNaN(tokensBondedAt) || tokensBondedAt < 1) {
      errors.push('Tokens bonded at must be at least 1 token');
    }

    // Validate curve
    if (![0, 1].includes(params.curve)) {
      errors.push('Curve must be 0 (exponential) or 1 (linear)');
    }

    if (errors.length > 0) {
      throw new Error(`Token parameter validation failed: ${errors.join(', ')}`);
    }
  }
}
