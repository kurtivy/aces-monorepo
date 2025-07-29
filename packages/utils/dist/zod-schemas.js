"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainEventWebhookSchema = exports.SubmissionStatusEnum = exports.PaginationSchema = exports.UpdateTokenMetadataSchema = exports.WebhookReplaySchema = exports.RecoverySchema = exports.RejectionSchema = exports.ApprovalSchema = exports.CreateBidSchema = exports.CreateSubmissionSchema = void 0;
const zod_1 = require("zod");
// Submission schemas (from backend.md API contract)
exports.CreateSubmissionSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, 'Asset name is required')
        .max(50, 'Asset name must be less than 50 characters'),
    symbol: zod_1.z.string().min(1, 'Symbol is required').max(10, 'Symbol must be less than 10 characters'),
    description: zod_1.z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(1000, 'Description must be less than 1000 characters'),
    imageUrl: zod_1.z.string().url('Please provide a valid image URL').optional(),
    imageUrls: zod_1.z.array(zod_1.z.string().url('Please provide valid image URLs')).optional().default([]),
    proofOfOwnership: zod_1.z.string().min(10, 'Proof of ownership must be at least 10 characters'),
    email: zod_1.z.string().email('Please enter a valid email address').optional(),
    destinationWallet: zod_1.z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum wallet address')
        .optional(),
    twitterLink: zod_1.z
        .string()
        .url('Please enter a valid Twitter URL')
        .regex(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, 'Please enter a valid Twitter/X URL')
        .optional()
        .or(zod_1.z.literal('')),
});
exports.CreateBidSchema = zod_1.z.object({
    submissionId: zod_1.z.string().cuid(),
    amount: zod_1.z.string(),
    currency: zod_1.z.enum(['ETH', 'ACES']),
});
// Admin schemas
exports.ApprovalSchema = zod_1.z.object({
    submissionId: zod_1.z.string().cuid(),
});
exports.RejectionSchema = zod_1.z.object({
    submissionId: zod_1.z.string().cuid(),
    rejectionReason: zod_1.z.string().min(10).max(500),
});
exports.RecoverySchema = zod_1.z.object({
    submissionId: zod_1.z.string().cuid(),
});
exports.WebhookReplaySchema = zod_1.z.object({
    webhookLogId: zod_1.z.string().cuid(),
});
// Token metadata update schema (for item admin)
exports.UpdateTokenMetadataSchema = zod_1.z.object({
    contractAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    description: zod_1.z.string().min(10).max(1000).optional(),
    imageUrl: zod_1.z.string().url().optional(),
});
// Pagination schema
exports.PaginationSchema = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.number().min(1).max(100).default(20),
});
// Enum for submission status, for reuse
exports.SubmissionStatusEnum = zod_1.z.enum(['PENDING', 'APPROVED', 'LIVE', 'REJECTED']);
// Webhook payload schema (for chain events)
exports.ChainEventWebhookSchema = zod_1.z.object({
    txHash: zod_1.z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    status: zod_1.z.enum(['MINED', 'FAILED', 'DROPPED']),
    blockNumber: zod_1.z.number().optional(),
    gasUsed: zod_1.z.string().optional(),
});
//# sourceMappingURL=zod-schemas.js.map