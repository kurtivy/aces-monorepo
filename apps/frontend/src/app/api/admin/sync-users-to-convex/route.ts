import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/sync-users-to-convex
 * One-time backfill: copy all Prisma users to Convex appUsers so existing users exist in Convex.
 * Idempotent; safe to run multiple times.
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

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return NextResponse.json({
      success: false,
      error: 'Convex sync skipped: NEXT_PUBLIC_CONVEX_URL is not set',
      synced: 0,
      failed: 0,
    });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const { fetchMutation } = await import('convex/nextjs');
    const { api } = await import('../../../../../convex/_generated/api');

    let synced = 0;
    let failed = 0;
    for (const u of users) {
      try {
        await fetchMutation(api.users.upsertForBackfill, {
          id: u.id,
          privyDid: u.privyDid,
          walletAddress: u.walletAddress ?? undefined,
          email: u.email ?? undefined,
          username: u.username ?? undefined,
          role: u.role,
          isActive: u.isActive,
          sellerStatus: u.sellerStatus ?? undefined,
          createdAt: u.createdAt.getTime(),
          updatedAt: u.updatedAt.getTime(),
        });
        synced++;
      } catch (err) {
        console.error('[ADMIN] sync-users-to-convex item failed:', u.id, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} user(s) to Convex${failed > 0 ? `; ${failed} failed` : ''}.`,
      synced,
      failed,
    });
  } catch (error) {
    console.error('[ADMIN] Error syncing users to Convex:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync users',
        message: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 },
    );
  }
}
