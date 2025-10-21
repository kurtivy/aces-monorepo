import { CreateSubmissionRequest, ApiResponse } from '@aces/utils';

export interface UserSubmission {
  id: string;
  title: string;
  symbol: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LIVE';
  rejectionReason?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  imageGallery: string[];
  rwaListing?: {
    id: string;
    isLive: boolean;
  } | null;
}

export interface UserSubmissionsResponse {
  success: boolean;
  data: UserSubmission[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface UploadUrlResponse {
  url: string;
  fileName: string;
  publicUrl: string;
}

export interface UploadImageResponse {
  imageUrl: string;
  fileName: string;
}

export class SubmissionsApi {
  private static getBaseUrl(): string {
    // Use environment variable if available
    if (process.env.NEXT_PUBLIC_API_URL) {
      console.log('Using NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
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
      console.log('Full URL:', href);
      console.log('Hostname:', hostname);

      // Check for dev/git-dev branch
      if (href.includes('git-dev') || hostname.includes('git-dev')) {
        const backendUrl = 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
        console.log('MATCHED dev, using backend:', backendUrl);
        return backendUrl;
      }

      console.log('No dev match found for hostname:', hostname);
    }

    // Production fallback (main branch and aces.fun)
    const fallbackUrl = 'https://acesbackend-production.up.railway.app';
    console.log('Using production backend URL:', fallbackUrl);
    return fallbackUrl;
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
      if (body instanceof FormData) {
        // Remove Content-Type header for FormData to let browser set it with boundary
        delete requestHeaders['Content-Type'];
        requestOptions.body = body;
      } else {
        requestOptions.body = JSON.stringify(body);
      }
    }

    const url = `${baseUrl}${endpoint}`;
    console.log(`Making ${method} request to:`, url);

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        let errorDetails: unknown = undefined;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (errorData.details) {
            errorDetails = errorData.details;
          }
        } catch {
          // If we can't parse the error response, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        const err: any = new Error(errorMessage);
        if (errorDetails) err.details = errorDetails;
        throw err;
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  static async getUploadUrl(fileType: string, authToken?: string): Promise<UploadUrlResponse> {
    const result = await this.makeRequest<ApiResponse<UploadUrlResponse>>(
      '/api/v1/submissions/get-upload-url',
      {
        method: 'POST',
        body: { fileType },
        authToken,
      },
    );

    return result.data!;
  }

  static async uploadImage(
    file: File,
    authToken?: string,
    type: 'asset' | 'ownership' = 'asset',
  ): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    // The backend returns { success, imageUrl, fileName } directly, not wrapped in ApiResponse
    const result = await this.makeRequest<{ success: boolean; imageUrl: string; fileName: string }>(
      `/api/v1/submissions/upload-image?type=${type}`,
      {
        method: 'POST',
        body: formData,
        authToken,
      },
    );

    if (!result.success || !result.imageUrl) {
      throw new Error('Failed to upload image - no URL returned');
    }

    return result.imageUrl;
  }

  static async createTestSubmission(
    data: CreateSubmissionRequest,
    authToken?: string,
  ): Promise<ApiResponse<any>> {
    // Debug logging
    console.log('Sending submission data:', JSON.stringify(data, null, 2));
    console.log('🔑 Auth token present?', !!authToken);
    console.log('🔑 Auth token length:', authToken?.length);
    console.log('🔑 Auth token preview:', authToken?.substring(0, 20) + '...');
    console.log('ImageGallery URLs:');
    data.imageGallery?.forEach((url, i) => {
      console.log(`URL ${i}:`, url);
      console.log(`Is valid URL?`, /^https?:\/\/.+/.test(url));
      console.log(`URL length:`, url.length);
      console.log(`Has spaces?`, url.includes(' '));
    });

    return await this.makeRequest<ApiResponse<any>>('/api/v1/submissions', {
      method: 'POST',
      body: data,
      authToken,
    });
  }

  static async getUserSubmissions(
    options: { limit?: number; cursor?: string } = {},
    token?: string,
  ): Promise<UserSubmissionsResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.cursor) params.append('cursor', options.cursor);

    const query = params.toString() ? `?${params.toString()}` : '';

    return await this.makeRequest<UserSubmissionsResponse>(`/api/v1/submissions/my${query}`, {
      method: 'GET',
      authToken: token,
    });
  }

  // Additional utility methods you might need

  static async getSubmissionById(id: string, authToken?: string): Promise<ApiResponse<any>> {
    return await this.makeRequest<ApiResponse<any>>(`/api/v1/submissions/${id}`, {
      method: 'GET',
      authToken,
    });
  }

  static async updateSubmission(
    id: string,
    data: Partial<CreateSubmissionRequest>,
    authToken?: string,
  ): Promise<ApiResponse<any>> {
    return await this.makeRequest<ApiResponse<any>>(`/api/v1/submissions/${id}`, {
      method: 'PUT',
      body: data,
      authToken,
    });
  }

  static async deleteSubmission(id: string, authToken?: string): Promise<ApiResponse<any>> {
    return await this.makeRequest<ApiResponse<any>>(`/api/v1/submissions/${id}`, {
      method: 'DELETE',
      authToken,
    });
  }
}
