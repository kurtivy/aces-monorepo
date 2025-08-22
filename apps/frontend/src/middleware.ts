import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');
  const pathname = request.nextUrl.pathname;

  // Add comprehensive logging
  console.log('🔍 MIDDLEWARE DEBUG:');
  console.log('  Hostname:', hostname);
  console.log('  Pathname:', pathname);
  console.log('  Full URL:', request.url);

  // Define domain types
  const isAceofbaseDomain =
    hostname === 'aceofbase.fun' ||
    hostname === 'localhost:3001' ||
    hostname === 'local.aceofbase.fun:3000' ||
    (hostname?.includes('vercel.app') && hostname?.includes('aceofbase'));

  const isMainDomain =
    hostname === 'aces.fun' ||
    hostname === 'localhost:3000' ||
    hostname === 'local.aces.fun:3000' ||
    (hostname?.includes('vercel.app') && !hostname?.includes('aceofbase'));

  console.log('  Is Aceofbase Domain:', isAceofbaseDomain);
  console.log('  Is Main Domain:', isMainDomain);

  // Main domain blocking logic
  if (isMainDomain) {
    if (
      pathname.startsWith('/profile') ||
      pathname.startsWith('/launch') ||
      pathname.startsWith('/aceofbase')
    ) {
      console.log('  🚫 BLOCKING route on main domain:', pathname);
      return NextResponse.rewrite(new URL('/404', request.url));
    }
  }

  // Aceofbase domain blocking logic - only allow root and static assets
  if (isAceofbaseDomain) {
    const allowedPaths = [
      '/',
      '/_next',
      '/api',
      '/favicon.ico',
      '/canvas-images',
      '/fonts',
      '/svg',
      '/aces-logo.png',
      '/404-image.png',
    ];

    const isAllowedPath = allowedPaths.some((path) => pathname.startsWith(path));

    if (!isAllowedPath) {
      console.log('  🚫 BLOCKING non-root route on aceofbase domain:', pathname);
      return NextResponse.rewrite(new URL('/404', request.url));
    }
  }

  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Debug headers
  response.headers.set('X-Middleware-Domain', hostname || 'unknown');
  response.headers.set('X-Middleware-Path', pathname);
  response.headers.set('X-Middleware-Aceofbase', isAceofbaseDomain?.toString() || 'false');
  response.headers.set('X-Middleware-Main', isMainDomain?.toString() || 'false');

  console.log('  ✅ CONTINUING to next()');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|canvas-images|fonts|svg|api).*)'],
};
