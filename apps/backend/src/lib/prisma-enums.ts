// src/lib/prisma-enums.ts
// Safe enum definitions that work in serverless environments

export const SellerStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export const SubmissionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DRAFT: 'DRAFT',
} as const;

// Type exports for TypeScript
export type SellerStatusType = keyof typeof SellerStatus;
export type UserRoleType = keyof typeof UserRole;
export type SubmissionStatusType = keyof typeof SubmissionStatus;

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
