"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainEventWebhookSchema = exports.PaginationSchema = exports.UpdateTokenMetadataSchema = exports.WebhookReplaySchema = exports.RecoverySchema = exports.RejectionSchema = exports.ApprovalSchema = exports.CreateBidSchema = exports.CreateSubmissionSchema = void 0;
const zod_1 = require("zod");
// Submission schemas (from backend.md API contract)
exports.CreateSubmissionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50),
    symbol: zod_1.z.string().min(1).max(10),
    description: zod_1.z.string().min(10).max(1000),
    imageUrl: zod_1.z.string().url(),
    proofOfOwnership: zod_1.z.string().min(10),
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
// Webhook payload schema (for chain events)
exports.ChainEventWebhookSchema = zod_1.z.object({
    txHash: zod_1.z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    status: zod_1.z.enum(['MINED', 'FAILED', 'DROPPED']),
    blockNumber: zod_1.z.number().optional(),
    gasUsed: zod_1.z.string().optional(),
});
