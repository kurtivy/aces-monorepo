// import { PrismaClient } from '@prisma/client';
// import { logger } from '../lib/logger';

// interface CreateListingFromSubmissionData {
//   submissionId: string;
//   approvedBy: string;
// }

// interface UpdateListingStatusData {
//   listingId: string;
//   isLive: boolean;
//   updatedBy: string;
// }

// export class ListingService {
//   constructor(private prisma: PrismaClient) {}

//   /**
//    * Automatically creates an RWAListing when an RWASubmission is approved
//    * This is called when a submission status changes to APPROVED
//    */
//   async createListingFromApprovedSubmission({
//     submissionId,
//     approvedBy,
//   }: CreateListingFromSubmissionData) {
//     try {
//       logger.info(`Creating RWAListing from approved submission: ${submissionId}`);

//       // Get the approved submission with all necessary data
//       const submission = await this.prisma.rwaSubmission.findUnique({
//         where: { id: submissionId },
//         include: {
//           owner: true,
//         },
//       });

//       if (!submission) {
//         throw new Error(`RWASubmission with id ${submissionId} not found`);
//       }

//       if (submission.status !== 'APPROVED') {
//         throw new Error(`Cannot create listing from submission with status: ${submission.status}`);
//       }

//       // Check if listing already exists for this submission
//       const existingListing = await this.prisma.rwaListing.findUnique({
//         where: { rwaSubmissionId: submissionId },
//       });

//       if (existingListing) {
//         logger.warn(`RWAListing already exists for submission: ${submissionId}`);
//         return existingListing;
//       }

//       // Create the RWAListing with data from the approved submission
//       const listing = await this.prisma.rwaListing.create({
//         data: {
//           title: submission.title,
//           symbol: submission.symbol,
//           description: submission.description,
//           assetType: submission.assetType,
//           imageGallery: submission.imageGallery,
//           contractAddress: submission.contractAddress,
//           location: submission.location,
//           email: submission.email,
//           isLive: false, // Always start as not live
//           rwaSubmissionId: submission.id,
//           ownerId: submission.ownerId,
//           updatedBy: approvedBy,
//         },
//         include: {
//           owner: true,
//           rwaSubmission: true,
//           approvedBy: true,
//         },
//       });

//       logger.info(
//         `Successfully created RWAListing: ${listing.id} from submission: ${submissionId}`,
//       );

//       return listing;
//     } catch (error) {
//       logger.error(`Error creating listing from submission ${submissionId}:`, error);
//       throw error;
//     }
//   }

//   /**
//    * Updates the isLive status of an RWAListing
//    * This controls whether the listing appears on the platform
//    */
//   async updateListingStatus({ listingId, isLive, updatedBy }: UpdateListingStatusData) {
//     try {
//       logger.info(`Updating listing ${listingId} status to isLive: ${isLive}`);

//       const listing = await this.prisma.rwaListing.update({
//         where: { id: listingId },
//         data: {
//           isLive,
//           updatedBy,
//           updatedAt: new Date(),
//         },
//         include: {
//           owner: true,
//           rwaSubmission: true,
//           approvedBy: true,
//         },
//       });

//       logger.info(`Successfully updated listing ${listingId} status to isLive: ${isLive}`);

//       return listing;
//     } catch (error) {
//       logger.error(`Error updating listing ${listingId} status:`, error);
//       throw error;
//     }
//   }

//   /**
//    * Get all live listings for the platform
//    */
//   async getLiveListings() {
//     try {
//       const listings = await this.prisma.rwaListing.findMany({
//         where: { isLive: true },
//         include: {
//           owner: {
//             select: {
//               id: true,
//               displayName: true,
//               avatar: true,
//               walletAddress: true,
//             },
//           },
//           bids: {
//             take: 5,
//             orderBy: { createdAt: 'desc' },
//             include: {
//               bidder: {
//                 select: {
//                   id: true,
//                   displayName: true,
//                   avatar: true,
//                 },
//               },
//             },
//           },
//           token: true,
//         },
//         orderBy: { createdAt: 'desc' },
//       });

//       return listings;
//     } catch (error) {
//       logger.error('Error fetching live listings:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get all listings for admin view (including not live ones)
//    */
//   async getAllListings() {
//     try {
//       // First get all listings without any includes to avoid orphaned relationship errors
//       const listings = await this.prisma.rwaListing.findMany({
//         orderBy: { createdAt: 'desc' },
//       });

//       // Then manually fetch all relationships for each listing to handle orphaned records
//       const listingsWithRelations = await Promise.all(
//         listings.map(async (listing) => {
//           // Safely fetch owner with account verification
//           let owner = null;
//           try {
//             owner = await this.prisma.user.findUnique({
//               where: { id: listing.ownerId },
//               select: {
//                 id: true,
//                 displayName: true,
//                 avatar: true,
//                 walletAddress: true,
//               },
//             });

