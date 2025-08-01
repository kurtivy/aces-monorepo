import { PrismaClient, SellerStatus, VerificationStatus, Prisma } from '@prisma/client';
import { errors } from '../lib/errors';
import { MultipartFile } from '@fastify/multipart';
import { SecureStorageService } from '../lib/secure-storage-utils';

export class AccountVerificationService {
  constructor(private prisma: PrismaClient) {}

  async submitVerification(
    userId: string,
    data: {
      documentType: string;
      documentNumber: string;
      firstName: string; // Changed from fullName to firstName/lastName
      lastName: string;
      dateOfBirth: Date;
      countryOfIssue: string;
      state?: string;
      address: string;
      emailAddress: string;
      twitter?: string; // New optional field
      website?: string; // New optional field
    },
    documentFile?: MultipartFile & { buffer?: Buffer },
  ) {
    console.log('Starting verification submission for user:', userId);

    try {
      // Check rate limiting
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { accountVerification: true }, // Changed from verification to accountVerification
      });

      console.log('Found user:', { userId, hasVerification: !!user?.accountVerification });

      if (!user) throw errors.notFound('User not found');

      // Check if user can submit (max 3 attempts per 24h)
      if (user.verificationAttempts >= 3) {
        const lastAttempt = user.lastVerificationAttempt;
        if (lastAttempt && Date.now() - lastAttempt.getTime() < 24 * 60 * 60 * 1000) {
          console.log('Too many attempts:', { attempts: user.verificationAttempts, lastAttempt });
          throw errors.badRequest('Too many verification attempts. Please try again in 24 hours.');
        }
        // Reset counter if 24h passed
        console.log('Resetting attempt counter');
        await this.prisma.user.update({
          where: { id: userId },
          data: { verificationAttempts: 0 },
        });
      }

      // Delete previous document if it exists
      if (user.accountVerification?.documentImageUrl) {
        console.log('Deleting previous document');
        await this.deleteVerificationDocument(userId);
      }

      // Upload document if provided
      let documentImageUrl: string | null = null;
      if (documentFile) {
        console.log('Uploading new document to Google Cloud Secure Storage');
        documentImageUrl = await SecureStorageService.uploadSecureDocument(
          documentFile,
          userId,
          data.documentType,
        );
        console.log(
          'Document uploaded successfully to Google Cloud Secure Storage:',
          documentImageUrl,
        );
      } else {
        console.log('No document file provided - skipping upload');
      }

