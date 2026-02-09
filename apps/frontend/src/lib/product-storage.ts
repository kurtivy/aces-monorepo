/**
 * Product image storage using Google Cloud Storage.
 * Used by admin upload-image API route.
 */
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

const hasGoogleCloudCredentials = !!(
  process.env.GOOGLE_CLOUD_PROJECT_ID &&
  process.env.GOOGLE_CLOUD_CLIENT_EMAIL &&
  process.env.GOOGLE_CLOUD_PRIVATE_KEY
);

let productStorage: Storage | null = null;
let productBucket: ReturnType<Storage['bucket']> | null = null;
let productBucketName = '';

if (hasGoogleCloudCredentials) {
  let privateKey = (process.env.GOOGLE_CLOUD_PRIVATE_KEY || '').trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1).trim();
  }
  // Support both single-line (literal \n) and multi-line PEM from .env
  if (!privateKey.includes('\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  productStorage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });

  productBucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'acesfun-product-images';
  productBucket = productStorage.bucket(productBucketName);
}

export function getProductBucket() {
  if (!hasGoogleCloudCredentials || !productBucket) {
    throw new Error(
      'Google Cloud Storage not configured. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, GOOGLE_CLOUD_PRIVATE_KEY (and optionally GOOGLE_CLOUD_BUCKET_NAME) in .env',
    );
  }
  return productBucket;
}

/** Get the configured product bucket name (for image-proxy fallback). */
export function getProductBucketName(): string {
  return productBucketName || process.env.GOOGLE_CLOUD_BUCKET_NAME || 'acesfun-product-images';
}

/** Get a GCS bucket by name using the same credentials (for image-proxy fallback). */
export function getBucketByName(bucketName: string): ReturnType<Storage['bucket']> | null {
  if (!productStorage) return null;
  return productStorage.bucket(bucketName);
}

export function getProductUrl(fileName: string): string {
  if (!productBucketName) {
    throw new Error('Google Cloud Storage not initialized');
  }
  return `https://storage.googleapis.com/${productBucketName}/${fileName}`;
}

export async function uploadProductImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ imageUrl: string; fileName: string }> {
  const bucket = getProductBucket();
  const fileExtension = mimeType.split('/')[1] || 'jpg';
  const fileName = `${randomUUID()}.${fileExtension}`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
  });

  const imageUrl = getProductUrl(fileName);
  return { imageUrl, fileName };
}
