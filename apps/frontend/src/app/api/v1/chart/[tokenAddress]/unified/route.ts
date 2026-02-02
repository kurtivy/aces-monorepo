import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'https://acesbackend-production.up.railway.app';

/**
 * GET /api/v1/chart/:tokenAddress/unified
 * Proxies chart unified requests to the backend so the TradingView iframe
 * can load from the frontend origin (same-origin fetch, no CORS).
 * Query: timeframe, from, to, limit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> },
) {
  try {
    const { tokenAddress } = await params;
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '1h';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = searchParams.get('limit');

    const query = new URLSearchParams();
    query.set('timeframe', timeframe);
    if (from != null) query.set('from', from);
    if (to != null) query.set('to', to);
    if (limit != null) query.set('limit', limit);

    const backendUrl = `${BACKEND_BASE}/api/v1/chart/${encodeURIComponent(tokenAddress)}/unified?${query.toString()}`;

    const response = await fetch(backendUrl, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=10',
      },
    });
  } catch (error) {
    console.error('[chart/unified] Proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch chart data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
