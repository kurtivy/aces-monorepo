import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates') 
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

export interface BidData {
  id: string;
  listingId: string;
  bidderId: string;
  verificationId: string;
  amount: string;
  currency: string;
  expiresAt: string | null;
  createdAt: string;
  bidder?: {
    id: string;
    displayName: string | null;
    walletAddress: string | null;
    email: string | null;
  } | null;
  listing?: {
    id: string;
    title: string;
    symbol: string;
    imageGallery: string[];
    isLive: boolean;
    owner?: {
      id: string;
      displayName: string | null;
    } | null;
  } | null;
  verification?: {
    id: string;
    status: string;
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

export class BidsApi {
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

  static async getAllBids(authToken: string): Promise<ApiResult<BidData[]>> {
    return this.request('/admin/bids', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async getUserBids(authToken: string): Promise<BidData[]> {
    const result = await this.request<BidData[]>('/bids/my', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error || 'Failed to fetch user bids');
    }
  }
}
