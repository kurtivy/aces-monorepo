import type { ApiResponse } from '@aces/utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' &&
  (window.location.hostname.includes('feat-ui-updates') ||
    window.location.hostname.includes('feat-rwa-page-upgrade'))
    ? 'https://aces-monorepo-backend-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

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
  owner?: {
    id: string;
    displayName: string | null;
    avatar: string | null;
    walletAddress: string | null;
    accountVerification?: {
      firstName: string | null;
      lastName: string | null;
      status: string;
    } | null;
  };
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
    // For admin endpoints, use the admin base path
    const isAdminEndpoint = endpoint.startsWith('/admin/');
    const basePath = isAdminEndpoint ? '/api/v1' : '/api/v1/listings';
    const url = `${API_BASE_URL}${basePath}${endpoint}`;

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
    return this.request('/live', {
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

  static async getAllListingsForAdmin(authToken: string): Promise<ApiResult<ListingData[]>> {
    return this.request('/admin/listings', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }
}
