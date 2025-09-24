import { Storage } from '@google-cloud/storage';

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

  console.log('[DEBUG] Private key processing:');
  console.log(`[DEBUG] - Original length: ${process.env.GOOGLE_CLOUD_PRIVATE_KEY?.length}`);
  console.log(`[DEBUG] - Processed length: ${privateKey.length}`);
  console.log(`[DEBUG] - Starts with BEGIN: ${privateKey.startsWith('-----BEGIN')}`);
  console.log(`[DEBUG] - Ends with END: ${privateKey.endsWith('-----')}`);
  console.log(`[DEBUG] - Contains newlines: ${privateKey.includes('\n')}`);

  productStorage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });

  productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'aces-product-images';
  productBucket = productStorage.bucket(productBucketName);
} else {
  console.warn(
    'Google Cloud Storage credentials not configured. Product image access will be disabled for testing.',
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
    if (!hasGoogleCloudCredentials || !productBucket) {
      return `mock-signed://${fileName}?expires=${Date.now() + expiresInMinutes * 60 * 1000}`;
    }

    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    };

    const [url] = await productBucket.file(fileName).getSignedUrl(options);
    return url;
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
    const signedUrls = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          if (url.includes('storage.googleapis.com') && url.includes(productBucketName)) {
            const fileName = this.extractFileName(url);
            return await this.getSignedProductUrl(fileName, expiresInMinutes);
          }
          // Return original URL if it's not a GCS product image URL
          return url;
        } catch (error) {
          console.error(`Failed to generate signed URL for ${url}:`, error);
          // Return original URL as fallback
          return url;
        }
      }),
    );
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
