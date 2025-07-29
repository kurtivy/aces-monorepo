import type { ApiResponse } from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface VerificationSubmissionData {
  documentType: string;
  documentNumber: string;
  firstName: string; // Changed from fullName to firstName
  lastName: string; // New field
  dateOfBirth: string;
  countryOfIssue: string;
  state?: string;
  address: string;
  emailAddress: string;
  twitter?: string; // New optional field
  website?: string; // New optional field
  documentImage?: File; // Now optional
}

export interface VerificationStatus {
  sellerStatus: 'NOT_APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  verificationAttempts: number;
  lastVerificationAttempt?: string;
  verificationDetails?: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
    submittedAt: string;
    reviewedAt?: string;
  };
  canReapply: boolean;
  attemptsRemaining: number;
  rejectionReason?: string;
}

export interface VerificationResult {
  id: string;
  status: string;
  submittedAt: string;
  userId: string;
}

// Backend response type for status endpoint
export interface BackendVerificationStatus {
  sellerStatus: 'NOT_APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  verificationAttempts: number;
  lastVerificationAttempt?: string;
  verificationDetails?: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
    submittedAt: string;
    reviewedAt?: string;
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

export class VerificationApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}/api/v1/account-verification${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
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

  /**
   * Submit verification with optional documents
   */
  static async submitVerification(
    data: VerificationSubmissionData,
    authToken: string,
  ): Promise<ApiResult<VerificationResult>> {
    const formData = new FormData();

    // Add all text fields
    formData.append('documentType', data.documentType);
    formData.append('documentNumber', data.documentNumber);
    // Combine firstName and lastName for the fullName field that backend expects
    formData.append('fullName', `${data.firstName} ${data.lastName}`.trim());
    formData.append('dateOfBirth', data.dateOfBirth);
    formData.append('countryOfIssue', data.countryOfIssue);
    if (data.state) formData.append('state', data.state);
    formData.append('address', data.address);
    formData.append('emailAddress', data.emailAddress);
    if (data.twitter) formData.append('twitter', data.twitter);
    if (data.website) formData.append('website', data.website);

    // Add file only if provided
    if (data.documentImage) {
      formData.append('documentFile', data.documentImage);
    }

    return this.request('/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });
  }

  /**
   * Get verification status
   */
  static async getVerificationStatus(authToken: string): Promise<ApiResult<VerificationStatus>> {
    const result = await this.request<BackendVerificationStatus>('/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!result.success) {
      return result;
    }

    // Transform the backend response to match our frontend interface
    const backendData = result.data;
    const transformedData: VerificationStatus = {
      sellerStatus: backendData.sellerStatus,
      verificationAttempts: backendData.verificationAttempts,
      lastVerificationAttempt: backendData.lastVerificationAttempt,
      verificationDetails: backendData.verificationDetails
        ? {
            id: backendData.verificationDetails.id,
            status: backendData.verificationDetails.status,
            rejectionReason: backendData.verificationDetails.rejectionReason,
            submittedAt: backendData.verificationDetails.submittedAt,
            reviewedAt: backendData.verificationDetails.reviewedAt,
          }
        : undefined,
      canReapply: backendData.sellerStatus !== 'PENDING' && backendData.verificationAttempts < 3,
      attemptsRemaining: Math.max(0, 3 - backendData.verificationAttempts),
      rejectionReason: backendData.verificationDetails?.rejectionReason,
    };

    return {
      success: true,
      data: transformedData,
    };
  }

  /**
   * Check if user can submit verification
   */
  static async canSubmitVerification(authToken: string): Promise<{
    canSubmit: boolean;
    reason?: string;
    attemptsRemaining?: number;
  }> {
    const result = await this.getVerificationStatus(authToken);

    if (!result.success) {
      return { canSubmit: false, reason: result.error };
    }

    const status = result.data;

    if (status.sellerStatus === 'APPROVED') {
      return { canSubmit: false, reason: 'Already verified' };
    }

    if (status.sellerStatus === 'PENDING') {
      return { canSubmit: false, reason: 'Verification pending approval' };
    }

    if (!status.canReapply) {
      return {
        canSubmit: false,
        reason: 'Maximum attempts reached for today',
        attemptsRemaining: status.attemptsRemaining,
      };
    }

    return {
      canSubmit: true,
      attemptsRemaining: status.attemptsRemaining,
    };
  }

  /**
   * Delete verification document
   */
  static async deleteVerificationDocument(
    authToken: string,
  ): Promise<ApiResult<{ message: string }>> {
    return this.request('/document', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  }
}

// Helper function to convert File to base64 for preview
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Helper function to validate file type and size
export const validateDocumentFile = (file: File): { valid: boolean; error?: string } => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const maxSizeInMB = 5;
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'File type not supported. Please upload a JPEG, PNG, or PDF file.',
    };
  }

  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      error: `File size too large. Please upload a file smaller than ${maxSizeInMB}MB.`,
    };
  }

  return { valid: true };
};
