import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/twitch/analytics
 * Tracks Twitch stream window analytics (opened, closed, etc.)
 * Uses relative URL - no external API needed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, windowState, timestamp } = body;

    // Log for debugging/analytics (could be extended to store in DB)
    console.info('[Twitch Analytics]', { action, windowState, timestamp });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twitch analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track analytics' },
      { status: 500 },
    );
  }
}
