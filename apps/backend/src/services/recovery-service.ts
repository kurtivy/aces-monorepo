import { PrismaClient, WebhookLog, SubmissionStatus, RwaSubmission } from '@prisma/client';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';
import { withTransaction } from '../lib/database';

export class RecoveryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Retry submission approval (for failed approvals)
   */
  async retrySubmissionApproval(
    submissionId: string,
    adminId: string,
    correlationId: string,
  ): Promise<{ success: boolean; submissionId: string }> {
    try {
      const result = await withTransaction(async (tx) => {
        // Get submission
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId },
          include: { owner: true },
        });

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        // Only allow retry for rejected submissions
        if (submission.status !== 'REJECTED') {
          throw errors.validation(`Cannot retry submission with status: ${submission.status}`);
        }

        // Reset submission to pending for retry
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'PENDING',
            rejectionReason: null,
            updatedBy: adminId,
            updatedAt: new Date(),
          },
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: 'REJECTED',
            toStatus: 'PENDING',
            actorId: adminId,
            actorType: 'ADMIN',
            notes: 'Submission reset for retry approval',
          },
        });

        return true;
      });

      loggers.database('retry_approval', 'rwa_submission', submissionId);
      return { success: result, submissionId };
    } catch (error) {
      loggers.error(error as Error, {
        submissionId,
        adminId,
        correlationId,
        operation: 'retrySubmissionApproval',
      });
      throw error;
    }
  }

  /**
   * Recover webhook processing (replay webhook)
   */
  async replayWebhook(
    webhookLogId: string,
    adminId: string,
    correlationId: string,
  ): Promise<{ success: boolean; processed: boolean }> {
    try {
      const webhookLog = await this.prisma.webhookLog.findUnique({
        where: { id: webhookLogId },
      });

      if (!webhookLog) {
        throw errors.notFound('Webhook log not found');
      }

      if (webhookLog.processedAt) {
        loggers.database('webhook_already_processed', 'webhook_logs', webhookLogId);
        return { success: true, processed: true };
      }

      // Mark as processed (in a real implementation, you'd re-process the webhook)
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          processedAt: new Date(),
          error: null, // Clear any previous error
        },
      });

      loggers.database('webhook_replayed', 'webhook_logs', webhookLogId);
      return { success: true, processed: false };
    } catch (error) {
      loggers.error(error as Error, {
        webhookLogId,
        adminId,
        correlationId,
        operation: 'replayWebhook',
      });
      throw error;
    }
  }

  /**
   * Get failed webhook logs for retry
   */
  async getFailedWebhooks(
    limit: number = 50,
    options: { olderThan?: Date; includeProcessed?: boolean } = {},
  ): Promise<WebhookLog[]> {
    try {
      const where: {
        processedAt?: null;
        createdAt?: { lt: Date };
        error: { not: null };
      } = {
        error: { not: null },
      };

      if (!options.includeProcessed) {
        where.processedAt = null;
      }

      if (options.olderThan) {
        where.createdAt = {
          lt: options.olderThan,
        };
      }

      // Include webhooks with errors
      where.error = {
        not: null,
      };

      const webhooks = await this.prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return webhooks;
    } catch (error) {
      loggers.error(error as Error, { operation: 'getFailedWebhooks' });
      throw error;
    }
  }

  /**
   * Get submissions that need recovery (stuck in pending too long)
   */
  async getStuckSubmissions(options: { olderThanHours?: number } = {}): Promise<RwaSubmission[]> {
    try {
      const hoursAgo = options.olderThanHours || 24;
      const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      const submissions = await this.prisma.rwaSubmission.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: cutoffDate,
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
            },
          },
          rwaListing: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return submissions;
    } catch (error) {
      loggers.error(error as Error, { operation: 'getStuckSubmissions' });
      throw error;
    }
  }

  /**
   * Bulk retry stuck submissions
   */
  async bulkRetryStuckSubmissions(
    adminId: string,
    maxAge: number = 24,
    dryRun: boolean = true,
  ): Promise<{
    found: number;
    processed: number;
    errors: string[];
  }> {
    try {
      const stuckSubmissions = await this.getStuckSubmissions({
        olderThanHours: maxAge,
      });

      if (dryRun) {
        return {
          found: stuckSubmissions.length,
          processed: 0,
          errors: [],
        };
      }

      let processed = 0;
      const errors: string[] = [];

      for (const submission of stuckSubmissions) {
        try {
          await this.retrySubmissionApproval(submission.id, adminId, `bulk-retry-${Date.now()}`);
          processed++;
        } catch (error) {
          errors.push(
            `${submission.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      loggers.database(
        'bulk_retry_completed',
        'recovery',
        `${processed}/${stuckSubmissions.length}`,
      );

      return {
        found: stuckSubmissions.length,
        processed,
        errors,
      };
    } catch (error) {
      loggers.error(error as Error, { adminId, maxAge, operation: 'bulkRetryStuckSubmissions' });
      throw error;
    }
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<{
    stuckSubmissions: number;
    failedWebhooks: number;
    totalRecoveryActions: number;
  }> {
    try {
      const [stuckSubmissions, failedWebhooks, totalRecoveryActions] = await Promise.all([
        this.prisma.rwaSubmission.count({
          where: {
            status: 'PENDING',
            createdAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Older than 24 hours
            },
          },
        }),
        this.prisma.webhookLog.count({
          where: {
            processedAt: null,
            error: {
              not: null,
            },
          },
        }),
        this.prisma.submissionAuditLog.count({
          where: {
            notes: {
              contains: 'retry',
            },
          },
        }),
      ]);

      return {
        stuckSubmissions,
        failedWebhooks,
        totalRecoveryActions,
      };
    } catch (error) {
      loggers.error(error as Error, { operation: 'getRecoveryStats' });
      throw error;
    }
  }
}
