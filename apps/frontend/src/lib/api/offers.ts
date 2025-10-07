import type { ApiResponse } from '@aces/utils';

function getOffersApiBaseUrl(): string {
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

const API_BASE_URL = getOffersApiBaseUrl();

export interface OfferData {
  id: string;
  itemName: string;
  ticker: string;
  image: string;
  offerAmount: string;
  fromAddress: string;
  fromDisplayName?: string;
  expiration: string;
  status: 'active' | 'expired' | 'accepted' | 'declined';
  createdAt: string;
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

export class OffersApi {
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

  // Get offers for listings owned by the user
  static async getOffersForMyListings(authToken: string): Promise<
    ApiResult<
      {
        id: string;
        amount: string;
        message?: string;
        listingId: string;
        bidderId: string;
        status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
        expiresAt: string;
        respondedAt?: string;
        responseMessage?: string;
        createdAt: string;
        updatedAt: string;
        bidder: {
          id: string;
          username?: string;
          walletAddress?: string;
          email?: string;
        };
        listing: {
          id: string;
          title: string;
          symbol: string;
          ownerId: string;
          isLive: boolean;
          startingBidPrice?: string;
          reservePrice?: string;
          imageGallery?: string[];
        };
      }[]
    >
  > {
    return this.request('/received', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  // Accept an offer (bid)
  static async acceptOffer(offerId: string, authToken: string): Promise<ApiResult<void>> {
    return this.request(`/${offerId}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  // Decline an offer (bid)
  static async declineOffer(offerId: string, authToken: string): Promise<ApiResult<void>> {
    return this.request(`/${offerId}/decline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  // Counter an offer (create a new bid in response)
  static async counterOffer(
    offerId: string,
    counterAmount: string,
    currency: 'ETH' | 'ACES',
    authToken: string,
  ): Promise<ApiResult<void>> {
    return this.request(`/${offerId}/counter`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        amount: counterAmount,
        currency,
      }),
    });
  }
}
