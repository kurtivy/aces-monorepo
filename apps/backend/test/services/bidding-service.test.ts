import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { User, RwaSubmission } from '@prisma/client';
import { BiddingService } from '../../src/services/bidding-service';
import { CreateBidRequest } from '../../../packages/utils/src/types';

const prisma = new PrismaClient();
const biddingService = new BiddingService(prisma);

describe('BiddingService', () => {
  let user1: User;
  let user2: User;
  let submission1: RwaSubmission;

  beforeAll(async () => {
    // Create some seed data that can be used across tests
    user1 = await prisma.user.create({
      data: {
        privyDid: 'user-did-1',
        walletAddress: '0xUser1WalletAddress',
      },
    });

    user2 = await prisma.user.create({
      data: {
        privyDid: 'user-did-2',
        walletAddress: '0xUser2WalletAddress',
      },
    });

    submission1 = await prisma.rwaSubmission.create({
      data: {
        name: 'Test Submission',
        symbol: 'TEST',
        description: 'A test submission for bidding',
        imageUrl: 'http://example.com/image.png',
        proofOfOwnership: 'proof-link',
        ownerId: user2.id, // user2 owns the submission
      },
    });
  });

  afterEach(async () => {
    // Clean up bids after each test to ensure isolation
    await prisma.bid.deleteMany();
  });

  afterAll(async () => {
    // Clean up all data after tests are done
    // Use a transaction to ensure all deletions succeed
    await prisma.$transaction([
      prisma.submissionAuditLog.deleteMany(),
      prisma.bid.deleteMany(),
      prisma.rwaSubmission.deleteMany(),
      prisma.user.deleteMany(),
    ]);
    await prisma.$disconnect();
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
    });

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
    });

    it('should not allow a user to bid on their own submission', async () => {
      const bidRequest: CreateBidRequest = {
        submissionId: submission1.id,
        amount: '1.0',
        currency: 'ETH',
      };

      // user2 owns submission1
      await expect(
        biddingService.createOrUpdateBid(user2.id, bidRequest, 'corr-id-3'),
      ).rejects.toThrow('Cannot bid on your own submission');
    });
  });
});
