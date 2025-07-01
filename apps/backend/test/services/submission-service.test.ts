import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { User, RwaSubmission, Bid, Token } from '@prisma/client';
import { SubmissionService } from '../../src/services/submission-service';
import { CreateSubmissionRequest } from '@aces/utils/zod-schemas';
import {
  createTestPrismaClient,
  cleanupTestDatabase,
  disconnectTestDatabase,
  getTestNamespace,
} from './setup-database';
import { setTestNamespace, createUniqueUser, createUniqueSubmission } from './test-data-factory';

// Type for submission with included relations
type SubmissionWithRelations = RwaSubmission & {
  owner: User;
  token?: Token | null;
  bids?: (Bid & { bidder: User })[];
};

// Mock the logger
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
      database: mockLog,
      error: mockLog,
    },
  };
});

let prisma: PrismaClient;
let submissionService: SubmissionService;

describe('SubmissionService', () => {
  let user1: User;
  let user2: User;
  let pendingSubmission: RwaSubmission;
  let approvedSubmission: RwaSubmission;
  let testNamespace: string;

  beforeAll(async () => {
    // Create isolated test environment
    testNamespace = getTestNamespace('submission');
    setTestNamespace(testNamespace);
    prisma = createTestPrismaClient(testNamespace);
    submissionService = new SubmissionService(prisma);
  });

  // Use beforeEach to ensure a clean slate for every test
  beforeEach(async () => {
    // Create fresh users for each test with unique IDs
    user1 = await createUniqueUser(prisma);
    user2 = await createUniqueUser(prisma);

    // Create fresh submissions for each test
    pendingSubmission = await createUniqueSubmission(prisma, user1.id, {
      name: 'Pending Submission',
      symbol: 'PEND',
      description: 'A submission waiting for approval',
      imageUrl: 'http://example.com/pending.png',
      proofOfOwnership: 'proof-pending',
      status: 'PENDING',
    });

    approvedSubmission = await createUniqueSubmission(prisma, user2.id, {
      name: 'Approved Submission',
      symbol: 'APPR',
      description: 'A submission that is already approved',
      imageUrl: 'http://example.com/approved.png',
      proofOfOwnership: 'proof-approved',
      status: 'APPROVED',
    });
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

  describe('createSubmission', () => {
    it('should create a new submission successfully', async () => {
      const submissionData: CreateSubmissionRequest = {
        name: 'Test Asset',
        symbol: 'TEST',
        description: 'A test asset for submission',
        imageUrl: 'http://example.com/test.png',
        proofOfOwnership: 'proof-test',
      };
      const correlationId = 'test-create-submission';

      const createdSubmission = (await submissionService.createSubmission(
        user1.id,
        submissionData,
        correlationId,
      )) as SubmissionWithRelations;

      expect(createdSubmission).toBeDefined();
      expect(createdSubmission.name).toBe(submissionData.name);
      expect(createdSubmission.symbol).toBe(submissionData.symbol);
      expect(createdSubmission.description).toBe(submissionData.description);
      expect(createdSubmission.imageUrl).toBe(submissionData.imageUrl);
      expect(createdSubmission.proofOfOwnership).toBe(submissionData.proofOfOwnership);
      expect(createdSubmission.ownerId).toBe(user1.id);
      expect(createdSubmission.status).toBe('PENDING');
      expect(createdSubmission.owner).toBeDefined();

      // Verify audit log was created
      const auditLog = await prisma.submissionAuditLog.findFirst({
        where: { submissionId: createdSubmission.id },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.fromStatus).toBeNull();
      expect(auditLog?.toStatus).toBe('PENDING');
      expect(auditLog?.actorId).toBe(user1.id);
      expect(auditLog?.actorType).toBe('USER');
      expect(auditLog?.notes).toBe('Submission created');
    });
  });

  describe('getUserSubmissions', () => {
    it('should return submissions for a specific user', async () => {
      const { data, hasMore } = await submissionService.getUserSubmissions(user1.id);

      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data.every((s) => s.ownerId === user1.id)).toBe(true);
      expect(data.every((s) => s.deletedAt === null)).toBe(true);
      expect(hasMore).toBe(false);

      // Check that submissions include related data
      const submissionWithRelations = data[0] as SubmissionWithRelations;
      expect(submissionWithRelations.owner).toBeDefined();
    });

    it('should handle pagination with limit and cursor', async () => {
      // Create additional submissions for pagination testing
      for (let i = 0; i < 3; i++) {
        await createUniqueSubmission(prisma, user1.id, {
          name: `Pagination Test ${i}`,
          symbol: `PAG${i}`,
          description: 'desc',
          imageUrl: 'url',
          proofOfOwnership: 'proof',
        });
      }

      const page1 = await submissionService.getUserSubmissions(user1.id, { limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await submissionService.getUserSubmissions(user1.id, {
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.data.length).toBeGreaterThan(0);
      expect(page2.data[0].id).not.toBe(page1.data[0].id); // Different submissions
    });

    it('should return empty array for user with no submissions', async () => {
      const newUser = await createUniqueUser(prisma);

      const { data, hasMore } = await submissionService.getUserSubmissions(newUser.id);
      expect(data).toEqual([]);
      expect(hasMore).toBe(false);
    });
  });

  describe('getSubmissionById', () => {
    it('should return a submission by ID', async () => {
      const submission = await submissionService.getSubmissionById(pendingSubmission.id);

      expect(submission).not.toBeNull();
      expect(submission?.id).toBe(pendingSubmission.id);
      expect(submission?.name).toBe(pendingSubmission.name);
      expect((submission as SubmissionWithRelations)?.owner).toBeDefined();
    });

    it('should return a submission by ID for the owner', async () => {
      const submission = await submissionService.getSubmissionById(pendingSubmission.id, user1.id);

      expect(submission).not.toBeNull();
      expect(submission?.id).toBe(pendingSubmission.id);
      expect(submission?.ownerId).toBe(user1.id);
    });

    it('should return null for non-owner when userId is provided', async () => {
      const submission = await submissionService.getSubmissionById(pendingSubmission.id, user2.id);

      expect(submission).toBeNull();
    });

    it('should return null for non-existent submission', async () => {
      const nonExistentId = 'clxxxxxxxxx';
      const submission = await submissionService.getSubmissionById(nonExistentId);

      expect(submission).toBeNull();
    });
  });

  describe('softDeleteSubmission', () => {
    it('should soft delete a pending submission successfully', async () => {
      const correlationId = 'test-soft-delete';
      const result = await submissionService.softDeleteSubmission(
        pendingSubmission.id,
        user1.id,
        correlationId,
      );

      expect(result).toBe(true);

      const deletedSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: pendingSubmission.id },
      });
      expect(deletedSubmission?.deletedAt).not.toBeNull();
    });

    it('should throw an error if submission does not belong to user', async () => {
      const correlationId = 'test-soft-delete-fail';
      await expect(
        submissionService.softDeleteSubmission(pendingSubmission.id, user2.id, correlationId),
      ).rejects.toThrow('Submission not found or cannot be deleted');
    });

    it('should throw an error if submission is not in PENDING state', async () => {
      const correlationId = 'test-soft-delete-fail-status';
      await expect(
        submissionService.softDeleteSubmission(approvedSubmission.id, user2.id, correlationId),
      ).rejects.toThrow('Submission not found or cannot be deleted');
    });

    it('should throw an error for non-existent submission', async () => {
      const nonExistentId = 'clxxxxxxxxx';
      const correlationId = 'test-soft-delete-fail-notfound';
      await expect(
        submissionService.softDeleteSubmission(nonExistentId, user1.id, correlationId),
      ).rejects.toThrow('Submission not found or cannot be deleted');
    });
  });

  describe('getAllSubmissions', () => {
    it('should return all submissions when no status filter is provided', async () => {
      const { data, hasMore } = await submissionService.getAllSubmissions();

      expect(data.length).toBeGreaterThanOrEqual(2); // At least pending and approved
      expect(data.some((s) => s.status === 'PENDING')).toBe(true);
      expect(data.some((s) => s.status === 'APPROVED')).toBe(true);
      expect(hasMore).toBe(false);
    });

    it('should filter submissions by status', async () => {
      const { data } = await submissionService.getAllSubmissions('PENDING');

      expect(data.every((s) => s.status === 'PENDING')).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle pagination for all submissions', async () => {
      // Create additional submissions for pagination testing
      for (let i = 0; i < 3; i++) {
        await createUniqueSubmission(prisma, user1.id);
      }

      const page1 = await submissionService.getAllSubmissions(undefined, { limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await submissionService.getAllSubmissions(undefined, {
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.data.length).toBeGreaterThan(0);
    });

    it('should return empty array when filtering by non-existent status', async () => {
      // Using a valid but unused status for this test
      const { data, hasMore } = await submissionService.getAllSubmissions('LIVE');

      expect(data).toEqual([]);
      expect(hasMore).toBe(false);
    });
  });
});
