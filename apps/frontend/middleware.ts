import { type NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');
  const pathname = request.nextUrl.pathname;

  console.log('[v0] Middleware triggered - hostname:', hostname, 'pathname:', pathname);

  // Handle aceofbase.com domain - serve launch page content
  if (hostname === 'aceofbase.com' || hostname === 'www.aceofbase.com') {
    console.log('[v0] Matched aceofbase.com domain');
    // Root path should serve the launch page
    if (pathname === '/' || pathname === '') {
      console.log('[v0] Rewriting root to /launch');
      return NextResponse.rewrite(new URL('/launch', request.url));
    }
    // Allow other paths to work normally on aceofbase.com
    return NextResponse.next();
  }

  // Handle aces.fun domain (main site) AND Vercel preview URLs for testing
  if (hostname === 'aces.fun' || hostname === 'www.aces.fun' || hostname?.includes('vercel.app')) {
    console.log('[v0] Matched main domain or Vercel preview URL');
    if (pathname === '/launch' || pathname === '/profile' || pathname === '/rwa') {
      console.log('[v0] Blocking access to:', pathname, '- returning 404');
      return NextResponse.rewrite(new URL('/404', request.url));
    }

    return NextResponse.next();
  }

  // Default behavior for localhost and other domains during development
  if (hostname?.includes('localhost') || hostname?.includes('127.0.0.1')) {
    console.log('[v0] Localhost detected - allowing all access');
    // During development, allow access to all pages for testing
    return NextResponse.next();
  }

  console.log('[v0] No specific rules matched - default behavior');
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
