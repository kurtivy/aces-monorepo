import { PrismaClient } from '@prisma/client';
import { TokenService } from '../../services/token-service';
import { OHLCVService } from '../../services/ohlcv-service';

interface VercelRequest {
  method: string;
  headers: { [key: string]: string | string[] | undefined };
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security: Only allow POST and verify it's actually a cron
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add cron secret verification
  const cronSecret = req.headers['x-vercel-cron-signature'] || req.headers.authorization;
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Allow manual disable during testing
  if (process.env.ENABLE_CRON !== 'true') {
    return res.status(200).json({
      message: 'Cron disabled',
      timestamp: new Date().toISOString(),
    });
  }

  const startTime = Date.now();
  const results = {
    processed: 0,
    errors: 0,
    skipped: 0,
    tokenResults: [] as any[],
  };

  try {
    // Optimized: Get all tokens from subgraph in ONE call
    const activeTokensFromSubgraph = await getActiveTokensFromSubgraph();

    console.log(`[CRON] Starting sync for ${activeTokensFromSubgraph.length} active tokens`);

    const tokenService = new TokenService(prisma);
    const ohlcvService = new OHLCVService(prisma, tokenService);

    // Process each active token
    for (const tokenData of activeTokensFromSubgraph) {
      try {
        await syncTokenData(tokenData, tokenService, ohlcvService);
        results.processed++;
        results.tokenResults.push({
          address: tokenData.address,
          symbol: tokenData.symbol,
          tradesCount: tokenData.tradesCount,
          status: 'success',
        });
      } catch (error) {
        console.error(`[CRON] Error syncing token ${tokenData.address}:`, error);
        results.errors++;
        results.tokenResults.push({
          address: tokenData.address,
          symbol: tokenData.symbol,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[CRON] Completed in ${duration}ms: ${results.processed} successful, ${results.errors} errors`,
    );

    res.status(200).json({
      success: true,
      message: 'Sync completed',
      duration: `${duration}ms`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Fatal sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function getActiveTokensFromSubgraph() {
  try {
    // Single query to get all tokens with activity filtering
    const query = `{
      tokens(first: 50, orderBy: tradesCount, orderDirection: desc) {
        id
        address
        name
        symbol
        tradesCount
        tokensBought
        tokensSold
        bonded
      }
    }`;

    const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const result = (await response.json()) as any;
    if (result.errors) {
      throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
    }

    const allTokens = result.data?.tokens || [];

    // Get database tokens that have been recently viewed/updated
    const recentlyViewedTokens = await getRecentlyViewedTokens();

    // Filter to only active tokens (have trades OR recently viewed)
    const activeTokens = allTokens.filter(
      (token: any) =>
        token.tradesCount > 0 || recentlyViewedTokens.includes(token.address.toLowerCase()),
    );

    console.log(
      `[CRON] Found ${activeTokens.length} active tokens out of ${allTokens.length} total`,
    );
    return activeTokens;
  } catch (error) {
    console.error('[CRON] Error fetching tokens from subgraph:', error);

    // Fallback: get recently viewed tokens from database
    const fallbackTokens = await prisma.token.findMany({
      where: {
        isActive: true,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
      },
      select: {
        contractAddress: true,
        symbol: true,
      },
    });

    return fallbackTokens.map((t) => ({
      address: t.contractAddress,
      symbol: t.symbol,
      tradesCount: 0,
    }));
  }
}

async function getRecentlyViewedTokens(): Promise<string[]> {
  // Get tokens that users have interacted with recently
  const recentTokens = await prisma.token.findMany({
    where: {
      updatedAt: {
        gte: new Date(Date.now() - 6 * 60 * 60 * 1000), // Last 6 hours
      },
    },
    select: {
      contractAddress: true,
    },
  });

  return recentTokens.map((t) => t.contractAddress.toLowerCase());
}

async function syncTokenData(
  tokenData: any,
  tokenService: TokenService,
  ohlcvService: OHLCVService,
) {
  const contractAddress = tokenData.address;

  // Skip dormant tokens unless recently viewed
  if (tokenData.tradesCount === 0) {
    console.log(`[CRON] Skipping dormant token ${tokenData.symbol} (${contractAddress})`);
    return;
  }

  // Use database transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Update the services to use the transaction client
    const txTokenService = new TokenService(tx as any);
    const txOhlcvService = new OHLCVService(tx as any, txTokenService);

    // 1. Fetch and update basic token data
    await txTokenService.fetchAndUpdateTokenData(contractAddress);

    // 2. Generate and store OHLCV data for all timeframes
    const timeframes = ['1h', '4h', '1d'];

    for (const timeframe of timeframes) {
      await txOhlcvService.generateOHLCVCandles(contractAddress, timeframe);
    }

    // 3. Update the token's lastSyncedAt timestamp
    await tx.token.update({
      where: { contractAddress: contractAddress.toLowerCase() },
      data: { updatedAt: new Date() },
    });
  });
}
