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

export interface AdminStats {
  pendingVerifications: number;
  totalVerifications: number;
  approvedToday: number;
  rejectedToday: number;
}

export class AdminApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${API_BASE_URL}/api/v1/seller-verification/admin${endpoint}`;

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

  static async getPendingVerifications(token: string): Promise<VerificationApplication[]> {
    const response = await this.request<{ data?: VerificationApplication[] }>(
      '/pending',
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
    return this.request(
      `/process/${verificationId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          approve,
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
    return this.request(
      `/${verificationId}`,
      {
        method: 'GET',
      },
      token,
    );
  }
}
