// src/lib/prisma-enums.ts - Complete Enum Definitions
// Safe enum definitions that work in serverless environments
// These MUST match your Prisma schema exactly

export const UserRole = {
  TRADER: 'TRADER',
  ADMIN: 'ADMIN',
} as const;

export const VerificationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const DocumentType = {
  DRIVERS_LICENSE: 'DRIVERS_LICENSE',
  PASSPORT: 'PASSPORT',
  ID_CARD: 'ID_CARD',
} as const;

export const SubmissionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const RejectionType = {
  MANUAL: 'MANUAL',
  TX_FAILURE: 'TX_FAILURE',
} as const;

export const AssetType = {
  VEHICLE: 'VEHICLE',
  JEWELRY: 'JEWELRY',
  COLLECTIBLE: 'COLLECTIBLE',
  ART: 'ART',
  FASHION: 'FASHION',
  ALCOHOL: 'ALCOHOL',
  OTHER: 'OTHER',
} as const;

// Type exports for TypeScript
export type UserRoleType = keyof typeof UserRole;
export type VerificationStatusType = keyof typeof VerificationStatus;
export type DocumentTypeType = keyof typeof DocumentType;
export type SubmissionStatusType = keyof typeof SubmissionStatus;
export type RejectionTypeType = keyof typeof RejectionType;
export type AssetTypeType = keyof typeof AssetType;

// Helper to safely get enum values
export const safeEnumValue = <T extends Record<string, string>>(
  enumObj: T | undefined,
  key: keyof T,
  fallback: string,
): string => {
  try {
    return enumObj?.[key] || fallback;
  } catch {
    return fallback;
  }
};
