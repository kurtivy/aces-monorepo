"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const accounts_1 = require("viem/accounts");
const utils_1 = require("@aces/utils");
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const database_1 = require("../lib/database");
class ApprovalService {
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
        // Configure chain based on network
        const chain = this.network === 'baseSepolia' ? chains_1.baseSepolia : chains_1.baseSepolia; // Default to baseSepolia for now
        this.walletClient = (0, viem_1.createWalletClient)({
            account,
            chain,
            transport: (0, viem_1.http)(process.env.BASE_RPC_URL || 'https://sepolia.base.org'),
        });
        logger_1.loggers.blockchain('initialized', 'wallet_client', `network: ${this.network}`);
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
    async approveSubmission(submissionId, adminId, correlationId) {
        try {
            // Use transaction to ensure atomicity
            const result = await (0, database_1.withTransaction)(async (tx) => {
                // Get submission with owner details
                const submission = await tx.rwaSubmission.findUnique({
                    where: { id: submissionId },
                    include: { owner: true },
                });
                if (!submission) {
                    throw errors_1.errors.notFound('Submission not found');
                }
                if (submission.status !== 'PENDING') {
                    throw errors_1.errors.validation(`Submission status is ${submission.status}, cannot approve`);
                }
                if (!submission.owner.walletAddress) {
                    throw errors_1.errors.validation('Submission owner has no wallet address');
                }
                // Check if already has a transaction hash (idempotency)
                if (submission.txHash) {
                    logger_1.loggers.blockchain(submission.txHash, 'already_approved', submission.id);
                    return { txHash: submission.txHash };
                }
                // Get contract addresses for current network
                const contractAddresses = utils_1.CONTRACTS[this.network];
                if (!contractAddresses?.mockRwaFactory) {
                    throw errors_1.errors.internal(`No factory contract address configured for network: ${this.network}`);
                }
                // Call factory contract to create RWA
                logger_1.loggers.blockchain('calling', 'factory_contract', contractAddresses.mockRwaFactory);
                const walletClient = this.ensureWalletClient();
                if (!walletClient.account) {
                    throw errors_1.errors.internal('Wallet client is not configured with an account.');
                }
                const hash = await walletClient.writeContract({
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
                logger_1.loggers.blockchain(hash, 'transaction_submitted', contractAddresses.mockRwaFactory);
                // Update submission status
                await tx.rwaSubmission.update({
                    where: { id: submissionId },
                    data: {
                        status: 'APPROVED',
                        txHash: hash,
                        txStatus: 'SUBMITTED',
                        approvedAt: new Date(),
                        updatedBy: adminId,
                        updatedByType: 'ADMIN',
                    },
                });
                // Log to audit trail
                await tx.submissionAuditLog.create({
                    data: {
                        submissionId,
                        fromStatus: 'PENDING',
                        toStatus: 'APPROVED',
                        actorId: adminId,
                        actorType: 'ADMIN',
                        notes: `Approved and submitted transaction: ${hash}`,
                    },
                });
                return { txHash: hash };
            });
            logger_1.loggers.database('approved', 'rwa_submission', submissionId);
            return result;
        }
        catch (error) {
            logger_1.loggers.error(error, {
                submissionId,
                adminId,
                correlationId,
                operation: 'approveSubmission',
            });
            throw error;
        }
    }
    async updateTransactionStatus(txHash, status, blockNumber, gasUsed, correlationId) {
        try {
            const result = await (0, database_1.withTransaction)(async (tx) => {
                // Find submission by transaction hash
                const submission = await tx.rwaSubmission.findUnique({
                    where: { txHash },
                    include: { owner: true },
                });
                if (!submission) {
                    logger_1.loggers.blockchain(txHash, 'submission_not_found', 'updateTransactionStatus');
                    return false;
                }
                // Idempotency check - if already in this status, do nothing
                if (submission.txStatus === status) {
                    logger_1.loggers.blockchain(txHash, 'status_already_set', status);
                    return true;
                }
                // Determine the new status
                let newStatus;
                if (status === 'MINED') {
                    newStatus = 'LIVE';
                }
                else if (status === 'FAILED' || status === 'DROPPED') {
                    newStatus = 'REJECTED';
                }
                // Update submission
                const updateData = {
                    txStatus: status,
                    updatedByType: 'WEBHOOK',
                };
                if (newStatus) {
                    updateData.status = newStatus;
                }
                if (newStatus === 'REJECTED') {
                    updateData.rejectionType = 'TX_FAILURE';
                }
                await tx.rwaSubmission.update({
                    where: { txHash },
                    data: updateData,
                });
                // Log to audit trail
                await tx.submissionAuditLog.create({
                    data: {
                        submissionId: submission.id,
                        fromStatus: submission.status,
                        toStatus: newStatus || submission.status,
                        actorId: 'SYSTEM',
                        actorType: 'WEBHOOK',
                        notes: `Transaction ${status.toLowerCase()}: ${txHash}${blockNumber ? ` (block ${blockNumber})` : ''}`,
                    },
                });
                // If transaction was successful, create token record
                if (status === 'MINED' && blockNumber) {
                    // We would need to query the blockchain for the actual token address and deed NFT ID
                    // For now, we'll leave this as a placeholder for when we implement full blockchain integration
                    logger_1.loggers.blockchain(txHash, 'token_creation_placeholder', submission.id);
                }
                return true;
            });
            logger_1.loggers.blockchain(txHash, 'status_updated', status);
            return result;
        }
        catch (error) {
            logger_1.loggers.error(error, {
                txHash,
                status,
                correlationId,
                operation: 'updateTransactionStatus',
            });
            throw error;
        }
    }
    async getPendingApprovals(options = {}) {
        try {
            const limit = Math.min(options.limit || 20, 100);
            const where = {
                status: 'PENDING',
                deletedAt: null,
            };
            if (options.cursor) {
                where.id = { lt: options.cursor };
            }
            const submissions = await this.prisma.rwaSubmission.findMany({
                where,
                include: {
                    owner: true,
                    bids: {
                        where: { deletedAt: null },
                        orderBy: { createdAt: 'desc' },
                        take: 5, // Include recent bids for admin context
                    },
                },
                orderBy: { createdAt: 'asc' }, // Oldest first for FIFO processing
                take: limit + 1,
            });
            const hasMore = submissions.length > limit;
            const data = hasMore ? submissions.slice(0, -1) : submissions;
            const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
            return { data, nextCursor, hasMore };
        }
        catch (error) {
            logger_1.loggers.error(error, { operation: 'getPendingApprovals' });
            throw error;
        }
    }
    async getSubmissionDetails(submissionId) {
        try {
            const submission = await this.prisma.rwaSubmission.findUnique({
                where: { id: submissionId },
                include: {
                    owner: true,
                    token: true,
                    bids: {
                        where: { deletedAt: null },
                        include: { bidder: true },
                        orderBy: { createdAt: 'desc' },
                    },
                    auditLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 10, // Recent audit history
                    },
                },
            });
            return submission;
        }
        catch (error) {
            logger_1.loggers.error(error, { submissionId, operation: 'getSubmissionDetails' });
            throw error;
        }
    }
    async validateAdminPermissions(userId, walletAddress) {
        if (!walletAddress) {
            return false;
        }
        const adminWallets = (process.env.ADMIN_WALLET_ADDRESSES || '').toLowerCase().split(',');
        return adminWallets.includes(walletAddress.toLowerCase());
    }
}
exports.ApprovalService = ApprovalService;
