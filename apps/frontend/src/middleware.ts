import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');
  const pathname = request.nextUrl.pathname;

  // Map localhost ports to domains for testing
  const isDomain1 = hostname === 'aces.fun' || hostname === 'localhost:3000';
  const isDomain2 = hostname === 'aceofbase.fun' || hostname === 'localhost:3001';

  // Block /launch and /profile routes on aces.fun (or localhost:3000)
  if (isDomain1 && (pathname.startsWith('/launch') || pathname.startsWith('/profile'))) {
    // Rewrite to a non-existent route to trigger the not-found.tsx page
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  // Redirect aceofbase.fun root to /launch
  if (isDomain2 && pathname === '/') {
    return NextResponse.rewrite(new URL('/launch', request.url));
  }

  // Block aceofbase.fun from accessing other routes (except /launch and its assets)
  if (
    isDomain2 &&
    !pathname.startsWith('/launch') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/favicon') &&
    !pathname.startsWith('/canvas-images') &&
    !pathname.startsWith('/fonts') &&
    !pathname.startsWith('/svg')
  ) {
    return NextResponse.redirect(new URL('/launch', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only run middleware on page routes, not assets
    '/((?!_next/static|_next/image|favicon.ico|canvas-images|fonts|svg|api).*)',
  ],
};
