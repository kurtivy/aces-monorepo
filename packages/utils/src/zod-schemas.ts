import { z } from 'zod';

// Document type enum for ownership documentation
export const OwnershipDocumentTypeEnum = z.enum([
  'BILL_OF_SALE',
  'CERTIFICATE_OF_AUTH',
  'INSURANCE_DOC',
  'DEED_OR_TITLE',
  'APPRAISAL_DOC',
  'PROVENANCE_DOC',
]);

// Ownership documentation object schema
export const OwnershipDocumentSchema = z.object({
  type: OwnershipDocumentTypeEnum,
  imageUrl: z.string().url('Please provide a valid documentation image URL'),
  uploadedAt: z.string().datetime(),
});

// Submission schemas (from backend.md API contract)
export const CreateSubmissionSchema = z.object({
  title: z
    .string()
    .min(1, 'Asset title is required')
    .max(200, 'Asset title must be less than 200 characters'),
  symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol must be less than 10 characters'),
  brand: z.string().min(1, 'Brand is required').max(100, 'Brand must be less than 100 characters'),
  story: z
    .string()
    .min(10, 'Story must be at least 10 characters')
    .max(5000, 'Story must be less than 5000 characters'),
  details: z
    .string()
    .min(10, 'Details must be at least 10 characters')
    .max(5000, 'Details must be less than 5000 characters'),
  provenance: z
    .string()
    .min(10, 'Provenance must be at least 10 characters')
    .max(5000, 'Provenance must be less than 5000 characters'),
  value: z.string().min(1, 'Value is required'),
  reservePrice: z.string().min(1, 'Reserve price is required'),
  hypeSentence: z
    .string()
    .min(10, 'Hype sentence must be at least 10 characters')
    .max(500, 'Hype sentence must be less than 500 characters'),
  assetType: z.enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER'], {
    required_error: 'Asset type is required',
    invalid_type_error: 'Please select a valid asset type',
  }),
  imageGallery: z
    .array(z.string().url('Please provide valid image URLs'))
    .min(1, 'At least one asset image is required'),
  ownershipDocumentation: z
    .array(OwnershipDocumentSchema)
    .min(3, 'At least 3 ownership documents are required')
    .max(6, 'Maximum 6 ownership documents allowed'),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
});

export const CreateBidSchema = z.object({
  listingId: z.string().cuid(),
  amount: z.string(),
  currency: z.enum(['ETH', 'ACES']),
  expiresAt: z.string().datetime().optional(),
});

// Admin schemas
export const ApprovalSchema = z.object({
  submissionId: z.string().cuid(),
});

export const RejectionSchema = z.object({
  submissionId: z.string().cuid(),
  rejectionReason: z.string().min(10).max(500),
});

export const RecoverySchema = z.object({
  submissionId: z.string().cuid(),
});

export const WebhookReplaySchema = z.object({
  webhookLogId: z.string().cuid(),
});

// Token metadata update schema (for item admin)
export const UpdateTokenMetadataSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  description: z.string().min(10).max(1000).optional(),
  imageGallery: z.array(z.string().url()).optional(),
});

// Pagination schema
export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

// Enum for submission status, for reuse
export const SubmissionStatusEnum = z.enum(['PENDING', 'APPROVED', 'LIVE', 'REJECTED']);

// Webhook payload schema (for chain events)
export const ChainEventWebhookSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  status: z.enum(['MINED', 'FAILED', 'DROPPED']),
  blockNumber: z.number().optional(),
  gasUsed: z.string().optional(),
});

// Token creation workflow schemas
export const TokenCreationStatusEnum = z.enum([
  'AWAITING_USER_DETAILS',
  'PENDING_ADMIN_REVIEW',
  'READY_TO_MINT',
  'MINTED',
]);

export const TokenParametersSchema = z.object({
  curve: z.number().int().min(0).max(1), // 0 = Quadratic, 1 = Linear
  steepness: z.string().regex(/^\d+$/, 'Steepness must be a valid number string'),
  floor: z.string().regex(/^\d+$/, 'Floor must be a valid number string'),
  tokensBondedAt: z.string().regex(/^\d+$/, 'Tokens bonded at must be a valid number string'),
  salt: z.string().min(1, 'Salt is required'),
  chainId: z
    .number()
    .int()
    .refine((val) => val === 8453 || val === 84532, {
      message: 'Chain ID must be Base Mainnet (8453) or Base Sepolia (84532)',
    }),
  name: z.string().optional(),
  symbol: z.string().optional(),
  predictedAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid predicted address')
    .optional(),
});

export const SaveTokenParametersSchema = z.object({
  listingId: z.string().cuid(),
  tokenParameters: TokenParametersSchema,
});

export const PrepareForMintingSchema = z.object({
  listingId: z.string().cuid(),
});

export const MintTokenSchema = z.object({
  listingId: z.string().cuid(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
});

// Export inferred types
export type CreateSubmissionRequest = z.infer<typeof CreateSubmissionSchema>;
export type CreateBidRequest = z.infer<typeof CreateBidSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalSchema>;
export type RejectionRequest = z.infer<typeof RejectionSchema>;
export type RecoveryRequest = z.infer<typeof RecoverySchema>;
export type WebhookReplayRequest = z.infer<typeof WebhookReplaySchema>;
export type UpdateTokenMetadataRequest = z.infer<typeof UpdateTokenMetadataSchema>;
export type PaginationRequest = z.infer<typeof PaginationSchema>;
export type ChainEventWebhookRequest = z.infer<typeof ChainEventWebhookSchema>;
export type TokenParametersRequest = z.infer<typeof TokenParametersSchema>;
export type SaveTokenParametersRequest = z.infer<typeof SaveTokenParametersSchema>;
export type PrepareForMintingRequest = z.infer<typeof PrepareForMintingSchema>;
export type MintTokenRequest = z.infer<typeof MintTokenSchema>;
