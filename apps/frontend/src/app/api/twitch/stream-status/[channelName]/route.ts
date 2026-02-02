import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/twitch/stream-status/[channelName]
 * Returns Twitch stream status for the given channel.
 * Uses relative URL - no external API needed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelName: string }> },
) {
  try {
    const { channelName } = await params;

    if (!channelName || channelName.length > 50) {
      return NextResponse.json({ success: false, error: 'Invalid channel name' }, { status: 400 });
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Twitch API credentials not configured');
      return NextResponse.json(
        { success: false, error: 'Twitch API not configured' },
        { status: 500 },
      );
    }

    // Get OAuth token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to get Twitch OAuth token');
      return NextResponse.json(
        { success: false, error: 'Failed to authenticate with Twitch API' },
        { status: 500 },
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // Check stream status
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${channelName}`,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    if (!streamResponse.ok) {
      console.error('Failed to fetch stream data from Twitch');
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stream data' },
        { status: 500 },
      );
    }

    const streamData = (await streamResponse.json()) as {
      data: Array<Record<string, unknown>>;
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          isLive: streamData.data.length > 0,
          streamData: streamData.data[0] ?? null,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        },
      },
    );
  } catch (error) {
    console.error('Twitch stream status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check stream status' },
      { status: 500 },
    );
  }
}
