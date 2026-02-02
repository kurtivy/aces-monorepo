import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSupabase } from '@/lib/auth/route-auth';
import { uploadProductImage } from '@/lib/product-storage';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * POST /api/admin/upload-image
 * Upload a product image to GCP. Runs on frontend (localhost:3000) - no proxy to backend.
 * Requires admin auth (Privy JWT with ADMIN role).
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminSupabase(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 });
  }

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
    console.error('[ADMIN] Upload image error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload image',
      },
      { status: 500 },
    );
  }
}
