import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates') 
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

export interface VerificationData {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  countryOfIssue: string;
  state?: string;
  address: string;
  emailAddress: string;
  twitter?: string;
  website?: string;
  documentImageUrl?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  attempts: number;
  lastAttemptAt?: string;
  user?: {
    id: string;
    username: string | null;
    email: string | null;
    createdAt: string;
  } | null;
  reviewer?: {
    id: string;
    username: string | null;
    email: string | null;
  } | null;
}

export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  error: string;
}

export type ApiResult<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class VerificationsApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}/api/v1${endpoint}`;

    const finalHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: finalHeaders,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `Request failed with status ${response.status}`,
        };
      }

      return data as ApiSuccessResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  static async getAllVerifications(authToken: string): Promise<ApiResult<VerificationData[]>> {
    return this.request('/admin/verifications', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async getPendingVerifications(authToken: string): Promise<ApiResult<VerificationData[]>> {
    return this.request('/admin/verifications/pending', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async reviewVerification(
    verificationId: string,
    approved: boolean,
    rejectionReason: string | undefined,
    authToken: string,
  ): Promise<ApiResult<VerificationData>> {
    return this.request(`/admin/verifications/${verificationId}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        approved,
        rejectionReason,
      }),
    });
  }
}
