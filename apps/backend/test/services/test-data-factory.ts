import type { PrismaClient, User, RwaSubmission, WebhookLog } from '@prisma/client';

// Unique identifier generators with much stronger uniqueness guarantees
let userCounter = 0;
let submissionCounter = 0;
let webhookCounter = 0;
let txCounter = 0;

// Global test run identifier for complete isolation
const testRunId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Per-test namespace for even more isolation
let currentTestNamespace = '';

export function setTestNamespace(namespace: string): void {
  currentTestNamespace = namespace;
}

export function generateUniqueId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 12); // Longer random string
  const namespace = currentTestNamespace ? `${currentTestNamespace}_` : '';
  return `${namespace}${prefix}_${testRunId}_${timestamp}_${random}`;
}

export function generateUniqueWalletAddress(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 12);
  const namespace = currentTestNamespace ? currentTestNamespace.substring(0, 4) : 'test';

  // Create a more unique wallet address
  const uniquePart = `${namespace}${timestamp}${random}`;
  const walletAddress = `0x${uniquePart}`.toLowerCase().padEnd(42, '0').substring(0, 42);

  return walletAddress;
}

export function generateUniqueTxHash(): string {
  txCounter++;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const namespace = currentTestNamespace ? currentTestNamespace.substring(0, 4) : 'test';

  return `0x${namespace}${txCounter.toString().padStart(8, '0')}${timestamp.toString(16)}${random}`
    .padEnd(66, '0')
    .substring(0, 66);
}

export async function createTestUsers(
  prisma: PrismaClient,
  namespace?: string,
): Promise<[User, User]> {
  userCounter++;
  const testNamespace = namespace || currentTestNamespace || generateUniqueId('ns');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  try {
    // Use transaction to create both users atomically
    const [adminUser, regularUser] = await prisma.$transaction([
      prisma.user.create({
        data: {
          privyDid: `admin_${testNamespace}_${userCounter}_${timestamp}_${random}`,
          walletAddress:
            process.env.ADMIN_WALLET_ADDRESSES?.split(',')[0] || generateUniqueWalletAddress(),
        },
      }),
      prisma.user.create({
        data: {
          privyDid: `user_${testNamespace}_${userCounter}_${timestamp}_${random}`,
          walletAddress: generateUniqueWalletAddress(),
        },
      }),
    ]);

    return [adminUser, regularUser];
  } catch (error) {
    console.error('Failed to create test users:', error);
    throw new Error(`Test user creation failed: ${error}`);
  }
}

export async function createTestSubmissions(
  prisma: PrismaClient,
  _adminUser: User,
  regularUser: User,
  namespace?: string,
): Promise<[RwaSubmission, RwaSubmission]> {
  submissionCounter++;
  const testNamespace = namespace || currentTestNamespace || generateUniqueId('ns');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  try {
    // Use transaction to create both submissions atomically
    const [pendingSubmission, approvedSubmission] = await prisma.$transaction([
      prisma.rwaSubmission.create({
        data: {
          name: `Pending_Submission_${testNamespace}_${submissionCounter}`,
          symbol: `PEND${submissionCounter}${random}`.substring(0, 10).toUpperCase(),
          description: `A submission waiting for approval ${testNamespace} ${timestamp}`,
          imageUrl: `https://example.com/pending-${testNamespace}-${timestamp}.png`,
          proofOfOwnership: `proof-pending-${testNamespace}-${timestamp}-${random}`,
          ownerId: regularUser.id,
          status: 'PENDING',
        },
      }),
      prisma.rwaSubmission.create({
        data: {
          name: `Approved_Submission_${testNamespace}_${submissionCounter}`,
          symbol: `APPR${submissionCounter}${random}`.substring(0, 10).toUpperCase(),
          description: `A submission that is already approved ${testNamespace} ${timestamp}`,
          imageUrl: `https://example.com/approved-${testNamespace}-${timestamp}.png`,
          proofOfOwnership: `proof-approved-${testNamespace}-${timestamp}-${random}`,
          ownerId: regularUser.id,
          status: 'APPROVED',
          txHash: generateUniqueTxHash(),
        },
      }),
    ]);

    return [pendingSubmission, approvedSubmission];
  } catch (error) {
    console.error('Failed to create test submissions:', error);
    throw new Error(`Test submission creation failed: ${error}`);
  }
}

