import { PrismaClient, Token } from '@prisma/client';
import { logger } from '../lib/logger';
import { errors } from '../lib/errors';

interface CreateTokenFromListingData {
  listingId: string;
  contractAddress: string;
  userId: string;
}

interface TokenWithListing extends Token {
  rwaListing: {
    id: string;
    title: string;
    symbol: string;
    imageGallery: string[];
    isLive: boolean;
    owner: {
      id: string;
      displayName: string | null;
    };
  };
}

export class TokenService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a token from an approved and live listing
   */
  async createTokenFromListing({
    listingId,
    contractAddress,
    userId,
  }: CreateTokenFromListingData): Promise<TokenWithListing> {
    try {
      logger.info(`Creating token from listing: ${listingId}`);

      // Verify the listing exists and is live
      const listing = await this.prisma.rwaListing.findUnique({
        where: { id: listingId },
        include: {
          owner: true,
          rwaSubmission: true,
          token: true, // Check if token already exists
        },
      });

      if (!listing) {
        throw errors.notFound(`Listing with id ${listingId} not found`);
      }

      if (!listing.isLive) {
        throw errors.validation('Cannot create token from inactive listing');
      }

      if (listing.token) {
        throw errors.validation('Token already exists for this listing');
      }

      // Check if contract address is already used
      const existingToken = await this.prisma.token.findUnique({
        where: { contractAddress },
      });

      if (existingToken) {
        throw errors.validation('Contract address already in use');
      }

      // Create the token
      const token = await this.prisma.token.create({
        data: {
          contractAddress,
          rwaListingId: listingId,
          userId, // User creating the token (could be admin or owner)
        },
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

      logger.info(`Successfully created token: ${token.id} for listing: ${listingId}`);

      return token as TokenWithListing;
    } catch (error) {
      logger.error(`Error creating token from listing ${listingId}:`, error);
      throw error;
    }
  }

  /**
   * Get token by ID with listing details
   */
  async getTokenById(tokenId: string): Promise<TokenWithListing | null> {
    try {
      // Try to get token with rwaListing relationship
      let token = null;
      let rwaListing = null;

      try {
        token = await this.prisma.token.findUnique({
          where: { id: tokenId },
          include: {
            rwaListing: {
              include: {
                owner: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        });
        rwaListing = token?.rwaListing;
      } catch (relationError) {
        // If rwaListing relationship fails, fetch separately
        console.warn(
          `Failed to fetch token with rwaListing relationship, falling back to separate queries:`,
          relationError,
        );

        token = await this.prisma.token.findUnique({
          where: { id: tokenId },
        });

        // Try to fetch listing separately if token exists
        if (token?.rwaListingId) {
          try {
            const listing = await this.prisma.rwaListing.findUnique({
              where: { id: token.rwaListingId },
              include: {
                owner: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            });
            rwaListing = listing;
          } catch (listingError) {
            console.warn(`Could not fetch separate rwaListing:`, listingError);
            rwaListing = null;
          }
        }
      }

      if (!token) return null;

      // Combine token with listing data
      return {
        ...token,
        rwaListing,
      } as TokenWithListing;
    } catch (error) {
      logger.error(`Error fetching token ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get token by contract address
   */
  async getTokenByContractAddress(contractAddress: string): Promise<TokenWithListing | null> {
    try {
      // Try to get token with rwaListing relationship
      let token = null;
      let rwaListing = null;

      try {
        token = await this.prisma.token.findUnique({
          where: { contractAddress },
          include: {
            rwaListing: {
              include: {
                owner: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        });
        rwaListing = token?.rwaListing;
      } catch (relationError) {
        // If rwaListing relationship fails, fetch separately
        console.warn(
          `Failed to fetch token with rwaListing relationship, falling back to separate queries:`,
          relationError,
        );

        token = await this.prisma.token.findUnique({
          where: { contractAddress },
        });

        // Try to fetch listing separately if token exists
        if (token?.rwaListingId) {
          try {
            const listing = await this.prisma.rwaListing.findUnique({
              where: { id: token.rwaListingId },
              include: {
                owner: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            });
            rwaListing = listing;
          } catch (listingError) {
            console.warn(`Could not fetch separate rwaListing:`, listingError);
            rwaListing = null;
          }
        }
      }

      if (!token) return null;

      // Combine token with listing data
      return {
        ...token,
        rwaListing,
      } as TokenWithListing;
    } catch (error) {
      logger.error(`Error fetching token by contract address ${contractAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get all tokens (admin endpoint)
   */
  async getAllTokens(): Promise<TokenWithListing[]> {
    try {
      const tokens = await this.prisma.token.findMany({
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return tokens as TokenWithListing[];
    } catch (error) {
      logger.error('Error fetching all tokens:', error);
      throw error;
    }
  }

  /**
   * Get tokens by user
   */
  async getTokensByUser(userId: string): Promise<TokenWithListing[]> {
    try {
      const tokens = await this.prisma.token.findMany({
        where: { userId },
        include: {
          rwaListing: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return tokens as TokenWithListing[];
    } catch (error) {
      logger.error(`Error fetching tokens for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete token (admin only)
   */
  async deleteToken(tokenId: string): Promise<void> {
    try {
      await this.prisma.token.delete({
        where: { id: tokenId },
      });

      logger.info(`Successfully deleted token: ${tokenId}`);
    } catch (error) {
      logger.error(`Error deleting token ${tokenId}:`, error);
      throw error;
    }
  }
}
