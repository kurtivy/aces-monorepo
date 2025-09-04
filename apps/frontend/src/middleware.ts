import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // Check if this is an admin domain request
  const isAdminDomain =
    host.includes('admin.aces.fun') ||
    host.includes('admin') ||
    host.includes('localhost:3003') ||
    host.includes('local.admin.aces.fun');

  // Block access to profile page - redirect to home
  if (pathname === '/profile') {
    return NextResponse.redirect(new URL('/', request.url));
  }

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
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
