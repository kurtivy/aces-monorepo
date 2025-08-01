import { PrismaClient, SellerStatus, User } from '@prisma/client';
import { loggers } from '../lib/logger';

export class SellerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all sellers on the platform (users who have applied for seller status)
   */
  async getAllSellers() {
    try {
      // Get users who have applied to be sellers (not NOT_APPLIED status)
      const sellers = await this.prisma.user.findMany({
        where: {
          sellerStatus: {
            not: SellerStatus.NOT_APPLIED,
          },
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          walletAddress: true,
          sellerStatus: true,
          appliedAt: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { appliedAt: 'desc' },
      });

      // Fetch additional data for each seller with safe relationship handling
      const sellersWithData = await Promise.all(
        sellers.map(async (seller) => {
          // Safely fetch account verification
          let accountVerification = null;
          try {
            accountVerification = await this.prisma.accountVerification.findUnique({
              where: { userId: seller.id },
              select: {
                id: true,
                status: true,
                submittedAt: true,
                reviewedAt: true,
                attempts: true,
                firstName: true,
                lastName: true,
                documentType: true,
              },
            });
          } catch (error) {
            console.warn(`Failed to fetch verification for seller ${seller.id}:`, error);
          }

          // Safely fetch seller's listings
          let listings: Array<{
            id: string;
            title: string;
            symbol: string;
            isLive: boolean;
            createdAt: Date;
          }> = [];
          try {
            listings = await this.prisma.rwaListing.findMany({
              where: { ownerId: seller.id },
              select: {
                id: true,
                title: true,
                symbol: true,
                isLive: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
            });
          } catch (error) {
            console.warn(`Failed to fetch listings for seller ${seller.id}:`, error);
          }

          // Safely fetch bid statistics for seller's listings
          let bidStats = { totalBids: 0, totalBidValue: 0 };
          try {
            if (listings.length > 0) {
              const listingIds = listings.map((l) => l.id);
              const bids = await this.prisma.bid.findMany({
                where: { listingId: { in: listingIds } },
                select: {
                  amount: true,
                  currency: true,
                },
              });

              bidStats = {
                totalBids: bids.length,
                totalBidValue: bids.reduce((sum, bid) => sum + parseFloat(bid.amount), 0),
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch bid stats for seller ${seller.id}:`, error);
          }

          return {
            ...seller,
            accountVerification,
            listings: {
              total: listings.length,
              live: listings.filter((l) => l.isLive).length,
              recent: listings.slice(0, 3), // Most recent 3 listings
            },
            bidStats,
          };
        }),
      );

      return sellersWithData;
    } catch (error) {
      loggers.error(error as Error, { operation: 'getAllSellers' });
      throw error;
    }
  }

  /**
   * Get pending seller applications
   */
  async getPendingSellers() {
    try {
      const sellers = await this.prisma.user.findMany({
        where: {
          sellerStatus: SellerStatus.PENDING,
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          walletAddress: true,
          sellerStatus: true,
          appliedAt: true,
          createdAt: true,
        },
        orderBy: { appliedAt: 'asc' }, // FIFO order
      });

      // Fetch verification data for each pending seller
      const sellersWithVerification = await Promise.all(
        sellers.map(async (seller) => {
          let accountVerification = null;
          try {
            accountVerification = await this.prisma.accountVerification.findUnique({
              where: { userId: seller.id },
              select: {
                id: true,
                status: true,
                submittedAt: true,
                attempts: true,
                documentType: true,
                firstName: true,
                lastName: true,
              },
            });
          } catch (error) {
            console.warn(`Failed to fetch verification for pending seller ${seller.id}:`, error);
          }

          return {
            ...seller,
            accountVerification,
          };
        }),
      );

      return sellersWithVerification;
    } catch (error) {
      loggers.error(error as Error, { operation: 'getPendingSellers' });
      throw error;
    }
  }

  /**
   * Get seller statistics
   */
  async getSellerStats() {
    try {
      const [totalSellers, statusGroups] = await Promise.all([
        this.prisma.user.count({
          where: {
            sellerStatus: {
              not: SellerStatus.NOT_APPLIED,
            },
          },
        }),
        this.prisma.user.groupBy({
          by: ['sellerStatus'],
          _count: { sellerStatus: true },
          where: {
            sellerStatus: {
              not: SellerStatus.NOT_APPLIED,
            },
          },
        }),
      ]);

      const statusBreakdown = statusGroups.reduce(
        (acc, item) => {
          acc[item.sellerStatus] = item._count.sellerStatus;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        totalSellers,
        byStatus: statusBreakdown,
      };
    } catch (error) {
      loggers.error(error as Error, { operation: 'getSellerStats' });
      throw error;
    }
  }
}
