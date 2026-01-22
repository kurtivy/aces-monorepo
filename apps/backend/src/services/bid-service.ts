import { PrismaClient, Prisma, User, Listing, Bid } from '@prisma/client';
import { BidStatus } from '../lib/prisma-enums';
import { errors } from '../lib/errors';
import {
  NotificationService,
  NotificationType,
  NotificationTemplates,
} from './notification-service';

// Type for bids with relations
type BidWithRelations = Prisma.BidGetPayload<{
  include: {
    bidder: {
      select: {
        id: true;
        username: true;
        walletAddress: true;
        email: true;
      };
    };
    listing: {
      select: {
        id: true;
        title: true;
        symbol: true;
        ownerId: true;
        isLive: true;
        startingBidPrice: true;
        reservePrice: true;
      };
    };
  };
}>;

export interface CreateBidRequest {
  listingId: string;
  amount: string;
  message?: string;
}

export interface RespondToBidRequest {
  status: 'ACCEPTED' | 'REJECTED';
  responseMessage?: string;
}

export class BidService {
  private notificationService: NotificationService;

  constructor(
    private prisma: PrismaClient,
    notificationService?: NotificationService,
  ) {
    this.notificationService = notificationService || new NotificationService(prisma);
  }

  /**
   * Check if user can place bids (all authenticated users can bid)
   */
  async checkUserBiddingEligibility(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // All authenticated users can place bids (verification no longer required)
    return !!user;
  }

