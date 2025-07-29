import { z } from 'zod';

// Submission schemas (from backend.md API contract)
export const CreateSubmissionSchema = z.object({
  name: z
    .string()
    .min(1, 'Asset name is required')
    .max(50, 'Asset name must be less than 50 characters'),
  symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol must be less than 10 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters'),
  imageUrl: z.string().url('Please provide a valid image URL').optional(),
  imageUrls: z.array(z.string().url('Please provide valid image URLs')).optional().default([]),
  proofOfOwnership: z.string().min(10, 'Proof of ownership must be at least 10 characters'),
  email: z.string().email('Please enter a valid email address').optional(),
  destinationWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum wallet address')
    .optional(),
  twitterLink: z
    .string()
    .url('Please enter a valid Twitter URL')
    .regex(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, 'Please enter a valid Twitter/X URL')
    .optional()
    .or(z.literal('')),
});

export const CreateBidSchema = z.object({
  submissionId: z.string().cuid(),
  amount: z.string(),
  currency: z.enum(['ETH', 'ACES']),
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
  imageUrl: z.string().url().optional(),
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
