import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { User, RwaSubmission, WebhookLog } from '@prisma/client';
import { RecoveryService } from '../../src/services/recovery-service';

// Mock the dependencies
let mockTxCounter = 0;
const mockWriteContract = vi.fn(async () => {
  mockTxCounter++;
  return `0x${mockTxCounter.toString().padStart(64, '0')}`;
});

vi.mock('viem', async () => {
  const actualViem = await vi.importActual('viem');
  return {
    ...(actualViem as object),
    createWalletClient: vi.fn(() => ({
      writeContract: mockWriteContract,
      account: { address: '0xRecoveryWalletAddress' },
      chain: { id: 84532 },
    })),
  };
});

vi.mock('../../src/lib/logger', () => {
  const mockLog = vi.fn();
  return {
    logger: {
      info: mockLog,
      warn: mockLog,
      error: mockLog,
      debug: mockLog,
    },
    loggers: {
      blockchain: mockLog,
      database: mockLog,
      error: mockLog,
    },
  };
});

const prisma = new PrismaClient();
let recoveryService: RecoveryService;

describe('RecoveryService', () => {
  let adminUser: User;
  let regularUser: User;
  let failedSubmission: RwaSubmission;
  let approvedSubmission: RwaSubmission;
  let rejectedSubmission: RwaSubmission;
  let unprocessedWebhook: WebhookLog;
  let processedWebhook: WebhookLog;

  beforeAll(async () => {
    // Set up environment variables
    process.env.MINTER_PRIVATE_KEY = '0x' + 'b'.repeat(64);
    process.env.BASE_RPC_URL = 'https://sepolia.base.org';
    process.env.BLOCKCHAIN_NETWORK = 'baseSepolia';

    recoveryService = new RecoveryService(prisma);
  }, 10000);

  beforeEach(async () => {
    // Create fresh users for each test with unique IDs
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    [adminUser, regularUser] = await prisma.user.createManyAndReturn({
      data: [
        {
          privyDid: `admin-did-${timestamp}-${random}`,
          walletAddress: `0xadminwalletaddress${timestamp}${random}`.toLowerCase().substring(0, 42),
        },
        {
          privyDid: `user-did-${timestamp}-${random}`,
          walletAddress: `0xuserwalletaddress${timestamp}${random}`.toLowerCase().substring(0, 42),
        },
      ],
    });

    // Create submissions with different statuses for testing
    [failedSubmission, approvedSubmission, rejectedSubmission] =
      await prisma.rwaSubmission.createManyAndReturn({
        data: [
          {
            name: 'Failed Submission',
            symbol: 'FAIL',
            description: 'A submission with failed transaction',
            imageUrl: 'http://example.com/failed.png',
            proofOfOwnership: 'proof-failed',
            ownerId: regularUser.id,
            status: 'APPROVED',
            txStatus: 'FAILED',
            txHash: '0x' + 'failed'.padStart(64, '0'),
          },
          {
            name: 'Approved Submission',
            symbol: 'APPR',
            description: 'A submission that is approved and submitted',
            imageUrl: 'http://example.com/approved.png',
            proofOfOwnership: 'proof-approved',
            ownerId: regularUser.id,
            status: 'APPROVED',
            txStatus: 'SUBMITTED',
            txHash: '0x' + 'approved'.padStart(64, '0'),
          },
          {
            name: 'Rejected Submission',
            symbol: 'REJ',
            description: 'A submission that was rejected',
            imageUrl: 'http://example.com/rejected.png',
            proofOfOwnership: 'proof-rejected',
            ownerId: regularUser.id,
            status: 'REJECTED',
            txStatus: 'DROPPED',
            txHash: '0x' + 'rejected'.padStart(64, '0'),
          },
        ],
      });

    // Create webhook logs for testing
    [unprocessedWebhook, processedWebhook] = await prisma.webhookLog.createManyAndReturn({
      data: [
        {
          payload: {
            event: 'transaction.mined',
            txHash: failedSubmission.txHash,
            status: 'MINED',
            blockNumber: 12345,
          },
          headers: {},
          error: 'Processing failed',
        },
        {
          payload: {
            event: 'transaction.failed',
            hash: '0x' + 'processed'.padStart(64, '0'),
            status: 'FAILED',
          },
          headers: {},
          processedAt: new Date(),
        },
      ],
    });
  }, 10000);

  afterEach(async () => {
    vi.clearAllMocks();
    mockTxCounter = 0;
    // Clean up in proper order to avoid foreign key constraints
    // Delete children first, then parents
    await prisma.bid.deleteMany();
    await prisma.submissionAuditLog.deleteMany();
    await prisma.webhookLog.deleteMany();
    await prisma.rwaSubmission.deleteMany();
    await prisma.user.deleteMany();
  }, 10000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('resubmitTransaction', () => {
    it('should resubmit a failed transaction successfully', async () => {
      const correlationId = 'test-resubmit-success';
      const result = await recoveryService.resubmitTransaction(
        failedSubmission.id,
        adminUser.id,
        correlationId,
      );

      expect(result.txHash).toBeDefined();
      expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.previousTxHash).toBe(failedSubmission.txHash);

      // Verify the submission was updated
      const updatedSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: failedSubmission.id },
      });
      expect(updatedSubmission?.status).toBe('APPROVED');
      expect(updatedSubmission?.txStatus).toBe('SUBMITTED');
      expect(updatedSubmission?.txHash).toBe(result.txHash);
      expect(updatedSubmission?.updatedBy).toBe(adminUser.id);
      expect(updatedSubmission?.updatedByType).toBe('ADMIN');

      // Verify audit log was created
      const auditLog = await prisma.submissionAuditLog.findFirst({
        where: { submissionId: failedSubmission.id },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.notes).toContain('Transaction resubmitted');
      expect(auditLog?.notes).toContain(result.txHash);
      expect(auditLog?.notes).toContain(failedSubmission.txHash);
    }, 10000);

    it('should resubmit a rejected submission with dropped transaction', async () => {
      const correlationId = 'test-resubmit-dropped';
      const result = await recoveryService.resubmitTransaction(
        rejectedSubmission.id,
        adminUser.id,
        correlationId,
      );

      expect(result.txHash).toBeDefined();
      expect(result.previousTxHash).toBe(rejectedSubmission.txHash);

      const updatedSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: rejectedSubmission.id },
      });
      expect(updatedSubmission?.status).toBe('APPROVED');
      expect(updatedSubmission?.txStatus).toBe('SUBMITTED');
    }, 10000);

    it('should throw error if submission is not in resubmittable state', async () => {
      const correlationId = 'test-resubmit-invalid-status';
      await expect(
        recoveryService.resubmitTransaction(approvedSubmission.id, adminUser.id, correlationId),
      ).rejects.toThrow('Cannot resubmit transaction with status: SUBMITTED');
    }, 10000);

    it('should throw error if submission does not exist', async () => {
      const correlationId = 'test-resubmit-not-found';
      const nonExistentId = 'clxxxxxxxxx';
      await expect(
        recoveryService.resubmitTransaction(nonExistentId, adminUser.id, correlationId),
      ).rejects.toThrow('Submission not found');
    }, 10000);

    it('should throw error if submission has no original transaction hash', async () => {
      const submissionWithoutTx = await prisma.rwaSubmission.create({
        data: {
          name: 'No TX Submission',
          symbol: 'NOTX',
          description: 'A submission without tx hash',
          imageUrl: 'http://example.com/notx.png',
          proofOfOwnership: 'proof-notx',
          ownerId: regularUser.id,
          status: 'APPROVED',
          txStatus: 'FAILED',
        },
      });

      const correlationId = 'test-resubmit-no-tx';
      await expect(
        recoveryService.resubmitTransaction(submissionWithoutTx.id, adminUser.id, correlationId),
      ).rejects.toThrow('No original transaction to resubmit');
    }, 10000);

    it('should throw error if submission owner has no wallet address', async () => {
      const userWithoutWallet = await prisma.user.create({
        data: { privyDid: 'no-wallet-recovery' },
      });

      const submissionNoWallet = await prisma.rwaSubmission.create({
        data: {
          name: 'No Wallet Recovery',
          symbol: 'NOWREC',
          description: 'Recovery test without wallet',
          imageUrl: 'http://example.com/nowrec.png',
          proofOfOwnership: 'proof-nowrec',
          ownerId: userWithoutWallet.id,
          status: 'APPROVED',
          txStatus: 'FAILED',
          txHash: '0x' + 'nowallet'.padStart(64, '0'),
        },
      });

      const correlationId = 'test-resubmit-no-wallet';
      await expect(
        recoveryService.resubmitTransaction(submissionNoWallet.id, adminUser.id, correlationId),
      ).rejects.toThrow('Submission owner has no wallet address');
    }, 10000);
  });

  describe('replayWebhook', () => {
    it('should replay an unprocessed webhook successfully', async () => {
      const correlationId = 'test-replay-success';
      const result = await recoveryService.replayWebhook(
        unprocessedWebhook.id,
        adminUser.id,
        correlationId,
      );

      expect(result.success).toBe(true);
      expect(result.processed).toBe(false);

      // Verify webhook was marked as processed
      const updatedWebhook = await prisma.webhookLog.findUnique({
        where: { id: unprocessedWebhook.id },
      });
      expect(updatedWebhook?.processedAt).not.toBeNull();

      // Verify submission status was updated based on webhook
      const updatedSubmission = await prisma.rwaSubmission.findUnique({
        where: { txHash: failedSubmission.txHash ?? undefined },
      });
      expect(updatedSubmission?.status).toBe('LIVE');
      expect(updatedSubmission?.txStatus).toBe('MINED');
      expect(updatedSubmission?.updatedByType).toBe('WEBHOOK');

      // Verify audit log was created
      const auditLog = await prisma.submissionAuditLog.findFirst({
        where: { submissionId: failedSubmission.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog?.notes).toContain('Webhook replayed: MINED');
    }, 10000);

    it('should handle already processed webhook (idempotency)', async () => {
      const correlationId = 'test-replay-idempotent';
      const result = await recoveryService.replayWebhook(
        processedWebhook.id,
        adminUser.id,
        correlationId,
      );

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
    }, 10000);

    it('should handle webhook for failed transaction status', async () => {
      const failedWebhook = await prisma.webhookLog.create({
        data: {
          payload: {
            event: 'transaction.failed',
            transactionHash: failedSubmission.txHash,
            status: 'FAILED',
          },
          headers: {},
          error: 'Failed webhook',
        },
      });

      const correlationId = 'test-replay-failed';
      const result = await recoveryService.replayWebhook(
        failedWebhook.id,
        adminUser.id,
        correlationId,
      );

      expect(result.success).toBe(true);

      const updatedSubmission = await prisma.rwaSubmission.findUnique({
        where: { txHash: failedSubmission.txHash ?? undefined },
      });
      expect(updatedSubmission?.status).toBe('REJECTED');
      expect(updatedSubmission?.txStatus).toBe('FAILED');
    }, 10000);

    it('should handle webhook for dropped transaction status', async () => {
      const droppedWebhook = await prisma.webhookLog.create({
        data: {
          payload: {
            event: 'transaction.dropped',
            hash: rejectedSubmission.txHash,
            status: 'DROPPED',
          },
          headers: {},
          error: 'Dropped webhook',
        },
      });

      const correlationId = 'test-replay-dropped';
      const result = await recoveryService.replayWebhook(
        droppedWebhook.id,
        adminUser.id,
        correlationId,
      );

      expect(result.success).toBe(true);

      const updatedSubmission = await prisma.rwaSubmission.findUnique({
        where: { txHash: rejectedSubmission.txHash ?? undefined },
      });
      expect(updatedSubmission?.status).toBe('REJECTED');
      expect(updatedSubmission?.txStatus).toBe('DROPPED');
    }, 10000);

    it('should throw error for non-existent webhook', async () => {
      const correlationId = 'test-replay-not-found';
      const nonExistentId = 'clxxxxxxxxx';
      await expect(
        recoveryService.replayWebhook(nonExistentId, adminUser.id, correlationId),
      ).rejects.toThrow('Webhook log not found');
    }, 10000);

    it('should throw error for invalid webhook payload', async () => {
      const invalidWebhook = await prisma.webhookLog.create({
        data: {
          payload: {
            event: 'invalid',
            invalidField: 'no tx hash',
          },
          headers: {},
          error: 'Invalid payload',
        },
      });

      const correlationId = 'test-replay-invalid';
      await expect(
        recoveryService.replayWebhook(invalidWebhook.id, adminUser.id, correlationId),
      ).rejects.toThrow('Invalid webhook payload');
    }, 10000);

    it('should handle webhook for submission that does not exist', async () => {
      const orphanWebhook = await prisma.webhookLog.create({
        data: {
          payload: {
            event: 'transaction.mined',
            txHash: '0x' + 'orphan'.padStart(64, '0'),
            status: 'MINED',
          },
          headers: {},
          error: 'Orphan webhook',
        },
      });

      const correlationId = 'test-replay-orphan';
      const result = await recoveryService.replayWebhook(
        orphanWebhook.id,
        adminUser.id,
        correlationId,
      );

      expect(result.success).toBe(true);
      expect(result.processed).toBe(false);

      // Webhook should still be marked as processed
      const updatedWebhook = await prisma.webhookLog.findUnique({
        where: { id: orphanWebhook.id },
      });
      expect(updatedWebhook?.processedAt).not.toBeNull();
    }, 10000);
  });

  describe('getFailedTransactions', () => {
    it('should return failed transactions with default pagination', async () => {
      const result = await recoveryService.getFailedTransactions();

      expect(result.data).toHaveLength(2); // failedSubmission and rejectedSubmission
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();

      const failedTx = result.data.find((s) => s.id === failedSubmission.id);
      expect(failedTx).toBeDefined();
      expect(failedTx?.txStatus).toBe('FAILED');
    }, 10000);

    it('should handle pagination with limit', async () => {
      const result = await recoveryService.getFailedTransactions({ limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    }, 10000);

    it('should handle pagination with cursor', async () => {
      const firstPage = await recoveryService.getFailedTransactions({ limit: 1 });

      if (firstPage.hasMore && firstPage.nextCursor) {
        const secondPage = await recoveryService.getFailedTransactions({
          limit: 1,
          cursor: firstPage.nextCursor,
        });

        expect(secondPage.data.length).toBeGreaterThanOrEqual(0);
        if (secondPage.data.length > 0) {
          expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
        }
      } else {
        // If there's no second page, that's also valid
        expect(firstPage.data).toHaveLength(1);
      }
    }, 10000);

    it('should return empty result when no failed transactions exist', async () => {
      // Update all submissions to have successful status
      await prisma.rwaSubmission.updateMany({
        where: { txStatus: { in: ['FAILED', 'DROPPED'] } },
        data: { txStatus: 'MINED' },
      });

      const result = await recoveryService.getFailedTransactions();

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    }, 10000);
  });

  describe('getUnprocessedWebhooks', () => {
    it('should return unprocessed webhooks with errors', async () => {
      const result = await recoveryService.getUnprocessedWebhooks();

      expect(result.data).toHaveLength(1); // Only unprocessedWebhook
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();

      const unprocessed = result.data[0];
      expect(unprocessed.id).toBe(unprocessedWebhook.id);
      expect(unprocessed.processedAt).toBeNull();
      expect(unprocessed.error).toBeTruthy();
    }, 10000);

    it('should handle pagination', async () => {
      // Create additional unprocessed webhooks
      await prisma.webhookLog.createMany({
        data: [
          {
            payload: { event: 'test1', test: 'data1' },
            headers: {},
            error: 'Error 1',
          },
          {
            payload: { event: 'test2', test: 'data2' },
            headers: {},
            error: 'Error 2',
          },
        ],
      });

      const result = await recoveryService.getUnprocessedWebhooks({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    }, 10000);

    it('should return empty result when no unprocessed webhooks exist', async () => {
      // Mark all webhooks as processed
      await prisma.webhookLog.updateMany({
        where: { processedAt: null },
        data: { processedAt: new Date() },
      });

      const result = await recoveryService.getUnprocessedWebhooks();

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    }, 10000);
  });

  describe('getRecoveryStats', () => {
    it('should return correct recovery statistics', async () => {
      // Create additional data for comprehensive stats
      await prisma.rwaSubmission.create({
        data: {
          name: 'Pending Submission',
          symbol: 'PEND',
          description: 'A pending submission',
          imageUrl: 'http://example.com/pending.png',
          proofOfOwnership: 'proof-pending',
          ownerId: regularUser.id,
          status: 'PENDING',
        },
      });

      const stats = await recoveryService.getRecoveryStats();

      expect(stats.failedTransactions).toBe(2); // failedSubmission and rejectedSubmission
      expect(stats.unprocessedWebhooks).toBe(1); // unprocessedWebhook
      expect(stats.pendingApprovals).toBe(1); // The newly created pending submission
    }, 10000);

    it('should return zero stats when no issues exist', async () => {
      // Clean up all problematic data
      await prisma.$transaction([
        prisma.submissionAuditLog.deleteMany(),
        prisma.webhookLog.deleteMany(),
        prisma.rwaSubmission.deleteMany(),
      ]);

      const stats = await recoveryService.getRecoveryStats();

      expect(stats.failedTransactions).toBe(0);
      expect(stats.unprocessedWebhooks).toBe(0);
      expect(stats.pendingApprovals).toBe(0);
    }, 10000);
  });
});
