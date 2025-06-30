import { z } from 'zod';

// Submission schemas (from backend.md API contract)
export const CreateSubmissionSchema = z.object({
  name: z.string().min(1).max(50),
  symbol: z.string().min(1).max(10),
  description: z.string().min(10).max(1000),
  imageUrl: z.string().url(),
  proofOfOwnership: z.string().min(10),
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
