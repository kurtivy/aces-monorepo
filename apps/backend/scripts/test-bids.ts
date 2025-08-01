import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBidsFunctionality() {
  console.log('🧪 Testing Bids Functionality...\n');

  try {
    // Clean up any existing test data
    // Clean up any existing test data (in correct order due to foreign key constraints)
    await prisma.bid.deleteMany({
      where: {
        bidder: {
          privyDid: { startsWith: 'test-bids-' },
        },
      },
    });
    await prisma.bid.deleteMany({
      where: {
        listing: {
          title: { startsWith: 'Test Listing' },
        },
      },
    });
    await prisma.accountVerification.deleteMany({
      where: {
        user: {
          privyDid: { startsWith: 'test-bids-' },
        },
      },
    });
    await prisma.rwaListing.deleteMany({
      where: {
        title: { startsWith: 'Test Listing' },
      },
    });
    await prisma.rwaSubmission.deleteMany({
      where: {
        title: { startsWith: 'Test Submission' },
      },
    });
    await prisma.user.deleteMany({
      where: {
        privyDid: { startsWith: 'test-bids-' },
      },
    });

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        privyDid: `test-bids-user-${Date.now()}`,
        walletAddress: '0x1234567890123456789012345678901234567890',
        displayName: 'Test Bidder',
        email: 'test@example.com',
      },
    });
    console.log('✅ Created test user:', testUser.id);

    // Create test submission
    const testSubmission = await prisma.rwaSubmission.create({
      data: {
        title: 'Test Submission for Bids',
        symbol: 'TEST',
        description: 'A test submission for bid functionality',
        imageGallery: ['https://example.com/test-image.jpg'],
        proofOfOwnership: 'Test ownership proof',
        typeOfOwnership: 'Certificate #12345',
        ownerId: testUser.id,
        status: 'APPROVED',
      },
    });
    console.log('✅ Created test submission:', testSubmission.id);

    // Create test listing linked to the submission
    const testListing = await prisma.rwaListing.create({
      data: {
        title: 'Test Listing for Bids',
        symbol: 'TEST',
        description: 'A test listing for bid functionality',
        imageGallery: ['https://example.com/test-image.jpg'],
        isLive: true,
        rwaSubmissionId: testSubmission.id,
        ownerId: testUser.id,
      },
    });
    console.log('✅ Created test listing:', testListing.id);

    // Create account verification for the user
    const verification = await prisma.accountVerification.create({
      data: {
        userId: testUser.id,
        documentType: 'DRIVERS_LICENSE',
        documentNumber: 'TEST123456',
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: new Date('1990-01-01'),
        countryOfIssue: 'US',
        state: 'CA',
        address: '123 Test St, Test City, CA 90210',
        emailAddress: 'test@example.com',
        status: 'APPROVED',
      },
    });
    console.log('✅ Created account verification:', verification.id);

    // Create a test bid
    const testBid = await prisma.bid.create({
      data: {
        listingId: testListing.id,
        bidderId: testUser.id,
        verificationId: verification.id,
        amount: '100.50',
        currency: 'ETH',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    });
    console.log('✅ Created test bid:', testBid.id);

    // Test the getUserBids functionality
    const userBids = await prisma.bid.findMany({
      where: { bidderId: testUser.id },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            symbol: true,
            imageGallery: true,
            isLive: true,
            owner: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
        verification: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📊 Test Results:');
    console.log('User ID:', testUser.id);
    console.log('Number of bids found:', userBids.length);

    if (userBids.length > 0) {
      const bid = userBids[0];
      console.log('Latest bid:');
      console.log('  - ID:', bid.id);
      console.log('  - Amount:', bid.amount, bid.currency);
      console.log('  - Listing:', bid.listing.title);
      console.log('  - Symbol:', bid.listing.symbol);
      console.log('  - Is Live:', bid.listing.isLive);
      console.log('  - Verification Status:', bid.verification.status);
    }

    // Test the getListingsByOwner functionality
    const userListings = await prisma.rwaListing.findMany({
      where: { ownerId: testUser.id },
      include: {
        rwaSubmission: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
        bids: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        token: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📊 Listings Test Results:');
    console.log('Number of listings found:', userListings.length);

    if (userListings.length > 0) {
      const listing = userListings[0];
      console.log('Latest listing:');
      console.log('  - ID:', listing.id);
      console.log('  - Title:', listing.title);
      console.log('  - Symbol:', listing.symbol);
      console.log('  - Is Live:', listing.isLive);
      console.log('  - Number of bids:', listing.bids.length);
    }

    // Test the getOffersForUserListings functionality
    const offersForUserListings = await prisma.bid.findMany({
      where: {
        listing: {
          ownerId: testUser.id,
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            symbol: true,
            imageGallery: true,
            isLive: true,
          },
        },
        bidder: {
          select: {
            id: true,
            displayName: true,
            walletAddress: true,
          },
        },
        verification: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📊 Offers Test Results:');
    console.log('Number of offers found:', offersForUserListings.length);

    if (offersForUserListings.length > 0) {
      const offer = offersForUserListings[0];
      console.log('Latest offer:');
      console.log('  - ID:', offer.id);
      console.log('  - Amount:', offer.amount, offer.currency);
      console.log('  - Listing:', offer.listing.title);
      console.log('  - From:', offer.bidder.displayName || offer.bidder.walletAddress);
    }

    console.log('\n✅ Bids functionality test completed successfully!');
    console.log('\nTo test the API endpoints, you can:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Use a tool like Postman or curl to call:');
    console.log('   GET http://localhost:3002/api/v1/bids/my');
    console.log('   GET http://localhost:3002/api/v1/bids/my-listings-offers');
    console.log('   GET http://localhost:3002/api/v1/listings/my-listings');
    console.log('   Headers: Authorization: Bearer <your-auth-token>');
  } catch (error) {
    console.error('❌ Error testing bids functionality:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testBidsFunctionality();
