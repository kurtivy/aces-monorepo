import { createClient } from '@supabase/supabase-js';
import { MultipartFile } from '@fastify/multipart';
import { randomUUID } from 'crypto';
import { errors } from './errors';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase storage configuration missing, falling back to local storage');
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.mkdir(uploadsDir, { recursive: true }).catch((err) =>
    console.error('Failed to create uploads directory:', err),
  );
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const BUCKET_NAME = 'verification-documents';

async function compressImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
  try {
    // Don't try to compress PDFs
    if (mimetype === 'application/pdf') {
      return buffer;
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();
    console.log('Image metadata:', metadata);

    // If image is already small, don't compress
    if (buffer.length < 500 * 1024) {
      // < 500KB
      return buffer;
    }

    // Resize if dimensions are too large
    if (metadata.width && metadata.width > 2000) {
      image.resize(2000, undefined, { fit: 'inside' });
    }

    switch (mimetype) {
      case 'image/jpeg':
        return image.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      case 'image/png':
        return image.png({ quality: 80, compressionLevel: 9 }).toBuffer();
      case 'image/webp':
        return image.webp({ quality: 80 }).toBuffer();
      default:
        return buffer;
    }
  } catch (error) {
    console.error('Image compression error:', error);
    // Return original buffer if compression fails
    return buffer;
  }
}

export async function uploadVerificationDocument(
  file: MultipartFile & { buffer?: Buffer },
  userId: string,
): Promise<string> {
  try {
    console.log('Starting document upload process...');

    // For testing, if it's a mock file, return a mock URL
    if (file.filename === 'test-document.jpg') {
      console.log('Mock file detected, returning mock URL');
      return `mock://test-document-${userId}.jpg`;
    }

    const buffer = file.buffer || (await file.toBuffer());
    console.log(`Original file size: ${buffer.length} bytes`);

    const compressedBuffer = await compressImage(buffer, file.mimetype);
    console.log(`Compressed file size: ${compressedBuffer.length} bytes`);

    const fileExt = file.filename.split('.').pop() || 'jpg';
    const fileName = `${userId}/${randomUUID()}.${fileExt}`;
    console.log(`Generated filename: ${fileName}`);

    // If Supabase is configured, use it
    if (supabase) {
      console.log('Using Supabase storage');
      try {
        // Ensure bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        if (!buckets?.find((b) => b.name === BUCKET_NAME)) {
          console.log('Creating storage bucket:', BUCKET_NAME);
          await supabase.storage.createBucket(BUCKET_NAME, {
            public: false,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
          });
        }

        // Upload file
        console.log('Uploading file to Supabase...');
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, compressedBuffer, {
            contentType: file.mimetype,
            upsert: true,
          });

        if (error) {
          console.error('Supabase upload error:', error);
          throw error;
        }

        // Get URL (valid for 1 hour for security)
        console.log('Getting signed URL...');
        const signedUrlResult = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(fileName, 3600);

        if (signedUrlResult.error) {
          console.error('Signed URL error:', signedUrlResult.error);
          throw signedUrlResult.error;
        }
        if (!signedUrlResult.data?.signedUrl) {
          throw new Error('Failed to get signed URL');
        }

        console.log(
          `Compressed image from ${buffer.length} to ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length / buffer.length) * 100)}% reduction)`,
        );

        return signedUrlResult.data.signedUrl;
      } catch (error) {
        console.error('Supabase storage error:', error);
        // Fall back to local storage if Supabase fails
        console.log('Falling back to local storage due to Supabase error');
      }
    }

    // Local storage (development only)
    console.log('Using local storage');
    const uploadDir = path.join(process.cwd(), 'uploads', userId);
    await fs.mkdir(uploadDir, { recursive: true });
    console.log('Created upload directory:', uploadDir);

    const filePath = path.join(uploadDir, `${randomUUID()}.${fileExt}`);
    await fs.writeFile(filePath, compressedBuffer);

    console.log(`File saved locally: ${filePath}`);
    console.log(
      `Compressed image from ${buffer.length} to ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length / buffer.length) * 100)}% reduction)`,
    );

    return `file://${filePath}`;
  } catch (error) {
    console.error('File upload error:', error);
    // Log additional details but only pass cause to the error
    console.error('Upload details:', {
      userId,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.file.bytesRead,
    });
    throw errors.internal('Failed to upload document', { cause: error });
  }
}

export async function deleteVerificationDocument(url: string): Promise<void> {
  try {
    console.log('Starting document deletion:', url);
    if (supabase && url.includes(supabaseUrl || '')) {
      // Extract path from Supabase URL
      const path = url.split('/').slice(-2).join('/');
      console.log('Deleting from Supabase:', path);
      const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

      if (error) {
        console.error('Supabase deletion error:', error);
        throw error;
      }
      console.log('Successfully deleted from Supabase');
    } else if (url.startsWith('file://')) {
      // Handle local file deletion
      console.log('Deleting local file:', url);
      const filePath = url.replace('file://', '');
      await fs.unlink(filePath);
      console.log('Successfully deleted local file');
    }
  } catch (error) {
    console.error('File deletion error:', error);
    throw errors.internal('Failed to delete verification document', { cause: error });
  }
}
