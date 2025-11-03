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
  return 'https://acesbackend-production.up.railway.app';
}

const API_BASE_URL = getBaseUrl();

export interface ListingData {
  id: string;
  title: string;
  symbol: string;
  description: string;
  // New schema fields (optional while backend transitions)
  brand?: string | null;
  story?: string | null;
  details?: string | null;
  provenance?: string | null;
  hypeSentence?: string | null;
  value?: string | null;
  reservePrice?: string | null;
  startingBidPrice?: string | null;
  assetDetails?: Record<string, string> | null;
  imageGallery: string[];
  contractAddress?: string;
  location?: string;
  email?: string;
  isLive: boolean;
  tokenCreationStatus?: string | null;
  tokenParameters?: Record<string, any> | null;
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
    options: { method?: string; headers?: Record<string, string>; body?: string | null } = {},
  ): Promise<ApiResult<T>> {
    // For all listings-related endpoints (including admin), keep the listings base path
    const basePath = '/api/v1/listings';
    const url = `${API_BASE_URL}${basePath}${endpoint}`;

    // Only set Content-Type if there's a body (avoid Fastify error for empty body with Content-Type)
    const hasBody = options.body !== undefined && options.body !== null && options.body !== '';

    // Build headers object - only use plain Record<string, string>
    const headersObj: Record<string, string> = { ...options.headers };

    // Only add Content-Type if there's actually a body
    if (hasBody && !headersObj['Content-Type']) {
      headersObj['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        body: options.body || undefined,
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

  static async getListingBySymbol(symbol: string): Promise<ApiResult<ListingData>> {
    return this.request(`/symbol/${encodeURIComponent(symbol)}`, {
      method: 'GET',
    });
  }

  static async updateMyListing(
    listingId: string,
    data: Partial<{
      title: string;
      symbol: string;
      brand: string;
      story: string;
      details: string;
      provenance: string;
      value: string;
      reservePrice: string;
      hypeSentence: string;
      assetType: string;
      imageGallery: string[];
      location: string;
      assetDetails: Record<string, string>;
      startingBidPrice: string;
    }>,
    authToken: string,
  ): Promise<ApiResult<ListingData>> {
    return this.request(`/${listingId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
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
    return this.request('/admin/all', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async createListingFromSubmission(
    submissionId: string,
    authToken: string,
  ): Promise<ApiResult<ListingData>> {
    return this.request('/admin/create-from-submission', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ submissionId }),
    });
  }

  /**
   * Update listing details - Admin updates listing information
   */
  static async updateListing(
    listingId: string,
    updates: Partial<ListingData>,
    authToken: string,
  ): Promise<ApiResult<ListingData>> {
    return this.request(`/admin/${listingId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updates),
    });
  }

  /**
   * Finalize user details - User confirms listing ready for admin review
   */
  static async finalizeUserDetails(
    listingId: string,
    authToken: string,
  ): Promise<ApiResult<ListingData>> {
    return this.request(`/${listingId}/finalize-user-details`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      // No body needed - request method will handle Content-Type correctly
    });
  }

  /**
   * Complete minting - User has minted the token
   */
  static async mintToken(
    listingId: string,
    contractAddress: string,
    authToken: string,
  ): Promise<ApiResult<{ listing: ListingData; token: any }>> {
    return this.request(`/${listingId}/mint-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ contractAddress }),
    });
  }
}
