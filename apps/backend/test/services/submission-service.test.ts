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
  rwaListing?: RwaSubmission | null;
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
      title: 'Pending Submission',
      symbol: 'PEND',
      description: 'A submission waiting for approval',
      imageGallery: ['http://example.com/pending.png'],
      proofOfOwnership: 'proof-pending',
      typeOfOwnership: 'Vehicle',
      status: 'PENDING',
    });

    approvedSubmission = await createUniqueSubmission(prisma, user2.id, {
      title: 'Approved Submission',
      symbol: 'APPR',
      description: 'A submission that is already approved',
      imageGallery: ['http://example.com/approved.png'],
      proofOfOwnership: 'proof-approved',
      typeOfOwnership: 'Vehicle',
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
        title: 'Test Asset',
        symbol: 'TEST',
        description: 'A test asset for submission',
        imageGallery: ['http://example.com/test.png'],
        proofOfOwnership: 'proof-test',
        typeOfOwnership: 'Vehicle',
      };
      const correlationId = 'test-create-submission';

      const createdSubmission = (await submissionService.createSubmission(
        user1.id,
        submissionData,
        correlationId,
      )) as SubmissionWithRelations;

      expect(createdSubmission).toBeDefined();
      expect(createdSubmission.title).toBe(submissionData.title);
      expect(createdSubmission.symbol).toBe(submissionData.symbol);
      expect(createdSubmission.description).toBe(submissionData.description);
      expect(createdSubmission.imageGallery).toEqual(submissionData.imageGallery);
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
      expect(auditLog?.notes).toBe('Initial submission');
    });
  });

  describe('getUserSubmissions', () => {
    it('should return submissions for a specific user', async () => {
      const { data, hasMore } = await submissionService.getUserSubmissions(user1.id);

      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data.every((s) => s.ownerId === user1.id)).toBe(true);
      expect(hasMore).toBe(false);

      // Check that submissions include related data
      const submissionWithRelations = data[0] as SubmissionWithRelations;
      expect(submissionWithRelations.owner).toBeDefined();
    });

    it('should handle pagination with limit and cursor', async () => {
      // Create additional submissions for pagination testing
      for (let i = 0; i < 3; i++) {
        await createUniqueSubmission(prisma, user1.id, {
          title: `Pagination Test ${i}`,
          symbol: `PAG${i}`,
          description: 'desc',
          imageGallery: ['url'],
          proofOfOwnership: 'proof',
          typeOfOwnership: 'Vehicle',
        });
      }

      const page1 = await submissionService.getUserSubmissions(user1.id, undefined, { limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await submissionService.getUserSubmissions(user1.id, undefined, {
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
      expect(submission?.title).toBe(pendingSubmission.title);
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
      const submission = await submissionService.getSubmissionById('non-existent-id');

      expect(submission).toBeNull();
    });
  });

  describe('deleteSubmission', () => {
    it('should delete a pending submission successfully', async () => {
      const result = await submissionService.deleteSubmission(pendingSubmission.id, user1.id);

      // Verify submission was deleted
      const deletedSubmission = await prisma.rwaSubmission.findUnique({
        where: { id: pendingSubmission.id },
      });
      expect(deletedSubmission).toBeNull();

      // Verify audit log was created
      const auditLog = await prisma.submissionAuditLog.findFirst({
        where: { submissionId: pendingSubmission.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.fromStatus).toBe('PENDING');
      expect(auditLog?.toStatus).toBe('REJECTED');
      expect(auditLog?.actorId).toBe(user1.id);
      expect(auditLog?.actorType).toBe('USER');
      expect(auditLog?.notes).toBe('Submission deleted by user');
    });

    it('should throw error when trying to delete non-pending submission', async () => {
      await expect(
        submissionService.deleteSubmission(approvedSubmission.id, user2.id),
      ).rejects.toThrow('Cannot delete submission with status: APPROVED');
    });

    it('should throw error when trying to delete non-existent submission', async () => {
      await expect(submissionService.deleteSubmission('non-existent-id', user1.id)).rejects.toThrow(
        'Submission not found or access denied',
      );
    });

    it('should throw error when trying to delete another user submission', async () => {
      await expect(
        submissionService.deleteSubmission(pendingSubmission.id, user2.id),
      ).rejects.toThrow('Submission not found or access denied');
    });
  });

  describe('getAllSubmissions', () => {
    it('should return all submissions for admin', async () => {
      const { data, hasMore } = await submissionService.getAllSubmissions(user1.id);

      expect(data.length).toBeGreaterThanOrEqual(2);
      expect(hasMore).toBe(false);
      expect(data.every((s) => s.owner)).toBe(true);
    });

    it('should filter submissions by status', async () => {
      const { data: pendingData } = await submissionService.getAllSubmissions(user1.id, {
        status: 'PENDING',
      });

      expect(pendingData.every((s) => s.status === 'PENDING')).toBe(true);
    });
  });
});
