import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { MultipartFile } from '@fastify/multipart';

// Initialize storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'aces-rwa-images';
const bucket = storage.bucket(bucketName);

export class StorageService {
  /**
   * Get the bucket instance for direct operations
   */
  static getBucket() {
    return bucket;
  }

  /**
   * Generate a signed URL for uploading an image
   */
  static async getSignedUploadUrl(
    fileType: string,
    folder: string = 'submissions',
  ): Promise<{ url: string; fileName: string }> {
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
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  }

  /**
   * Delete an image from storage
   */
  static async deleteImage(fileName: string): Promise<void> {
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
