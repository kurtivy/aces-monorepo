import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../../../convex/_generated/api';
import { getConvexAdminToken } from '@/lib/auth/route-auth';

/**
 * GET /api/admin/session
 * Returns the current Convex admin JWT when the request is authenticated (cookie or Bearer).
 * Used by the client to hydrate sessionStorage so upload/API calls can send Bearer when the
 * client doesn't have the token in memory (e.g. after refresh or "already logged in" redirect).
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getConvexAdminToken(request);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    const admin = await fetchQuery(api.admin.getCurrentAdmin, {}, { token });
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    return NextResponse.json({ success: true, token });
  } catch {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
}
