// Core shared types for ACES platform

// Standard Error Contract (from backend.md)
export type AppError = {
  statusCode: number;
  code: string;
  message: string;
  meta?: Record<string, unknown>;
};

// Standard Pagination Contract (from backend.md)
export type PaginatedResponse<T> = {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
};

// User types - Exactly matching Prisma's User model
export interface User {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Submission types (matching Prisma schema)
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'LIVE' | 'REJECTED';
export type TxStatus = 'SUBMITTED' | 'MINED' | 'FAILED' | 'DROPPED';
export type RejectionType = 'MANUAL' | 'TX_FAILURE';
export type ActionType = 'USER' | 'SYSTEM' | 'WEBHOOK' | 'ADMIN';

// Base RwaSubmission interface - matches Prisma model fields only (no relations)
export interface RwaSubmission {
  id: string;
  status: SubmissionStatus;
  txStatus: TxStatus | null;
  rejectionType: RejectionType | null;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  proofOfOwnership: string;
  destinationWallet: string | null;
  twitterLink: string | null;
  email: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectionReason: string | null;
  txHash: string | null;
  deletedAt: Date | null;
  updatedBy: string | null;
  updatedByType: ActionType | null;
}

export interface Token {
  id: string;
  contractAddress: string;
  deedNftId: number;
  submissionId: string;
  createdAt: Date;
}

export interface Bid {
  id: string;
  amount: string;
  currency: string;
  bidderId: string;
  submissionId: string;
  createdAt: Date;
  deletedAt: Date | null;
  updatedBy: string | null;
  updatedByType: ActionType | null;
}

// Extended interfaces for when relations are included (Prisma include queries)
export interface RwaSubmissionWithOwner extends RwaSubmission {
  owner: User;
}

export interface RwaSubmissionWithToken extends RwaSubmission {
  token: Token | null;
}

export interface RwaSubmissionWithRelations extends RwaSubmission {
  owner: User;
  token: Token | null;
  bids: (Bid & { bidder: User })[];
}

// For service layer responses that might include audit logs
export interface RwaSubmissionDetailed extends RwaSubmissionWithRelations {
  auditLogs: {
    id: string;
    submissionId: string;
    fromStatus: SubmissionStatus | null;
    toStatus: SubmissionStatus;
    actorId: string;
    actorType: ActionType;
    notes: string | null;
    createdAt: Date;
  }[];
}

// Blockchain types
export interface ContractAddresses {
  acesToken: string;
  deedNft: string;
  factory: string;
}

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  contracts: ContractAddresses;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: AppError | string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'ready';
  timestamp: string;
  version?: string;
}

// Contract interaction types
export interface CreateRwaParams {
  name: string;
  symbol: string;
  tokenURI: string;
  initialOwner: string;
}

export interface ApprovalResult {
  txHash: string;
  submissionId: string;
}

export interface RecoveryResult {
  success: boolean;
  txHash?: string;
  message?: string;
}
