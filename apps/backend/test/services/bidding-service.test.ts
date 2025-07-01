import { describe, it, expect, afterEach, afterAll, beforeEach, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { User, RwaSubmission } from '@prisma/client';
import { BiddingService } from '../../src/services/bidding-service';
import { CreateBidRequest } from '@aces/utils/zod-schemas';
import {
  createTestPrismaClient,
  cleanupTestDatabase,
  disconnectTestDatabase,
  getTestNamespace,
} from './setup-database';
import { setTestNamespace, createUniqueUser, createUniqueSubmission } from './test-data-factory';

let prisma: PrismaClient;
let biddingService: BiddingService;

describe('BiddingService', () => {
  let user1: User;
  let user2: User;
  let submission1: RwaSubmission;
  let testNamespace: string;

  beforeAll(async () => {
    // Create isolated test environment
    testNamespace = getTestNamespace('bidding');
    setTestNamespace(testNamespace);
    prisma = createTestPrismaClient(testNamespace);
    biddingService = new BiddingService(prisma);
  });

  // Use beforeEach to set up fresh data for each test
  beforeEach(async () => {
    // Create unique users for this test
    user1 = await createUniqueUser(prisma);
    user2 = await createUniqueUser(prisma);

    // Create unique submission owned by user2
    submission1 = await createUniqueSubmission(prisma, user2.id, {
      name: 'Test Submission for Bidding',
      symbol: 'TESTBID',
      description: 'A test submission for bidding',
      imageUrl: 'http://example.com/image.png',
      proofOfOwnership: 'proof-link',
    });
  });

  afterEach(async () => {
    // Clean up all data after each test to ensure isolation
    await cleanupTestDatabase(prisma);
  });

  afterAll(async () => {
    // Disconnect Prisma at the very end
    await disconnectTestDatabase(prisma);
  });

  describe('createOrUpdateBid', () => {
    it('should create a new bid for a user if one does not exist', async () => {
      const bidRequest: CreateBidRequest = {
        submissionId: submission1.id,
        amount: '1.5',
        currency: 'ETH',
      };
      const correlationId = 'test-create-corr-id';

      const createdBid = await biddingService.createOrUpdateBid(
        user1.id,
        bidRequest,
        correlationId,
      );

      expect(createdBid).toBeDefined();
      expect(createdBid.bidderId).toBe(user1.id);
      expect(createdBid.submissionId).toBe(submission1.id);
      expect(createdBid.amount).toBe('1.5');
      expect(createdBid.currency).toBe('ETH');

      const dbBid = await prisma.bid.findUnique({ where: { id: createdBid.id } });
      expect(dbBid).not.toBeNull();
      expect(dbBid?.bidderId).toBe(user1.id);
      expect(dbBid?.submissionId).toBe(submission1.id);
    }, 10000);

    it('should update an existing bid for a user', async () => {
      // First, create a bid
      const initialBidRequest: CreateBidRequest = {
        submissionId: submission1.id,
        amount: '1.0',
        currency: 'ETH',
      };
      await biddingService.createOrUpdateBid(user1.id, initialBidRequest, 'corr-id-1');

      // Now, update it
      const updatedBidRequest: CreateBidRequest = {
        submissionId: submission1.id,
        amount: '2.5', // New amount
        currency: 'ETH',
      };
      const updatedBid = await biddingService.createOrUpdateBid(
        user1.id,
        updatedBidRequest,
        'corr-id-2',
      );

      expect(updatedBid.amount).toBe('2.5');

      const bidsForUser = await prisma.bid.findMany({ where: { bidderId: user1.id } });
      expect(bidsForUser.length).toBe(1); // Should not create a new bid
      expect(bidsForUser[0].amount).toBe('2.5');
    }, 10000);

    it('should not allow a user to bid on their own submission', async () => {
      const bidRequest: CreateBidRequest = {
        submissionId: submission1.id,
        amount: '1.0',
        currency: 'ETH',
      };

      // user2 owns submission1, so they should not be able to bid on it
      await expect(
        biddingService.createOrUpdateBid(user2.id, bidRequest, 'corr-id-3'),
      ).rejects.toThrow('Cannot bid on your own submission');
    }, 10000);
  });
});
