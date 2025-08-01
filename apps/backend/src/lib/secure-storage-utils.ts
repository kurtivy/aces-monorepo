import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { MultipartFile } from '@fastify/multipart';

// Check if Google Cloud credentials are available
const hasGoogleCloudCredentials = !!(
  process.env.GOOGLE_CLOUD_PROJECT_ID &&
  process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL &&
  process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY
);

// Initialize secure storage with different credentials (only if credentials available)
let secureStorage: Storage | null = null;
let secureBucket: ReturnType<Storage['bucket']> | null = null;
let secureBucketName = '';

if (hasGoogleCloudCredentials) {
  secureStorage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  });

  secureBucketName = process.env.GOOGLE_CLOUD_SECURE_BUCKET_NAME || 'aces-secure-documents';
  secureBucket = secureStorage.bucket(secureBucketName);
} else {
  console.warn(
    'Google Cloud Storage credentials not configured. Document upload will be disabled for testing.',
  );
}

export class SecureStorageService {
  /**
   * Get the secure bucket instance for direct operations
   */
  static getSecureBucket() {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      throw new Error('Google Cloud Storage not configured');
    }
    return secureBucket;
  }

  /**
   * Upload a verification document to secure storage
   */
  static async uploadSecureDocument(
    file: MultipartFile & { buffer?: Buffer },
    userId: string,
    documentType: string,
  ): Promise<string> {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.error('Google Cloud Storage not configured:', {
        hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
        hasSecureEmail: !!process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
        hasSecureKey: !!process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY,
        secureBucket: !!secureBucket,
      });
      throw new Error(
        'Google Cloud Storage not configured. Please check environment variables and bucket setup.',
      );
    }

    try {
      const buffer = file.buffer || (await file.toBuffer());
      const fileExt = file.filename?.split('.').pop() || 'jpg';
      const fileName = `verification/${userId}/${documentType}/${randomUUID()}.${fileExt}`;

      await secureBucket.file(fileName).save(buffer, {
        contentType: file.mimetype,
        metadata: {
          userId,
          documentType,
          uploadedAt: new Date().toISOString(),
        },
      });

      return this.getSecureUrl(fileName);
    } catch (error) {
      console.error('Error uploading secure document:', error);
      throw error;
    }
  }

  /**
   * Get a secure URL for an uploaded document (requires authentication)
   */
  static getSecureUrl(fileName: string): string {
    if (!hasGoogleCloudCredentials || !secureBucketName) {
      return fileName; // Return the mock URL for testing
    }
    return `https://storage.googleapis.com/${secureBucketName}/${fileName}`;
  }

  /**
   * Generate a signed URL for secure document access (temporary access)
   */
  static async getSignedSecureUrl(
    fileName: string,
    expiresInMinutes: number = 15,
  ): Promise<string> {
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    };
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log('Google Cloud Storage not configured, returning mock signed URL for testing');
      return `mock-signed://${fileName}?expires=${options.expires}`;
    }

    const [url] = await secureBucket.file(fileName).getSignedUrl(options);
    return url;
  }

  /**
   * Delete a secure document
   */
  static async deleteSecureDocument(fileName: string): Promise<void> {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log('Google Cloud Storage not configured, skipping document deletion for testing');
      return;
    }

    try {
      await secureBucket.file(fileName).delete();
    } catch (error) {
      console.error('Error deleting secure document:', error);
      throw error;
    }
  }

  /**
   * Delete a secure document by URL
   */
  static async deleteSecureDocumentByUrl(url: string): Promise<void> {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log('Google Cloud Storage not configured, skipping document deletion for testing');
      return;
    }

    try {
      // Handle mock URLs for testing
      if (url.startsWith('mock://')) {
        console.log('Mock URL detected, skipping deletion for testing');
        return;
      }

      // Extract filename from URL
      const fileName = url.split(`${secureBucketName}/`)[1];
      if (!fileName) {
        throw new Error('Invalid secure file URL');
      }
      await this.deleteSecureDocument(fileName);
    } catch (error) {
      console.error('Error deleting secure document by URL:', error);
      throw error;
    }
  }

  /**
   * List all documents for a user (admin only)
   */
  static async listUserDocuments(userId: string): Promise<string[]> {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log('Google Cloud Storage not configured, returning empty list for testing');
      return [];
    }

    try {
      const [files] = await secureBucket.getFiles({
        prefix: `verification/${userId}/`,
      });
      return files.map((file) => file.name);
    } catch (error) {
      console.error('Error listing user documents:', error);
      throw error;
    }
  }

  /**
   * Get document metadata
   */
  static async getDocumentMetadata(fileName: string): Promise<Record<string, unknown>> {
    if (!hasGoogleCloudCredentials || !secureBucket) {
      console.log('Google Cloud Storage not configured, returning mock metadata for testing');
      return { fileName, mockMetadata: true };
    }

    try {
      const [metadata] = await secureBucket.file(fileName).getMetadata();
      return metadata;
    } catch (error) {
      console.error('Error getting document metadata:', error);
      throw error;
    }
  }
}

// Export the functions for use in verification service
export const uploadSecureDocument =
  SecureStorageService.uploadSecureDocument.bind(SecureStorageService);
export const deleteSecureDocument =
  SecureStorageService.deleteSecureDocument.bind(SecureStorageService);
export const deleteSecureDocumentByUrl =
  SecureStorageService.deleteSecureDocumentByUrl.bind(SecureStorageService);
export const getSignedSecureUrl =
  SecureStorageService.getSignedSecureUrl.bind(SecureStorageService);
