import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates') 
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

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
        currency: string;
        createdAt: string;
        expiresAt?: string;
        listing: {
          title: string;
          symbol: string;
          imageGallery?: string[];
        };
        bidder: {
          id: string;
          displayName?: string;
          walletAddress?: string;
        };
      }[]
    >
  > {
    return this.request('/my-listings-offers', {
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
