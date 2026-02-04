import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BASE_MAINNET_CHAIN_ID = 8453;

/**
 * GET /api/tokens/list
 * Public list of active tokens from Prisma (Supabase) for profile holdings.
 * Returns only Base mainnet tokens; no auth required.
 */
export async function GET() {
  try {
    const tokens = await prisma.token.findMany({
      where: {
        isActive: true,
        chainId: BASE_MAINNET_CHAIN_ID,
      },
      orderBy: { symbol: 'asc' },
      select: {
        contractAddress: true,
        symbol: true,
        name: true,
        chainId: true,
        decimals: true,
      },
    });

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('[API] Error fetching token list:', error);
    return NextResponse.json({ error: 'Failed to fetch token list' }, { status: 500 });
  }
}
