import { z } from 'zod';

// Submission schemas (from backend.md API contract)
export const CreateSubmissionSchema = z.object({
  title: z
    .string()
    .min(1, 'Asset title is required')
    .max(200, 'Asset title must be less than 200 characters'),
  symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol must be less than 10 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  assetType: z.enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER'], {
    required_error: 'Asset type is required',
    invalid_type_error: 'Please select a valid asset type',
  }),
  imageGallery: z
    .array(z.string().url('Please provide valid image URLs'))
    .min(1, 'At least one asset image is required'),
  proofOfOwnership: z
    .string()
    .min(1, 'Proof of ownership is required')
    .max(1000, 'Proof of ownership must be less than 1000 characters'),
  proofOfOwnershipImageUrl: z.string().url('Please provide a valid proof documentation image'),
  typeOfOwnership: z
    .string()
    .min(1, 'Type of ownership is required')
    .max(100, 'Type of ownership must be less than 100 characters'),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  email: z.string().email('Please enter a valid email address').optional(),
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
