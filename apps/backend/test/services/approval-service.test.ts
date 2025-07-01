import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { User, RwaSubmission } from '@prisma/client';
import { ApprovalService } from '../../src/services/approval-service';
import {
  createTestPrismaClient,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from './setup-database';
import { createTestUsers, createTestSubmissions } from './test-data-factory';

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
      account: { address: '0xAdminWalletAddress' },
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

let prisma: PrismaClient;
let approvalService: ApprovalService;

describe('ApprovalService', () => {
  let adminUser: User;
  let regularUser: User;
  let pendingSubmission: RwaSubmission;
  let approvedSubmission: RwaSubmission;

  beforeAll(async () => {
    // Initialize database connection
    prisma = createTestPrismaClient();

    // Set up environment variables that are constant for all tests
    process.env.MINTER_PRIVATE_KEY = '0x' + 'a'.repeat(64);
    process.env.BASE_RPC_URL = 'https://sepolia.base.org';
    process.env.ADMIN_WALLET_ADDRESSES = '0xadminwalletaddress,0xanotheradmin';

    approvalService = new ApprovalService(prisma);
  });

  // Use beforeEach to ensure a clean slate for every test
  beforeEach(async () => {
    // Create fresh users for each test with guaranteed unique data
    [adminUser, regularUser] = await createTestUsers(prisma);

    // Create fresh submissions for each test
    [pendingSubmission, approvedSubmission] = await createTestSubmissions(
      prisma,
      adminUser,
      regularUser,
    );
  });

  afterEach(async () => {
    // Clean up all data after each test to ensure isolation
    vi.clearAllMocks();
    await cleanupTestDatabase(prisma);
  });

  afterAll(async () => {
    // Disconnect Prisma at the very end
    await disconnectTestDatabase(prisma);
  });

  describe('approveSubmission', () => {
    it('should approve a pending submission successfully', async () => {
      const correlationId = 'test-approve-success';
      const result = await approvalService.approveSubmission(
        pendingSubmission.id,
        adminUser.id,
        correlationId,
      );

      expect(result.txHash).toBeDefined();
      expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);

      const updatedSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: pendingSubmission.id },
      });
      expect(updatedSubmission?.status).toBe('APPROVED');
      expect(updatedSubmission?.txStatus).toBe('SUBMITTED');
      expect(updatedSubmission?.txHash).toBe(result.txHash);
      expect(updatedSubmission?.approvedAt).not.toBeNull();
      expect(updatedSubmission?.updatedBy).toBe(adminUser.id);

      const auditLog = await prisma.submissionAuditLog.findFirst({
        where: { submissionId: pendingSubmission.id },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.fromStatus).toBe('PENDING');
      expect(auditLog?.toStatus).toBe('APPROVED');
      expect(auditLog?.actorId).toBe(adminUser.id);
    });

    it('should throw an error if the submission is not in PENDING state', async () => {
      const correlationId = 'test-approve-fail-status';
      await expect(
        approvalService.approveSubmission(approvedSubmission.id, adminUser.id, correlationId),
      ).rejects.toThrow('Submission status is APPROVED, cannot approve');
    });

    it('should throw a not found error for a non-existent submission', async () => {
      const correlationId = 'test-approve-fail-notfound';
      const nonExistentId = 'clxxxxxxxxx';
      await expect(
        approvalService.approveSubmission(nonExistentId, adminUser.id, correlationId),
      ).rejects.toThrow('Submission not found');
    });

    it('should throw an error if the submission owner has no wallet address', async () => {
      const userWithoutWallet = await prisma.user.create({
        data: { privyDid: 'no-wallet-user' },
      });
      const submissionWithoutWallet = await prisma.rwaSubmission.create({
        data: {
          name: 'No Wallet Submission',
          symbol: 'NOWAL',
          description: 'A submission from a user with no wallet',
          imageUrl: 'http://example.com/nowallet.png',
          proofOfOwnership: 'proof-nowallet',
          ownerId: userWithoutWallet.id,
        },
      });

      const correlationId = 'test-approve-fail-nowallet';
      await expect(
        approvalService.approveSubmission(submissionWithoutWallet.id, adminUser.id, correlationId),
      ).rejects.toThrow('Submission owner has no wallet address');
    });

    it('should return the existing txHash for an already approved submission if called again', async () => {
      // This test requires a submission that was approved but has the txHash.
      // We can use the 'approvedSubmission' for this, but the initial check prevents it.
      // Let's create a new one that is pending, approve it, and then try to approve again.
      const submissionToReapprove = await prisma.rwaSubmission.create({
        data: {
          name: 'Re-approve Test',
          symbol: 'REAPP',
          description: 'Test for re-approval idempotency',
          imageUrl: 'http://example.com/reapp.png',
          proofOfOwnership: 'proof-reapp',
          ownerId: regularUser.id,
        },
      });

      const { txHash } = await approvalService.approveSubmission(
        submissionToReapprove.id,
        adminUser.id,
        'corr-1',
      );

      // Check that writeContract was called for the first approval
      expect(mockWriteContract).toHaveBeenCalledTimes(1);

      // Now the submission is approved. Let's try to approve it again.
      // The service logic currently prevents this with the status check.
      // To test idempotency on txHash, we would need to bypass the status check,
      // which suggests the idempotency check on txHash might be for cases where status update failed.
      // Let's simulate that by manually setting it back to PENDING but with a txHash.
      await prisma.rwaSubmission.update({
        where: { id: submissionToReapprove.id },
        data: { status: 'PENDING', txHash: txHash },
      });

      const result = await approvalService.approveSubmission(
        submissionToReapprove.id,
        adminUser.id,
        'corr-2',
      );
      expect(result.txHash).toBe(txHash);

      // Ensure writeContract was not called the second time
      expect(mockWriteContract).toHaveBeenCalledTimes(1); // Should still be 1 from the first call
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status to MINED and submission status to LIVE', async () => {
      const txHash = '0x' + 'mined'.padEnd(64, '0');
      const submission = await prisma.rwaSubmission.create({
        data: {
          name: 'Mined Test',
          symbol: 'MINED',
          description: 'A submission to test MINED status',
          imageUrl: 'http://example.com/mined.png',
          proofOfOwnership: 'proof-mined',
          ownerId: regularUser.id,
          status: 'APPROVED',
          txStatus: 'SUBMITTED',
          txHash,
        },
      });

      const result = await approvalService.updateTransactionStatus(txHash, 'MINED', 12345);
      expect(result).toBe(true);

      const updatedSubmission = await prisma.rwaSubmission.findUnique({ where: { txHash } });
      expect(updatedSubmission?.txStatus).toBe('MINED');
      expect(updatedSubmission?.status).toBe('LIVE');

      const auditLog = await prisma.submissionAuditLog.findFirst({
        where: { submissionId: submission.id },
      });
      expect(auditLog?.toStatus).toBe('LIVE');
    });

    it('should update transaction status to FAILED and submission status to REJECTED', async () => {
      const txHash = '0x' + 'failed'.padEnd(64, '0');
      const submission = await prisma.rwaSubmission.create({
        data: {
          name: 'Failed Test',
          symbol: 'FAILED',
          description: 'A submission to test FAILED status',
          imageUrl: 'http://example.com/failed.png',
          proofOfOwnership: 'proof-failed',
          ownerId: regularUser.id,
          status: 'APPROVED',
          txStatus: 'SUBMITTED',
          txHash,
        },
      });

      const result = await approvalService.updateTransactionStatus(txHash, 'FAILED');
      expect(result).toBe(true);

      const updatedSubmission = await prisma.rwaSubmission.findUnique({ where: { txHash } });
      expect(updatedSubmission?.txStatus).toBe('FAILED');
      expect(updatedSubmission?.status).toBe('REJECTED');
      expect(updatedSubmission?.rejectionType).toBe('TX_FAILURE');

      const auditLog = await prisma.submissionAuditLog.findFirst({
        where: { submissionId: submission.id },
      });
      expect(auditLog?.toStatus).toBe('REJECTED');
    });

    it('should return false for a non-existent transaction hash', async () => {
      const nonExistentTxHash = '0x' + 'nonexistent'.padEnd(64, '0');
      const result = await approvalService.updateTransactionStatus(nonExistentTxHash, 'MINED');
      expect(result).toBe(false);
    });
  });

  describe('getPendingApprovals', () => {
    it('should return a list of pending submissions', async () => {
      // pendingSubmission is created in beforeEach
      const { data } = await approvalService.getPendingApprovals();

      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data.every((s) => s.status === 'PENDING')).toBe(true);
    });

    it('should handle pagination with limit and cursor', async () => {
      // Create more pending submissions to test pagination
      for (let i = 0; i < 3; i++) {
        await prisma.rwaSubmission.create({
          data: {
            name: `Pagination Test ${i}`,
            symbol: `PAG${i}`,
            description: 'desc',
            imageUrl: 'url',
            proofOfOwnership: 'proof',
            ownerId: regularUser.id,
          },
        });
      }
      const allPending = await prisma.rwaSubmission.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      const page1 = await approvalService.getPendingApprovals({ limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe(allPending[1].id);

      const page2 = await approvalService.getPendingApprovals({
        limit: 2,
        cursor: page1.nextCursor,
      });
      // Page 1 got 2, so page 2 should get the remaining 1.
      expect(page2.data.length).toBe(1);

      // After fetching page 2, there are no more pages.
      expect(page2.hasMore).toBe(false);
    });
  });

  describe('validateAdminPermissions', () => {
    it('should return true for a user with an admin wallet address', async () => {
      const hasPermissions = await approvalService.validateAdminPermissions(
        adminUser.id,
        adminUser.walletAddress,
      );
      expect(hasPermissions).toBe(true);
    });

    it('should return false for a user without an admin wallet address', async () => {
      const hasPermissions = await approvalService.validateAdminPermissions(
        regularUser.id,
        regularUser.walletAddress,
      );
      expect(hasPermissions).toBe(false);
    });
  });
});
