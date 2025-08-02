import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { MultipartFile } from '@fastify/multipart';

// Check if Google Cloud credentials are available
const hasGoogleCloudCredentials = !!(
  process.env.GOOGLE_CLOUD_PROJECT_ID &&
  process.env.GOOGLE_CLOUD_CLIENT_EMAIL &&
  process.env.GOOGLE_CLOUD_PRIVATE_KEY
);

// Initialize storage safely (only if credentials available)
let storage: Storage | null = null;
let bucket: ReturnType<Storage['bucket']> | null = null;
let bucketName = '';

if (hasGoogleCloudCredentials) {
  storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  });

  bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'aces-rwa-images';
  bucket = storage.bucket(bucketName);
} else {
  console.warn(
    'Google Cloud Storage credentials not configured. File upload will be disabled for testing.',
  );
}

export class StorageService {
  /**
   * Get the bucket instance for direct operations
   */
  static getBucket() {
    if (!bucket) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }
    return bucket;
  }

  /**
   * Generate a signed URL for uploading an image
   */
  static async getSignedUploadUrl(
    fileType: string,
    folder: string = 'submissions',
  ): Promise<{ url: string; fileName: string }> {
    if (!bucket) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }

    const fileName = `${folder}/${randomUUID()}-${Date.now()}`;
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: fileType,
    };

    const [url] = await bucket.file(fileName).getSignedUrl(options);
    return { url, fileName };
  }

  /**
   * Get a public URL for an uploaded image
   */
  static getPublicUrl(fileName: string): string {
    if (!bucketName) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  }

  /**
   * Generate a signed URL for reading an image (temporary access)
   */
  static async getSignedReadUrl(fileName: string, expiresInMinutes: number = 60): Promise<string> {
    if (!bucket) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }

    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    };

    const [url] = await bucket.file(fileName).getSignedUrl(options);
    return url;
  }

  /**
   * Delete an image from storage
   */
  static async deleteImage(fileName: string): Promise<void> {
    if (!bucket) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }

    try {
      await bucket.file(fileName).delete();
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Upload a verification document
   */
  static async uploadVerificationDocument(
    file: MultipartFile & { buffer?: Buffer },
    userId: string,
  ): Promise<string> {
    if (!bucket) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }

    try {
      const buffer = file.buffer || (await file.toBuffer());
      const fileExt = file.filename.split('.').pop() || 'jpg';
      const fileName = `verification/${userId}/${randomUUID()}.${fileExt}`;

      await bucket.file(fileName).save(buffer, {
        contentType: file.mimetype,
      });

      return this.getPublicUrl(fileName);
    } catch (error) {
      console.error('Error uploading verification document:', error);
      throw error;
    }
  }

  /**
   * Delete a verification document
   */
  static async deleteVerificationDocument(url: string): Promise<void> {
    if (!bucketName) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }

    try {
      // Extract filename from URL
      const fileName = url.split(`${bucketName}/`)[1];
      if (!fileName) {
        throw new Error('Invalid file URL');
      }
      await this.deleteImage(fileName);
    } catch (error) {
      console.error('Error deleting verification document:', error);
      throw error;
    }
  }
}

// Export the functions for backward compatibility
export const uploadVerificationDocument =
  StorageService.uploadVerificationDocument.bind(StorageService);
export const deleteVerificationDocument =
  StorageService.deleteVerificationDocument.bind(StorageService);
