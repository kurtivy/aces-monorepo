import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchMutation } from 'convex/nextjs';
import { api } from '../../../../../../convex/_generated/api';
import { syncAppUserToPrisma } from '@/lib/convex-sync';

/**
 * Decode JWT without verification (we trust Privy tokens)
 */
function decodeJWT(
  token: string,
): { sub?: string; wallet_address?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/users/verify-or-create
 * Verify or create user from Privy authentication.
 * Called by frontend after successful Privy auth. Convex = source of truth; then sync to Prisma.
 *
 * Requires on Vercel (including preview branches):
 * - NEXT_PUBLIC_CONVEX_URL and CONVEX_DEPLOY_KEY for the Convex deployment this branch uses.
 */
export async function POST(request: NextRequest) {
  try {
    // Fail fast with 503 when Convex is not configured (e.g. preview branch missing env vars)
    const hasConvexUrl =
      typeof process.env.NEXT_PUBLIC_CONVEX_URL === 'string' &&
      process.env.NEXT_PUBLIC_CONVEX_URL.length > 0;
    const hasDeployKey =
      typeof process.env.CONVEX_DEPLOY_KEY === 'string' && process.env.CONVEX_DEPLOY_KEY.length > 0;
    const isVercel = process.env.VERCEL === '1';
    if (!hasConvexUrl || (isVercel && !hasDeployKey)) {
      const missing =
        !hasConvexUrl && isVercel && !hasDeployKey
          ? 'NEXT_PUBLIC_CONVEX_URL and CONVEX_DEPLOY_KEY'
          : !hasConvexUrl
            ? 'NEXT_PUBLIC_CONVEX_URL'
            : 'CONVEX_DEPLOY_KEY';
      console.error('[verify-or-create] Convex not configured. Missing:', missing);
      return NextResponse.json(
        {
          success: false,
          error: `Profile service not configured: add ${missing} to this deployment's environment variables (Vercel → Project → Settings → Environment Variables).`,
        },
        { status: 503 },
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication token required' },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const decoded = decodeJWT(token) as {
      sub: string;
      wallet_address?: string;
      email?: string;
    } | null;

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { success: false, error: 'Invalid or mismatched authentication token' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { privyDid, walletAddress, email, username } = body as {
      privyDid: string;
      walletAddress?: string;
      email?: string;
      username?: string;
    };

    if (!privyDid || privyDid !== decoded.sub) {
      return NextResponse.json(
        { success: false, error: 'Invalid or mismatched authentication token' },
        { status: 401 },
      );
    }

    const convexUser = await fetchMutation(api.users.getOrCreateUser, {
      privyDid,
      walletAddress: walletAddress ?? undefined,
      email: email ?? undefined,
      username: username ?? undefined,
    });

    // Prisma sync is optional: only run when DIRECT_DATABASE_URL is set (e.g. Vercel env).
    // Convex is the source of truth; profile is returned from Convex either way.
    if (process.env.DIRECT_DATABASE_URL) {
      try {
        await syncAppUserToPrisma(prisma, {
          id: convexUser.id,
          privyDid: convexUser.privyDid,
          walletAddress: convexUser.walletAddress,
          email: convexUser.email,
          username: convexUser.username,
          role: convexUser.role,
          isActive: convexUser.isActive,
          sellerStatus: convexUser.sellerStatus,
          createdAt: convexUser.createdAt,
          updatedAt: convexUser.updatedAt,
        });
      } catch (prismaErr) {
        console.error('[verify-or-create] Prisma sync failed (profile still returned):', prismaErr);
        // Don't 500: we have a valid Convex user; Prisma is best-effort for FKs/listings.
      }
    }

    const profile = {
      id: convexUser.id,
      privyDid: convexUser.privyDid,
      walletAddress: convexUser.walletAddress ?? null,
      email: convexUser.email ?? null,
      username: convexUser.username ?? null,
      role: convexUser.role,
      isActive: convexUser.isActive,
      createdAt: new Date(convexUser.createdAt),
      updatedAt: new Date(convexUser.updatedAt),
    };

    const created = convexUser.createdAt > Date.now() - 10000;

    return NextResponse.json({
      success: true,
      data: {
        profile,
        created,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[verify-or-create] Error:', message, stack ?? '');
    // Log hint for common Vercel/production issues
    if (message.includes('DIRECT_DATABASE_URL')) {
      console.error(
        '[verify-or-create] Fix: Set DIRECT_DATABASE_URL in Vercel project Environment Variables.',
      );
    }
    if (message.includes('CONVEX') || message.includes('convex')) {
      console.error(
        '[verify-or-create] Fix: Set NEXT_PUBLIC_CONVEX_URL and CONVEX_DEPLOY_KEY in Vercel for this branch.',
      );
    }
    // Convex/upstream often returns "[Request ID: ...] Server Error" - treat as 503 so UI can show "temporarily unavailable"
    const isGenericUpstream =
      /Request ID:.*Server Error/i.test(message) || message.includes('Server Error');
    const status = isGenericUpstream ? 503 : 500;
    const clientMessage = isGenericUpstream
      ? 'Profile service is temporarily unavailable. Please try again in a moment.'
      : message;
    return NextResponse.json(
      {
        success: false,
        error: clientMessage,
      },
      { status },
    );
  }
}
