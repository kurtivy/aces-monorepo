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
export interface RwaSubmission {
    id: string;
    name: string;
    symbol: string;
    description: string;
    imageUrl: string | null;
    imageUrls: string[];
    proofOfOwnership: string;
    ownerId: string;
    email: string | null;
    destinationWallet: string | null;
    twitterLink: string | null;
    status: string;
    txStatus: string | null;
    rejectionType: string | null;
    approvedAt: Date | null;
    rejectionReason: string | null;
    txHash: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    updatedBy: string | null;
    updatedByType: string | null;
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
export interface RwaSubmissionWithOwner extends RwaSubmission {
    owner: User;
}
export interface RwaSubmissionWithToken extends RwaSubmission {
    token: Token | null;
}
export interface RwaSubmissionWithRelations extends RwaSubmission {
    owner: User;
    token: Token | null;
    bids: (Bid & {
        bidder: User;
    })[];
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