import type { TokenParameters } from '@aces/utils';

function getAdminApiBaseUrl(): string {
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

const API_BASE_URL = getAdminApiBaseUrl();

export class AdminApi {

  private static async adminRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${API_BASE_URL}/api/v1/admin${endpoint}`;

    console.log('🌐 Making admin request:', {
      url,
      method: options.method || 'GET',
      hasToken: !!token,
      body: options.body,
    });

    // Only set Content-Type to JSON if there's a body
    const headers: HeadersInit = {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
    };

    if (options.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('📥 Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Request failed:', errorData);
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Token management methods
  static async addTokenToDatabase(
    contractAddress: string,
    token: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      contractAddress: string;
      symbol: string;
      name: string;
      currentPrice: string;
      currentPriceACES: string;
    };
  }> {
    return this.adminRequest(
      '/tokens/add',
      {
        method: 'POST',
        body: JSON.stringify({ contractAddress }),
      },
      token,
    );
  }

  static async linkTokenToListing(
    contractAddress: string,
    listingId: string,
    token: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      contractAddress: string;
      listingId: string;
      listingTitle: string;
    };
  }> {
    return this.adminRequest(
      '/tokens/link-listing',
      {
        method: 'POST',
        body: JSON.stringify({ contractAddress, listingId }),
      },
      token,
    );
  }

  static async unlinkTokenFromListing(
    contractAddress: string,
    token: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      contractAddress: string;
    };
  }> {
    return this.adminRequest(
      '/tokens/unlink-listing',
      {
        method: 'DELETE',
        body: JSON.stringify({ contractAddress }),
      },
      token,
    );
  }

  static async getAvailableListings(token: string): Promise<{
    success: boolean;
    count: number;
    data: Array<{
      id: string;
      title: string;
      symbol: string;
      description: string;
      assetType: string;
      isLive: boolean;
      launchDate: string | null;
      createdAt: string;
      owner: {
        walletAddress: string | null;
        email: string | null;
      };
      token: {
        contractAddress: string;
        symbol: string;
        name: string;
      } | null;
    }>;
  }> {
    return this.adminRequest('/listings/available', { method: 'GET' }, token);
  }

  static async getAllTokens(token: string): Promise<{
    success: boolean;
    count: number;
    data: Array<{
      contractAddress: string;
      symbol: string;
      name: string;
      currentPrice: string;
      currentPriceACES: string;
      volume24h: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      listingId: string | null;
      listing: {
        id: string;
        title: string;
        symbol: string;
        isLive: boolean;
      } | null;
    }>;
  }> {
    return this.adminRequest('/tokens', { method: 'GET' }, token);
  }

  static async updateTokenPoolAddress(
    tokenAddress: string,
    poolAddress: string,
    token: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      contractAddress: string;
      poolAddress: string;
    };
  }> {
    console.log('📡 AdminApi.updateTokenPoolAddress called with:', {
      tokenAddress,
      poolAddress,
      endpoint: `/tokens/${tokenAddress}/pool-address`,
    });
    return this.adminRequest(
      `/tokens/${tokenAddress}/pool-address`,
      {
        method: 'PATCH',
        body: JSON.stringify({ poolAddress }),
      },
      token,
    );
  }

  /**
   * Save token parameters for a listing (admin configures before minting)
   */
  static async saveTokenParameters(
    listingId: string,
    tokenParameters: TokenParameters,
    token: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    console.log('📡 AdminApi.saveTokenParameters called with:', {
      listingId,
      tokenParameters,
      endpoint: `/listings/${listingId}/token-parameters`,
    });
    return this.adminRequest(
      `/listings/${listingId}/token-parameters`,
      {
        method: 'PATCH',
        body: JSON.stringify(tokenParameters),
      },
      token,
    );
  }

  /**
   * Force graduate a token to DEX (manually trigger graduation)
   */
  static async forceGraduateToken(
    tokenAddress: string,
    token: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
    tokenStatus?: any;
  }> {
    console.log('📡 AdminApi.forceGraduateToken called with:', {
      tokenAddress,
      endpoint: `/tokens/${tokenAddress}/force-graduate`,
    });
    return this.adminRequest(
      `/tokens/${tokenAddress}/force-graduate`,
      {
        method: 'POST',
      },
      token,
    );
  }

  /**
   * Prepare listing for minting (admin finalizes and notifies user)
   */
  static async prepareForMinting(
    listingId: string,
    token: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    console.log('📡 AdminApi.prepareForMinting called with:', {
      listingId,
      endpoint: `/listings/${listingId}/prepare-mint`,
    });
    return this.adminRequest(
      `/listings/${listingId}/prepare-mint`,
      {
        method: 'POST',
      },
      token,
    );
  }
}
