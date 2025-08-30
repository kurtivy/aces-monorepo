// backend/src/services/account-verification-service.ts - V1 Clean Implementation
import {
  PrismaClient,
  VerificationStatus,
  DocumentType,
  AccountVerification,
} from '@prisma/client';
import { errors } from '../lib/errors';
import { MultipartFile } from '@fastify/multipart';
import { SecureStorageService } from '../lib/secure-storage-utils';
import { VisionService } from '../lib/vision-service';

export interface DocumentAnalysisResults {
  faceComparison: {
    match: boolean;
    similarity: number;
  };
  documentAnalysis: {
    isValid: boolean;
    confidence: number;
  };
  overallScore: number;
  reasons: string[];
}

export interface CreateVerificationData {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  countryOfIssue: string;
  state?: string;
  address: string;
  emailAddress: string;
  selfieImageUrl: string | null;
  facialComparisonScore: number | null;
  visionApiRecommendation: string | null;
  documentAnalysisResults: DocumentAnalysisResults | null;
  facialVerificationAt: Date | null;
}

export interface VerificationWithUser extends AccountVerification {
  user: {
    id: string;
    email: string | null;
    walletAddress: string | null;
    createdAt: Date;
  } | null;
  reviewer: {
    id: string;
    email: string | null;
  } | null;
}

