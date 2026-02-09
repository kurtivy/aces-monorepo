import { NextRequest, NextResponse } from 'next/server';
import { uploadProductImage } from '@/lib/product-storage';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Map GCP/storage errors to safe, user-facing messages (no key or internal details). */
function sanitizeUploadError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (
    lower.includes('not configured') ||
    lower.includes('could not load') ||
    lower.includes('default credentials') ||
    lower.includes('invalid pem') ||
    lower.includes('invalid key')
  ) {
    return 'GCP credentials are missing or invalid. Check GOOGLE_CLOUD_* env vars and restart the server.';
  }
  if (
    lower.includes('bucket') &&
    (lower.includes('not found') || lower.includes('does not exist'))
  ) {
    return 'GCP bucket not found. Create the bucket or set GOOGLE_CLOUD_BUCKET_NAME correctly.';
  }
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('403')) {
    return 'GCP bucket or permissions misconfigured. Ensure the service account can create objects in the bucket.';
  }
  if (lower.includes('unauthorized') || lower.includes('401')) {
    return 'GCP authentication failed. Check service account key and project.';
  }
  return 'Image upload failed. Check server logs for details.';
}

/**
 * POST /api/admin/upload-image
 * Upload a product image to GCP. No auth required; protect the admin token-launch page via route/layout if needed.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPEG, PNG, and WebP allowed.' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 2MB limit.' },
        { status: 400 },
      );
    }

    const { imageUrl, fileName } = await uploadProductImage(buffer, file.type);

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[ADMIN] Upload image error:', err.message, err.cause ?? err);
    return NextResponse.json(
      {
        success: false,
        error: sanitizeUploadError(error),
      },
      { status: 500 },
    );
  }
}
