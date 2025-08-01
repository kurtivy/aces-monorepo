import {
  PrismaClient,
  UserRole,
  SellerStatus,
  SubmissionStatus,
  VerificationStatus,
} from '@prisma/client';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';

// Simplified user profile response interface
export interface UserProfileResponse {
  id: string;
  walletAddress: string | null;
  email: string | null;
  role: UserRole;
  sellerStatus: SellerStatus;
  displayName: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  isVerifiedSeller: boolean;
}

export interface UserActivitySummary {
  submissionsCount: number;
  listingsCount: number;
  bidsCount: number;
  tokensCount: number;
}

export interface UserPortfolioSummary {
  tokenSymbols: string[];
  totalValueEstimate: string;
  tokens: Array<{
    id: string;
    contractAddress: string;
    title: string;
    ticker: string;
    image: string;
    value: string;
    category: string;
  }>;
}

export interface UserPortfolioItem {
  id: string;
  contractAddress: string;
  title: string;
  ticker: string;
  image: string;
  value: string;
  category: string;
}

export interface UserPublicProfile {
  id: string;
  displayName: string | null;
  avatar: string | null;
  role: UserRole;
  sellerStatus: SellerStatus;
  memberSince: Date;
  verificationStatus: VerificationStatus | null;
}

export class UserProfileService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          walletAddress: true,
          email: true,
          role: true,
          sellerStatus: true,
          displayName: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true,
        },
      });

      if (!user) {
        throw errors.notFound('User not found');
      }

      // Compute derived fields
      const isVerifiedSeller = user.sellerStatus === SellerStatus.APPROVED;

      return {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        role: user.role,
        sellerStatus: user.sellerStatus,
        displayName: user.displayName,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        verifiedAt: user.verifiedAt,
        rejectedAt: user.rejectedAt,
        rejectionReason: user.rejectionReason,
        isVerifiedSeller,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserProfile' });
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string): Promise<UserActivitySummary> {
    try {
      const [submissionsCount, listingsCount, bidsCount, tokensCount] = await Promise.all([
        this.prisma.rwaSubmission.count({
          where: { ownerId: userId },
        }),
        this.prisma.rwaListing.count({
          where: { ownerId: userId },
        }),
        this.prisma.bid.count({
          where: { bidderId: userId },
        }),
        this.prisma.token.count({
          where: { userId },
        }),
      ]);

      return {
        submissionsCount,
        listingsCount,
        bidsCount,
        tokensCount,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserActivitySummary' });
      throw error;
    }
  }

  /**
   * Get user submissions
   */
  async getUserSubmissions(userId: string) {
    try {
      const submissions = await this.prisma.rwaSubmission.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          symbol: true,
          status: true,
          createdAt: true,
          imageGallery: true,
          rwaListing: {
            select: {
              id: true,
              isLive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return submissions.map((sub) => ({
        id: sub.id,
        title: sub.title,
        symbol: sub.symbol,
        status: sub.status,
        imageUrl: sub.imageGallery[0] || '/placeholder.svg',
        createdAt: sub.createdAt,
        hasListing: !!sub.rwaListing,
        listingIsLive: sub.rwaListing?.isLive || false,
      }));
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserSubmissions' });
      throw error;
    }
  }

  /**
   * Get user listings
   */
  async getUserListings(userId: string) {
    try {
      const listings = await this.prisma.rwaListing.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          symbol: true,
          imageGallery: true,
          isLive: true,
          createdAt: true,
          rwaSubmission: {
            select: {
              id: true,
              status: true,
            },
          },
          bids: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              amount: true,
              currency: true,
              createdAt: true,
              bidder: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          token: {
            select: {
              id: true,
              contractAddress: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        symbol: listing.symbol,
        imageUrl: listing.imageGallery[0] || '/placeholder.svg',
        isLive: listing.isLive,
        createdAt: listing.createdAt,
        submissionId: listing.rwaSubmission.id,
        submissionStatus: listing.rwaSubmission.status,
        bidsCount: listing.bids.length,
        latestBid: listing.bids[0] || null,
        hasToken: !!listing.token,
        tokenAddress: listing.token?.contractAddress || null,
      }));
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserListings' });
      throw error;
    }
  }

  /**
   * Get user bids
   */
  async getUserBids(userId: string) {
    try {
      const bids = await this.prisma.bid.findMany({
        where: { bidderId: userId },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              imageGallery: true,
              isLive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return bids.map((bid) => ({
        id: bid.id,
        amount: bid.amount,
        currency: bid.currency,
        createdAt: bid.createdAt,
        listing: {
          id: bid.listing.id,
          title: bid.listing.title,
          symbol: bid.listing.symbol,
          imageUrl: bid.listing.imageGallery[0] || '/placeholder.svg',
          isLive: bid.listing.isLive,
        },
      }));
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserBids' });
      throw error;
    }
  }

  /**
   * Get user tokens/portfolio
   */
  async getUserTokens(userId: string): Promise<UserPortfolioItem[]> {
    try {
      const tokens = await this.prisma.token.findMany({
        where: { userId },
        include: {
          rwaListing: {
            select: {
              title: true,
              symbol: true,
              imageGallery: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return tokens.map((token) => ({
        id: token.id,
        contractAddress: token.contractAddress,
        title: token.rwaListing?.title || 'Unknown',
        ticker: token.rwaListing?.symbol || 'UNK',
        image: token.rwaListing?.imageGallery[0] || '/placeholder.svg',
        value: '0', // Would need pricing data
        category: this.getCategoryFromTitle(token.rwaListing?.title || ''),
      }));
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserTokens' });
      throw error;
    }
  }

  /**
   * Get user portfolio summary
   */
  async getUserPortfolioSummary(userId: string): Promise<UserPortfolioSummary> {
    try {
      const tokens = await this.getUserTokens(userId);

      return {
        tokenSymbols: tokens.map((t) => t.ticker),
        totalValueEstimate: '0', // Would need pricing integration
        tokens,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserPortfolioSummary' });
      throw error;
    }
  }

  /**
   * Get public user profile (for other users to view)
   */
  async getPublicUserProfile(userId: string): Promise<UserPublicProfile> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          avatar: true,
          role: true,
          sellerStatus: true,
          createdAt: true,
          accountVerification: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!user) {
        throw errors.notFound('User not found');
      }

      return {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        sellerStatus: user.sellerStatus,
        memberSince: user.createdAt,
        verificationStatus: user.accountVerification?.status || null,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getPublicUserProfile' });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updates: {
      displayName?: string;
      avatar?: string;
      email?: string;
    },
  ): Promise<UserProfileResponse> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          walletAddress: true,
          email: true,
          role: true,
          sellerStatus: true,
          displayName: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true,
        },
      });

      const isVerifiedSeller = updatedUser.sellerStatus === SellerStatus.APPROVED;

      return {
        ...updatedUser,
        isVerifiedSeller,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, updates, operation: 'updateUserProfile' });
      throw error;
    }
  }

  /**
   * Helper method to categorize assets
   */
  private getCategoryFromTitle(title: string): string {
    const titleLower = title.toLowerCase();
    if (
      titleLower.includes('car') ||
      titleLower.includes('vehicle') ||
      titleLower.includes('porsche')
    ) {
      return 'Vehicle';
    }
    if (
      titleLower.includes('house') ||
      titleLower.includes('property') ||
      titleLower.includes('real estate')
    ) {
      return 'Real Estate';
    }
    if (
      titleLower.includes('art') ||
      titleLower.includes('painting') ||
      titleLower.includes('sculpture')
    ) {
      return 'Art';
    }
    if (
      titleLower.includes('watch') ||
      titleLower.includes('jewelry') ||
      titleLower.includes('gold')
    ) {
      return 'Luxury';
    }
    return 'Other';
  }
}
