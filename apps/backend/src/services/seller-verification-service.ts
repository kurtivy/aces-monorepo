import { PrismaClient, SellerStatus, VerificationStatus } from '@prisma/client';
import { errors } from '../lib/errors';
import { MultipartFile } from '@fastify/multipart';
import { uploadVerificationDocument, deleteVerificationDocument } from '../lib/storage-utils';

export class SellerVerificationService {
  constructor(private prisma: PrismaClient) {}

  async submitVerification(
    userId: string,
    data: {
      documentType: string;
      documentNumber: string;
      fullName: string;
      dateOfBirth: Date;
      countryOfIssue: string;
      state?: string;
      address: string;
      emailAddress: string;
    },
    documentFile: MultipartFile & { buffer?: Buffer },
  ) {
    console.log('Starting verification submission for user:', userId);

    try {
      // Check rate limiting
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { verification: true },
      });

      console.log('Found user:', { userId, hasVerification: !!user?.verification });

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
      if (user.verification?.documentImageUrl) {
        console.log('Deleting previous document');
        await this.deleteVerificationDocument(userId);
      }

      // Upload document
      console.log('Uploading new document');
      const documentImageUrl = await uploadVerificationDocument(documentFile, userId);
      console.log('Document uploaded successfully:', documentImageUrl);

      // Use transaction to ensure all operations succeed or fail together
      console.log('Starting database transaction');
      const result = await this.prisma.$transaction(async (tx) => {
        // Create or update verification record
        console.log('Creating verification record');
        const verification = await tx.sellerVerification.upsert({
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
        console.log('Verification record created:', verification.id);

        // Update user status
        console.log('Updating user status');
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            sellerStatus: SellerStatus.PENDING,
            verificationAttempts: { increment: 1 },
            lastVerificationAttempt: new Date(),
            appliedAt: new Date(),
          },
        });
        console.log('User status updated:', { sellerStatus: updatedUser.sellerStatus });

        // Create audit log
        console.log('Creating audit log');
        const auditLog = await tx.verificationAuditLog.create({
          data: {
            verificationId: verification.id,
            action: 'SUBMIT',
            actorId: userId,
            details: { documentType: data.documentType },
          },
        });
        console.log('Audit log created:', auditLog.id);

        return { verification, user: updatedUser, auditLog };
      });

      console.log('Transaction completed successfully');
      return {
        success: true,
        verification: result.verification,
        message: 'Verification submitted successfully',
      };
    } catch (error) {
      console.error('Verification submission error:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      throw errors.internal('Failed to submit verification', { cause: error });
    }
  }

  async deleteVerificationDocument(userId: string): Promise<void> {
    try {
      const verification = await this.prisma.sellerVerification.findUnique({
        where: { userId },
        select: {
          id: true,
          documentImageUrl: true,
        },
      });

      if (verification?.documentImageUrl) {
        await deleteVerificationDocument(verification.documentImageUrl);

        // Update the verification record to remove the URL
        await this.prisma.sellerVerification.update({
          where: { userId },
          data: { documentImageUrl: null },
        });

        // Create audit log
        await this.prisma.verificationAuditLog.create({
          data: {
            verificationId: verification.id,
            action: 'DELETE_DOCUMENT',
            actorId: userId,
            details: { reason: 'User requested document deletion' },
          },
        });
      }
    } catch (error) {
      console.error('Document deletion error:', error);
      throw errors.internal('Failed to delete verification document', { cause: error });
    }
  }

  async processVerification(
    verificationId: string,
    adminId: string,
    approved: boolean,
    rejectionReason?: string,
  ) {
    const verification = await this.prisma.sellerVerification.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });

    if (!verification) throw errors.notFound('Verification not found');
    if (verification.status !== VerificationStatus.PENDING) {
      throw errors.badRequest('Verification has already been processed');
    }

    const newStatus = approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
    const newSellerStatus = approved ? SellerStatus.APPROVED : SellerStatus.REJECTED;

    await this.prisma.$transaction([
      // Update verification
      this.prisma.sellerVerification.update({
        where: { id: verificationId },
        data: {
          status: newStatus,
          rejectionReason: approved ? null : rejectionReason,
          reviewedAt: new Date(),
          reviewedBy: adminId,
        },
      }),
      // Update user
      this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          sellerStatus: newSellerStatus,
          verifiedAt: approved ? new Date() : null,
          rejectedAt: approved ? null : new Date(),
          rejectionReason: approved ? null : rejectionReason,
          role: approved ? 'SELLER' : 'TRADER',
        },
      }),
      // Create audit log
      this.prisma.verificationAuditLog.create({
        data: {
          verificationId,
          action: approved ? 'APPROVE' : 'REJECT',
          actorId: adminId,
          details: approved ? {} : { reason: rejectionReason },
        },
      }),
    ]);

    return { success: true };
  }

  async getVerificationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true },
    });

    if (!user) throw errors.notFound('User not found');

    return {
      status: user.sellerStatus,
      verificationDetails: user.verification,
      canReapply:
        user.verificationAttempts < 3 ||
        (user.lastVerificationAttempt &&
          Date.now() - user.lastVerificationAttempt.getTime() >= 24 * 60 * 60 * 1000),
    };
  }

  async getPendingVerifications() {
    return this.prisma.sellerVerification.findMany({
      where: { status: VerificationStatus.PENDING },
      include: { user: true },
      orderBy: { submittedAt: 'asc' },
    });
  }
}
