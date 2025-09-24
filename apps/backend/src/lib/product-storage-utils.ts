import { Storage } from '@google-cloud/storage';
import { config } from 'dotenv';

// Load environment variables
config();

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

  console.log('[ProductStorage] Initializing Google Cloud Storage for product images...');
  console.log(`[ProductStorage] - Project ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
  console.log(`[ProductStorage] - Client Email: ${process.env.GOOGLE_CLOUD_CLIENT_EMAIL}`);
  console.log(`[ProductStorage] - Private key length: ${privateKey.length}`);
  console.log(
    `[ProductStorage] - Private key format valid: ${privateKey.startsWith('-----BEGIN') && privateKey.endsWith('-----')}`,
  );

  productStorage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });

  productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'aces-product-images';
  productBucket = productStorage.bucket(productBucketName);

  console.log(`[ProductStorage] ✅ Initialized successfully for bucket: ${productBucketName}`);
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
    // Check credentials dynamically
    const hasCredentials = !!(
      process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL &&
      process.env.GOOGLE_CLOUD_PRIVATE_KEY
    );

    if (!hasCredentials) {
      console.warn(
        `[ProductStorage] No credentials available, returning direct URL for: ${fileName}`,
      );
      return `https://storage.googleapis.com/${productBucketName}/${fileName}`;
    }

    try {
      // Initialize storage dynamically if not already done
      if (!productStorage) {
        let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');

        productStorage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: {
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
            private_key: privateKey,
          },
        });
      }

      if (!productBucket) {
        productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'aces-product-images';
        productBucket = productStorage.bucket(productBucketName);
      }

      const options = {
        version: 'v4' as const,
        action: 'read' as const,
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      };

      const [url] = await productBucket.file(fileName).getSignedUrl(options);
      console.log(`[ProductStorage] Generated signed URL for: ${fileName}`);
      return url;
    } catch (error) {
      console.error(`[ProductStorage] Failed to generate signed URL for ${fileName}:`, error);
      // Fallback to direct URL
      return `https://storage.googleapis.com/${productBucketName}/${fileName}`;
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

    const bucketPrefix = `https://storage.googleapis.com/${productBucketName}/`;
    if (!imageUrl.startsWith(bucketPrefix)) {
      throw new Error(`Invalid product storage URL format. Expected prefix: ${bucketPrefix}`);
    }
    return imageUrl.replace(bucketPrefix, '');
  }

  /**
   * Convert product image URLs to signed URLs for secure access
   */
  static async convertToSignedUrls(
    imageUrls: string[],
    expiresInMinutes: number = 60,
  ): Promise<string[]> {
    console.log(`[ProductStorage] Converting ${imageUrls.length} URLs to signed URLs...`);
    console.log(`[ProductStorage] Bucket name: ${productBucketName}`);
    console.log(`[ProductStorage] Has credentials: ${hasGoogleCloudCredentials}`);

    const signedUrls = await Promise.all(
      imageUrls.map(async (url, index) => {
        try {
          console.log(`[ProductStorage] Processing URL ${index + 1}/${imageUrls.length}: ${url}`);

          if (url.includes('storage.googleapis.com') && url.includes(productBucketName)) {
            const fileName = this.extractFileName(url);
            console.log(`[ProductStorage] Extracting filename: ${fileName}`);
            const signedUrl = await this.getSignedProductUrl(fileName, expiresInMinutes);
            console.log(`[ProductStorage] ✅ Generated signed URL for: ${fileName}`);
            return signedUrl;
          }
          // Return original URL if it's not a GCS product image URL
          console.log(`[ProductStorage] ℹ️  Keeping original URL (not GCS): ${url}`);
          return url;
        } catch (error) {
          console.error(`[ProductStorage] ❌ Failed to generate signed URL for ${url}:`, error);
          // Return original URL as fallback
          return url;
        }
      }),
    );

    console.log(`[ProductStorage] ✅ Completed URL conversion. Results:`);
    signedUrls.forEach((url, index) => {
      console.log(
        `[ProductStorage]   ${index + 1}: ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`,
      );
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
      console.error(`Error checking if file exists: ${fileName}`, error);
      return false;
    }
  }
}
