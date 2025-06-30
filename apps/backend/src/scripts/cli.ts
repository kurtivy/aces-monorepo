#!/usr/bin/env ts-node
/* eslint-disable no-console */

import { getPrismaClient, disconnectDatabase } from '../lib/database';
import { logger } from '../lib/logger';
import { RecoveryService } from '../services/recovery-service';
import { ApprovalService } from '../services/approval-service';
import { BiddingService } from '../services/bidding-service';
import type { Bid, SubmissionAuditLog, User, RwaSubmission } from '@prisma/client';

const prisma = getPrismaClient();

// Initialize services
const recoveryService = new RecoveryService(prisma);
const approvalService = new ApprovalService(prisma);
const biddingService = new BiddingService(prisma);

type DetailedSubmission = RwaSubmission & {
  owner: User;
  token?: { contractAddress: string; deedNftId: number } | null;
  bids: (Bid & { bidder: User })[];
  auditLogs: SubmissionAuditLog[];
};

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command) {
    console.log(`
ACES Backend CLI

Usage: pnpm cli <command> [arguments]

Commands:
  recover-tx <submissionId>           Resubmit a failed transaction
  replay-webhook <webhookLogId>       Replay a failed webhook
  stats                              Show system statistics
  list-failed                        List failed transactions
  list-webhooks                      List unprocessed webhooks
  list-pending                       List pending approvals
  submission <submissionId>          Show submission details
  help                               Show this help message

Examples:
  pnpm cli recover-tx clm123abc456def
  pnpm cli replay-webhook clm789xyz123
  pnpm cli stats
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'recover-tx':
        await handleRecoverTransaction(args);
        break;

      case 'replay-webhook':
        await handleReplayWebhook(args);
        break;

      case 'stats':
        await handleStats();
        break;

      case 'list-failed':
        await handleListFailed();
        break;

      case 'list-webhooks':
        await handleListWebhooks();
        break;

      case 'list-pending':
        await handleListPending();
        break;

      case 'submission':
        await handleShowSubmission(args);
        break;

      case 'help':
        process.argv = [process.argv[0], process.argv[1], '']; // Trigger help display
        main();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "pnpm cli help" for available commands');
        process.exit(1);
    }
  } catch (error) {
    logger.error({ error, command, args }, 'CLI command failed');
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

async function handleRecoverTransaction(args: string[]) {
  const [submissionId] = args;

  if (!submissionId) {
    console.error('Usage: pnpm cli recover-tx <submissionId>');
    process.exit(1);
  }

  console.log(`🔄 Attempting to recover transaction for submission: ${submissionId}`);

  try {
    const result = await recoveryService.resubmitTransaction(
      submissionId,
      'CLI',
      `cli-recovery-${Date.now()}`,
    );

    console.log(`✅ Transaction resubmitted successfully!`);
    console.log(`   New Transaction Hash: ${result.txHash}`);
    if (result.previousTxHash) {
      console.log(`   Previous Hash: ${result.previousTxHash}`);
    }
    console.log(`   Monitor the transaction on the blockchain explorer.`);
  } catch (error) {
    console.error(
      `❌ Failed to resubmit transaction: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

async function handleReplayWebhook(args: string[]) {
  const [webhookLogId] = args;

  if (!webhookLogId) {
    console.error('Usage: pnpm cli replay-webhook <webhookLogId>');
    process.exit(1);
  }

  console.log(`🔄 Attempting to replay webhook: ${webhookLogId}`);

  try {
    const result = await recoveryService.replayWebhook(
      webhookLogId,
      'CLI',
      `cli-webhook-replay-${Date.now()}`,
    );

    if (result.processed) {
      console.log(`ℹ️  Webhook was already processed, no action taken.`);
    } else {
      console.log(`✅ Webhook replayed successfully!`);
      console.log(`   Check the audit logs for submission status updates.`);
    }
  } catch (error) {
    console.error(
      `❌ Failed to replay webhook: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

async function handleStats() {
  console.log(`📊 ACES Backend Statistics\n`);

  try {
    const [recoveryStats, biddingStats] = await Promise.all([
      recoveryService.getRecoveryStats(),
      biddingService.getBiddingStats(),
    ]);

    console.log(`System Health:`);
    console.log(`  Failed Transactions: ${recoveryStats.failedTransactions}`);
    console.log(`  Unprocessed Webhooks: ${recoveryStats.unprocessedWebhooks}`);
    console.log(`  Pending Approvals: ${recoveryStats.pendingApprovals}`);
    console.log();

    console.log(`Bidding Activity:`);
    console.log(`  Total Active Bids: ${biddingStats.totalActiveBids}`);
    console.log(`  Unique Bidders: ${biddingStats.totalBiddingUsers}`);
    console.log(`  Top Currency: ${biddingStats.topCurrency}`);
    console.log();

    // Additional database stats
    const [totalSubmissions, liveTokens, totalUsers] = await Promise.all([
      prisma.rwaSubmission.count({ where: { deletedAt: null } }),
      prisma.rwaSubmission.count({ where: { status: 'LIVE', deletedAt: null } }),
      prisma.user.count(),
    ]);

    console.log(`Database Stats:`);
    console.log(`  Total Submissions: ${totalSubmissions}`);
    console.log(`  Live Tokens: ${liveTokens}`);
    console.log(`  Total Users: ${totalUsers}`);
    console.log();

    // Show action items if any
    if (recoveryStats.failedTransactions > 0) {
      console.log(
        `⚠️  Action Required: ${recoveryStats.failedTransactions} failed transactions need attention`,
      );
      console.log(`   Run: pnpm cli list-failed`);
    }

    if (recoveryStats.unprocessedWebhooks > 0) {
      console.log(`⚠️  Action Required: ${recoveryStats.unprocessedWebhooks} unprocessed webhooks`);
      console.log(`   Run: pnpm cli list-webhooks`);
    }

    if (recoveryStats.pendingApprovals > 0) {
      console.log(`📋 ${recoveryStats.pendingApprovals} submissions pending admin approval`);
      console.log(`   Run: pnpm cli list-pending`);
    }
  } catch (error) {
    console.error(
      `❌ Failed to retrieve stats: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

async function handleListFailed() {
  console.log(`💥 Failed Transactions:\n`);

  try {
    const result = await recoveryService.getFailedTransactions({ limit: 10 });

    if (result.data.length === 0) {
      console.log(`✅ No failed transactions found.`);
      return;
    }

    result.data.forEach((submission, index) => {
      console.log(`${index + 1}. ${submission.name} (${submission.symbol})`);
      console.log(`   Submission ID: ${submission.id}`);
      console.log(`   Transaction Hash: ${submission.txHash}`);
      console.log(`   Status: ${submission.txStatus}`);
      console.log(`   Owner ID: ${submission.ownerId}`);
      console.log(`   Recovery Command: pnpm cli recover-tx ${submission.id}`);
      console.log();
    });

    if (result.hasMore) {
      console.log(`... and ${result.hasMore ? 'more' : '0'} additional failed transactions.`);
    }
  } catch (error) {
    console.error(
      `❌ Failed to list failed transactions: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

async function handleListWebhooks() {
  console.log(`🪝 Unprocessed Webhooks:\n`);

  try {
    const result = await recoveryService.getUnprocessedWebhooks({ limit: 10 });

    if (result.data.length === 0) {
      console.log(`✅ No unprocessed webhooks found.`);
      return;
    }

    result.data.forEach((webhook, index) => {
      console.log(`${index + 1}. Webhook ID: ${webhook.id}`);
      console.log(`   Created: ${webhook.createdAt}`);
      console.log(`   Error: ${webhook.error}`);
      console.log(`   Payload Preview: ${JSON.stringify(webhook.payload).substring(0, 100)}...`);
      console.log(`   Replay Command: pnpm cli replay-webhook ${webhook.id}`);
      console.log();
    });

    if (result.hasMore) {
      console.log(`... and ${result.hasMore ? 'more' : '0'} additional unprocessed webhooks.`);
    }
  } catch (error) {
    console.error(
      `❌ Failed to list webhooks: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

async function handleListPending() {
  console.log(`📋 Pending Approvals:\n`);

  try {
    const result = await approvalService.getPendingApprovals({ limit: 10 });

    if (result.data.length === 0) {
      console.log(`✅ No pending approvals found.`);
      return;
    }

    result.data.forEach((submission, index) => {
      console.log(`${index + 1}. ${submission.name} (${submission.symbol})`);
      console.log(`   Submission ID: ${submission.id}`);
      console.log(`   Owner ID: ${submission.ownerId}`);
      console.log(`   Created: ${submission.createdAt}`);
      console.log(`   Description: ${submission.description.substring(0, 100)}...`);
      console.log(`   Details Command: pnpm cli submission ${submission.id}`);
      console.log();
    });

    if (result.hasMore) {
      console.log(`... and ${result.hasMore ? 'more' : '0'} additional pending submissions.`);
    }
  } catch (error) {
    console.error(
      `❌ Failed to list pending approvals: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

async function handleShowSubmission(args: string[]) {
  const [submissionId] = args;

  if (!submissionId) {
    console.error('Usage: pnpm cli submission <submissionId>');
    process.exit(1);
  }

  console.log(`📋 Submission Details: ${submissionId}\n`);

  try {
    const submission = (await approvalService.getSubmissionDetails(
      submissionId,
    )) as DetailedSubmission | null;

    if (!submission) {
      console.error(`❌ Submission not found: ${submissionId}`);
      process.exit(1);
    }

    console.log(`Basic Information:`);
    console.log(`  Name: ${submission.name}`);
    console.log(`  Symbol: ${submission.symbol}`);
    console.log(`  Status: ${submission.status}`);
    console.log(`  TX Status: ${submission.txStatus || 'None'}`);
    console.log(`  Created: ${submission.createdAt}`);
    if (submission.approvedAt) {
      console.log(`  Approved: ${submission.approvedAt}`);
    }
    console.log();

    console.log(`Owner Information:`);
    console.log(`  Privy DID: ${submission.owner.privyDid}`);
    console.log(`  Wallet: ${submission.owner.walletAddress || 'Not connected'}`);
    console.log();

    console.log(`Content:`);
    console.log(`  Description: ${submission.description}`);
    console.log(`  Image URL: ${submission.imageUrl}`);
    console.log(`  Proof of Ownership: ${submission.proofOfOwnership}`);
    console.log();

    if (submission.txHash) {
      console.log(`Blockchain:`);
      console.log(`  Transaction Hash: ${submission.txHash}`);
      if (submission.token) {
        console.log(`  Contract Address: ${submission.token.contractAddress}`);
        console.log(`  Deed NFT ID: ${submission.token.deedNftId}`);
      }
      console.log();
    }

    if (submission.bids && submission.bids.length > 0) {
      console.log(`Bids (${submission.bids.length}):`);
      submission.bids.slice(0, 5).forEach((bid, index) => {
        console.log(
          `  ${index + 1}. ${bid.amount} ${bid.currency} by ${
            bid.bidder.walletAddress || bid.bidder.id
          }`,
        );
      });
      if (submission.bids.length > 5) {
        console.log(`  ... and ${submission.bids.length - 5} more bids`);
      }
      console.log();
    }

    if (submission.auditLogs && submission.auditLogs.length > 0) {
      console.log(`Recent Audit History:`);
      submission.auditLogs.slice(0, 3).forEach((log, index) => {
        console.log(
          `  ${index + 1}. ${log.fromStatus || 'None'} → ${log.toStatus} (${log.actorType})`,
        );
        console.log(`     ${log.createdAt}: ${log.notes}`);
      });
      console.log();
    }
  } catch (error) {
    console.error(
      `❌ Failed to get submission details: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 CLI interrupted, cleaning up...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 CLI terminated, cleaning up...');
  await disconnectDatabase();
  process.exit(0);
});

// Run the CLI
main().catch(async (error) => {
  logger.error({ error }, 'Unhandled CLI error');
  console.error('Fatal error:', error);
  await disconnectDatabase();
  process.exit(1);
});
