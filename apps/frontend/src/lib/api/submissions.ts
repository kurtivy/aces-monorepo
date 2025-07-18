import type {
  // RwaSubmission,
  RwaSubmissionWithOwner,
  CreateSubmissionRequest,
  ApiResponse,
} from '@aces/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export class SubmissionsApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}/api/v1/submissions${endpoint}`;

    const finalHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers: finalHeaders,
    });

    const data = await response.json();
    return data as ApiResponse<T>;
  }

  static async createSubmission(
    data: CreateSubmissionRequest,
    authToken: string,
  ): Promise<ApiResponse<RwaSubmissionWithOwner>> {
    return this.request('/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });
  }

  // Test endpoint that doesn't require authentication
  static async createTestSubmission(
    data: CreateSubmissionRequest,
  ): Promise<ApiResponse<RwaSubmissionWithOwner>> {
    return this.request('/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getSubmissions(): Promise<ApiResponse<RwaSubmissionWithOwner[]>> {
    return this.request('');
  }

  static async getSubmission(id: string): Promise<ApiResponse<RwaSubmissionWithOwner>> {
    return this.request(`/${id}`);
  }
}