//             // Also fetch account verification for the owner
//             if (owner) {
//               try {
//                 const verification = await this.prisma.accountVerification.findUnique({
//                   where: { userId: listing.ownerId },
//                   select: {
//                     firstName: true,
//                     lastName: true,
//                     status: true,
//                   },
//                 });

//                 // Add verification data to owner object
//                 (owner as any).accountVerification = verification;
//               } catch (verificationError) {
//                 logger.warn(
//                   `Failed to fetch verification for owner ${listing.ownerId}:`,
//                   verificationError,
//                 );
//               }
//             }
//           } catch (error) {
//             logger.warn(
//               `Failed to fetch owner ${listing.ownerId} for listing ${listing.id}:`,
//               error,
//             );
//           }

//           // Safely fetch rwaSubmission
//           let rwaSubmission = null;
//           try {
//             rwaSubmission = await this.prisma.rwaSubmission.findUnique({
//               where: { id: listing.rwaSubmissionId },
//               select: {
//                 id: true,
//                 status: true,
//                 createdAt: true,
//               },
//             });
//           } catch (error) {
//             logger.warn(
//               `Failed to fetch submission ${listing.rwaSubmissionId} for listing ${listing.id}:`,
//               error,
//             );
//           }

//           // Safely fetch bids
//           let bids: Array<{
//             id: string;
//             amount: string;
//             currency: string;
//             createdAt: Date;
//             bidder: {
//               id: string;
//               displayName: string | null;
//               avatar: string | null;
//             };
//             verification: {
//               id: string;
//               status: string;
//             };
//           }> = [];
//           try {
//             bids = await this.prisma.bid.findMany({
//               where: { listingId: listing.id },
//               take: 5,
//               orderBy: { createdAt: 'desc' },
//               include: {
//                 bidder: {
//                   select: {
//                     id: true,
//                     displayName: true,
//                     avatar: true,
//                   },
//                 },
//                 verification: {
//                   select: {
//                     id: true,
//                     status: true,
//                   },
//                 },
//               },
//             });
//           } catch (error) {
//             logger.warn(`Failed to fetch bids for listing ${listing.id}:`, error);
//           }

//           // Safely fetch token
//           let token = null;
//           try {
//             token = await this.prisma.token.findUnique({
//               where: { rwaListingId: listing.id },
//             });
//           } catch (error) {
//             logger.warn(`Failed to fetch token for listing ${listing.id}:`, error);
//           }

//           return {
//             ...listing,
//             owner,
//             rwaSubmission,
//             bids,
//             token,
//           };
//         }),
//       );

//       return listingsWithRelations;
//     } catch (error) {
//       logger.error('Error fetching all listings:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get a specific listing by ID
//    */
//   async getListingById(listingId: string) {
//     try {
//       const listing = await this.prisma.rwaListing.findUnique({
//         where: { id: listingId },
//         include: {
//           owner: {
//             select: {
//               id: true,
//               displayName: true,
//               avatar: true,
//               walletAddress: true,
//             },
//           },
//           rwaSubmission: true,
//           bids: {
//             orderBy: { createdAt: 'desc' },
//             include: {
//               bidder: {
//                 select: {
//                   id: true,
//                   displayName: true,
//                   avatar: true,
//                 },
//               },
//               verification: {
//                 select: {
//                   id: true,
//                   status: true,
//                 },
//               },
//             },
//           },
//           token: true,
//           approvedBy: {
//             select: {
//               id: true,
//               displayName: true,
//             },
//           },
//         },
//       });

//       if (!listing) {
//         throw new Error(`RWAListing with id ${listingId} not found`);
//       }

//       return listing;
//     } catch (error) {
//       logger.error(`Error fetching listing ${listingId}:`, error);
//       throw error;
//     }
//   }

//   /**
//    * Get listings by owner
//    */
//   async getListingsByOwner(ownerId: string) {
//     try {
//       const listings = await this.prisma.rwaListing.findMany({
//         where: { ownerId },
//         include: {
//           rwaSubmission: {
//             select: {
//               id: true,
//               status: true,
//               createdAt: true,
//             },
//           },
//           bids: {
//             take: 5,
//             orderBy: { createdAt: 'desc' },
//             include: {
//               bidder: {
//                 select: {
//                   id: true,
//                   displayName: true,
//                   avatar: true,
//                 },
//               },
//               verification: {
//                 select: {
//                   id: true,
//                   status: true,
//                 },
//               },
//             },
//           },
//           token: true,
//         },
//         orderBy: { createdAt: 'desc' },
//       });

//       return listings;
//     } catch (error) {
//       logger.error(`Error fetching listings for owner ${ownerId}:`, error);
//       throw error;
//     }
//   }
// }
