import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/route-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateTokenSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  chainId: z.number().int().positive().default(8453),
  totalSupply: z.string().optional(), // For fixed supply tokens
  decimals: z.string().optional(), // For verification
  isFixedSupply: z.boolean().optional().default(false), // Flag for fixed supply tokens
});

/**
 * POST /api/admin/tokens/create - Store token in database after on-chain creation.
 * Any authenticated user can register a token they deployed.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { contractAddress, symbol, name, chainId, isFixedSupply } = CreateTokenSchema.parse(body);

    console.log(`[TOKEN] Creating token record: ${contractAddress}`);

    // Check if token already exists
    const existing = await prisma.token.findUnique({
      where: { contractAddress: contractAddress.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token already exists',
          message: `Token with address ${contractAddress} already exists in database`,
        },
        { status: 400 },
      );
    }

    // Create token record
    // For fixed supply tokens, use DEX_TRADING phase since they don't use bonding curves
    // If no DEX pool exists yet, it will remain at DEX_TRADING but with no price source
    const token = await prisma.token.create({
      data: {
        contractAddress: contractAddress.toLowerCase(),
        symbol,
        name,
        chainId,
        currentPrice: '0',
        currentPriceACES: '0',
        volume24h: '0',
        // Fixed supply tokens don't use bonding curves - they're either on DEX or not trading yet
        // Set to DEX_TRADING phase, but priceSource will be BONDING_CURVE until a pool is created
        phase: isFixedSupply ? 'DEX_TRADING' : 'BONDING_CURVE',
        priceSource: 'BONDING_CURVE', // Will update to DEX when pool is created
        isActive: true,
      },
    });

    console.log(`[TOKEN] Token created successfully: ${token.symbol}`);

    return NextResponse.json({
      success: true,
      message: `Token ${token.symbol} created successfully`,
      data: {
        contractAddress: token.contractAddress,
        symbol: token.symbol,
        name: token.name,
        chainId: token.chainId,
      },
    });
  } catch (error) {
    console.error('[TOKEN] Error creating token:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
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
        error: 'Failed to create token',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
