import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
 * Called by frontend after successful Privy auth.
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

    let user = await prisma.user.findUnique({
      where: { privyDid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          privyDid,
          walletAddress: walletAddress || null,
          email: email || null,
          username: username || null,
          role: 'TRADER',
          isActive: true,
          sellerStatus: 'NOT_APPLIED',
        },
      });
    } else {
      const updates: Record<string, unknown> = {};
      if (walletAddress && user.walletAddress !== walletAddress) {
        updates.walletAddress = walletAddress;
      }
      if (email && user.email !== email) {
        updates.email = email;
      }
      if (username != null && user.username !== username) {
        updates.username = username;
      }

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { ...updates, updatedAt: new Date() },
        });
      }
    }

    const profile = {
      id: user.id,
      privyDid: user.privyDid,
      walletAddress: user.walletAddress,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const created = user.createdAt.getTime() > Date.now() - 10000;

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
