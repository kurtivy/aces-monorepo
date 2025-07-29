import { PrismaClient, SellerStatus, VerificationStatus } from '@prisma/client';
import { errors } from '../lib/errors';
import { MultipartFile } from '@fastify/multipart';
import { uploadSecureDocument, deleteSecureDocumentByUrl } from '../lib/secure-storage-utils';

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
        console.log('Uploading new document');
        documentImageUrl = await uploadSecureDocument(documentFile, userId, data.documentType);
        console.log('Document uploaded successfully:', documentImageUrl);
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

  async getVerificationById(verificationId: string) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { id: verificationId },
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
      console.error('Error getting verification by ID:', error);
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

      await deleteSecureDocumentByUrl(user.accountVerification.documentImageUrl);

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
      return this.prisma.accountVerification.findMany({
        where: { status: VerificationStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              createdAt: true,
            },
          },
        },
        orderBy: { submittedAt: 'asc' }, // FIFO order
      });
    } catch (error) {
      console.error('Error getting pending verifications:', error);
      throw error;
    }
  }
}
