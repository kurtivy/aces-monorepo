// src/lib/prisma-enums.ts
// Safe enum definitions that work in serverless environments
// These MUST match your Prisma schema exactly

export const UserRole = {
  TRADER: 'TRADER', // ← Changed from 'USER'
  SELLER: 'SELLER',
  ADMIN: 'ADMIN',
} as const;

export const SellerStatus = {
  NOT_APPLIED: 'NOT_APPLIED', // ← Added this one
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const SubmissionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const VerificationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
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
export type SellerStatusType = keyof typeof SellerStatus;
export type SubmissionStatusType = keyof typeof SubmissionStatus;
export type VerificationStatusType = keyof typeof VerificationStatus;
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
