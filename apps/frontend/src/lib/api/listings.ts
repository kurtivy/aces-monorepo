import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface ListingData {
  id: string;
  title: string;
  symbol: string;
  description: string;
  imageGallery: string[];
  contractAddress?: string;
  location?: string;
  email?: string;
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  rwaSubmissionId: string;
  rwaSubmission?: {
    id: string;
    status: string;
    createdAt: string;
  };
  bids?: Array<{
    id: string;
    amount: string;
    currency: string;
    createdAt: string;
    bidder: {
      id: string;
      displayName: string | null;
      avatar: string | null;
    };
  }>;
  token?: {
    id: string;
    contractAddress: string;
    totalSupply: string;
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

export class ListingsApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}/api/v1/listings${endpoint}`;

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

  static async getMyListings(authToken: string): Promise<ApiResult<ListingData[]>> {
    return this.request('/my-listings', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async getLiveListings(): Promise<ApiResult<ListingData[]>> {
    return this.request('', {
      method: 'GET',
    });
  }

  static async getListingById(listingId: string): Promise<ApiResult<ListingData>> {
    return this.request(`/${listingId}`, {
      method: 'GET',
    });
  }

  static async toggleListingStatus(
    listingId: string,
    isLive: boolean,
    authToken: string,
  ): Promise<ApiResult<ListingData>> {
    return this.request(`/${listingId}/toggle`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ isLive }),
    });
  }
}
