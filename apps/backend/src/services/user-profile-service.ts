import { PrismaClient, UserRole, SellerStatus } from '@prisma/client';
import { loggers } from '../lib/logger';
import { errors } from '../lib/errors';
import { EnhancedUser } from '../types/fastify';

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  website?: string;
  twitterHandle?: string;
  avatar?: string;
  notifications?: boolean;
  newsletter?: boolean;
  darkMode?: boolean;
}

export interface UserProfileResponse {
  id: string;
  walletAddress: string | null;
  email: string | null;
  role: UserRole;
  sellerStatus: SellerStatus;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  bio: string | null;
  website: string | null;
  twitterHandle: string | null;
  avatar: string | null;
  notifications: boolean;
  newsletter: boolean;
  darkMode: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  fullName: string | null;
  isVerifiedSeller: boolean;
  canAccessSellerDashboard: boolean;
}

export interface UserTransactionHistory {
  submissions: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    imageUrl: string;
  }>;
  bids: Array<{
    id: string;
    amount: string;
    currency: string;
    createdAt: Date;
    submission: {
      id: string;
      name: string;
      imageUrl: string;
    };
  }>;
  totalSubmissions: number;
  totalBids: number;
  totalSpent: string; // Sum of winning bids (would need additional logic)
}

export interface UserOnChainAssets {
  tokens: Array<{
    contractAddress: string;
    symbol: string;
    name: string;
    balance: string;
    imageUrl?: string;
  }>;
  totalValue: string; // USD value (would need price oracle)
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
          firstName: true,
          lastName: true,
          displayName: true,
          bio: true,
          website: true,
          twitterHandle: true,
          avatar: true,
          notifications: true,
          newsletter: true,
          darkMode: true,
          createdAt: true,
          updatedAt: true,
          sellerPasswordHash: true,
        },
      });

      if (!user) {
        throw errors.notFound('User not found');
      }

      // Compute derived fields
      const fullName =
        user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null;
      const isVerifiedSeller = user.sellerStatus === SellerStatus.APPROVED;
      const canAccessSellerDashboard = isVerifiedSeller && !!user.sellerPasswordHash;

      return {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        role: user.role,
        sellerStatus: user.sellerStatus,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        bio: user.bio,
        website: user.website,
        twitterHandle: user.twitterHandle,
        avatar: user.avatar,
        notifications: user.notifications,
        newsletter: user.newsletter,
        darkMode: user.darkMode,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        fullName,
        isVerifiedSeller,
        canAccessSellerDashboard,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserProfile' });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updates: UserProfileUpdate,
    correlationId: string,
  ): Promise<UserProfileResponse> {
    try {
      // Validate Twitter handle format if provided
      if (updates.twitterHandle && !updates.twitterHandle.match(/^@?[A-Za-z0-9_]{1,15}$/)) {
        throw errors.badRequest('Invalid Twitter handle format');
      }

      // Remove @ prefix from Twitter handle if present
      if (updates.twitterHandle?.startsWith('@')) {
        updates.twitterHandle = updates.twitterHandle.substring(1);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });

      loggers.database('update', 'user_profile', userId);

      return this.getUserProfile(userId);
    } catch (error) {
      loggers.error(error as Error, { userId, correlationId, operation: 'updateUserProfile' });
      throw error;
    }
  }

  /**
   * Get user transaction history
   */
  async getUserTransactionHistory(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<UserTransactionHistory> {
    try {
      // Get user's submissions
      const submissions = await this.prisma.rwaSubmission.findMany({
        where: { ownerId: userId },
        take: limit,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          imageUrl: true,
        },
      });

      // Get user's bids
      const bids = await this.prisma.bid.findMany({
        where: { bidderId: userId },
        take: limit,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
        include: {
          submission: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      });

      // Get totals
      const [totalSubmissions, totalBids] = await Promise.all([
        this.prisma.rwaSubmission.count({ where: { ownerId: userId } }),
        this.prisma.bid.count({ where: { bidderId: userId } }),
      ]);

      // TODO: Calculate totalSpent based on winning bids
      const totalSpent = '0'; // Placeholder

      return {
        submissions: submissions.map((sub) => ({
          id: sub.id,
          name: sub.name,
          status: sub.status,
          createdAt: sub.createdAt,
          imageUrl: sub.imageUrl,
        })),
        bids: bids.map((bid) => ({
          id: bid.id,
          amount: bid.amount,
          currency: bid.currency,
          createdAt: bid.createdAt,
          submission: bid.submission,
        })),
        totalSubmissions,
        totalBids,
        totalSpent,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserTransactionHistory' });
      throw error;
    }
  }

  /**
   * Get user's on-chain assets (placeholder - would integrate with Web3 providers)
   */
  async getUserOnChainAssets(userId: string, walletAddress?: string): Promise<UserOnChainAssets> {
    try {
      // This would integrate with Web3 providers like Alchemy, Moralis, etc.
      // For now, return placeholder data

      // Get tokens from our platform that user owns
      const userTokens = await this.prisma.token.findMany({
        where: {
          submission: {
            ownerId: userId,
          },
        },
        include: {
          submission: {
            select: {
              name: true,
              symbol: true,
              imageUrl: true,
            },
          },
        },
      });

      const tokens = userTokens.map((token) => ({
        contractAddress: token.contractAddress,
        symbol: token.submission.symbol,
        name: token.submission.name,
        balance: '1.0', // Placeholder - would query blockchain
        imageUrl: token.submission.imageUrl,
      }));

      // TODO: Integrate with price oracles for USD values
      const totalValue = '0.00';

      return {
        tokens,
        totalValue,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserOnChainAssets' });
      throw error;
    }
  }

  /**
   * Get public user profile (limited info for other users)
   */
  async getPublicUserProfile(userId: string): Promise<{
    id: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    website: string | null;
    twitterHandle: string | null;
    role: UserRole;
    isVerifiedSeller: boolean;
    createdAt: Date;
    totalSubmissions: number;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          avatar: true,
          bio: true,
          website: true,
          twitterHandle: true,
          role: true,
          sellerStatus: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw errors.notFound('User not found');
      }

      const totalSubmissions = await this.prisma.rwaSubmission.count({
        where: { ownerId: userId },
      });

      return {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        website: user.website,
        twitterHandle: user.twitterHandle,
        role: user.role,
        isVerifiedSeller: user.sellerStatus === SellerStatus.APPROVED,
        createdAt: user.createdAt,
        totalSubmissions,
      };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getPublicUserProfile' });
      throw error;
    }
  }

  /**
   * Search users by display name or wallet address
   */
  async searchUsers(
    query: string,
    limit: number = 10,
  ): Promise<
    Array<{
      id: string;
      displayName: string | null;
      avatar: string | null;
      walletAddress: string | null;
      role: UserRole;
      isVerifiedSeller: boolean;
    }>
  > {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            {
              displayName: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              walletAddress: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
        take: limit,
        select: {
          id: true,
          displayName: true,
          avatar: true,
          walletAddress: true,
          role: true,
          sellerStatus: true,
        },
      });

      return users.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        walletAddress: user.walletAddress,
        role: user.role,
        isVerifiedSeller: user.sellerStatus === SellerStatus.APPROVED,
      }));
    } catch (error) {
      loggers.error(error as Error, { query, operation: 'searchUsers' });
      throw error;
    }
  }
}