  /**
   * Validate bid amount against listing rules
   */
  private async validateBidAmount(
    listingId: string,
    amount: string,
    excludeBidId?: string,
  ): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        bids: {
          where: {
            status: BidStatus.PENDING,
            isActive: true,
            ...(excludeBidId && { id: { not: excludeBidId } }),
          },
          orderBy: { amount: 'desc' },
          take: 1,
        },
      },
    });

    if (!listing) {
      throw errors.notFound('Listing not found');
    }

    const bidAmount = parseFloat(amount);

    // Check against starting bid price
    if (listing.startingBidPrice) {
      const startingPrice = parseFloat(listing.startingBidPrice);
      if (bidAmount < startingPrice) {
        throw errors.validation(`Bid must be at least $${startingPrice.toLocaleString()}`);
      }
    }

    // Check against current highest bid
    if (listing.bids.length > 0) {
      const highestBid = parseFloat(listing.bids[0].amount);
      if (bidAmount <= highestBid) {
        throw errors.validation(
          `Bid must be higher than current highest bid of $${highestBid.toLocaleString()}`,
        );
      }
    }
  }

  /**
   * Create a new bid
   */
  async createBid(userId: string, data: CreateBidRequest): Promise<BidWithRelations> {
    try {
      // Check user eligibility (all authenticated users can bid)
      const isEligible = await this.checkUserBiddingEligibility(userId);
      if (!isEligible) {
        throw errors.forbidden('User not found');
      }

      // Get listing and validate
      const listing = await this.prisma.listing.findUnique({
        where: { id: data.listingId },
        select: {
          id: true,
          ownerId: true,
          isLive: true,
          startingBidPrice: true,
        },
      });

      if (!listing) {
        throw errors.notFound('Listing not found');
      }

      if (!listing.isLive) {
        throw errors.validation('Listing is not available for bidding');
      }

      if (listing.ownerId === userId) {
        throw errors.validation('You cannot bid on your own listing');
      }

      // Validate bid amount
      await this.validateBidAmount(data.listingId, data.amount);

      // Check for existing active bid from this user
      const existingBid = await this.prisma.bid.findFirst({
        where: {
          listingId: data.listingId,
          bidderId: userId,
          status: BidStatus.PENDING,
          isActive: true,
        },
      });

      // Set expiration to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      let newBid: BidWithRelations;

      if (existingBid) {
        // Update existing bid - deactivate old one and create new one with reference
        await this.prisma.bid.update({
          where: { id: existingBid.id },
          data: { isActive: false },
        });

        newBid = await this.prisma.bid.create({
          data: {
            amount: data.amount,
            message: data.message,
            listingId: data.listingId,
            bidderId: userId,
            expiresAt,
            previousBidId: existingBid.id,
          },
          include: {
            bidder: {
              select: {
                id: true,
                username: true,
                walletAddress: true,
                email: true,
              },
            },
            listing: {
              select: {
                id: true,
                title: true,
                symbol: true,
                ownerId: true,
                isLive: true,
                startingBidPrice: true,
                reservePrice: true,
              },
            },
          },
        });
      } else {
        // Create new bid
        newBid = await this.prisma.bid.create({
          data: {
            amount: data.amount,
            message: data.message,
            listingId: data.listingId,
            bidderId: userId,
            expiresAt,
          },
          include: {
            bidder: {
              select: {
                id: true,
                username: true,
                walletAddress: true,
                email: true,
              },
            },
            listing: {
              select: {
                id: true,
                title: true,
                symbol: true,
                ownerId: true,
                isLive: true,
                startingBidPrice: true,
                reservePrice: true,
              },
            },
          },
        });
      }

      // Create notification for listing owner about new bid
      try {
        const template = NotificationTemplates[NotificationType.NEW_BID_RECEIVED];
        await this.notificationService.createNotification({
          userId: listing.ownerId,
          listingId: data.listingId,
          type: NotificationType.NEW_BID_RECEIVED,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl(),
        });
      } catch (notificationError) {
        console.error('Error creating bid notification:', notificationError);
        // Don't fail the bid creation if notification fails
      }

      // If this is a higher bid, notify other bidders they've been outbid
      try {
        const newBidAmount = parseFloat(data.amount);
        const outbidUsers = await this.prisma.bid.findMany({
          where: {
            listingId: data.listingId,
            bidderId: { not: userId }, // Exclude current bidder
            status: BidStatus.PENDING,
            isActive: true,
            amount: { lt: data.amount }, // Bids lower than the new bid
          },
          select: {
            bidderId: true,
          },
        });

        const outbidTemplate = NotificationTemplates[NotificationType.BID_OUTBID];
        for (const outbidUser of outbidUsers) {
          await this.notificationService.createNotification({
            userId: outbidUser.bidderId,
            listingId: data.listingId,
            type: NotificationType.BID_OUTBID,
            title: outbidTemplate.title,
            message: outbidTemplate.message,
            actionUrl: outbidTemplate.getActionUrl(),
          });
        }
      } catch (notificationError) {
        console.error('Error creating outbid notifications:', notificationError);
        // Don't fail the bid creation if notification fails
      }

      return newBid;
    } catch (error) {
      console.error('Error in createBid:', error);
      throw error;
    }
  }

  /**
   * Get bids for a listing
   */
  async getListingBids(
    listingId: string,
    options: { limit?: number; cursor?: string; includeInactive?: boolean } = {},
  ): Promise<{ data: BidWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: any = {
        listingId,
        status: BidStatus.PENDING,
        ...(options.includeInactive ? {} : { isActive: true }),
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const bids = await this.prisma.bid.findMany({
        where,
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true,
            },
          },
        },
        orderBy: { amount: 'desc' },
        take: limit + 1,
      });

      const hasMore = bids.length > limit;
      const data = hasMore ? bids.slice(0, -1) : bids;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error('Error in getListingBids:', error);
      throw error;
    }
  }

  /**
   * Get user's bids
   */
  async getUserBids(
    userId: string,
    filter?: { status?: keyof typeof BidStatus },
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: BidWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: any = {
        bidderId: userId,
        isActive: true,
        ...(filter?.status && { status: filter.status }),
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const bids = await this.prisma.bid.findMany({
        where,
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = bids.length > limit;
      const data = hasMore ? bids.slice(0, -1) : bids;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error('Error in getUserBids:', error);
      throw error;
    }
  }

  /**
   * Get bids on user's listings
   */
  async getBidsOnUserListings(
    userId: string,
    filter?: { status?: keyof typeof BidStatus },
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: BidWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: any = {
        listing: {
          ownerId: userId,
        },
        isActive: true,
        ...(filter?.status && { status: filter.status }),
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const bids = await this.prisma.bid.findMany({
        where,
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = bids.length > limit;
      const data = hasMore ? bids.slice(0, -1) : bids;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error('Error in getBidsOnUserListings:', error);
      throw error;
    }
  }

  /**
   * Respond to a bid (accept/reject) - listing owner only
   */
  async respondToBid(
    bidId: string,
    userId: string,
    data: RespondToBidRequest,
  ): Promise<BidWithRelations> {
    try {
      const bid = await this.prisma.bid.findUnique({
        where: { id: bidId },
        include: {
          listing: {
            select: {
              ownerId: true,
            },
          },
        },
      });

      if (!bid) {
        throw errors.notFound('Bid not found');
      }

      if (bid.listing.ownerId !== userId) {
        throw errors.forbidden('You can only respond to bids on your own listings');
      }

      if (bid.status !== BidStatus.PENDING) {
        throw errors.validation('Bid has already been responded to');
      }

      if (!bid.isActive) {
        throw errors.validation('This bid is no longer active');
      }

      const updatedBid = await this.prisma.bid.update({
        where: { id: bidId },
        data: {
          status: data.status === 'ACCEPTED' ? BidStatus.ACCEPTED : BidStatus.REJECTED,
          respondedAt: new Date(),
          responseMessage: data.responseMessage,
        },
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true,
            },
          },
        },
      });

      // Create notification for bidder about bid response
      try {
        const notificationType =
          data.status === 'ACCEPTED'
            ? NotificationType.BID_ACCEPTED
            : NotificationType.BID_REJECTED;

        const template = NotificationTemplates[notificationType];
        await this.notificationService.createNotification({
          userId: updatedBid.bidderId,
          listingId: updatedBid.listingId,
          type: notificationType,
          title: template.title,
          message: template.message,
          actionUrl: template.getActionUrl(),
        });
      } catch (notificationError) {
        console.error('Error creating bid response notification:', notificationError);
        // Don't fail the bid response if notification fails
      }

      return updatedBid;
    } catch (error) {
      console.error('Error in respondToBid:', error);
      throw error;
    }
  }

  /**
   * Withdraw a bid - bidder only
   */
  async withdrawBid(bidId: string, userId: string): Promise<void> {
    try {
      const bid = await this.prisma.bid.findUnique({
        where: { id: bidId },
        select: {
          bidderId: true,
          status: true,
          isActive: true,
        },
      });

      if (!bid) {
        throw errors.notFound('Bid not found');
      }

      if (bid.bidderId !== userId) {
        throw errors.forbidden('You can only withdraw your own bids');
      }

      if (bid.status !== BidStatus.PENDING) {
        throw errors.validation('Can only withdraw pending bids');
      }

      if (!bid.isActive) {
        throw errors.validation('Bid is not active');
      }

      await this.prisma.bid.update({
        where: { id: bidId },
        data: {
          status: BidStatus.WITHDRAWN,
          isActive: false,
        },
      });
    } catch (error) {
      console.error('Error in withdrawBid:', error);
      throw error;
    }
  }

  /**
   * Get highest bid for a listing
   */
  async getHighestBid(listingId: string): Promise<BidWithRelations | null> {
    try {
      const highestBid = await this.prisma.bid.findFirst({
        where: {
          listingId,
          status: BidStatus.PENDING,
          isActive: true,
        },
        include: {
          bidder: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
              email: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              ownerId: true,
              isLive: true,
              startingBidPrice: true,
              reservePrice: true,
            },
          },
        },
        orderBy: { amount: 'desc' },
      });

      return highestBid;
    } catch (error) {
      console.error('Error in getHighestBid:', error);
      throw error;
    }
  }

  /**
   * Auto-expire bids (to be run periodically)
   */
  async expireBids(): Promise<number> {
    try {
      const result = await this.prisma.bid.updateMany({
        where: {
          status: BidStatus.PENDING,
          expiresAt: {
            lt: new Date(),
          },
        },
        data: {
          status: BidStatus.EXPIRED,
          isActive: false,
        },
      });

      return result.count;
    } catch (error) {
      console.error('Error in expireBids:', error);
      throw error;
    }
  }
}
