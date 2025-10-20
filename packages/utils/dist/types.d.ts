export type AppError = {
    statusCode: number;
    code: string;
    message: string;
    meta?: Record<string, unknown>;
};
export type PaginatedResponse<T> = {
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
};
export interface User {
    id: string;
    privyDid: string;
    walletAddress: string | null;
    email: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'LIVE' | 'REJECTED';
export type TxStatus = 'SUBMITTED' | 'MINED' | 'FAILED' | 'DROPPED';
export type RejectionType = 'MANUAL' | 'TX_FAILURE';
export type ActionType = 'USER' | 'SYSTEM' | 'WEBHOOK' | 'ADMIN';
export interface OwnershipDocumentMeta {
    type: 'BILL_OF_SALE' | 'CERTIFICATE_OF_AUTH' | 'INSURANCE_DOC' | 'DEED_OR_TITLE' | 'APPRAISAL_DOC' | 'PROVENANCE_DOC';
    imageUrl: string;
    uploadedAt: string;
}
export interface RwaSubmission {
    id: string;
    title: string;
    symbol: string;
    brand: string | null;
    story: string | null;
    details: string | null;
    provenance: string | null;
    value: string | null;
    reservePrice: string | null;
    hypeSentence: string | null;
    assetType: string;
    imageGallery: string[];
    ownershipDocumentation: OwnershipDocumentMeta[] | null;
    ownerId: string;
    email: string | null;
    location: string | null;
    contractAddress: string | null;
    status: string;
    rejectionType: string | null;
    approvedAt: Date | null;
    rejectionReason: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    description?: string;
    proofOfOwnership?: string;
    typeOfOwnership?: string;
}
export interface Token {
    id: string;
    contractAddress: string;
    rwaListingId: string;
    userId: string;
    createdAt: Date;
}
export interface Bid {
    id: string;
    amount: string;
    currency: string;
    bidderId: string;
    listingId: string;
    verificationId: string;
    createdAt: Date;
    expiresAt: Date | null;
}
export interface RwaSubmissionWithOwner extends RwaSubmission {
    owner: User;
}
export interface RwaSubmissionWithListing extends RwaSubmission {
    rwaListing: RwaListing | null;
}
export interface RwaSubmissionWithRelations extends RwaSubmission {
    owner: User;
    rwaListing: RwaListing | null;
}
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
//# sourceMappingURL=types.d.ts.map