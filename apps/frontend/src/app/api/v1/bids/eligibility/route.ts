import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/route-auth';

/**
 * GET /api/v1/bids/eligibility
 * Check if the authenticated user is eligible to place bids.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // All authenticated users can place bids
    return NextResponse.json({
      success: true,
      data: {
        isEligible: !!user,
        message: 'You are eligible to place bids',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    console.error('[bids/eligibility] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check eligibility',
      },
      { status: 500 },
    );
  }
}
