"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryService = void 0;
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const accounts_1 = require("viem/accounts");
const utils_1 = require("@aces/utils");
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const database_1 = require("../lib/database");
const zod_1 = require("zod");
const ReplayWebhookPayloadSchema = zod_1.z
    .object({
    txHash: zod_1.z.string().optional(),
    hash: zod_1.z.string().optional(),
    transactionHash: zod_1.z.string().optional(),
    status: zod_1.z.string(),
    blockNumber: zod_1.z.number().optional(),
    gasUsed: zod_1.z.string().optional(),
})
    .refine((data) => data.txHash || data.hash || data.transactionHash, {
    message: 'Payload must contain one of txHash, hash, or transactionHash',
});
class RecoveryService {
    prisma;
    walletClient = null;
    network;
    constructor(prisma) {
        this.prisma = prisma;
        // Initialize network setting but don't require wallet client immediately
        this.network = process.env.BLOCKCHAIN_NETWORK || 'localhost';
        // Only initialize wallet client if we have the private key
        if (process.env.MINTER_PRIVATE_KEY) {
            this.initializeWalletClient();
        }
    }
    initializeWalletClient() {
        if (!process.env.MINTER_PRIVATE_KEY) {
            throw new Error('MINTER_PRIVATE_KEY environment variable is required for blockchain operations');
        }
        const account = (0, accounts_1.privateKeyToAccount)(process.env.MINTER_PRIVATE_KEY);
        const chain = this.network === 'baseSepolia' ? chains_1.baseSepolia : chains_1.baseSepolia;
        this.walletClient = (0, viem_1.createWalletClient)({
            account,
            chain,
            transport: (0, viem_1.http)(process.env.BASE_RPC_URL || 'https://sepolia.base.org'),
        });
        logger_1.loggers.blockchain('initialized', 'recovery_wallet_client', `network: ${this.network}`);
    }
    ensureWalletClient() {
        if (!this.walletClient) {
            if (!process.env.MINTER_PRIVATE_KEY) {
                throw new Error('MINTER_PRIVATE_KEY environment variable is required for blockchain operations');
            }
            this.initializeWalletClient();
            // Double-check initialization succeeded
            if (!this.walletClient) {
                throw new Error('Failed to initialize wallet client');
            }
        }
        return this.walletClient;
    }
    async resubmitTransaction(submissionId, adminId, correlationId) {
        try {
            const result = await (0, database_1.withTransaction)(async (tx) => {
                // Get submission details
                const submission = await tx.rwaSubmission.findUnique({
                    where: { id: submissionId },
                    include: { owner: true },
                });
                if (!submission) {
                    throw errors_1.errors.notFound('Submission not found');
                }
                // Validate that this submission can be resubmitted
                if (submission.status !== 'APPROVED' && submission.status !== 'REJECTED') {
                    throw errors_1.errors.validation(`Cannot resubmit submission with status: ${submission.status}`);
                }
                if (!submission.txHash) {
                    throw errors_1.errors.validation('No original transaction to resubmit');
                }
                if (submission.txStatus !== 'FAILED' && submission.txStatus !== 'DROPPED') {
                    throw errors_1.errors.validation(`Cannot resubmit transaction with status: ${submission.txStatus}`);
                }
                if (!submission.owner.walletAddress) {
                    throw errors_1.errors.validation('Submission owner has no wallet address');
                }
                const previousTxHash = submission.txHash;
                // Get contract addresses
                const contractAddresses = utils_1.CONTRACTS[this.network];
                if (!contractAddresses?.mockRwaFactory) {
                    throw errors_1.errors.internal(`No factory contract address configured for network: ${this.network}`);
                }
                // Resubmit the transaction with same parameters
                logger_1.loggers.blockchain('resubmitting', 'factory_contract', `${contractAddresses.mockRwaFactory} | original: ${previousTxHash}`);
                const walletClient = this.ensureWalletClient();
                if (!walletClient.account) {
                    throw errors_1.errors.internal('Wallet client is not configured with an account.');
                }
                const newHash = await walletClient.writeContract({
                    account: walletClient.account,
                    chain: walletClient.chain,
                    address: contractAddresses.mockRwaFactory,
                    abi: utils_1.MOCK_RWA_FACTORY_ABI,
                    functionName: 'createRwa',
                    args: [
                        submission.name,
                        submission.symbol,
                        BigInt(1), // Temporary deedId - in production this should be dynamically generated
                        submission.owner.walletAddress,
                    ],
                });
                logger_1.loggers.blockchain(newHash, 'transaction_resubmitted', `previous: ${previousTxHash}`);
                // Update submission with new transaction
                await tx.rwaSubmission.update({
                    where: { id: submissionId },
                    data: {
                        status: 'APPROVED', // Back to approved since we resubmitted
                        txHash: newHash,
                        txStatus: 'SUBMITTED',
                        updatedBy: adminId,
                        updatedByType: 'ADMIN',
                    },
                });
                // Log to audit trail
                await tx.submissionAuditLog.create({
                    data: {
                        submissionId,
                        fromStatus: submission.status,
                        toStatus: 'APPROVED',
                        actorId: adminId,
                        actorType: 'ADMIN',
                        notes: `Transaction resubmitted. New: ${newHash}, Previous: ${previousTxHash}`,
                    },
                });
                return { txHash: newHash, previousTxHash };
            });
            logger_1.loggers.database('resubmitted', 'rwa_submission', submissionId);
            return result;
        }
        catch (error) {
            logger_1.loggers.error(error, {
                submissionId,
                adminId,
                correlationId,
                operation: 'resubmitTransaction',
            });
            throw error;
        }
    }
    async replayWebhook(webhookLogId, adminId, correlationId) {
        try {
            const result = await (0, database_1.withTransaction)(async (tx) => {
                // Get webhook log
                const webhookLog = await tx.webhookLog.findUnique({
                    where: { id: webhookLogId },
                });
                if (!webhookLog) {
                    throw errors_1.errors.notFound('Webhook log not found');
                }
                // Check if already processed (idempotency)
                if (webhookLog.processedAt) {
                    logger_1.loggers.blockchain('webhook_already_processed', 'replay', webhookLogId);
                    return { success: true, processed: true };
                }
                // Mark as processed first to prevent duplicate processing
                await tx.webhookLog.update({
                    where: { id: webhookLogId },
                    data: { processedAt: new Date() },
                });
                // Extract transaction details from payload
                const parseResult = ReplayWebhookPayloadSchema.safeParse(webhookLog.payload);
                if (!parseResult.success) {
                    throw errors_1.errors.validation('Invalid webhook payload', { details: parseResult.error.issues });
                }
                const payload = parseResult.data;
                const txHash = payload.txHash || payload.hash || payload.transactionHash;
                const status = payload.status;
                if (!txHash || !status) {
                    throw errors_1.errors.validation('Invalid webhook payload: missing txHash or status');
                }
                // Find the submission by transaction hash
                const submission = await tx.rwaSubmission.findUnique({
                    where: { txHash },
                });
                if (!submission) {
                    logger_1.loggers.blockchain(txHash, 'submission_not_found_for_webhook', webhookLogId);
                    return { success: true, processed: false };
                }
                // Update submission status based on webhook
                let newSubmissionStatus;
                let newTxStatus;
                switch (status.toUpperCase()) {
                    case 'MINED':
                    case 'SUCCESS':
                    case 'CONFIRMED':
                        newSubmissionStatus = 'LIVE';
                        newTxStatus = 'MINED';
                        break;
                    case 'FAILED':
                    case 'REVERTED':
                        newSubmissionStatus = 'REJECTED';
                        newTxStatus = 'FAILED';
                        break;
                    case 'DROPPED':
                    case 'CANCELLED':
                        newSubmissionStatus = 'REJECTED';
                        newTxStatus = 'DROPPED';
                        break;
                    default:
                        throw errors_1.errors.validation(`Unknown transaction status: ${status}`);
                }
                // Update submission
                await tx.rwaSubmission.update({
                    where: { txHash },
                    data: {
                        status: newSubmissionStatus,
                        txStatus: newTxStatus,
                        updatedByType: 'WEBHOOK',
                    },
                });
                // Log to audit trail
                await tx.submissionAuditLog.create({
                    data: {
                        submissionId: submission.id,
                        fromStatus: submission.status,
                        toStatus: newSubmissionStatus,
                        actorId: adminId,
                        actorType: 'ADMIN',
                        notes: `Webhook replayed: ${status} for tx ${txHash}${payload.blockNumber ? ` (block ${payload.blockNumber})` : ''}`,
                    },
                });
                return { success: true, processed: false };
            });
            logger_1.loggers.database('webhook_replayed', 'webhook_log', webhookLogId);
            return result;
        }
        catch (error) {
            logger_1.loggers.error(error, {
                webhookLogId,
                adminId,
                correlationId,
                operation: 'replayWebhook',
            });
            throw error;
        }
    }
    async getFailedTransactions(options = {}) {
        try {
            const limit = Math.min(options.limit || 20, 100);
            const where = {
                txStatus: { in: ['FAILED', 'DROPPED'] },
                deletedAt: null,
            };
            if (options.cursor) {
                where.id = { lt: options.cursor };
            }
            const submissions = (await this.prisma.rwaSubmission.findMany({
                where,
                include: {
                    owner: true,
                    auditLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 3, // Recent audit history
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit + 1,
            }));
            const hasMore = submissions.length > limit;
            const data = hasMore ? submissions.slice(0, -1) : submissions;
            const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
            return { data, nextCursor, hasMore };
        }
        catch (error) {
            logger_1.loggers.error(error, { operation: 'getFailedTransactions' });
            throw error;
        }
    }
    async getUnprocessedWebhooks(options = {}) {
        try {
            const limit = Math.min(options.limit || 20, 100);
            const where = {
                processedAt: null,
                error: { not: null }, // Only show errored webhooks
            };
            if (options.cursor) {
                where.id = { lt: options.cursor };
            }
            const webhookLogs = await this.prisma.webhookLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit + 1,
            });
            const hasMore = webhookLogs.length > limit;
            const data = hasMore ? webhookLogs.slice(0, -1) : webhookLogs;
            const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
            return { data, nextCursor, hasMore };
        }
        catch (error) {
            logger_1.loggers.error(error, { operation: 'getUnprocessedWebhooks' });
            throw error;
        }
    }
    async getRecoveryStats() {
        try {
            const [failedTransactions, unprocessedWebhooks, pendingApprovals] = await Promise.all([
                this.prisma.rwaSubmission.count({
                    where: {
                        txStatus: { in: ['FAILED', 'DROPPED'] },
                        deletedAt: null,
                    },
                }),
                this.prisma.webhookLog.count({
                    where: {
                        processedAt: null,
                        error: { not: null },
                    },
                }),
                this.prisma.rwaSubmission.count({
                    where: {
                        status: 'PENDING',
                        deletedAt: null,
                    },
                }),
            ]);
            return {
                failedTransactions,
                unprocessedWebhooks,
                pendingApprovals,
            };
        }
        catch (error) {
            logger_1.loggers.error(error, { operation: 'getRecoveryStats' });
            throw error;
        }
    }
}
exports.RecoveryService = RecoveryService;
