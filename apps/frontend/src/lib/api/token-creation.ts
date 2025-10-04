'use client';

// Token Creation API Service
export interface UserProvidedDetails {
  additionalImages?: string[];
  technicalSpecifications?: string;
  additionalDescription?: string;
  proofDocuments?: string[];
  [key: string]: any;
}

export interface TokenParameters {
  steepness: string;
  floor: string;
  tokensBondedAt: string;
  curve: number;
  salt?: string;
  useVanityMining?: boolean;
  vanityTarget?: string;
  [key: string]: any;
}

export interface MintParameters {
  contractAddress: string;
  steepness: string;
  floor: string;
  tokensBondedAt: string;
  curve: number;
  salt: string;
  name: string;
  symbol: string;
}

export enum TokenCreationStatus {
  AWAITING_USER_DETAILS = 'AWAITING_USER_DETAILS',
  PENDING_ADMIN_REVIEW = 'PENDING_ADMIN_REVIEW',
  READY_TO_MINT = 'READY_TO_MINT',
  MINTED = 'MINTED',
  FAILED = 'FAILED',
}

export interface ListingWithTokenStatus {
  id: string;
  title: string;
  symbol: string;
  description: string;
  assetType: string;
  imageGallery: string[];
  tokenCreationStatus: string | null;
  userProvidedDetails: any;
  tokenParameters: any;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    email: string | null;
    walletAddress: string | null;
  };
  submission?: {
    id: string;
    assetType: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class TokenCreationApi {
  private static baseUrl = '/api/v1/token-creation';

  /**
   * Submit additional details for token creation (user)
   */
  static async submitUserDetails(
    listingId: string,
    details: UserProvidedDetails,
    token: string,
  ): Promise<ApiResponse<ListingWithTokenStatus>> {
    try {
      const response = await fetch(`${this.baseUrl}/listings/${listingId}/submit-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(details),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit details',
      };
    }
  }

  /**
   * Get mint parameters for a listing (user)
   */
  static async getMintParameters(
    listingId: string,
    token: string,
  ): Promise<ApiResponse<MintParameters>> {
    try {
      const response = await fetch(`${this.baseUrl}/listings/${listingId}/mint-parameters`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get mint parameters',
      };
    }
  }

  /**
   * Confirm token mint (user)
   */
  static async confirmTokenMint(
    listingId: string,
    txHash: string,
    tokenAddress: string,
    token: string,
  ): Promise<ApiResponse<ListingWithTokenStatus>> {
    try {
      const response = await fetch(`${this.baseUrl}/listings/${listingId}/confirm-mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ txHash, tokenAddress }),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm mint',
      };
    }
  }

  /**
   * Get user's token creation status (user)
   */
  static async getUserTokenCreationStatus(
    token: string,
  ): Promise<ApiResponse<ListingWithTokenStatus[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/my-status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      };
    }
  }

  // ========== ADMIN METHODS ==========

  /**
   * Get listings pending admin review (admin)
   */
  static async getListingsPendingReview(
    token: string,
  ): Promise<ApiResponse<ListingWithTokenStatus[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/pending-review`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending listings',
      };
    }
  }

  /**
   * Approve token parameters (admin)
   */
  static async approveTokenParameters(
    listingId: string,
    parameters: TokenParameters,
    token: string,
  ): Promise<ApiResponse<ListingWithTokenStatus>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/admin/listings/${listingId}/approve-parameters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(parameters),
        },
      );

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve parameters',
      };
    }
  }

  /**
   * Get all token creation statuses (admin)
   */
  static async getAllTokenCreationStatuses(
    token: string,
  ): Promise<ApiResponse<ListingWithTokenStatus[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/all-statuses`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all statuses',
      };
    }
  }
}
