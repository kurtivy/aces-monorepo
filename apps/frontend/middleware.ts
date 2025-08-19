import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Simple test - add a header to EVERY request
  const response = NextResponse.next();
  response.headers.set('x-middleware-test', 'working');
  response.headers.set('x-hostname', request.headers.get('host') || 'unknown');

  return response;
}

// Simplified matcher - should catch most requests
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
