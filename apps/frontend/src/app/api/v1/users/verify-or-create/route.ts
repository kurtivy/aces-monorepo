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
 */
export async function POST(request: NextRequest) {
  try {
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
    console.error('[verify-or-create] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify or create user',
      },
      { status: 500 },
    );
  }
}
