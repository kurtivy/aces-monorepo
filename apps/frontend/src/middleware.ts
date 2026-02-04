import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const { pathname } = request.nextUrl;
    const host = request.headers.get('host') || '';

    // Protect /admin routes: redirect to login if not authenticated (except login and unauthorized)
    if (
      pathname.startsWith('/admin') &&
      pathname !== '/admin/login' &&
      pathname !== '/admin/unauthorized'
    ) {
      const authenticated = await convexAuth.isAuthenticated();
      if (!authenticated) {
        return nextjsMiddlewareRedirect(request, '/admin/login');
      }
    }

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
    if (
      isAdminDomain &&
      pathname !== '/login' &&
      pathname !== '/unauthorized' &&
      pathname !== '/'
    ) {
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    apiRoute: '/api/auth',
  },
);

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
