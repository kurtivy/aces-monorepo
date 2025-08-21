import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Define your domains
  const domains = {
    main: 'aces.fun',
    launch: 'aceofbase.fun',
  };

  // For development and Vercel deployments
  const isDevelopment = hostname.includes('localhost') || hostname.includes('127.0.0.1');
  const isVercelDeployment = hostname.includes('vercel.app');

  // Determine which domain logic to apply based on hostname
  const getDomainType = (): 'main' | 'launch' | 'dev' => {
    if (!isDevelopment && !isVercelDeployment) {
      if (hostname === domains.main) {
        return 'main';
      } else if (hostname === domains.launch) {
        return 'launch';
      }
    } else if (isVercelDeployment) {
      // For Vercel deployments, determine domain type by URL pattern or branch name
      // You can customize this logic based on your deployment naming conventions
      if (hostname.includes('aceofbase') || hostname.includes('launch')) {
        return 'launch';
      } else {
        return 'main'; // Default Vercel deployments act like main domain
      }
    }
    return 'dev';
  };

  const domainType = getDomainType();

  // Routes that should NOT be accessible on aces.fun (temporarily disabled)
  const acesRestrictedRoutes: string[] = []; // Temporarily allow all routes

  // Routes that should ONLY be accessible on aceofbase.com
  // const aceofbaseOnlyRoutes = ['/launch']; // Commented out

  // Check domain type
  const isMainDomain = domainType === 'main';
  // const isLaunchDomain = domainType === 'launch'; // Commented out
  const isDevEnvironment = domainType === 'dev';

  // Apply domain restrictions only in production-like environments
  // TEMPORARILY DISABLED: Allowing all routes on all domains
  if (false && !isDevEnvironment) {
    // If on main domain (aces.fun or main Vercel deployment), block restricted routes
    if (isMainDomain) {
      const isRestrictedOnAces = acesRestrictedRoutes.some((route) => pathname.startsWith(route));

      if (isRestrictedOnAces) {
        console.log(`❌ Blocking ${pathname} on main domain (${hostname})`);
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      }
    }

    // COMMENTED OUT: Launch domain restrictions
    // If on launch domain (aceofbase.com or launch Vercel deployment), only allow launch routes
    // if (isLaunchDomain) {
    //   const isAceofbaseRoute = aceofbaseOnlyRoutes.some((route) => pathname.startsWith(route));

    //   if (!isAceofbaseRoute) {
    //     console.log(`❌ Non-launch route ${pathname} on launch domain (${hostname})`);
    //     return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    //   }
    // }
  }

  // Protected routes that require authentication (if you have any)
  const protectedRoutes = [
    '/dashboard',
    '/admin',
    // Add your protected routes here
  ];

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  // Authentication checks for protected routes
  if (isProtectedRoute) {
    const authToken =
      request.cookies.get('auth-token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!authToken) {
      console.log('❌ No auth token found for protected route:', pathname);

      // Redirect to login page
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Create response and add headers
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add custom headers for debugging
  response.headers.set('X-Middleware-Domain', hostname);
  response.headers.set('X-Middleware-Domain-Type', domainType);
  response.headers.set('X-Middleware-Path', pathname);
  response.headers.set('X-Middleware-Timestamp', new Date().toISOString());

  return response;
}

export const config = {
  matcher: [
    // Include all routes except static files and some Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
