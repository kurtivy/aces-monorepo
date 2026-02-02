import { NextRequest, NextResponse } from 'next/server';
import { getBucketByName, getProductBucketName } from '@/lib/product-storage';

/** Allowed hostnames for image proxy (avoids SSRF). Add others as needed. */
const ALLOWED_HOSTS = new Set([
  'storage.googleapis.com',
  'storage.cloud.google.com',
  'aces-product-images.storage.googleapis.com',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const TIMEOUT_MS = 15000;

/**
 * Parse GCS URL path into bucket and object path.
 * Path is like /aces-product-images/submissions/.../file.png (no query).
 */
/** Derive Content-Type from URL path when upstream doesn't send one (e.g. GCS). */
function contentTypeFromPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg'; // safe default for product images
}

function parseGcsPath(pathname: string): { bucket: string; objectPath: string } | null {
  const trimmed = pathname.replace(/^\/+/, '');
  const firstSlash = trimmed.indexOf('/');
  if (firstSlash <= 0) return null;
  const bucket = trimmed.slice(0, firstSlash);
  const objectPath = trimmed.slice(firstSlash + 1);
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

/**
 * GET /api/image-proxy?url=<encoded-image-url>
 * Fetches the image server-side and streams it back. Use for GCS (and other) images
 * that fail in the browser due to CORS or expired signed URLs.
 * When the URL returns 4xx (e.g. expired signed URL), falls back to GCS Storage API
 * using app credentials so the image still loads.
 */
export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const host = targetUrl.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return NextResponse.json(
      { error: `Proxying is not allowed for host: ${host}` },
      { status: 403 },
    );
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return NextResponse.json({ error: 'Only http(s) URLs are allowed' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Fallback: for GCS URLs that return 4xx (e.g. expired signed URL), serve via Storage API
      if (host === 'storage.googleapis.com' && res.status >= 400 && res.status < 500) {
        const parsed = parseGcsPath(targetUrl.pathname);
        if (parsed) {
          let streamResponse = await streamFromGcs(parsed.bucket, parsed.objectPath);
          // If URL bucket differs from configured bucket (e.g. aces-product-images vs acesfun-product-images), try configured bucket
          if (!streamResponse) {
            const configuredBucket = getProductBucketName();
            if (configuredBucket && configuredBucket !== parsed.bucket) {
              streamResponse = await streamFromGcs(configuredBucket, parsed.objectPath);
            }
          }
          if (streamResponse) return streamResponse;
        }
      }
      return NextResponse.json(
        { error: `Upstream returned ${res.status}`, status: res.status },
        { status: 502 },
      );
    }

    const rawContentType = res.headers.get('Content-Type');
    const contentType =
      rawContentType && /^image\//.test(rawContentType)
        ? rawContentType
        : contentTypeFromPath(targetUrl.pathname);
    const contentLength = res.headers.get('Content-Length');
    const length = contentLength ? parseInt(contentLength, 10) : null;
    if (length != null && length > MAX_SIZE) {
      return NextResponse.json(
        { error: `Image too large (max ${MAX_SIZE / 1024 / 1024}MB)` },
        { status: 413 },
      );
    }

    const body = res.body;
    if (!body) {
      return NextResponse.json({ error: 'No response body' }, { status: 502 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
  }
}

/** Serve a GCS object by bucket and path using app credentials (works when signed URL is expired). */
async function streamFromGcs(bucketName: string, objectPath: string): Promise<NextResponse | null> {
  try {
    const bucket = getBucketByName(bucketName);
    if (!bucket) return null;

    const file = bucket.file(objectPath);
    const [downloadResult, metaResult] = await Promise.all([
      file.download(),
      file.getMetadata().catch(() => [null]),
    ]);
    const buffer = downloadResult[0];
    const meta = metaResult?.[0];
    const size = buffer.length;
    if (size > MAX_SIZE) return null;

    const contentType = (meta?.contentType as string) || contentTypeFromPath(objectPath);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch {
    return null;
  }
}
