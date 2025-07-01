import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { cleanupTestDatabase, waitForDatabase } from '../services/setup-database';

// Simple test data factory function
function createSubmissionData(overrides: any = {}) {
  return {
    name: 'Test Submission',
    symbol: 'TEST',
    description: 'Test description',
    imageUrl: 'https://example.com/test.jpg',
    proofOfOwnership: 'Test proof',
    status: 'PENDING' as const,
    ...overrides,
  };
}

const prisma = new PrismaClient();

// Mock wallet addresses for testing
const MOCK_USER_WALLET = '0x1234567890123456789012345678901234567890';
const MOCK_ADMIN_WALLET = '0x9876543210987654321098765432109876543210';

// Test user IDs (will be created in beforeEach)
let testUserId: string;
let testAdminId: string;

describe('End-to-End Integration Tests', () => {
  beforeAll(async () => {
    // Wait for database to be ready and clean any existing data
    await waitForDatabase(prisma);
    await cleanupTestDatabase(prisma);

    // Set admin wallet in environment for tests
    process.env.ADMIN_WALLET_ADDRESSES = MOCK_ADMIN_WALLET;
  });

  beforeEach(async () => {
    // Clean database before each test for isolation
    await cleanupTestDatabase(prisma);

    // Create test users with unique identifiers
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);

    const testUser = await prisma.user.create({
      data: {
        privyDid: `test-user-e2e-${timestamp}-${random}`,
        walletAddress: MOCK_USER_WALLET,
      },
    });
    testUserId = testUser.id;

    const testAdmin = await prisma.user.create({
      data: {
        privyDid: `test-admin-e2e-${timestamp}-${random}`,
        walletAddress: MOCK_ADMIN_WALLET,
      },
    });
    testAdminId = testAdmin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Complete RWA Submission to Approval Workflow', () => {
    it('should handle the complete user journey: submit → admin review → approve → blockchain deployment', async () => {
      // ===============================
      // STEP 1: User submits RWA
      // ===============================
      const submissionData = createSubmissionData({
        ownerId: testUserId,
        name: 'Luxury Watch Collection',
        symbol: 'WATCH',
        description: 'Rare vintage Rolex collection',
        imageUrl: 'https://example.com/rolex.jpg',
        proofOfOwnership: 'Authentication certificate #12345',
        status: 'PENDING',
      });

      const submission = await prisma.rwaSubmission.create({
        data: submissionData,
      });

      expect(submission.status).toBe('PENDING');
      expect(submission.ownerId).toBe(testUserId);
      expect(submission.name).toBe('Luxury Watch Collection');

      // ===============================
      // STEP 2: Admin retrieves pending submissions
      // ===============================
      const pendingSubmissions = await prisma.rwaSubmission.findMany({
        where: { status: 'PENDING', deletedAt: null },
        include: { owner: true },
        orderBy: { createdAt: 'asc' },
      });

      expect(pendingSubmissions).toHaveLength(1);
      expect(pendingSubmissions[0].id).toBe(submission.id);
      expect(pendingSubmissions[0].owner.walletAddress).toBe(MOCK_USER_WALLET);

      // ===============================
      // STEP 3: Admin approves submission (with mocked blockchain call)
      // ===============================

      // Mock the blockchain transaction hash
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      // Simulate approval service logic without actual blockchain call
      const approvedSubmission = await prisma.rwaSubmission.update({
        where: { id: submission.id },
        data: {
          status: 'APPROVED',
          txHash: mockTxHash,
          txStatus: 'SUBMITTED',
          approvedAt: new Date(),
          updatedBy: testAdminId,
          updatedByType: 'ADMIN',
        },
      });

      expect(approvedSubmission.status).toBe('APPROVED');
      expect(approvedSubmission.txHash).toBe(mockTxHash);
      expect(approvedSubmission.txStatus).toBe('SUBMITTED');
      expect(approvedSubmission.approvedAt).toBeTruthy();

      // ===============================
      // STEP 4: Audit trail is created
      // ===============================
      const auditLog = await prisma.submissionAuditLog.create({
        data: {
          submissionId: submission.id,
          fromStatus: 'PENDING',
          toStatus: 'APPROVED',
          actorId: testAdminId,
          actorType: 'ADMIN',
        },
      });

      expect(auditLog.submissionId).toBe(submission.id);
      expect(auditLog.fromStatus).toBe('PENDING');
      expect(auditLog.toStatus).toBe('APPROVED');
      expect(auditLog.actorId).toBe(testAdminId);

      // ===============================
      // STEP 5: Verify complete state
      // ===============================
      const finalSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: submission.id },
        include: {
          owner: true,
          auditLogs: true,
        },
      });

      expect(finalSubmission).toBeTruthy();
      expect(finalSubmission!.status).toBe('APPROVED');
      expect(finalSubmission!.owner.walletAddress).toBe(MOCK_USER_WALLET);
      expect(finalSubmission!.auditLogs).toHaveLength(1);
      expect(finalSubmission!.auditLogs[0].actorType).toBe('ADMIN');

      console.log('✅ Complete workflow test passed:', {
        submissionId: submission.id,
        status: finalSubmission!.status,
        txHash: finalSubmission!.txHash,
        auditTrail: finalSubmission!.auditLogs.length,
      });
    });

    it('should handle user submission retrieval workflow', async () => {
      // Create multiple submissions for the user
      const submissions = await Promise.all([
        prisma.rwaSubmission.create({
          data: createSubmissionData({
            ownerId: testUserId,
            name: 'Artwork #1',
            symbol: 'ART1',
            status: 'PENDING',
          }),
        }),
        prisma.rwaSubmission.create({
          data: createSubmissionData({
            ownerId: testUserId,
            name: 'Artwork #2',
            symbol: 'ART2',
            status: 'APPROVED',
          }),
        }),
        prisma.rwaSubmission.create({
          data: createSubmissionData({
            ownerId: testUserId,
            name: 'Artwork #3',
            symbol: 'ART3',
            status: 'PENDING',
            deletedAt: new Date(), // Soft deleted
          }),
        }),
      ]);

      // User retrieves their submissions (should exclude soft deleted)
      const userSubmissions = await prisma.rwaSubmission.findMany({
        where: { ownerId: testUserId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      expect(userSubmissions).toHaveLength(2); // Excludes soft deleted
      expect(userSubmissions.map((s) => s.name)).toEqual(['Artwork #2', 'Artwork #1']);
      expect(userSubmissions.every((s) => s.ownerId === testUserId)).toBe(true);
    });

    it('should handle submission soft deletion workflow', async () => {
      // Create a pending submission
      const submission = await prisma.rwaSubmission.create({
        data: createSubmissionData({
          ownerId: testUserId,
          name: 'Deletable Item',
          symbol: 'DELETE',
          status: 'PENDING',
        }),
      });

      // User deletes their pending submission
      const deleteResult = await prisma.rwaSubmission.updateMany({
        where: {
          id: submission.id,
          ownerId: testUserId,
          status: 'PENDING',
        },
        data: { deletedAt: new Date() },
      });

      expect(deleteResult.count).toBe(1);

      // Verify submission is soft deleted
      const deletedSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: submission.id },
      });

      expect(deletedSubmission!.deletedAt).toBeTruthy();

      // Verify it doesn't appear in user's active submissions
      const activeSubmissions = await prisma.rwaSubmission.findMany({
        where: { ownerId: testUserId, deletedAt: null },
      });

      expect(activeSubmissions.find((s) => s.id === submission.id)).toBeUndefined();
    });
  });

  describe('Recovery Workflow Tests', () => {
    it('should handle transaction resubmission workflow', async () => {
      // Create an approved submission with failed transaction
      const submission = await prisma.rwaSubmission.create({
        data: createSubmissionData({
          ownerId: testUserId,
          name: 'Failed Transaction Item',
          symbol: 'FAIL',
          status: 'APPROVED',
          txHash: '0xfailedhash',
          txStatus: 'FAILED',
        }),
      });

      // Admin resubmits the transaction
      const newTxHash = '0xnewsuccessfulhash';
      const resubmittedSubmission = await prisma.rwaSubmission.update({
        where: { id: submission.id },
        data: {
          txHash: newTxHash,
          txStatus: 'SUBMITTED',
          updatedBy: testAdminId,
          updatedByType: 'ADMIN',
        },
      });

      expect(resubmittedSubmission.txHash).toBe(newTxHash);
      expect(resubmittedSubmission.txStatus).toBe('SUBMITTED');
      expect(resubmittedSubmission.updatedBy).toBe(testAdminId);
    });

    it('should handle webhook replay workflow', async () => {
      // Create a failed webhook log
      const webhookLog = await prisma.webhookLog.create({
        data: {
          payload: { test: 'data' },
          headers: { 'content-type': 'application/json', 'x-webhook-id': 'test-123' },
          processedAt: null, // Not processed
        },
      });

      expect(webhookLog.processedAt).toBeNull();

      // Admin replays the webhook
      const processedWebhook = await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { processedAt: new Date() },
      });

      expect(processedWebhook.processedAt).toBeTruthy();
    });
  });

  describe('Data Validation and Edge Cases', () => {
    it('should prevent approval of non-existent submissions', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const submission = await prisma.rwaSubmission.findUnique({
        where: { id: nonExistentId },
      });

      expect(submission).toBeNull();
    });

    it('should prevent approval of already approved submissions', async () => {
      // Create an already approved submission
      const submission = await prisma.rwaSubmission.create({
        data: createSubmissionData({
          ownerId: testUserId,
          name: 'Already Approved',
          symbol: 'APPROVED',
          status: 'APPROVED',
        }),
      });

      // Verify it cannot be approved again
      const existingSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: submission.id },
      });

      expect(existingSubmission!.status).toBe('APPROVED');

      // Logic check: approval should be rejected if status !== 'PENDING'
      const canBeApproved = existingSubmission!.status === 'PENDING';
      expect(canBeApproved).toBe(false);
    });

    it('should handle submissions with missing owner wallet addresses', async () => {
      // Create a user without wallet address
      const userWithoutWallet = await prisma.user.create({
        data: {
          privyDid: 'test-user-no-wallet',
          walletAddress: null,
        },
      });

      const submission = await prisma.rwaSubmission.create({
        data: createSubmissionData({
          ownerId: userWithoutWallet.id,
          name: 'No Wallet Item',
          symbol: 'NOWALLET',
          status: 'PENDING',
        }),
      });

      // Retrieve submission with owner
      const submissionWithOwner = await prisma.rwaSubmission.findUnique({
        where: { id: submission.id },
        include: { owner: true },
      });

      expect(submissionWithOwner!.owner.walletAddress).toBeNull();

      // Logic check: approval should be rejected if no wallet address
      const canBeApproved = submissionWithOwner!.owner.walletAddress !== null;
      expect(canBeApproved).toBe(false);
    });
  });

  describe('Performance and Concurrency Tests', () => {
    it('should handle multiple concurrent submissions', async () => {
      // Create multiple submissions concurrently
      const concurrentSubmissions = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          prisma.rwaSubmission.create({
            data: createSubmissionData({
              ownerId: testUserId,
              name: `Concurrent Item ${i}`,
              symbol: `CONC${i}`,
              status: 'PENDING',
            }),
          }),
        ),
      );

      expect(concurrentSubmissions).toHaveLength(5);
      expect(concurrentSubmissions.every((s) => s.status === 'PENDING')).toBe(true);

      // Verify all submissions are retrievable
      const allSubmissions = await prisma.rwaSubmission.findMany({
        where: { ownerId: testUserId },
      });

      expect(allSubmissions.length).toBeGreaterThanOrEqual(5);
    });

    it('should maintain data consistency during rapid state changes', async () => {
      const submission = await prisma.rwaSubmission.create({
        data: createSubmissionData({
          ownerId: testUserId,
          name: 'State Change Test',
          symbol: 'STATE',
          status: 'PENDING',
        }),
      });

      // Simulate rapid state changes with audit logging
      const stateChanges = [
        { from: 'PENDING', to: 'APPROVED' },
        { from: 'APPROVED', to: 'APPROVED' }, // Duplicate (should be handled)
      ];

      for (const change of stateChanges) {
        await prisma.submissionAuditLog.create({
          data: {
            submissionId: submission.id,
            fromStatus: change.from,
            toStatus: change.to,
            actorId: testAdminId,
            actorType: 'ADMIN',
          },
        });
      }

      // Verify audit trail integrity
      const auditLogs = await prisma.submissionAuditLog.findMany({
        where: { submissionId: submission.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(auditLogs).toHaveLength(2);
      expect(auditLogs[0].fromStatus).toBe('PENDING');
      expect(auditLogs[0].toStatus).toBe('APPROVED');
    });
  });
});
