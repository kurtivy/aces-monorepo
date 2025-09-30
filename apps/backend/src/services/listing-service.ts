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

export class ListingService {
  private notificationService: NotificationService;

  constructor(
    private prisma: PrismaClient,
    notificationService?: NotificationService,
  ) {
    this.notificationService = notificationService || new NotificationService(prisma);
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
          description: submission.description,
          assetType: submission.assetType,
          imageGallery: submission.imageGallery,
          location: submission.location,
          email: submission.email,
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Take one extra to check for more
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      // Convert image URLs to signed URLs for secure access
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing: any) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery),
        })),
      );

      return { data: dataWithSignedUrls, nextCursor, hasMore };
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
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      // Convert image URLs to signed URLs for secure access
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing: any) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery),
        })),
      );

      return { data: dataWithSignedUrls, nextCursor, hasMore };
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
          submission: true,
          approvedByUser: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      // Convert image URLs to signed URLs for secure access
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing: any) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery),
        })),
      );

      return { data: dataWithSignedUrls, nextCursor, hasMore };
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
        },
      });

      if (!listing) {
        return null;
      }

      // Convert image URLs to signed URLs for secure access
      const listingWithSignedUrls = {
        ...listing,
        imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery),
      };

      return listingWithSignedUrls;
    } catch (error) {
      console.error('Error fetching listing by ID:', error);
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
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = listings.length > limit;
      const data = hasMore ? listings.slice(0, -1) : listings;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      // Convert image URLs to signed URLs for secure access
      const dataWithSignedUrls = await Promise.all(
        data.map(async (listing: any) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery),
        })),
      );

      return { data: dataWithSignedUrls, nextCursor, hasMore };
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

      // Convert image URLs to signed URLs for secure access
      const dataWithSignedUrls = await Promise.all(
        listings.map(async (listing: any) => ({
          ...listing,
          imageGallery: await ProductStorageService.convertToSignedUrls(listing.imageGallery),
        })),
      );

      return dataWithSignedUrls;
    } catch (error) {
      console.error('Error fetching all listings for admin:', error);
      throw error;
    }
  }
}
