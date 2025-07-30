import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

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
  static getUserBids(_token: string) {
    throw new Error('Method not implemented.');
  }
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

  static async getAllBids(authToken: string): Promise<ApiResult<BidData[]>> {
    return this.request('/admin/bids', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }
}
