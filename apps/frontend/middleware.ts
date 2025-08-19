import { type NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');
  const pathname = request.nextUrl.pathname;

  // Handle aceofbase.com domain - serve launch page content
  if (hostname === 'aceofbase.com' || hostname === 'www.aceofbase.com') {
    // Root path should serve the launch page
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/launch', request.url));
    }
    // Allow other paths to work normally on aceofbase.com
    return NextResponse.next();
  }

  // Handle aces.fun domain (main site)
  if (hostname === 'aces.fun' || hostname === 'www.aces.fun') {
    if (pathname === '/launch' || pathname === '/profile' || pathname === '/rwa') {
      return NextResponse.rewrite(new URL('/404', request.url));
    }

    return NextResponse.next();
  }

  // Default behavior for localhost and other domains during development
  if (hostname?.includes('localhost') || hostname?.includes('127.0.0.1')) {
    // During development, allow access to all pages for testing
    return NextResponse.next();
  }

  // Default behavior for any other domains
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
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
