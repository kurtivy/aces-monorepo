import { z } from 'zod';
export declare const CreateSubmissionSchema: z.ZodObject<{
    name: z.ZodString;
    symbol: z.ZodString;
    description: z.ZodString;
    imageUrl: z.ZodString;
    proofOfOwnership: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    name: string;
    description: string;
    imageUrl: string;
    proofOfOwnership: string;
}, {
    symbol: string;
    name: string;
    description: string;
    imageUrl: string;
    proofOfOwnership: string;
}>;
export declare const CreateBidSchema: z.ZodObject<{
    submissionId: z.ZodString;
    amount: z.ZodString;
    currency: z.ZodEnum<["ETH", "ACES"]>;
}, "strip", z.ZodTypeAny, {
    submissionId: string;
    amount: string;
    currency: "ETH" | "ACES";
}, {
    submissionId: string;
    amount: string;
    currency: "ETH" | "ACES";
}>;
export declare const ApprovalSchema: z.ZodObject<{
    submissionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    submissionId: string;
}, {
    submissionId: string;
}>;
export declare const RejectionSchema: z.ZodObject<{
    submissionId: z.ZodString;
    rejectionReason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    submissionId: string;
    rejectionReason: string;
}, {
    submissionId: string;
    rejectionReason: string;
}>;
export declare const RecoverySchema: z.ZodObject<{
    submissionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    submissionId: string;
}, {
    submissionId: string;
}>;
export declare const WebhookReplaySchema: z.ZodObject<{
    webhookLogId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    webhookLogId: string;
}, {
    webhookLogId: string;
}>;
export declare const UpdateTokenMetadataSchema: z.ZodObject<{
    contractAddress: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
}, {
    contractAddress: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
}>;
export declare const PaginationSchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const ChainEventWebhookSchema: z.ZodObject<{
    txHash: z.ZodString;
    status: z.ZodEnum<["MINED", "FAILED", "DROPPED"]>;
    blockNumber: z.ZodOptional<z.ZodNumber>;
    gasUsed: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "MINED" | "FAILED" | "DROPPED";
    txHash: string;
    blockNumber?: number | undefined;
    gasUsed?: string | undefined;
}, {
    status: "MINED" | "FAILED" | "DROPPED";
    txHash: string;
    blockNumber?: number | undefined;
    gasUsed?: string | undefined;
}>;
export type CreateSubmissionRequest = z.infer<typeof CreateSubmissionSchema>;
export type CreateBidRequest = z.infer<typeof CreateBidSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalSchema>;
export type RejectionRequest = z.infer<typeof RejectionSchema>;
export type RecoveryRequest = z.infer<typeof RecoverySchema>;
export type WebhookReplayRequest = z.infer<typeof WebhookReplaySchema>;
export type UpdateTokenMetadataRequest = z.infer<typeof UpdateTokenMetadataSchema>;
export type PaginationRequest = z.infer<typeof PaginationSchema>;
export type ChainEventWebhookRequest = z.infer<typeof ChainEventWebhookSchema>;
