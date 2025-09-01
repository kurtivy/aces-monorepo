"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainEventWebhookSchema = exports.SubmissionStatusEnum = exports.PaginationSchema = exports.UpdateTokenMetadataSchema = exports.WebhookReplaySchema = exports.RecoverySchema = exports.RejectionSchema = exports.ApprovalSchema = exports.CreateBidSchema = exports.CreateSubmissionSchema = void 0;
const zod_1 = require("zod");
// Submission schemas (from backend.md API contract)
exports.CreateSubmissionSchema = zod_1.z.object({
    title: zod_1.z
        .string()
        .min(1, 'Asset title is required')
        .max(200, 'Asset title must be less than 200 characters'),
    symbol: zod_1.z.string().min(1, 'Symbol is required').max(10, 'Symbol must be less than 10 characters'),
    description: zod_1.z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(2000, 'Description must be less than 2000 characters'),
    assetType: zod_1.z.enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER'], {
        required_error: 'Asset type is required',
        invalid_type_error: 'Please select a valid asset type',
    }),
    imageGallery: zod_1.z
        .array(zod_1.z.string().url('Please provide valid image URLs'))
        .min(1, 'At least one asset image is required'),
    proofOfOwnership: zod_1.z
        .string()
        .min(1, 'Proof of ownership is required')
        .max(1000, 'Proof of ownership must be less than 1000 characters'),
    proofOfOwnershipImageUrl: zod_1.z.string().url('Please provide a valid proof documentation image'),
    typeOfOwnership: zod_1.z
        .string()
        .min(1, 'Type of ownership is required')
        .max(100, 'Type of ownership must be less than 100 characters'),
    location: zod_1.z.string().max(200, 'Location must be less than 200 characters').optional(),
    email: zod_1.z.string().email('Please enter a valid email address').optional(),
});
exports.CreateBidSchema = zod_1.z.object({
    listingId: zod_1.z.string().cuid(),
    amount: zod_1.z.string(),
    currency: zod_1.z.enum(['ETH', 'ACES']),
    expiresAt: zod_1.z.string().datetime().optional(),
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
    imageGallery: zod_1.z.array(zod_1.z.string().url()).optional(),
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