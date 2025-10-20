import { z } from 'zod';
export declare const OwnershipDocumentTypeEnum: z.ZodEnum<["BILL_OF_SALE", "CERTIFICATE_OF_AUTH", "INSURANCE_DOC", "DEED_OR_TITLE", "APPRAISAL_DOC", "PROVENANCE_DOC"]>;
export declare const OwnershipDocumentSchema: z.ZodObject<{
    type: z.ZodEnum<["BILL_OF_SALE", "CERTIFICATE_OF_AUTH", "INSURANCE_DOC", "DEED_OR_TITLE", "APPRAISAL_DOC", "PROVENANCE_DOC"]>;
    imageUrl: z.ZodString;
    uploadedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "BILL_OF_SALE" | "CERTIFICATE_OF_AUTH" | "INSURANCE_DOC" | "DEED_OR_TITLE" | "APPRAISAL_DOC" | "PROVENANCE_DOC";
    imageUrl: string;
    uploadedAt: string;
}, {
    type: "BILL_OF_SALE" | "CERTIFICATE_OF_AUTH" | "INSURANCE_DOC" | "DEED_OR_TITLE" | "APPRAISAL_DOC" | "PROVENANCE_DOC";
    imageUrl: string;
    uploadedAt: string;
}>;
export declare const CreateSubmissionSchema: z.ZodObject<{
    title: z.ZodString;
    symbol: z.ZodString;
    brand: z.ZodString;
    story: z.ZodString;
    details: z.ZodString;
    provenance: z.ZodString;
    value: z.ZodString;
    reservePrice: z.ZodString;
    hypeSentence: z.ZodString;
    assetType: z.ZodEnum<["VEHICLE", "JEWELRY", "COLLECTIBLE", "ART", "FASHION", "ALCOHOL", "OTHER"]>;
    imageGallery: z.ZodArray<z.ZodString, "many">;
    ownershipDocumentation: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["BILL_OF_SALE", "CERTIFICATE_OF_AUTH", "INSURANCE_DOC", "DEED_OR_TITLE", "APPRAISAL_DOC", "PROVENANCE_DOC"]>;
        imageUrl: z.ZodString;
        uploadedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "BILL_OF_SALE" | "CERTIFICATE_OF_AUTH" | "INSURANCE_DOC" | "DEED_OR_TITLE" | "APPRAISAL_DOC" | "PROVENANCE_DOC";
        imageUrl: string;
        uploadedAt: string;
    }, {
        type: "BILL_OF_SALE" | "CERTIFICATE_OF_AUTH" | "INSURANCE_DOC" | "DEED_OR_TITLE" | "APPRAISAL_DOC" | "PROVENANCE_DOC";
        imageUrl: string;
        uploadedAt: string;
    }>, "many">;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    value: string;
    title: string;
    brand: string;
    story: string;
    details: string;
    provenance: string;
    reservePrice: string;
    hypeSentence: string;
    assetType: "VEHICLE" | "JEWELRY" | "COLLECTIBLE" | "ART" | "FASHION" | "ALCOHOL" | "OTHER";
    imageGallery: string[];
    ownershipDocumentation: {
        type: "BILL_OF_SALE" | "CERTIFICATE_OF_AUTH" | "INSURANCE_DOC" | "DEED_OR_TITLE" | "APPRAISAL_DOC" | "PROVENANCE_DOC";
        imageUrl: string;
        uploadedAt: string;
    }[];
    location?: string | undefined;
}, {
    symbol: string;
    value: string;
    title: string;
    brand: string;
    story: string;
    details: string;
    provenance: string;
    reservePrice: string;
    hypeSentence: string;
    assetType: "VEHICLE" | "JEWELRY" | "COLLECTIBLE" | "ART" | "FASHION" | "ALCOHOL" | "OTHER";
    imageGallery: string[];
    ownershipDocumentation: {
        type: "BILL_OF_SALE" | "CERTIFICATE_OF_AUTH" | "INSURANCE_DOC" | "DEED_OR_TITLE" | "APPRAISAL_DOC" | "PROVENANCE_DOC";
        imageUrl: string;
        uploadedAt: string;
    }[];
    location?: string | undefined;
}>;
export declare const CreateBidSchema: z.ZodObject<{
    listingId: z.ZodString;
    amount: z.ZodString;
    currency: z.ZodEnum<["ETH", "ACES"]>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    listingId: string;
    amount: string;
    currency: "ETH" | "ACES";
    expiresAt?: string | undefined;
}, {
    listingId: string;
    amount: string;
    currency: "ETH" | "ACES";
    expiresAt?: string | undefined;
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
    imageGallery: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    imageGallery?: string[] | undefined;
    description?: string | undefined;
}, {
    contractAddress: string;
    imageGallery?: string[] | undefined;
    description?: string | undefined;
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
export declare const SubmissionStatusEnum: z.ZodEnum<["PENDING", "APPROVED", "LIVE", "REJECTED"]>;
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
//# sourceMappingURL=zod-schemas.d.ts.map