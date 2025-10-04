// Debug endpoint to test Google Cloud Storage access on Vercel
import { FastifyPluginAsync } from 'fastify';
import { ProductStorageService } from '../../../lib/product-storage-utils';

const gcsTestRoutes: FastifyPluginAsync = async (fastify) => {
  // Test endpoint for Google Cloud Storage access
  fastify.get('/debug/gcs-test', async (request, reply) => {
    try {
      console.log('[GCS-Test] Starting Google Cloud Storage test...');

      // Check environment variables
      const envCheck = {
        GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
        GOOGLE_CLOUD_CLIENT_EMAIL: !!process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        GOOGLE_CLOUD_PRIVATE_KEY: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY,
        GOOGLE_CLOUD_BUCKET_NAME: process.env.GOOGLE_CLOUD_BUCKET_NAME || 'aces-product-images',
      };

      console.log('[GCS-Test] Environment variables:', envCheck);

      // Test signed URL generation for a known file
      const testFileName = 'apkaws/APxKaws-image-4.webp';
      console.log(`[GCS-Test] Testing signed URL for: ${testFileName}`);

      const signedUrl = await ProductStorageService.getSignedProductUrl(testFileName, 5);
      console.log(`[GCS-Test] Generated signed URL: ${signedUrl.substring(0, 100)}...`);

      // Test if the signed URL is accessible
      const response = await fetch(signedUrl, { method: 'HEAD' });
      const urlTest = {
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      };

      console.log('[GCS-Test] URL accessibility test:', urlTest);

      // Test convertToSignedUrls method
      const testUrls = [
        'https://storage.googleapis.com/aces-product-images/apkaws/APxKaws-image-4.webp',
      ];

      console.log('[GCS-Test] Testing convertToSignedUrls...');
      const convertedUrls = await ProductStorageService.convertToSignedUrls(testUrls, 5);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: !!process.env.VERCEL,
          ...envCheck,
        },
        tests: {
          signedUrlGeneration: {
            success: !!signedUrl,
            url: signedUrl, // Show full URL for debugging
            urlLength: signedUrl.length,
          },
          urlAccessibility: urlTest,
          convertToSignedUrls: {
            originalUrls: testUrls,
            convertedUrls: convertedUrls.map((url) => url.substring(0, 100) + '...'),
          },
        },
      };
    } catch (error) {
      console.error('[GCS-Test] Error:', error);

      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  });
};

export default gcsTestRoutes;
