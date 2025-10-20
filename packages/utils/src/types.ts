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
export interface OwnershipDocumentMeta {
  type:
    | 'BILL_OF_SALE'
    | 'CERTIFICATE_OF_AUTH'
    | 'INSURANCE_DOC'
    | 'DEED_OR_TITLE'
    | 'APPRAISAL_DOC'
    | 'PROVENANCE_DOC';
  imageUrl: string;
  uploadedAt: string;
}

export interface RwaSubmission {
  id: string;
  title: string; // Changed from name to title
  symbol: string;
  // New RWA submission fields
  brand: string | null;
  story: string | null;
  details: string | null;
  provenance: string | null;
  value: string | null; // stored as string for precision
  reservePrice: string | null; // stored as string for precision
  hypeSentence: string | null;
  assetType: string; // enum on backend
  imageGallery: string[]; // Changed from imageUrl to imageGallery array
  ownershipDocumentation: OwnershipDocumentMeta[] | null;
  // Contact / misc
  ownerId: string;
  email: string | null;
  location: string | null; // country or city, optional
  contractAddress: string | null; // if/when linked
  status: string;
  rejectionType: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Legacy fields kept optional for backward-compat in some UIs
  description?: string;
  proofOfOwnership?: string;
  typeOfOwnership?: string;
}

export interface Token {
  id: string;
  contractAddress: string;
  rwaListingId: string; // Changed from submissionId to rwaListingId
  userId: string; // Added this field
  createdAt: Date;
}

export interface Bid {
  id: string;
  amount: string;
  currency: string;
  bidderId: string;
  listingId: string; // Changed from submissionId to listingId
  verificationId: string; // Added this field
  createdAt: Date;
  expiresAt: Date | null; // Added this field
}

// Extended interfaces for when relations are included (Prisma include queries)
export interface RwaSubmissionWithOwner extends RwaSubmission {
  owner: User;
}

export interface RwaSubmissionWithListing extends RwaSubmission {
  rwaListing: RwaListing | null; // Changed from token to rwaListing
}

export interface RwaSubmissionWithRelations extends RwaSubmission {
  owner: User;
  rwaListing: RwaListing | null; // Changed from token to rwaListing
}

// RwaListing interface to match the new schema
export interface RwaListing {
  id: string;
  title: string;
  symbol: string;
  description: string;
  imageGallery: string[];
  contractAddress: string | null;
  location: string | null;
  email: string | null;
  isLive: boolean;
  rwaSubmissionId: string;
  ownerId: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
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
