import type { ApiResponse } from '@aces/utils';

export interface Bid {
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
}

export interface CreateBidRequest {
  listingId: string;
  amount: string;
  message?: string;
}

export interface RespondToBidRequest {
  status: 'ACCEPTED' | 'REJECTED';
  responseMessage?: string;
}

export interface BidsListResponse {
  data: Bid[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

export class BidsApi {
  private static getBaseUrl(): string {
    // Bids API (eligibility, create, listing bids, etc.) lives in this Next.js app.
    // Always use same-origin so requests hit /api/v1/bids/* routes.
    return '';
  }

  private static async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      authToken?: string;
    } = {},
  ): Promise<T> {
    const { method = 'GET', body, headers = {}, authToken } = options;
    const baseUrl = this.getBaseUrl();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'include', // Important for CORS
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If we can't parse the error response, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Check if user is eligible to place bids
   */
  static async checkBiddingEligibility(
    authToken: string,
  ): Promise<ApiResponse<{ isEligible: boolean; message: string }>> {
    try {
      const response = await this.makeRequest('/api/v1/bids/eligibility', {
        method: 'GET',
        authToken,
      });

      return response as ApiResponse<{ isEligible: boolean; message: string }>;
    } catch (error) {
      console.error('Error checking bidding eligibility:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check eligibility',
      };
    }
  }

  /**
   * Create a new bid
   */
  static async createBid(data: CreateBidRequest, authToken: string): Promise<ApiResponse<Bid>> {
    try {
      const response = await this.makeRequest('/api/v1/bids', {
        method: 'POST',
        body: data,
        authToken,
      });

      return response as ApiResponse<Bid>;
    } catch (error) {
      console.error('Error creating bid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bid',
      };
    }
  }

  /**
   * Get bids for a specific listing
   */
  static async getListingBids(
    listingId: string,
    options?: {
      limit?: number;
      cursor?: string;
      includeInactive?: boolean;
    },
  ): Promise<ApiResponse<BidsListResponse>> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.cursor) params.append('cursor', options.cursor);
      if (options?.includeInactive) params.append('includeInactive', 'true');

      const response = await this.makeRequest(`/api/v1/bids/listing/${listingId}?${params}`, {
        method: 'GET',
      });

      return response as ApiResponse<BidsListResponse>;
    } catch (error) {
      console.error('Error getting listing bids:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get listing bids',
      };
    }
  }

  /**
   * Get highest bid for a listing.
   * On failure (500, network, etc.) returns { success: true, data: null } so the UI
   * never breaks; most listings have no bids.
   */
  static async getHighestBid(listingId: string): Promise<ApiResponse<Bid | null>> {
    const url = `${this.getBaseUrl()}/api/v1/bids/listing/${listingId}/highest`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        return { success: true, data: null };
      }
      const body = await response.json();
      return (
        body?.data !== undefined ? body : { success: true, data: body }
      ) as ApiResponse<Bid | null>;
    } catch {
      return { success: true, data: null };
    }
  }

  /**
   * Get user's bids
   */
  static async getUserBids(
    authToken: string,
    options?: {
      status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
      limit?: number;
      cursor?: string;
    },
  ): Promise<ApiResponse<BidsListResponse>> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.cursor) params.append('cursor', options.cursor);

      const response = await this.makeRequest(`/api/v1/bids/my?${params}`, {
        method: 'GET',
        authToken,
      });

      return response as ApiResponse<BidsListResponse>;
    } catch (error) {
      console.error('Error getting user bids:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user bids',
      };
    }
  }

  /**
   * Get bids received on user's listings
   */
  static async getReceivedBids(
    authToken: string,
    options?: {
      status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
      limit?: number;
      cursor?: string;
    },
  ): Promise<ApiResponse<BidsListResponse>> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.cursor) params.append('cursor', options.cursor);

      const response = await this.makeRequest(`/api/v1/bids/received?${params}`, {
        method: 'GET',
        authToken,
      });

      return response as ApiResponse<BidsListResponse>;
    } catch (error) {
      console.error('Error getting received bids:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get received bids',
      };
    }
  }

  /**
   * Respond to a bid (accept/reject)
   */
  static async respondToBid(
    bidId: string,
    data: RespondToBidRequest,
    authToken: string,
  ): Promise<ApiResponse<Bid>> {
    try {
      const response = await this.makeRequest(`/api/v1/bids/${bidId}/respond`, {
        method: 'PUT',
        body: data,
        authToken,
      });

      return response as ApiResponse<Bid>;
    } catch (error) {
      console.error('Error responding to bid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to respond to bid',
      };
    }
  }

  /**
   * Withdraw a bid
   */
  static async withdrawBid(bidId: string, authToken: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.makeRequest(`/api/v1/bids/${bidId}`, {
        method: 'DELETE',
        authToken,
      });

      return response as ApiResponse<void>;
    } catch (error) {
      console.error('Error withdrawing bid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to withdraw bid',
      };
    }
  }
}
