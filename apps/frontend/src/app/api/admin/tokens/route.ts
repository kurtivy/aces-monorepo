import { NextRequest, NextResponse } from 'next/server';
import { requireAdminConvex } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const AddTokenSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

/**
 * GET /api/admin/tokens - List all tokens
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminConvex(request);

    const tokens = await prisma.token.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        contractAddress: true,
        symbol: true,
        name: true,
        currentPrice: true,
        currentPriceACES: true,
        volume24h: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        listingId: true,
        listing: {
          select: {
            id: true,
            title: true,
            symbol: true,
            isLive: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: tokens.length,
      data: tokens,
    });
  } catch (error) {
    console.error('[ADMIN] Error fetching tokens:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tokens',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/tokens - Add token to database
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminConvex(request);

    const body = await request.json();
    const { contractAddress } = AddTokenSchema.parse(body);

    console.log(`[ADMIN] Adding token: ${contractAddress}`);

    // Get or create token
    let token = await prisma.token.findUnique({
      where: { contractAddress: contractAddress.toLowerCase() },
    });

    if (!token) {
      token = await prisma.token.create({
        data: {
          contractAddress: contractAddress.toLowerCase(),
          symbol: 'UNKNOWN',
          name: 'Loading...',
          currentPrice: '0',
          currentPriceACES: '0',
          volume24h: '0',
          chainId: 8453,
          priceSource: 'BONDING_CURVE',
        },
      });
    }

    // TODO: Fetch token data from blockchain/subgraph
    // For now, just return the token

    const updatedToken = await prisma.token.findUnique({
      where: { contractAddress: contractAddress.toLowerCase() },
      select: {
        contractAddress: true,
        symbol: true,
        name: true,
        currentPrice: true,
        currentPriceACES: true,
        volume24h: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`[ADMIN] Token added successfully: ${updatedToken?.symbol}`);

    return NextResponse.json({
      success: true,
      message: `Token ${updatedToken?.symbol} (${updatedToken?.name}) added successfully`,
      data: {
        contractAddress: updatedToken!.contractAddress,
        symbol: updatedToken!.symbol,
        name: updatedToken!.name,
        currentPrice: updatedToken!.currentPrice,
        currentPriceACES: updatedToken!.currentPriceACES,
        volume24h: updatedToken?.volume24h || '0',
        createdAt: updatedToken!.createdAt,
        updatedAt: updatedToken!.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Error adding token:', error);

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
        error: 'Failed to add token',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
