import { NextRequest, NextResponse } from 'next/server';
import { createBaseMainnetProvider } from '@/lib/utils/rpc-provider';
import { inspectCLPool } from '@/lib/contracts/aerodrome-locker';

/**
 * GET /api/admin/pools/[address]/inspect
 * Query Aerodrome CL pool fee (and optional locker beneficiary) via QuickNode/configured RPC.
 * Query: locker=0x... to include locker inspection (beneficiary, beneficiaryShare, bribeableShare, lockedUntil).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const poolAddress = address?.trim();
    if (!poolAddress || !poolAddress.startsWith('0x') || poolAddress.length !== 42) {
      return NextResponse.json(
        { success: false, error: 'Valid pool address (0x...) required' },
        { status: 400 },
      );
    }

    const lockerAddress = request.nextUrl.searchParams.get('locker')?.trim() || undefined;
    const provider = createBaseMainnetProvider();
    const inspection = await inspectCLPool(provider, poolAddress, {
      lockerAddress: lockerAddress || null,
      chainId: 8453,
    });

    return NextResponse.json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    console.error('[ADMIN] Pool inspect failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inspect pool',
      },
      { status: 500 },
    );
  }
}
