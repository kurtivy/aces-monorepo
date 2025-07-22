import {
  PrismaClient,
  Prisma,
  WebhookLog,
  SubmissionStatus,
  TxStatus,
  RwaSubmission,
} from '@prisma/client';
import { createWalletClient, http, WalletClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { CONTRACTS, MOCK_RWA_FACTORY_ABI } from '@aces/utils';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';
import { withTransaction } from '../lib/database';
import { z } from 'zod';

const ReplayWebhookPayloadSchema = z
  .object({
    txHash: z.string().optional(),
    hash: z.string().optional(),
    transactionHash: z.string().optional(),
    status: z.string(),
    blockNumber: z.number().optional(),
    gasUsed: z.string().optional(),
  })
  .refine((data) => data.txHash || data.hash || data.transactionHash, {
    message: 'Payload must contain one of txHash, hash, or transactionHash',
  });

export class RecoveryService {
  private walletClient: WalletClient | null = null;
  private network: string;

  constructor(private prisma: PrismaClient) {
    // Initialize network setting but don't require wallet client immediately
    this.network = process.env.BLOCKCHAIN_NETWORK || 'localhost';

    // Only initialize wallet client if we have the private key
    if (process.env.MINTER_PRIVATE_KEY) {
      this.initializeWalletClient();
    }
  }

  private initializeWalletClient() {
    if (!process.env.MINTER_PRIVATE_KEY) {
      throw new Error(
        'MINTER_PRIVATE_KEY environment variable is required for blockchain operations',
      );
    }

    const account = privateKeyToAccount(process.env.MINTER_PRIVATE_KEY as `0x${string}`);
    const chain = this.network === 'baseSepolia' ? baseSepolia : baseSepolia;

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(process.env.BASE_RPC_URL || 'https://sepolia.base.org'),
    });

    loggers.blockchain('initialized', 'recovery_wallet_client', `network: ${this.network}`);
  }

  private ensureWalletClient(): WalletClient {
    if (!this.walletClient) {
      if (!process.env.MINTER_PRIVATE_KEY) {
        throw new Error(
          'MINTER_PRIVATE_KEY environment variable is required for blockchain operations',
        );
      }
      this.initializeWalletClient();

      // Double-check initialization succeeded
      if (!this.walletClient) {
        throw new Error('Failed to initialize wallet client');
      }
    }
    return this.walletClient;
  }

  async resubmitTransaction(
    submissionId: string,
    adminId: string,
    correlationId: string,
  ): Promise<{ txHash: string; previousTxHash?: string }> {
    try {
      const result = await withTransaction(async (tx) => {
        // Get submission details
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId },
          include: { owner: true },
        });

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        // Validate that this submission can be resubmitted
        if (submission.status !== 'APPROVED' && submission.status !== 'REJECTED') {
          throw errors.validation(`Cannot resubmit submission with status: ${submission.status}`);
        }

        if (!submission.txHash) {
          throw errors.validation('No original transaction to resubmit');
        }

        if (submission.txStatus !== 'FAILED' && submission.txStatus !== 'DROPPED') {
          throw errors.validation(
            `Cannot resubmit transaction with status: ${submission.txStatus}`,
          );
        }

        if (!submission.owner.walletAddress) {
          throw errors.validation('Submission owner has no wallet address');
        }

        const previousTxHash = submission.txHash;

        // Get contract addresses
        const contractAddresses = CONTRACTS[this.network as keyof typeof CONTRACTS];
        if (!contractAddresses?.mockRwaFactory) {
          throw errors.internal(
            `No factory contract address configured for network: ${this.network}`,
          );
        }

        // Resubmit the transaction with same parameters
        loggers.blockchain(
          'resubmitting',
          'factory_contract',
          `${contractAddresses.mockRwaFactory} | original: ${previousTxHash}`,
        );

        const walletClient = this.ensureWalletClient();

        if (!walletClient.account) {
          throw errors.internal('Wallet client is not configured with an account', {
            cause: new Error('No wallet account'),
          });
        }

        const newHash = await walletClient.writeContract({
          account: walletClient.account,
          chain: walletClient.chain,
          address: contractAddresses.mockRwaFactory as `0x${string}`,
          abi: MOCK_RWA_FACTORY_ABI,
          functionName: 'createRwa',
          args: [
            submission.name,
            submission.symbol,
            BigInt(1), // Temporary deedId - in production this should be dynamically generated
            submission.owner.walletAddress as `0x${string}`,
          ],
        });

        loggers.blockchain(newHash, 'transaction_resubmitted', `previous: ${previousTxHash}`);

        // Update submission with new transaction
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'APPROVED', // Back to approved since we resubmitted
            txHash: newHash,
            txStatus: 'SUBMITTED',
            updatedBy: adminId,
            updatedByType: 'ADMIN',
          },
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: submission.status,
            toStatus: 'APPROVED',
            actorId: adminId,
            actorType: 'ADMIN',
            notes: `Transaction resubmitted. New: ${newHash}, Previous: ${previousTxHash}`,
          },
        });

        return { txHash: newHash, previousTxHash };
      });

      loggers.database('resubmitted', 'rwa_submission', submissionId);
      return result;
    } catch (error) {
      loggers.error(error as Error, {
        submissionId,
        adminId,
        correlationId,
        operation: 'resubmitTransaction',
      });
      throw error;
    }
  }

  async replayWebhook(
    webhookLogId: string,
    adminId: string,
    correlationId: string,
  ): Promise<{ success: boolean; processed: boolean }> {
    try {
      const result = await withTransaction(async (tx) => {
        // Get webhook log
        const webhookLog = await tx.webhookLog.findUnique({
          where: { id: webhookLogId },
        });

        if (!webhookLog) {
          throw errors.notFound('Webhook log not found');
        }

        // Check if already processed (idempotency)
        if (webhookLog.processedAt) {
          loggers.blockchain('webhook_already_processed', 'replay', webhookLogId);
          return { success: true, processed: true };
        }

        // Mark as processed first to prevent duplicate processing
        await tx.webhookLog.update({
          where: { id: webhookLogId },
          data: { processedAt: new Date() },
        });

        // Extract transaction details from payload
        const parseResult = ReplayWebhookPayloadSchema.safeParse(webhookLog.payload);
        if (!parseResult.success) {
          throw errors.validation('Invalid webhook payload', { details: parseResult.error.issues });
        }
        const payload = parseResult.data;
        const txHash = payload.txHash || payload.hash || payload.transactionHash!;
        const status = payload.status;

        if (!txHash || !status) {
          throw errors.validation('Invalid webhook payload: missing txHash or status');
        }

        // Find the submission by transaction hash
        const submission = await tx.rwaSubmission.findUnique({
          where: { txHash },
        });

        if (!submission) {
          loggers.blockchain(txHash, 'submission_not_found_for_webhook', webhookLogId);
          return { success: true, processed: false };
        }

        // Update submission status based on webhook
        let newSubmissionStatus;
        let newTxStatus;

        switch (status.toUpperCase()) {
          case 'MINED':
          case 'SUCCESS':
          case 'CONFIRMED':
            newSubmissionStatus = 'LIVE';
            newTxStatus = 'MINED';
            break;
          case 'FAILED':
          case 'REVERTED':
            newSubmissionStatus = 'REJECTED';
            newTxStatus = 'FAILED';
            break;
          case 'DROPPED':
          case 'CANCELLED':
            newSubmissionStatus = 'REJECTED';
            newTxStatus = 'DROPPED';
            break;
          default:
            throw errors.validation(`Unknown transaction status: ${status}`);
        }

        // Update submission
        await tx.rwaSubmission.update({
          where: { txHash },
          data: {
            status: newSubmissionStatus as SubmissionStatus,
            txStatus: newTxStatus as TxStatus,
            updatedByType: 'WEBHOOK',
          },
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId: submission.id,
            fromStatus: submission.status,
            toStatus: newSubmissionStatus as SubmissionStatus,
            actorId: adminId,
            actorType: 'ADMIN',
            notes: `Webhook replayed: ${status} for tx ${txHash}${payload.blockNumber ? ` (block ${payload.blockNumber})` : ''}`,
          },
        });

        return { success: true, processed: false };
      });

      loggers.database('webhook_replayed', 'webhook_log', webhookLogId);
      return result;
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

  async getFailedTransactions(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: RwaSubmission[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: Prisma.RwaSubmissionWhereInput = {
        txStatus: { in: ['FAILED', 'DROPPED'] },
        deletedAt: null,
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const submissions = (await this.prisma.rwaSubmission.findMany({
        where,
        include: {
          owner: true,
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3, // Recent audit history
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      })) as RwaSubmission[];

      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error as Error, { operation: 'getFailedTransactions' });
      throw error;
    }
  }

  async getUnprocessedWebhooks(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: WebhookLog[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: Prisma.WebhookLogWhereInput = {
        processedAt: null,
        error: { not: null }, // Only show errored webhooks
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const webhookLogs = await this.prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = webhookLogs.length > limit;
      const data = hasMore ? webhookLogs.slice(0, -1) : webhookLogs;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error as Error, { operation: 'getUnprocessedWebhooks' });
      throw error;
    }
  }

  async getRecoveryStats(): Promise<{
    failedTransactions: number;
    unprocessedWebhooks: number;
    pendingApprovals: number;
  }> {
    try {
      const [failedTransactions, unprocessedWebhooks, pendingApprovals] = await Promise.all([
        this.prisma.rwaSubmission.count({
          where: {
            txStatus: { in: ['FAILED', 'DROPPED'] },
            deletedAt: null,
          },
        }),
        this.prisma.webhookLog.count({
          where: {
            processedAt: null,
            error: { not: null },
          },
        }),
        this.prisma.rwaSubmission.count({
          where: {
            status: 'PENDING',
            deletedAt: null,
          },
        }),
      ]);

      return {
        failedTransactions,
        unprocessedWebhooks,
        pendingApprovals,
      };
    } catch (error) {
      loggers.error(error as Error, { operation: 'getRecoveryStats' });
      throw error;
    }
  }
}
