import type { RwaSubmissionWithRelations } from '@aces/utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates')
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

export interface VerificationApplication {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  firstName?: string;
  lastName?: string;
  fullName?: string; // For backward compatibility
  dateOfBirth: string;
  countryOfIssue: string;
  state?: string;
  address: string;
  emailAddress: string;
  twitter?: string;
  website?: string;
  documentImageUrl?: string;
  selfieImageUrl?: string;
  facialVerificationStatus?: string;
  facialAnalysisResults?: unknown;
  faceComparisonScore?: number;
  overallVerificationScore?: number;
  visionApiRecommendation?: string;
  facialVerificationAt?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  attempts: number;
  lastAttemptAt?: string;
  user: {
    id: string;
    username?: string;
    email?: string;
    walletAddress?: string;
    createdAt: string;
    sellerStatus?: string;
    verificationAttempts?: number;
    lastVerificationAttempt?: string;
  };
}

export interface SubmissionsResponse {
  success: boolean;
  data: RwaSubmissionWithRelations[];
  nextCursor?: string;
  hasMore: boolean;
}

export class AdminApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${API_BASE_URL}/api/v1/account-verification/admin${endpoint}`;

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  private static async adminRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${API_BASE_URL}/api/v1/admin${endpoint}`;

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Verification-related methods
  static async getPendingVerifications(token: string): Promise<VerificationApplication[]> {
    const response = await this.adminRequest<{ data?: VerificationApplication[] }>(
      '/verifications/pending',
      {
        method: 'GET',
      },
      token,
    );

    return response.data || (response as VerificationApplication[]);
  }

  static async processVerification(
    verificationId: string,
    approve: boolean,
    rejectionReason?: string,
    token?: string,
  ): Promise<{ success: boolean }> {
    return this.adminRequest(
      `/verifications/${verificationId}/review`,
      {
        method: 'POST',
        body: JSON.stringify({
          approved: approve,
          rejectionReason,
        }),
      },
      token,
    );
  }

  static async getVerificationDetails(
    verificationId: string,
    token: string,
  ): Promise<VerificationApplication> {
    return this.adminRequest(
      `/verifications/${verificationId}`,
      {
        method: 'GET',
      },
      token,
    );
  }

  static async getUserVerificationDetails(
    userId: string,
    token: string,
  ): Promise<{ success: boolean; data: VerificationApplication | null; message?: string }> {
    return this.adminRequest(
      `/users/${userId}/verification`,
      {
        method: 'GET',
      },
      token,
    );
  }

  // Submission management methods
  static async getSubmissions(
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LIVE',
    options: { limit?: number; cursor?: string } = {},
    token?: string,
  ): Promise<SubmissionsResponse> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.cursor) params.append('cursor', options.cursor);

    const query = params.toString() ? `?${params.toString()}` : '';

    return this.adminRequest<SubmissionsResponse>(
      `/submissions/all${query}`,
      {
        method: 'GET',
      },
      token,
    );
  }

  static async getSubmissionDetails(
    submissionId: string,
    token?: string,
  ): Promise<{ success: boolean; data: RwaSubmissionWithRelations }> {
    return this.adminRequest(
      `/submissions/${submissionId}`,
      {
        method: 'GET',
      },
      token,
    );
  }

  static async approveSubmission(
    submissionId: string,
    token?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.adminRequest(
      `/approve/${submissionId}`,
      {
        method: 'POST',
      },
      token,
    );
  }

  static async rejectSubmission(
    submissionId: string,
    rejectionReason: string,
    token?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.adminRequest(
      `/reject/${submissionId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          rejectionReason,
        }),
      },
      token,
    );
  }

  static async getSubmissionImages(
    submissionId: string,
    token?: string,
  ): Promise<{
    success: boolean;
    data: {
      submissionId: string;
      images: Array<{
        originalUrl: string;
        signedUrl: string;
        expiresIn: number;
        error?: string;
      }>;
    };
  }> {
    return this.adminRequest(
      `/submissions/${submissionId}/images`,
      {
        method: 'GET',
      },
      token,
    );
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
}
