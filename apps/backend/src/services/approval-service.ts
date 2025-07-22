import { PrismaClient, Prisma, RwaSubmission, SubmissionStatus } from '@prisma/client';
import { createWalletClient, http, WalletClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { CONTRACTS, MOCK_RWA_FACTORY_ABI } from '@aces/utils';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';
import { withTransaction } from '../lib/database';

export class ApprovalService {
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

    // Configure chain based on network
    const chain = this.network === 'baseSepolia' ? baseSepolia : baseSepolia; // Default to baseSepolia for now

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(process.env.BASE_RPC_URL || 'https://sepolia.base.org'),
    });

    loggers.blockchain('initialized', 'wallet_client', `network: ${this.network}`);
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

  async approveSubmission(
    submissionId: string,
    adminId: string,
    correlationId: string,
  ): Promise<{ txHash: string }> {
    try {
      // Use transaction to ensure atomicity
      const result = await withTransaction(async (tx) => {
        // Get submission with owner details
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId },
          include: { owner: true },
        });

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        if (submission.status !== 'PENDING') {
          throw errors.validation(`Submission status is ${submission.status}, cannot approve`);
        }

        if (!submission.owner.walletAddress) {
          throw errors.validation('Submission owner has no wallet address');
        }

        // Check if already has a transaction hash (idempotency)
        if (submission.txHash) {
          loggers.blockchain(submission.txHash, 'already_approved', submission.id);
          return { txHash: submission.txHash };
        }

        // Get contract addresses for current network
        const contractAddresses = CONTRACTS[this.network as keyof typeof CONTRACTS];
        if (!contractAddresses?.mockRwaFactory) {
          throw errors.internal(
            `No factory contract address configured for network: ${this.network}`,
          );
        }

        // Call factory contract to create RWA
        loggers.blockchain('calling', 'factory_contract', contractAddresses.mockRwaFactory);

        const walletClient = this.ensureWalletClient();

        if (!walletClient.account) {
          throw errors.internal('Wallet client is not configured with an account', {
            cause: new Error('No wallet account'),
          });
        }

        const hash = await walletClient.writeContract({
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

        loggers.blockchain(hash, 'transaction_submitted', contractAddresses.mockRwaFactory);

        // Update submission status
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'APPROVED',
            txHash: hash,
            txStatus: 'SUBMITTED',
            approvedAt: new Date(),
            updatedBy: adminId,
            updatedByType: 'ADMIN',
          },
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: 'PENDING',
            toStatus: 'APPROVED',
            actorId: adminId,
            actorType: 'ADMIN',
            notes: `Approved and submitted transaction: ${hash}`,
          },
        });

        return { txHash: hash };
      });

      loggers.database('approved', 'rwa_submission', submissionId);
      return result;
    } catch (error) {
      loggers.error(error as Error, {
        submissionId,
        adminId,
        correlationId,
        operation: 'approveSubmission',
      });
      throw errors.internal('Failed to approve submission', { cause: error });
    }
  }

  async updateTransactionStatus(
    txHash: string,
    status: 'MINED' | 'FAILED' | 'DROPPED',
    blockNumber?: number,
    gasUsed?: string,
    correlationId?: string,
  ): Promise<boolean> {
    try {
      const result = await withTransaction(async (tx) => {
        // Find submission by transaction hash
        const submission = await tx.rwaSubmission.findUnique({
          where: { txHash },
          include: { owner: true },
        });

        if (!submission) {
          loggers.blockchain(txHash, 'submission_not_found', 'updateTransactionStatus');
          return false;
        }

        // Idempotency check - if already in this status, do nothing
        if (submission.txStatus === status) {
          loggers.blockchain(txHash, 'status_already_set', status);
          return true;
        }

        // Determine the new status
        let newStatus: SubmissionStatus | undefined;
        if (status === 'MINED') {
          newStatus = 'LIVE';
        } else if (status === 'FAILED' || status === 'DROPPED') {
          newStatus = 'REJECTED';
        }

        // Update submission
        const updateData: Prisma.RwaSubmissionUpdateInput = {
          txStatus: status,
          updatedByType: 'WEBHOOK',
        };
        if (newStatus) {
          updateData.status = newStatus;
        }
        if (newStatus === 'REJECTED') {
          updateData.rejectionType = 'TX_FAILURE';
        }

        await tx.rwaSubmission.update({
          where: { txHash },
          data: updateData,
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId: submission.id,
            fromStatus: submission.status,
            toStatus: newStatus || submission.status,
            actorId: 'SYSTEM',
            actorType: 'WEBHOOK',
            notes: `Transaction ${status.toLowerCase()}: ${txHash}${blockNumber ? ` (block ${blockNumber})` : ''}`,
          },
        });

        // If transaction was successful, create token record
        if (status === 'MINED' && blockNumber) {
          // We would need to query the blockchain for the actual token address and deed NFT ID
          // For now, we'll leave this as a placeholder for when we implement full blockchain integration
          loggers.blockchain(txHash, 'token_creation_placeholder', submission.id);
        }

        return true;
      });

      loggers.blockchain(txHash, 'status_updated', status);
      return result;
    } catch (error) {
      loggers.error(error as Error, {
        txHash,
        status,
        correlationId,
        operation: 'updateTransactionStatus',
      });
      throw error;
    }
  }

  async getPendingApprovals(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: RwaSubmission[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: Prisma.RwaSubmissionWhereInput = {
        status: 'PENDING',
        deletedAt: null,
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const submissions = await this.prisma.rwaSubmission.findMany({
        where,
        include: {
          owner: true,
          bids: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 5, // Include recent bids for admin context
          },
        },
        orderBy: { createdAt: 'asc' }, // Oldest first for FIFO processing
        take: limit + 1,
      });

      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error as Error, { operation: 'getPendingApprovals' });
      throw error;
    }
  }

  async getSubmissionDetails(submissionId: string): Promise<RwaSubmission | null> {
    try {
      const submission = await this.prisma.rwaSubmission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true,
          token: true,
          bids: {
            where: { deletedAt: null },
            include: { bidder: true },
            orderBy: { createdAt: 'desc' },
          },
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 10, // Recent audit history
          },
        },
      });

      return submission;
    } catch (error) {
      loggers.error(error as Error, { submissionId, operation: 'getSubmissionDetails' });
      throw error;
    }
  }

  async validateAdminPermissions(userId: string, walletAddress: string | null): Promise<boolean> {
    if (!walletAddress) {
      return false;
    }

    // Check if wallet is in ADMIN_WALLET_ADDRESSES
    const adminWallets = (process.env.ADMIN_WALLET_ADDRESSES || '').toLowerCase().split(',');
    if (adminWallets.includes(walletAddress.toLowerCase())) {
      return true;
    }

    // Check if wallet matches the minter wallet
    if (process.env.MINTER_PRIVATE_KEY) {
      const minterAccount = privateKeyToAccount(process.env.MINTER_PRIVATE_KEY as `0x${string}`);
      if (minterAccount.address.toLowerCase() === walletAddress.toLowerCase()) {
        return true;
      }
    }

    return false;
  }
}
