"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MintTokenSchema = exports.PrepareForMintingSchema = exports.SaveTokenParametersSchema = exports.TokenParametersSchema = exports.TokenCreationStatusEnum = exports.ChainEventWebhookSchema = exports.SubmissionStatusEnum = exports.PaginationSchema = exports.UpdateTokenMetadataSchema = exports.WebhookReplaySchema = exports.RecoverySchema = exports.RejectionSchema = exports.ApprovalSchema = exports.CreateBidSchema = exports.CreateSubmissionSchema = exports.OwnershipDocumentSchema = exports.OwnershipDocumentTypeEnum = void 0;
const zod_1 = require("zod");
// Document type enum for ownership documentation
exports.OwnershipDocumentTypeEnum = zod_1.z.enum([
    'BILL_OF_SALE',
    'CERTIFICATE_OF_AUTH',
    'INSURANCE_DOC',
    'DEED_OR_TITLE',
    'APPRAISAL_DOC',
    'PROVENANCE_DOC',
]);
// Ownership documentation object schema
exports.OwnershipDocumentSchema = zod_1.z.object({
    type: exports.OwnershipDocumentTypeEnum,
    imageUrl: zod_1.z.string().url('Please provide a valid documentation image URL'),
    uploadedAt: zod_1.z.string().datetime(),
});
// Submission schemas (from backend.md API contract)
exports.CreateSubmissionSchema = zod_1.z.object({
    title: zod_1.z
        .string()
        .min(1, 'Asset title is required')
        .max(200, 'Asset title must be less than 200 characters'),
    symbol: zod_1.z.string().min(1, 'Symbol is required').max(10, 'Symbol must be less than 10 characters'),
    brand: zod_1.z.string().min(1, 'Brand is required').max(100, 'Brand must be less than 100 characters'),
    story: zod_1.z
        .string()
        .min(10, 'Story must be at least 10 characters')
        .max(5000, 'Story must be less than 5000 characters'),
    details: zod_1.z
        .string()
        .min(10, 'Details must be at least 10 characters')
        .max(5000, 'Details must be less than 5000 characters'),
    provenance: zod_1.z
        .string()
        .min(10, 'Provenance must be at least 10 characters')
        .max(5000, 'Provenance must be less than 5000 characters'),
    value: zod_1.z.string().min(1, 'Value is required'),
    reservePrice: zod_1.z.string().min(1, 'Reserve price is required'),
    hypeSentence: zod_1.z
        .string()
        .min(10, 'Hype sentence must be at least 10 characters')
        .max(500, 'Hype sentence must be less than 500 characters'),
    assetType: zod_1.z.enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER'], {
        required_error: 'Asset type is required',
        invalid_type_error: 'Please select a valid asset type',
    }),
    imageGallery: zod_1.z
        .array(zod_1.z.string().url('Please provide valid image URLs'))
        .min(1, 'At least one asset image is required'),
    ownershipDocumentation: zod_1.z
        .array(exports.OwnershipDocumentSchema)
        .min(3, 'At least 3 ownership documents are required')
        .max(6, 'Maximum 6 ownership documents allowed'),
    location: zod_1.z.string().max(200, 'Location must be less than 200 characters').optional(),
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
// Token creation workflow schemas
exports.TokenCreationStatusEnum = zod_1.z.enum([
    'AWAITING_USER_DETAILS',
    'PENDING_ADMIN_REVIEW',
    'READY_TO_MINT',
    'MINTED',
]);
exports.TokenParametersSchema = zod_1.z.object({
    curve: zod_1.z.number().int().min(0).max(1), // 0 = Quadratic, 1 = Linear
    steepness: zod_1.z.string().regex(/^\d+$/, 'Steepness must be a valid number string'),
    floor: zod_1.z.string().regex(/^\d+$/, 'Floor must be a valid number string'),
    tokensBondedAt: zod_1.z.string().regex(/^\d+$/, 'Tokens bonded at must be a valid number string'),
    salt: zod_1.z.string().min(1, 'Salt is required'),
    chainId: zod_1.z
        .number()
        .int()
        .refine((val) => val === 8453 || val === 84532, {
        message: 'Chain ID must be Base Mainnet (8453) or Base Sepolia (84532)',
    }),
    name: zod_1.z.string().optional(),
    symbol: zod_1.z.string().optional(),
    predictedAddress: zod_1.z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid predicted address')
        .optional(),
});
exports.SaveTokenParametersSchema = zod_1.z.object({
    listingId: zod_1.z.string().cuid(),
    tokenParameters: exports.TokenParametersSchema,
});
exports.PrepareForMintingSchema = zod_1.z.object({
    listingId: zod_1.z.string().cuid(),
});
exports.MintTokenSchema = zod_1.z.object({
    listingId: zod_1.z.string().cuid(),
    contractAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
});
//# sourceMappingURL=zod-schemas.js.map