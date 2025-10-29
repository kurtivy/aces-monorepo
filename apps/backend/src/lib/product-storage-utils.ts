import { Storage } from '@google-cloud/storage';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from root .env file (for local development)
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

// Check if Google Cloud credentials are available
const hasGoogleCloudCredentials = !!(
  process.env.GOOGLE_CLOUD_PROJECT_ID &&
  process.env.GOOGLE_CLOUD_CLIENT_EMAIL &&
  process.env.GOOGLE_CLOUD_PRIVATE_KEY
);

// Initialize product storage (only if credentials available)
let productStorage: Storage | null = null;
let productBucket: ReturnType<Storage['bucket']> | null = null;
let productBucketName = '';

if (hasGoogleCloudCredentials) {
  // Enhanced private key processing to handle various encoding issues
  let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';

  // Remove extra quotes if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  // Replace escaped newlines with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');

  productStorage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });

  productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'acesfun-product-images';
  productBucket = productStorage.bucket(productBucketName);
} else {
  console.warn(
    '[ProductStorage] ⚠️  Google Cloud Storage credentials not configured. Product image access will be disabled.',
  );
}

export class ProductStorageService {
  /**
   * Get the product bucket instance for direct operations
   */
  static getProductBucket() {
    if (!hasGoogleCloudCredentials || !productBucket) {
      throw new Error('Google Cloud Storage not configured');
    }
    return productBucket;
  }

  /**
   * Get a public URL for a product image
   */
  static getProductUrl(fileName: string): string {
    if (!productBucketName) {
      throw new Error('Google Cloud Storage not initialized. Check credentials.');
    }
    return `https://storage.googleapis.com/${productBucketName}/${fileName}`;
  }

  /**
   * Generate a signed URL for product image access (temporary access)
   */
  static async getSignedProductUrl(
    fileName: string,
    expiresInMinutes: number = 60,
  ): Promise<string> {
    try {
      // Check credentials dynamically
      const hasCredentials = !!(
        process.env.GOOGLE_CLOUD_PROJECT_ID &&
        process.env.GOOGLE_CLOUD_CLIENT_EMAIL &&
        process.env.GOOGLE_CLOUD_PRIVATE_KEY
      );

      if (!hasCredentials) {
        console.error(`[ProductStorage] Missing credentials for: ${fileName}`);
        throw new Error('Google Cloud Storage credentials not configured');
      }

      // Initialize storage dynamically if not already done
      if (!productStorage) {
        let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';

        // Clean up private key format
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');

        // Validate private key format
        if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
          console.error(`[ProductStorage] Invalid private key format for: ${fileName}`);
          throw new Error('Invalid private key format');
        }

        productStorage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: {
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
            private_key: privateKey,
          },
        });
      }

      if (!productBucket) {
        productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'acesfun-product-images';
        productBucket = productStorage.bucket(productBucketName);
      }

      // Generate signed URL
      const options = {
        version: 'v4' as const,
        action: 'read' as const,
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      };

      const [url] = await productBucket.file(fileName).getSignedUrl(options);

      // Validate that we got a proper signed URL
      if (!url || !url.includes('X-Goog-Signature')) {
        console.error(`[ProductStorage] Generated URL is not a valid signed URL for: ${fileName}`);
        console.error(`[ProductStorage] URL: ${url}`);
        throw new Error('Failed to generate valid signed URL');
      }

      return url;
    } catch (error) {
      console.error(`[ProductStorage] ❌ Error generating signed URL for ${fileName}:`, error);
      console.error(`[ProductStorage] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
      });

      // Instead of fallback, throw the error so we know what's wrong
      throw new Error(
        `Failed to generate signed URL for ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract filename from a product image URL
   */
  static extractFileName(imageUrl: string): string {
    // Handle case when credentials are not configured
    if (!productBucketName) {
      console.warn('Product bucket name not configured, cannot extract filename');
      throw new Error('Product storage not configured');
    }

    // Support both old and new bucket names for backward compatibility
    const oldBucketPrefix = 'https://storage.googleapis.com/aces-product-images/';
    const bucketPrefix = `https://storage.googleapis.com/${productBucketName}/`;

    if (imageUrl.startsWith(oldBucketPrefix)) {
      // Handle old bucket name
      return imageUrl.replace(oldBucketPrefix, '');
    }

    if (imageUrl.startsWith(bucketPrefix)) {
      // Handle current bucket name
      return imageUrl.replace(bucketPrefix, '');
    }

    throw new Error(
      `Invalid product storage URL format. Expected prefix: ${oldBucketPrefix} or ${bucketPrefix}`,
    );
  }

  /**
   * Convert product image URLs to signed URLs for secure access
   */
  static async convertToSignedUrls(
    imageUrls: string[],
    expiresInMinutes: number = 60,
  ): Promise<string[]> {
    const signedUrls = await Promise.all(
      imageUrls.map(async (url, index) => {
        try {
          // Check if this is a GCS URL that needs conversion (support both old and new bucket names)
          const isOldBucket =
            url.includes('storage.googleapis.com') && url.includes('aces-product-images');
          const isNewBucket =
            productBucketName &&
            url.includes('storage.googleapis.com') &&
            url.includes(productBucketName);

          if (isOldBucket || isNewBucket) {
            const fileName = this.extractFileName(url);

            const signedUrl = await this.getSignedProductUrl(fileName, expiresInMinutes);
            return signedUrl;
          }

          // Return original URL if it's not a GCS product image URL
          return url;
        } catch (error) {
          console.error(`[ProductStorage] ❌ Failed to convert URL ${url}:`, error);
          console.error(`[ProductStorage] Error details:`, {
            message: error instanceof Error ? error.message : 'Unknown error',
            index: index + 1,
            originalUrl: url,
          });

          // Re-throw the error so we can see what's failing
          throw error;
        }
      }),
    );

    signedUrls.forEach((url, index) => {
      const isSignedUrl = url.includes('X-Goog-Signature');
    });

    return signedUrls;
  }

  /**
   * Check if file exists in product bucket
   */
  static async fileExists(fileName: string): Promise<boolean> {
    if (!hasGoogleCloudCredentials || !productBucket) {
      return false;
    }

    try {
      const [exists] = await productBucket.file(fileName).exists();
      return exists;
    } catch (error) {
      console.error(`[ProductStorage] Error checking if file exists: ${fileName}`, error);
      return false;
    }
  }
}
