// src/lib/prisma-enums.ts - Step 1: User Model Only
// Safe enum definitions that work in serverless environments
// These MUST match your Prisma schema exactly

export const UserRole = {
  TRADER: 'TRADER',
  ADMIN: 'ADMIN',
} as const;

// Type exports for TypeScript
export type UserRoleType = keyof typeof UserRole;

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

// Note: Other enums (SellerStatus, SubmissionStatus, etc.) will be added in later steps
