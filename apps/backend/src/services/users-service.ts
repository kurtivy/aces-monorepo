// backend/src/services/users-service.ts - Step 1: Basic User Operations Only
import { PrismaClient } from '@prisma/client';
import { UserRole } from '../lib/prisma-enums';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';

// Step 1: Simple user profile response (matches current User model)
export interface SimpleUserProfile {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  role: keyof typeof UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UsersService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get user profile by ID - Step 1 version
   */
  async getUserProfile(userId: string): Promise<SimpleUserProfile> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          privyDid: true,
          walletAddress: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw errors.notFound('User not found');
      }

      return user;
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserProfile' });
      throw error;
    }
  }

  /**
   * Update user profile - Step 1 version (email only)
   */
  async updateUserProfile(
    userId: string,
    updates: {
      email?: string;
    },
  ): Promise<SimpleUserProfile> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          privyDid: true,
          walletAddress: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return updatedUser;
    } catch (error) {
      loggers.error(error as Error, { userId, updates, operation: 'updateUserProfile' });
      throw error;
    }
  }
}
