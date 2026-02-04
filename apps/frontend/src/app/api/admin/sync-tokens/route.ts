import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';
import { syncAllTokensToConvex } from '@/lib/convex-sync';

/**
 * POST /api/admin/sync-tokens
 * Sync all Prisma tokens to Convex for backfill and repair.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminConvex(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }
    throw error;
  }

  try {
    const tokens = await prisma.token.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const result = await syncAllTokensToConvex(
      tokens.map((t) => ({
        contractAddress: t.contractAddress,
        symbol: t.symbol,
        name: t.name,
        chainId: t.chainId,
        decimals: t.decimals,
        listingId: t.listingId,
        isActive: t.isActive,
      })),
    );

    if (result.skipped) {
      return NextResponse.json({
        success: false,
        error: 'Convex sync skipped: NEXT_PUBLIC_CONVEX_URL is not set',
        synced: 0,
        failed: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} token(s) to Convex${result.failed > 0 ? `; ${result.failed} failed` : ''}.`,
      synced: result.synced,
      failed: result.failed,
    });
  } catch (error) {
    console.error('[ADMIN] Error syncing tokens:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync tokens',
        message: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 },
    );
  }
}