export async function createTestWebhooks(
  prisma: PrismaClient,
  failedSubmission: RwaSubmission,
  namespace?: string,
): Promise<[WebhookLog, WebhookLog]> {
  webhookCounter++;
  const testNamespace = namespace || currentTestNamespace || generateUniqueId('ns');
  const timestamp = Date.now();

  try {
    // Use transaction to create both webhooks atomically
    const [unprocessedWebhook, processedWebhook] = await prisma.$transaction([
      prisma.webhookLog.create({
        data: {
          payload: {
            event: 'transaction.mined',
            txHash: failedSubmission.txHash,
            status: 'MINED',
            blockNumber: 12345,
            timestamp,
            namespace: testNamespace,
          },
          headers: { 'content-type': 'application/json' },
          error: `Processing failed ${testNamespace} ${webhookCounter}`,
        },
      }),
      prisma.webhookLog.create({
        data: {
          payload: {
            event: 'transaction.failed',
            hash: generateUniqueTxHash(),
            status: 'FAILED',
            timestamp,
            namespace: testNamespace,
          },
          headers: { 'content-type': 'application/json' },
          processedAt: new Date(),
        },
      }),
    ]);

    return [unprocessedWebhook, processedWebhook];
  } catch (error) {
    console.error('Failed to create test webhooks:', error);
    throw new Error(`Test webhook creation failed: ${error}`);
  }
}

// Create single instances with guaranteed uniqueness
export async function createUniqueUser(
  prisma: PrismaClient,
  overrides: Partial<{ privyDid: string; walletAddress: string }> = {},
): Promise<User> {
  userCounter++;
  const testNamespace = currentTestNamespace || generateUniqueId('ns');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return prisma.user.create({
    data: {
      privyDid:
        overrides.privyDid || `unique_user_${testNamespace}_${userCounter}_${timestamp}_${random}`,
      walletAddress: overrides.walletAddress || generateUniqueWalletAddress(),
    },
  });
}

export async function createUniqueSubmission(
  prisma: PrismaClient,
  ownerId: string,
  overrides: Partial<RwaSubmission> = {},
): Promise<RwaSubmission> {
  submissionCounter++;
  const testNamespace = currentTestNamespace || generateUniqueId('ns');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return prisma.rwaSubmission.create({
    data: {
      name: overrides.name || `Unique_Submission_${testNamespace}_${submissionCounter}`,
      symbol: overrides.symbol || `UNQ${submissionCounter}${random}`.substring(0, 10).toUpperCase(),
      description: overrides.description || `Unique submission ${testNamespace} ${timestamp}`,
      imageUrl:
        overrides.imageUrl || `https://example.com/unique-${testNamespace}-${timestamp}.png`,
      proofOfOwnership:
        overrides.proofOfOwnership || `proof-unique-${testNamespace}-${timestamp}-${random}`,
      ownerId,
      status: overrides.status || 'PENDING',
      txHash: overrides.txHash,
      ...overrides,
    },
  });
}

export function resetCounters(): void {
  userCounter = 0;
  submissionCounter = 0;
  webhookCounter = 0;
  txCounter = 0;
}

// Debugging utility
export function getTestStats(): {
  testRunId: string;
  currentNamespace: string;
  counters: {
    users: number;
    submissions: number;
    webhooks: number;
    transactions: number;
  };
} {
  return {
    testRunId,
    currentNamespace: currentTestNamespace,
    counters: {
      users: userCounter,
      submissions: submissionCounter,
      webhooks: webhookCounter,
      transactions: txCounter,
    },
  };
}
