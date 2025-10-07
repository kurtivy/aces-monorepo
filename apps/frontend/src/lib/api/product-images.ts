import { ApiResponse } from '@aces/utils';

export interface ProductImageUploadResponse {
  imageUrl: string;
  fileName: string;
}

export interface ProductImageDeleteResponse {
  message: string;
}

export class ProductImagesApi {
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
    const fallbackUrl = 'https://aces-monorepo-backend.vercel.app';
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
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If we can't parse the error response, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Upload a product image to Google Cloud Storage
   */
  static async uploadImage(
    file: File,
    authToken: string,
  ): Promise<ApiResponse<ProductImageUploadResponse>> {
    try {
      // Validate file size (2MB limit)
      const MAX_SIZE = 2 * 1024 * 1024; // 2MB
      if (file.size > MAX_SIZE) {
        return {
          success: false,
          error: 'File size exceeds 2MB limit',
        };
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return {
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
        };
      }

      const formData = new FormData();
      formData.append('file', file);

      const result = await this.makeRequest<{
        success: boolean;
        imageUrl: string;
        fileName: string;
      }>('/api/v1/product-images/upload', {
        method: 'POST',
        body: formData,
        authToken,
      });

      return {
        success: true,
        data: {
          imageUrl: result.imageUrl,
          fileName: result.fileName,
        },
      };
    } catch (error) {
      console.error('Product image upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Delete a product image from Google Cloud Storage
   */
  static async deleteImage(
    fileName: string,
    authToken: string,
  ): Promise<ApiResponse<ProductImageDeleteResponse>> {
    try {
      const response = await fetch(`/api/v1/product-images/${fileName}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: {
          message: data.message,
        },
      };
    } catch (error) {
      console.error('Product image delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Extract filename from a Google Cloud Storage URL
   */
  static extractFileName(imageUrl: string): string | null {
    try {
      // Handle aces-product-images bucket URLs
      const productBucketMatch = imageUrl.match(/aces-product-images\/([^?]+)/);
      if (productBucketMatch) {
        return productBucketMatch[1];
      }

      return null;
    } catch (error) {
      console.error('Error extracting filename:', error);
      return null;
    }
  }
}
