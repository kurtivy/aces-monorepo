import type { ApiResponse } from '@aces/utils';

function getBaseUrl(): string {
  // Use environment variable if available
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // For localhost development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3002';
  }

  // Dynamic URL based on current deployment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const href = window.location.href;

    // Check for dev/git-dev branch
    if (href.includes('git-dev') || hostname.includes('git-dev')) {
      return 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
    }
  }

  // Production fallback (main branch and aces.fun)
  return 'https://aces-monorepo-backend.vercel.app';
}

const API_BASE_URL = getBaseUrl();

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
    username: string | null;
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
      username: string | null;
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
