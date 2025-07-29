import type { RwaSubmissionWithRelations } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface VerificationApplication {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  dateOfBirth: string;
  countryOfIssue: string;
  state?: string;
  address: string;
  emailAddress: string;
  documentImageUrl?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  attempts: number;
  lastAttemptAt?: string;
  user: {
    id: string;
    displayName?: string;
    email?: string;
    walletAddress?: string;
    createdAt: string;
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

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
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

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
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
}
