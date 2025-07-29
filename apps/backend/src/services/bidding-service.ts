import { PrismaClient, Prisma, Bid } from '@prisma/client';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';
import { withTransaction } from '../lib/database';

interface CreateBidRequest {
  listingId: string; // Changed from submissionId to listingId
  amount: string;
  currency: string;
  expiresAt?: Date; // New optional field
}

export class BiddingService {
  constructor(private prisma: PrismaClient) {}

  async createOrUpdateBid(
    userId: string,
    data: CreateBidRequest,
    correlationId: string,
  ): Promise<Bid> {
    try {
      const result = await withTransaction(async (tx) => {
        // First, verify the listing exists and is in a biddable state
        const listing = await tx.rwaListing.findUnique({
          where: { id: data.listingId },
          include: {
            owner: true,
            rwaSubmission: true,
          },
        });

        if (!listing) {
          throw errors.notFound('Listing not found');
        }

        // Only allow bidding on live listings
        if (!listing.isLive) {
          throw errors.validation('Cannot bid on inactive listing');
        }

        // Don't allow bidding on own listings
        if (listing.ownerId === userId) {
          throw errors.validation('Cannot bid on your own listing');
        }

        // Verify user has approved KYC/verification
        const userVerification = await tx.accountVerification.findUnique({
          where: { userId },
        });

        if (!userVerification || userVerification.status !== 'APPROVED') {
          throw errors.validation('Account verification required to place bids');
        }

        // Check if user already has a bid on this listing
        const existingBid = await tx.bid.findUnique({
          where: {
            bidderId_listingId: {
              bidderId: userId,
              listingId: data.listingId,
            },
          },
        });

        let bid: Bid;

        if (existingBid) {
          // Update existing bid
          bid = await tx.bid.update({
            where: { id: existingBid.id },
            data: {
              amount: data.amount,
              currency: data.currency,
              expiresAt: data.expiresAt,
              createdAt: new Date(), // Update timestamp for new bid
            },
            include: {
              bidder: {
                select: {
                  id: true,
                  displayName: true,
                  walletAddress: true,
                },
              },
              listing: {
                include: {
                  owner: {
                    select: {
                      id: true,
                      displayName: true,
                      walletAddress: true,
                    },
                  },
                },
              },
              verification: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          });
        } else {
          // Create new bid
          bid = await tx.bid.create({
            data: {
              bidderId: userId,
              listingId: data.listingId,
              verificationId: userVerification.id,
              amount: data.amount,
              currency: data.currency,
              expiresAt: data.expiresAt,
            },
            include: {
              bidder: {
                select: {
                  id: true,
                  displayName: true,
                  walletAddress: true,
                },
              },
              listing: {
                include: {
                  owner: {
                    select: {
                      id: true,
                      displayName: true,
                      walletAddress: true,
                    },
                  },
                },
              },
              verification: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          });
        }

        return bid;
      });

      loggers.database('bid_created_or_updated', 'bids', result.id);
      return result;
    } catch (error) {
      loggers.error(error as Error, {
        userId,
        listingId: data.listingId,
        correlationId,
        operation: 'createOrUpdateBid',
      });
      throw error;
    }
  }

  async getBidsForListing(listingId: string): Promise<Bid[]> {
    try {
      // Verify listing exists
      const listing = await this.prisma.rwaListing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw errors.notFound('Listing not found');
      }

      const bids = await this.prisma.bid.findMany({
        where: { listingId },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
            },
          },
          verification: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [
          { amount: 'desc' }, // Highest bids first
          { createdAt: 'asc' }, // Then by time for same amounts
        ],
      });

      return bids;
    } catch (error) {
      loggers.error(error as Error, { listingId, operation: 'getBidsForListing' });
      throw error;
    }
  }

  async getUserBids(userId: string): Promise<Bid[]> {
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
              owner: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
          verification: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return bids;
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserBids' });
      throw error;
    }
  }

  async deleteBid(bidId: string, userId: string): Promise<void> {
    try {
      await withTransaction(async (tx) => {
        // Get the bid to ensure user owns it
        const bid = await tx.bid.findUnique({
          where: { id: bidId },
          include: { listing: true },
        });

        if (!bid) {
          throw errors.notFound('Bid not found');
        }

        if (bid.bidderId !== userId) {
          throw errors.forbidden('Cannot delete bid that is not yours');
        }

        // Check if listing is still active for bidding
        if (!bid.listing.isLive) {
          throw errors.validation('Cannot delete bid on inactive listing');
        }

        // Hard delete the bid (no soft delete in new schema)
        await tx.bid.delete({
          where: { id: bidId },
        });
      });

      loggers.database('bid_deleted', 'bids', bidId);
    } catch (error) {
      loggers.error(error as Error, { bidId, userId, operation: 'deleteBid' });
      throw error;
    }
  }

  async getBidById(bidId: string): Promise<Bid | null> {
    try {
      const bid = await this.prisma.bid.findUnique({
        where: { id: bidId },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
            },
          },
          listing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  walletAddress: true,
                },
              },
            },
          },
          verification: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      return bid;
    } catch (error) {
      loggers.error(error as Error, { bidId, operation: 'getBidById' });
      throw error;
    }
  }

  async getHighestBidForListing(listingId: string): Promise<Bid | null> {
    try {
      const bid = await this.prisma.bid.findFirst({
        where: { listingId },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
            },
          },
          verification: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [
          { amount: 'desc' },
          { createdAt: 'asc' }, // First bid wins in case of tie
        ],
      });

      return bid;
    } catch (error) {
      loggers.error(error as Error, { listingId, operation: 'getHighestBidForListing' });
      throw error;
    }
  }

  async getBidsForOwner(ownerId: string): Promise<Bid[]> {
    try {
      // Get all bids on listings owned by this user
      const bids = await this.prisma.bid.findMany({
        where: {
          listing: {
            ownerId: ownerId,
          },
        },
        include: {
          bidder: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              symbol: true,
              imageGallery: true,
              isLive: true,
            },
          },
          verification: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [{ listing: { title: 'asc' } }, { amount: 'desc' }, { createdAt: 'asc' }],
      });

      return bids;
    } catch (error) {
      loggers.error(error as Error, { ownerId, operation: 'getBidsForOwner' });
      throw error;
    }
  }

  async getBiddingStats() {
    try {
      const [totalBids, bidderGroups] = await Promise.all([
        this.prisma.bid.count(),
        this.prisma.bid.groupBy({
          by: ['bidderId'],
        }),
      ]);

      const totalBidders = bidderGroups.length;

      return {
        totalBids,
        totalBidders,
      };
    } catch (error) {
      loggers.error(error as Error, { operation: 'getBiddingStats' });
      throw error;
    }
  }
}