export class AccountVerificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Submit a new verification request
   */
  async submitVerification(
    userId: string,
    data: CreateVerificationData,
    documentFile?: MultipartFile & { buffer?: Buffer },
  ) {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { accountVerification: true },
      });

      if (!user) {
        throw errors.notFound('User not found');
      }

      // Check rate limiting (max 3 attempts)
      if (user.accountVerification && user.accountVerification.attempts >= 3) {
        const lastAttempt = user.accountVerification.lastAttemptAt;
        if (lastAttempt && Date.now() - lastAttempt.getTime() < 24 * 60 * 60 * 1000) {
          throw errors.badRequest('Too many verification attempts. Please try again in 24 hours.');
        }
      }

      // Upload document if provided
      let documentImageUrl: string | null = null;
      if (documentFile) {
        try {
          documentImageUrl = await SecureStorageService.uploadSecureDocument(
            documentFile,
            userId,
            data.documentType,
          );
        } catch (error) {
          console.error('Document upload failed:', error);
          // For development/testing: Continue without document upload if GCS is not configured
          if (
            error instanceof Error &&
            error.message.includes('Google Cloud Storage not configured')
          ) {
            console.warn(
              'Continuing verification submission without document upload (GCS not configured)',
            );
            documentImageUrl = `mock://verification/${userId}/${data.documentType}/${Date.now()}.jpg`;
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      }

      // Create or update verification record
      const verification = await this.prisma.accountVerification.upsert({
        where: { userId },
        create: {
          userId,
          ...data,
          documentImageUrl,
          status: VerificationStatus.PENDING,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
        update: {
          ...data,
          documentImageUrl,
          status: VerificationStatus.PENDING,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true,
            },
          },
        },
      });

      return verification;
    } catch (error) {
      console.error('Error submitting verification:', error);
      throw error;
    }
  }

  /**
   * Get verification by user ID
   */
  async getVerificationByUserId(userId: string): Promise<VerificationWithUser | null> {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return verification as VerificationWithUser | null;
    } catch (error) {
      console.error('Error getting verification:', error);
      throw error;
    }
  }

  /**
   * Get user's verification status (simplified)
   */
  async getUserVerificationStatus(userId: string) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
        select: {
          status: true,
          attempts: true,
          lastAttemptAt: true,
          rejectionReason: true,
        },
      });

      return {
        status: verification?.status || null,
        attempts: verification?.attempts || 0,
        lastAttemptAt: verification?.lastAttemptAt || null,
        rejectionReason: verification?.rejectionReason || null,
        canSubmit: verification
          ? verification.attempts < 3 ||
            Date.now() - verification.lastAttemptAt.getTime() >= 24 * 60 * 60 * 1000
          : true,
      };
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw error;
    }
  }

  /**
   * Review verification (admin only)
   */
  async reviewVerification(
    verificationId: string,
    reviewerId: string,
    decision: VerificationStatus,
    rejectionReason?: string,
  ) {
    if (decision === VerificationStatus.PENDING) {
      throw errors.badRequest('Cannot set verification status to pending during review');
    }

    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { id: verificationId },
      });

      if (!verification) {
        throw errors.notFound('Verification not found');
      }

      if (verification.status !== VerificationStatus.PENDING) {
        throw errors.badRequest('Verification has already been reviewed');
      }

      const updatedVerification = await this.prisma.accountVerification.update({
        where: { id: verificationId },
        data: {
          status: decision,
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          rejectionReason: decision === VerificationStatus.REJECTED ? rejectionReason : null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return updatedVerification;
    } catch (error) {
      console.error('Error reviewing verification:', error);
      throw error;
    }
  }

  /**
   * Get all pending verifications (admin only)
   */
  async getPendingVerifications(): Promise<VerificationWithUser[]> {
    try {
      const verifications = await this.prisma.accountVerification.findMany({
        where: { status: VerificationStatus.PENDING },
        orderBy: { submittedAt: 'asc' }, // FIFO order
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return verifications as VerificationWithUser[];
    } catch (error) {
      console.error('Error getting pending verifications:', error);
      throw error;
    }
  }

  /**
   * Get all verifications (admin only)
   */
  async getAllVerifications(): Promise<VerificationWithUser[]> {
    try {
      const verifications = await this.prisma.accountVerification.findMany({
        orderBy: { submittedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return verifications as VerificationWithUser[];
    } catch (error) {
      console.error('Error getting all verifications:', error);
      throw error;
    }
  }

  /**
   * Delete verification document
   */
  async deleteVerificationDocument(userId: string): Promise<boolean> {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
      });

      if (!verification?.documentImageUrl) {
        return false;
      }

      await SecureStorageService.deleteSecureDocumentByUrl(verification.documentImageUrl);

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

  /**
   * Submit facial verification (selfie)
   */
  async submitFacialVerification(userId: string, selfieFile: MultipartFile & { buffer: Buffer }) {
    try {
      console.log('🔍 Starting facial verification for user:', userId);

      // Check if user has a verification record with document
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
      });

      if (!verification) {
        throw errors.badRequest('Please submit document verification first');
      }

      if (!verification.documentImageUrl) {
        throw errors.badRequest('Document image is required for facial verification');
      }

      // Upload selfie to secure storage
      let selfieImageUrl: string;
      try {
        selfieImageUrl = await SecureStorageService.uploadSecureDocument(
          selfieFile,
          userId,
          'SELFIE',
        );
      } catch (error) {
        console.error('Selfie upload failed:', error);
        // For development/testing: Continue without selfie upload if GCS is not configured
        if (
          error instanceof Error &&
          error.message.includes('Google Cloud Storage not configured')
        ) {
          console.warn('Continuing facial verification without selfie upload (GCS not configured)');
          selfieImageUrl = `mock://selfie/${userId}/${Date.now()}.jpg`;
        } else {
          throw error;
        }
      }

      // Process with Google Vision API
      console.log('🔍 Processing with Google Vision API...');
      const visionResult = await VisionService.analyzeVerification(
        verification.documentImageUrl,
        selfieFile.buffer,
      );

      console.log('✅ Vision API analysis completed:', {
        overallScore: visionResult.overallScore,
        recommendation: visionResult.recommendation,
        faceMatch: visionResult.faceComparison.match,
      });

      // Update verification record with Vision API results
      const updatedVerification = await this.prisma.accountVerification.update({
        where: { userId },
        data: {
          selfieImageUrl,
          facialComparisonScore: visionResult.faceComparison.similarity,
          visionApiRecommendation: visionResult.recommendation,
          documentAnalysisResults: {
            faceComparison: visionResult.faceComparison,
            documentAnalysis: visionResult.documentAnalysis,
            overallScore: visionResult.overallScore,
            reasons: visionResult.reasons,
          },
          facialVerificationAt: new Date(),
        } as any,
      });

      return {
        verificationId: updatedVerification.id,
        facialVerificationStatus: 'COMPLETED',
        overallScore: visionResult.overallScore,
        faceComparisonScore: visionResult.faceComparison.similarity,
        visionApiRecommendation: visionResult.recommendation,
        recommendation: visionResult.recommendation,
        message: this.getVerificationMessage(visionResult.recommendation, visionResult.reasons),
      };
    } catch (error) {
      console.error('Error in facial verification:', error);
      throw error;
    }
  }

  /**
   * Get facial verification status
   */
  async getFacialVerificationStatus(userId: string) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
      });

      if (!verification) {
        return {
          facialVerificationStatus: 'NOT_STARTED',
          canStartFacialVerification: false,
          reason: 'Please submit document verification first',
        };
      }

      if (!verification.documentImageUrl) {
        return {
          facialVerificationStatus: 'NOT_STARTED',
          canStartFacialVerification: false,
          reason: 'Document image is required for facial verification',
        };
      }

      if (!(verification as any).selfieImageUrl) {
        return {
          facialVerificationStatus: 'NOT_STARTED',
          canStartFacialVerification: true,
        };
      }

      if (!(verification as any).facialVerificationAt) {
        return {
          facialVerificationStatus: 'PENDING',
          canStartFacialVerification: false,
          reason: 'Facial verification is being processed',
        };
      }

      return {
        facialVerificationStatus: 'COMPLETED',
        canStartFacialVerification: false,
        overallScore: (verification as any).documentAnalysisResults?.overallScore,
        faceComparisonScore: (verification as any).facialComparisonScore,
        visionApiRecommendation: (verification as any).visionApiRecommendation,
      };
    } catch (error) {
      console.error('Error getting facial verification status:', error);
      throw error;
    }
  }

  /**
   * Check if user is ready for facial verification
   */
  async isReadyForFacialVerification(userId: string) {
    try {
      const verification = await this.prisma.accountVerification.findUnique({
        where: { userId },
      });

      if (!verification) {
        return {
          ready: false,
          requiresDocumentFirst: true,
          reason: 'Please submit document verification first',
        };
      }

      if (!verification.documentImageUrl) {
        return {
          ready: false,
          requiresDocumentFirst: true,
          reason: 'Document image is required for facial verification',
        };
      }

      if ((verification as any).selfieImageUrl && (verification as any).facialVerificationAt) {
        return {
          ready: false,
          requiresDocumentFirst: false,
          reason: 'Facial verification already completed',
        };
      }

      return {
        ready: true,
        requiresDocumentFirst: false,
      };
    } catch (error) {
      console.error('Error checking facial verification readiness:', error);
      throw error;
    }
  }

  /**
   * Get verification message based on recommendation
   */
  private getVerificationMessage(recommendation: string, reasons: string[]): string {
    switch (recommendation) {
      case 'APPROVE':
        return 'Facial verification completed successfully. Your identity has been verified.';
      case 'REJECT':
        return `Facial verification failed: ${reasons.join(', ')}. Please try again with a clearer photo.`;
      case 'MANUAL_REVIEW':
        return `Facial verification completed but requires manual review: ${reasons.join(', ')}. We'll notify you of the result.`;
      default:
        return 'Facial verification completed.';
    }
  }
}
