import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates') 
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

export interface SellerData {
  id: string;
  username: string | null;
  email: string | null;
  walletAddress: string | null;
  sellerStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  accountVerification?: {
    id: string;
    status: string;
    submittedAt: string;
    reviewedAt: string | null;
    attempts: number;
    firstName: string | null;
    lastName: string | null;
    documentType: string | null;
  } | null;
  listings: {
    total: number;
    live: number;
    recent: Array<{
      id: string;
      title: string;
      symbol: string;
      isLive: boolean;
      createdAt: string;
    }>;
  };
  bidStats: {
    totalBids: number;
    totalBidValue: number;
  };
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

export class SellersApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}/api/v1${endpoint}`;

    // Only set Content-Type to JSON if there's a body
    const finalHeaders: HeadersInit = {
      ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
    };

    if (options.body) {
      (finalHeaders as Record<string, string>)['Content-Type'] = 'application/json';
    }

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

  static async getAllSellers(authToken: string): Promise<ApiResult<SellerData[]>> {
    return this.request('/admin/sellers', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async getPendingSellers(authToken: string): Promise<ApiResult<SellerData[]>> {
    return this.request('/admin/sellers/pending', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }
}
