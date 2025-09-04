import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates') 
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

export interface UserProfile {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  createdAt: string;
  updatedAt: string;
  email: string | null;
  role: 'TRADER' | 'SELLER' | 'ADMIN';
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  website: string | null;
  twitterHandle: string | null;
  sellerStatus: 'NOT_APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notifications: boolean;
  newsletter: boolean;
  darkMode: boolean;
}

export interface ProfileUpdateRequest {
  displayName?: string | null;
  bio?: string | null;
  website?: string | null;
  twitterHandle?: string | null;
  notifications?: boolean;
  newsletter?: boolean;
  darkMode?: boolean;
}

export interface UserVerificationRequest {
  privyDid: string;
  walletAddress?: string;
  email?: string;
  displayName?: string;
}

export interface UserVerificationResponse {
  profile: UserProfile;
  created: boolean;
}

export interface UserTransaction {
  id: string;
  type: 'BID' | 'PURCHASE' | 'SALE';
  amount: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  timestamp: string;
  assetId: string;
  assetName: string;
  assetSymbol: string;
}

export interface UserAsset {
  id: string;
  name: string;
  symbol: string;
  imageUrl: string;
  quantity: string;
  value: string;
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

export interface TokenData {
  id: string;
  title: string;
  ticker: string;
  image: string;
  contractAddress: string;
  category: string;
  amount: number;
  totalInEth: number;
  totalInAces: number;
  totalInUSD: number;
}

// Backend token data structure
export interface BackendTokenData {
  id: string;
  contractAddress: string;
  title: string;
  ticker: string;
  image: string;
  value: string;
  category: string;
}

export class ProfileApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}/api/v1/users${endpoint}`;

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

  static async getCurrentProfile(authToken: string): Promise<ApiResult<UserProfile>> {
    return this.request('/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async updateProfile(
    updates: ProfileUpdateRequest,
    authToken: string,
    walletAddress?: string,
  ): Promise<ApiResult<UserProfile>> {
    return this.request('/me', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'x-wallet-address': walletAddress || '',
      },
      body: JSON.stringify(updates),
    });
  }

  static async getPublicProfile(userId: string): Promise<ApiResult<UserProfile>> {
    return this.request(`/${userId}`);
  }

  static async searchUsers(query: string, limit: number = 10): Promise<ApiResult<UserProfile[]>> {
    return this.request(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  static async getUserTransactions(
    userId: string,
    authToken: string,
  ): Promise<ApiResult<{ transactions: UserTransaction[]; totalCount: number }>> {
    return this.request(`/${userId}/transactions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async getUserAssets(
    userId: string,
    authToken: string,
  ): Promise<ApiResult<{ assets: UserAsset[]; totalValue: number }>> {
    return this.request(`/${userId}/assets`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  static async getUserTokens(authToken: string): Promise<ApiResult<BackendTokenData[]>> {
    return this.request('/me/tokens', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }

  /**
   * Verify or create user from Privy authentication
   * This is called after successful Privy authentication to ensure user exists in database
   */
  static async verifyOrCreateUser(
    userInfo: UserVerificationRequest,
    authToken: string,
  ): Promise<ApiResult<UserVerificationResponse>> {
    return this.request('/verify-or-create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(userInfo),
    });
  }
}
