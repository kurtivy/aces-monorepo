import { CreateSubmissionRequest } from '@aces/utils';

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

export class SubmissionsApi {
  private static baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  static async getUploadUrl(
    fileType: string,
    authToken?: string,
  ): Promise<{
    url: string;
    fileName: string;
    publicUrl: string;
  }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/submissions/get-upload-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileType }),
    });

    if (!response.ok) {
      throw new Error('Failed to get upload URL');
    }

    const result = await response.json();
    return result.data;
  }

  static async uploadImage(file: File, authToken?: string): Promise<string> {
    // Use direct upload through backend to bypass CORS
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const uploadResponse = await fetch(`${this.baseUrl}/api/v1/submissions/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.error || 'Failed to upload image');
    }

    const result = await uploadResponse.json();
    return result.data.publicUrl;
  }

  static async createTestSubmission(data: CreateSubmissionRequest, authToken?: string) {
    // 🔍 ADD DEBUGGING HERE
    console.log('Sending submission data:', JSON.stringify(data, null, 2));
    console.log('ImageGallery URLs:');
    data.imageGallery?.forEach((url, i) => {
      console.log(`URL ${i}:`, url);
      console.log(`Is valid URL?`, /^https?:\/\/.+/.test(url));
      console.log(`URL length:`, url.length);
      console.log(`Has spaces?`, url.includes(' '));
    });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/submissions/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    return response.json();
  }

  static async getUserSubmissions(
    options: { limit?: number; cursor?: string } = {},
    token?: string,
  ): Promise<UserSubmissionsResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.cursor) params.append('cursor', options.cursor);

    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${this.baseUrl}/api/v1/submissions/my${query}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch submissions');
    }

    return response.json();
  }
}
