import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';
import { syncTokenToConvex } from '@/lib/convex-sync';
import { z } from 'zod';

const SKIP_ADMIN_AUTH =
  typeof process.env.NEXT_PUBLIC_SKIP_ADMIN_AUTH !== 'undefined'
    ? process.env.NEXT_PUBLIC_SKIP_ADMIN_AUTH === 'true'
    : true;

const UpdatePoolAddressSchema = z.object({
  poolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

/**
 * PATCH /api/admin/tokens/[address]/pool-address - Update pool address for a token
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    if (!SKIP_ADMIN_AUTH) {
      await requireAdminConvex(request);
    }

    const { address } = await params;
    const body = await request.json();
    const { poolAddress } = UpdatePoolAddressSchema.parse(body);

    console.log(`[ADMIN] Updating pool address for token ${address}: ${poolAddress}`);

    // Verify token exists
    const token = await prisma.token.findUnique({
      where: { contractAddress: address.toLowerCase() },
    });

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token not found',
          message: `Token with address ${address} does not exist in database`,
        },
        { status: 404 },
      );
    }

    // Update token with pool address
    const updatedToken = await prisma.token.update({
      where: { contractAddress: address.toLowerCase() },
      data: {
        poolAddress: poolAddress.toLowerCase(),
        priceSource: 'DEX',
        phase: 'DEX_TRADING',
        dexLiveAt: new Date(),
      },
    });

    console.log(`[ADMIN] Pool address updated successfully for token ${updatedToken.symbol}`);

    // Sync token (including poolAddress) to Convex so Convex-backed flows see the pool
    try {
      await syncTokenToConvex({
        contractAddress: updatedToken.contractAddress,
        symbol: updatedToken.symbol,
        name: updatedToken.name,
        chainId: updatedToken.chainId,
        decimals: updatedToken.decimals ?? undefined,
        listingId: updatedToken.listingId ?? null,
        isActive: updatedToken.isActive,
        poolAddress: updatedToken.poolAddress ?? null,
      });
    } catch (syncErr) {
      console.warn('[ADMIN] Convex token sync failed after pool address update:', syncErr);
    }

    return NextResponse.json({
      success: true,
      message: `Pool address updated successfully for token ${updatedToken.symbol}`,
      data: {
        contractAddress: updatedToken.contractAddress,
        poolAddress: updatedToken.poolAddress,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Error updating pool address:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update pool address',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
