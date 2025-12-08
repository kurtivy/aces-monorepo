import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // 🔒 CVE-2025-55182 Protection: Block malicious RSC headers
  const dangerousHeaders = ['rsc-action-id', 'next-action'];
  for (const header of dangerousHeaders) {
    if (request.headers.has(header)) {
      console.warn(`[SECURITY] Blocked request with suspicious header: ${header}`);
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // Block suspicious content-type headers
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('text/x-component')) {
    console.warn('[SECURITY] Blocked request with suspicious content-type: text/x-component');
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Always allow static TradingView assets to bypass any protection
  if (pathname.startsWith('/charting_library/')) {
    return NextResponse.next();
  }

  // Check if this is an admin domain request
  const isAdminDomain =
    host.includes('admin.aces.fun') ||
    host.includes('admin') ||
    host.includes('localhost:3003') ||
    host.includes('local.admin.aces.fun');

  // If it's an admin domain but not the login page, redirect to login
  if (isAdminDomain && pathname !== '/login' && pathname !== '/unauthorized' && pathname !== '/') {
    // For now, just continue - we'll handle auth checks in the components
    // This middleware could be enhanced later for server-side auth checks
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - charting_library (TradingView static assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|charting_library).*)',
  ],
};
