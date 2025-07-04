import { PrismaClient } from '@prisma/client';

// Global test run identifier to ensure complete isolation
const testRunId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Keep track of all active test clients for cleanup
const activeClients = new Set<PrismaClient>();

export function createTestPrismaClient(_testNamespace?: string): PrismaClient {
  // Create isolated Prisma client with reduced logging for tests
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['error'], // Only log errors to reduce noise
  });

  // Track active clients for cleanup
  activeClients.add(prisma);

  return prisma;
}

export function getTestNamespace(testFileNameHint?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const fileHint = testFileNameHint ? testFileNameHint.replace(/[^a-zA-Z0-9]/g, '') : 'test';

  return `${testRunId}_${fileHint}_${timestamp}_${random}`;
}

// AGGRESSIVE cleanup strategy - force sequential operations with retries
export async function cleanupTestDatabase(prisma: PrismaClient, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Strategy 1: Try with timeout and explicit ordering
      await cleanupWithTimeouts(prisma);
      return; // Success!
    } catch (error) {
      console.warn(`Cleanup attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt === maxRetries) {
        // Final attempt: use force cleanup
        console.warn('Using force cleanup as last resort...');
        await forceCleanupTestDatabase(prisma);
        return;
      }

      // Wait before retry to let any pending transactions finish
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}

async function cleanupWithTimeouts(prisma: PrismaClient): Promise<void> {
  // Use a transaction with aggressive timeouts and explicit ordering
  await prisma.$transaction(
    async (tx) => {
      // CRITICAL: Delete in exact order to avoid foreign key violations

      // 1. WebhookLogs first (no foreign key dependencies)
      await tx.webhookLog.deleteMany();

      // 2. Bids (references: submissionId, bidderId)
      await tx.bid.deleteMany();

      // 3. SubmissionAuditLogs (references: submissionId)
      await tx.submissionAuditLog.deleteMany();

      // 4. Tokens (if exists - references submissionId)
      try {
        await tx.token.deleteMany();
      } catch (error) {
        // Token table might not exist in some scenarios
        console.debug('Token cleanup skipped (expected in some tests)');
      }

      // 5. RwaSubmissions (references: ownerId)
      await tx.rwaSubmission.deleteMany();

      // 6. Users last (parent of submissions)
      await tx.user.deleteMany();
    },
    {
      maxWait: 5000, // 5 seconds max wait
      timeout: 15000, // 15 seconds total timeout
      isolationLevel: 'Serializable', // Highest isolation level
    },
  );
}

// Ultra-aggressive cleanup for when transaction approach fails
export async function forceCleanupTestDatabase(prisma: PrismaClient): Promise<void> {
  try {
    // Use raw SQL with CASCADE to force deletion
    console.log('Executing force cleanup with raw SQL...');

    // Disable foreign key checks temporarily (PostgreSQL way)
    await prisma.$executeRaw`SET session_replication_role = replica;`;

    // Force delete all test data
    await prisma.$executeRaw`DELETE FROM "webhookLog";`;
    await prisma.$executeRaw`DELETE FROM "bid";`;
    await prisma.$executeRaw`DELETE FROM "submissionAuditLog";`;

    // Try to delete token table if it exists
    try {
      await prisma.$executeRaw`DELETE FROM "token";`;
    } catch (e) {
      console.debug('Token table deletion skipped:', e);
    }

    await prisma.$executeRaw`DELETE FROM "rwaSubmission";`;
    await prisma.$executeRaw`DELETE FROM "user";`;

    // Re-enable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;

    console.log('Force cleanup completed successfully');
  } catch (error) {
    console.error('Force cleanup failed:', error);

    // Last resort: try TRUNCATE (resets auto-increment as well)
    try {
      await prisma.$executeRaw`TRUNCATE TABLE "webhookLog", "bid", "submissionAuditLog", "rwaSubmission", "user" RESTART IDENTITY CASCADE;`;
      console.log('TRUNCATE cleanup succeeded as final fallback');
    } catch (truncateError) {
      console.error('Even TRUNCATE failed:', truncateError);
      // At this point, log the issue but don't block tests
    }
  }
}

// Disconnect all connections properly with cleanup
export async function disconnectTestDatabase(prisma: PrismaClient): Promise<void> {
  try {
    // Remove from active clients
    activeClients.delete(prisma);

    // Disconnect
    await prisma.$disconnect();
  } catch (error) {
    console.warn('Database disconnect failed:', error);
  }
}

// Global cleanup for all test clients (emergency cleanup)
export async function disconnectAllTestClients(): Promise<void> {
  const clients = Array.from(activeClients);
  console.log(`Disconnecting ${clients.length} active test clients...`);

  await Promise.all(
    clients.map(async (client) => {
      try {
        await forceCleanupTestDatabase(client);
        await client.$disconnect();
      } catch (error) {
        console.warn('Failed to cleanup client:', error);
      }
    }),
  );

  activeClients.clear();
}

// Utility to wait for database to be ready (handles connection issues)
export async function waitForDatabase(prisma: PrismaClient, maxAttempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      return; // Success!
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Database not ready after ${maxAttempts} attempts: ${error}`);
      }
      console.log(`Database connection attempt ${attempt}/${maxAttempts} failed, retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
}

// Utility to check database state (for debugging isolation issues)
export async function debugDatabaseState(prisma: PrismaClient): Promise<void> {
  try {
    const userCount = await prisma.user.count();
    const submissionCount = await prisma.rwaSubmission.count();
    const bidCount = await prisma.bid.count();
    const auditCount = await prisma.submissionAuditLog.count();
    const webhookCount = await prisma.webhookLog.count();

    console.log(`[DEBUG] Database state:`, {
      users: userCount,
      submissions: submissionCount,
      bids: bidCount,
      auditLogs: auditCount,
      webhooks: webhookCount,
      total: userCount + submissionCount + bidCount + auditCount + webhookCount,
    });
  } catch (error) {
    console.error('[DEBUG] Failed to check database state:', error);
  }
}

// Test isolation verification
export async function verifyDatabaseEmpty(prisma: PrismaClient): Promise<boolean> {
  try {
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.rwaSubmission.count(),
      prisma.bid.count(),
      prisma.submissionAuditLog.count(),
      prisma.webhookLog.count(),
    ]);

    const totalRecords = counts.reduce((sum, count) => sum + count, 0);

    if (totalRecords > 0) {
      console.warn(`⚠️ Database not empty: ${totalRecords} records found`);
      await debugDatabaseState(prisma);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to verify empty database:', error);
    return false;
  }
}

// Setup global test cleanup handlers
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    console.log('Process exiting, cleaning up test database connections...');
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, cleaning up...');
    await disconnectAllTestClients();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, cleaning up...');
    await disconnectAllTestClients();
    process.exit(0);
  });
}