      // Use transaction to ensure all operations succeed or fail together
      console.log('Starting database transaction');
      const result = await this.prisma.$transaction(async (tx) => {
        // Create or update verification record
        console.log('Creating verification record');
        const verification = await tx.accountVerification.upsert({
          where: { userId },
          create: {
            ...data,
            userId,
            documentImageUrl,
            status: VerificationStatus.PENDING,
            attempts: 1,
          },
          update: {
            ...data,
            documentImageUrl,
            status: VerificationStatus.PENDING,
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });

        // Update user attempts
        console.log('Updating user verification attempts');
        await tx.user.update({
          where: { id: userId },
          data: {
            verificationAttempts: { increment: 1 },
            lastVerificationAttempt: new Date(),
            sellerStatus: SellerStatus.PENDING,
          },
        });

        // Log audit trail
        console.log('Creating audit log');
        await tx.verificationAuditLog.create({
          data: {
            verificationId: verification.id,
            action: 'SUBMITTED',
            actorId: userId,
            timestamp: new Date(),
            details: { documentType: data.documentType },
          },
        });

        console.log('Transaction completed successfully');
        return verification;
      });

      console.log('Verification submitted successfully');
      return result;
    } catch (error) {
      console.error('Error in submitVerification:', error);
      // Clean up uploaded file on error
      if (documentFile) {
        try {
          await this.deleteVerificationDocument(userId);
        } catch (cleanupError) {
          console.error('Error cleaning up document:', cleanupError);
        }
      }
      throw error;
    }
  }

  async reviewVerification(
    verificationId: string,
    reviewerId: string,
    decision: VerificationStatus,
    rejectionReason?: string,
  ) {
    if (decision === VerificationStatus.PENDING) {
      throw errors.badRequest('Cannot set verification status to pending during review');
    }

    console.log('Reviewing verification:', { verificationId, decision, reviewerId });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Get verification with user info
        const verification = await tx.accountVerification.findUnique({
          where: { id: verificationId },
          include: { user: true },
        });

        if (!verification) {
          throw errors.notFound('Verification not found');
        }

        if (verification.status !== VerificationStatus.PENDING) {
          throw errors.badRequest('Verification has already been reviewed');
        }

        // Update verification status
        const updatedVerification = await tx.accountVerification.update({
          where: { id: verificationId },
          data: {
            status: decision,
            reviewedAt: new Date(),
            reviewedBy: reviewerId,
            rejectionReason: decision === VerificationStatus.REJECTED ? rejectionReason : null,
          },
        });

        // Update user seller status
        const newSellerStatus =
          decision === VerificationStatus.APPROVED ? SellerStatus.APPROVED : SellerStatus.REJECTED;

        await tx.user.update({
          where: { id: verification.userId },
          data: {
            sellerStatus: newSellerStatus,
            verifiedAt: decision === VerificationStatus.APPROVED ? new Date() : null,
            rejectedAt: decision === VerificationStatus.REJECTED ? new Date() : null,
            rejectionReason: decision === VerificationStatus.REJECTED ? rejectionReason : null,
          },
        });

        // Log audit trail
        await tx.verificationAuditLog.create({
          data: {
            verificationId: verification.id,
            action: decision === VerificationStatus.APPROVED ? 'APPROVED' : 'REJECTED',
            actorId: reviewerId,
            timestamp: new Date(),
            details: {
              rejectionReason,
              previousStatus: VerificationStatus.PENDING,
              newStatus: decision,
            },
          },
        });

        return updatedVerification;
      });

      console.log('Verification reviewed successfully');
      return result;
    } catch (error) {
      console.error('Error in reviewVerification:', error);
      throw error;
    }
  }

  async getVerificationByUserId(userId: string) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              sellerStatus: true,
              verificationAttempts: true,
              lastVerificationAttempt: true,
            },
          },
        },
      });

      return verification;
    } catch (error) {
      console.error('Error getting verification:', error);
      throw error;
    }
  }

  async deleteVerificationDocument(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { accountVerification: true },
      });

      if (!user?.accountVerification?.documentImageUrl) {
        return false;
      }

      await SecureStorageService.deleteSecureDocumentByUrl(
        user.accountVerification.documentImageUrl,
      );

      // Update verification record to remove document URL
      await this.prisma.accountVerification.update({
        where: { userId },
        data: { documentImageUrl: null },
      });

      return true;
    } catch (error) {
      console.error('Error deleting verification document:', error);
      throw error;
    }
  }

  async getUserVerificationStatus(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { accountVerification: true },
      });

      if (!user) throw errors.notFound('User not found');

      return {
        sellerStatus: user.sellerStatus,
        verificationAttempts: user.verificationAttempts,
        lastVerificationAttempt: user.lastVerificationAttempt,
        verificationDetails: user.accountVerification,
      };
    } catch (error) {
      console.error('Error getting user verification status:', error);
      throw error;
    }
  }

  async getAllPendingVerifications() {
    try {
      // Get verifications without includes first to avoid orphaned relationship errors
      const verifications = await this.prisma.accountVerification.findMany({
        where: { status: VerificationStatus.PENDING },
        orderBy: { submittedAt: 'asc' }, // FIFO order
      });

      // Manually fetch user data for each verification to handle orphaned records
      const verificationsWithUsers = await Promise.all(
        verifications.map(async (verification) => {
          let user = null;
          try {
            user = await this.prisma.user.findUnique({
              where: { id: verification.userId },
              select: {
                id: true,
                displayName: true,
                email: true,
                createdAt: true,
              },
            });
          } catch (error) {
            console.warn(
              `Failed to fetch user ${verification.userId} for verification ${verification.id}:`,
              error,
            );
          }

          return {
            ...verification,
            user,
          };
        }),
      );

      return verificationsWithUsers;
    } catch (error) {
      console.error('Error getting pending verifications:', error);
      throw error;
    }
  }

  async getAllVerifications() {
    try {
      // Get all verifications without includes first to avoid orphaned relationship errors
      const verifications = await this.prisma.accountVerification.findMany({
        orderBy: { submittedAt: 'desc' },
      });

      // Manually fetch all relationships for each verification to handle orphaned records
      const verificationsWithRelations = await Promise.all(
        verifications.map(async (verification) => {
          // Safely fetch user
          let user = null;
          try {
            user = await this.prisma.user.findUnique({
              where: { id: verification.userId },
              select: {
                id: true,
                displayName: true,
                email: true,
                createdAt: true,
              },
            });
          } catch (error) {
            console.warn(
              `Failed to fetch user ${verification.userId} for verification ${verification.id}:`,
              error,
            );
          }

          // Safely fetch reviewer
          let reviewer = null;
          if (verification.reviewedBy) {
            try {
              reviewer = await this.prisma.user.findUnique({
                where: { id: verification.reviewedBy },
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              });
            } catch (error) {
              console.warn(
                `Failed to fetch reviewer ${verification.reviewedBy} for verification ${verification.id}:`,
                error,
              );
            }
          }

          return {
            ...verification,
            user,
            reviewer,
          };
        }),
      );

      return verificationsWithRelations;
    } catch (error) {
      console.error('Error getting all verifications:', error);
      throw error;
    }
  }

  /**
   * Create a verification record (used for testing)
   */
  async createVerification(
    userId: string,
    data: {
      documentType: string;
      documentNumber: string;
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
      countryOfIssue: string;
      state?: string;
      address: string;
      emailAddress: string;
      twitter?: string;
      website?: string;
      documentImageUrl?: string;
    },
  ) {
    try {
      console.log('Creating verification record for user:', userId);

      // Check if user already has a verification
      const existingVerification = await this.prisma.accountVerification.findUnique({
        where: { userId },
      });

      if (existingVerification) {
        console.log('Verification already exists for user:', userId);

        // If this is for testing and we have a documentImageUrl, update the existing record
        if (data.documentImageUrl) {
          console.log('Updating existing verification with test document URL');
          const updatedVerification = await this.prisma.accountVerification.update({
            where: { id: existingVerification.id },
            data: {
              documentImageUrl: data.documentImageUrl,
              status: VerificationStatus.PENDING,
            },
          });

          // Also ensure user status is PENDING
          await this.prisma.user.update({
            where: { id: userId },
            data: { sellerStatus: SellerStatus.PENDING },
          });

          console.log('Existing verification updated with documentImageUrl');
          return updatedVerification;
        }

        return existingVerification;
      }

      // Create the verification record
      const verification = await this.prisma.accountVerification.create({
        data: {
          userId,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          countryOfIssue: data.countryOfIssue,
          state: data.state,
          address: data.address,
          emailAddress: data.emailAddress,
          twitter: data.twitter,
          website: data.website,
          documentImageUrl: data.documentImageUrl,
          status: VerificationStatus.PENDING,
        },
      });

      // Update user's seller status to PENDING
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          sellerStatus: SellerStatus.PENDING,
        },
      });

      console.log('Verification record created successfully:', verification.id);
      return verification;
    } catch (error) {
      console.error('Error creating verification:', error);
      throw error;
    }
  }

  /**
   * Upload selfie image to Google Cloud Secure Storage
   */
  async uploadSelfieImage(
    selfieFile: MultipartFile & { buffer?: Buffer },
    userId: string,
  ): Promise<string> {
    try {
      console.log('Uploading selfie image to Google Cloud Secure Storage for user:', userId);

      const selfieImageUrl = await SecureStorageService.uploadSecureDocument(
        selfieFile,
        userId,
        'selfie',
      );
      console.log('Selfie uploaded successfully to Google Cloud Secure Storage:', selfieImageUrl);

      return selfieImageUrl;
    } catch (error) {
      console.error('Error uploading selfie image:', error);
      throw error;
    }
  }

  /**
   * Update facial verification data for a verification record
   */
  async updateFacialVerification(
    verificationId: string,
    facialData: {
      selfieImageUrl?: string;
      facialVerificationStatus?: string;
      facialAnalysisResults?: Prisma.InputJsonValue;
      faceComparisonScore?: number;
      overallVerificationScore?: number;
      visionApiRecommendation?: string;
      facialVerificationAt?: Date;
    },
  ) {
    try {
      console.log('Updating facial verification data:', { verificationId, facialData });

      const updatedVerification = await this.prisma.accountVerification.update({
        where: { id: verificationId },
        data: facialData,
      });

      console.log('Facial verification data updated successfully');
      return updatedVerification;
    } catch (error) {
      console.error('Error updating facial verification:', error);
      throw error;
    }
  }

  /**
   * Get verification by ID (needed for facial verification)
   */
  async getVerificationById(verificationId: string) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { id: verificationId },
        include: {
          user: true,
          reviewer: true,
        },
      });

      return verification;
    } catch (error) {
      console.error('Error getting verification by ID:', error);
      throw error;
    }
  }
}
