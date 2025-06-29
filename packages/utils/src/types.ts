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
  email?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Submission types (matching Prisma schema)
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'LIVE' | 'REJECTED';
export type TxStatus = 'SUBMITTED' | 'MINED' | 'FAILED' | 'DROPPED';
export type RejectionType = 'MANUAL' | 'TX_FAILURE';
export type ActionType = 'USER' | 'SYSTEM' | 'WEBHOOK' | 'ADMIN';

export interface RwaSubmission {
  id: string;
  status: SubmissionStatus;
  txStatus?: TxStatus;
  rejectionType?: RejectionType;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  ownerId: string;
  proofOfOwnership: string;
  createdAt: Date;
  approvedAt?: Date;
  rejectionReason?: string;
  txHash?: string;
  deletedAt?: Date;
  updatedBy?: string;
  updatedByType?: ActionType;
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
  deletedAt?: Date;
  updatedBy?: string;
  updatedByType?: ActionType;
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
  data?: T;
  error?: AppError;
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
