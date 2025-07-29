import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface BidData {
  id: string;
  amount: string;
  currency: string;
  createdAt: string;
  expiresAt?: string;
  listing: {
    id: string;
    title: string;
    symbol: string;
    imageGallery: string[];
    isLive: boolean;
    owner: {
      id: string;
      displayName: string | null;
    };
  };
  verification: {
    id: string;
    status: string;
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

export class BidsApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}/api/v1/bids${endpoint}`;

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

  static async getUserBids(authToken: string): Promise<ApiResult<BidData[]>> {
    return this.request('/my', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async createBid(
    listingId: string,
    amount: string,
    currency: 'ETH' | 'ACES',
    authToken: string,
    expiresAt?: string,
  ): Promise<ApiResult<BidData>> {
    return this.request('/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        listingId,
        amount,
        currency,
        expiresAt,
      }),
    });
  }

  static async deleteBid(bidId: string, authToken: string): Promise<ApiResult<void>> {
    return this.request(`/${bidId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async getBidById(bidId: string, authToken: string): Promise<ApiResult<BidData>> {
    return this.request(`/${bidId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }
}
