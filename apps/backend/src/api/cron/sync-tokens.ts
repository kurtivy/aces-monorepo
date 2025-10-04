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
  // Vercel Cron uses GET with the x-vercel-cron header; allow POST for manual runs
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const vercelCronHeader = req.headers['x-vercel-cron'];
  const isVercelCron = Boolean(vercelCronHeader);

  // Guard against unexpected callers; Vercel cron always includes the header
  if (!isVercelCron) {
    const cronSecret = req.headers['x-vercel-cron-signature'] || req.headers.authorization;
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized cron caller' });
    }
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

    // Track efficiency metrics
    let tokensWithActivity = 0;
    let tokensRecentlyViewed = 0;
    let tokensSkipped = 0;

    // Process each active token
    for (const tokenData of activeTokensFromSubgraph) {
      try {
        const result = await syncTokenData(tokenData, tokenService, ohlcvService);

        if (result.processed) {
          results.processed++;
          if (result.reason === 'active') tokensWithActivity++;
          if (result.reason === 'recently_viewed') tokensRecentlyViewed++;

          results.tokenResults.push({
            address: tokenData.address,
            symbol: tokenData.symbol,
            tradesCount: tokenData.tradesCount,
            status: 'success',
            reason: result.reason,
          });
        } else {
          tokensSkipped++;
          results.skipped++;
          results.tokenResults.push({
            address: tokenData.address,
            symbol: tokenData.symbol,
            tradesCount: tokenData.tradesCount,
            status: 'skipped',
            reason: result.reason,
          });
        }
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
    const efficiencyGain =
      tokensSkipped > 0 ? Math.round((tokensSkipped / activeTokensFromSubgraph.length) * 100) : 0;

    console.log(
      `[CRON] Completed in ${duration}ms: ${results.processed} successful, ${results.errors} errors`,
    );
    console.log(
      `[CRON] Efficiency: ${tokensSkipped} tokens skipped (${efficiencyGain}% reduction in API calls)`,
    );
    console.log(
      `[CRON] Activity breakdown: ${tokensWithActivity} active, ${tokensRecentlyViewed} recently viewed`,
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
): Promise<{ processed: boolean; reason: string }> {
  const contractAddress = tokenData.address;

  // Enhanced filtering: Only sync tokens with recent activity OR recently viewed
  const hasRecentActivity = tokenData.tradesCount > 0;
  const isRecentlyViewed = await isTokenRecentlyViewed(contractAddress);

  if (!hasRecentActivity && !isRecentlyViewed) {
    console.log(`[CRON] Skipping inactive token ${tokenData.symbol} (${contractAddress})`);
    return { processed: false, reason: 'inactive' };
  }

  // Use database transaction for atomicity
  await prisma.$transaction(
    async (tx) => {
      // Update the services to use the transaction client
      const txTokenService = new TokenService(tx as any);
      const txOhlcvService = new OHLCVService(tx as any, txTokenService);

      // 1. Update basic token data
      await txTokenService.fetchAndUpdateTokenData(contractAddress);

      // 2. Generate cached data for ALL active timeframes
      const allTimeframes = ['1m', '5m', '15m', '1h', '4h']; // Added minute timeframes

      for (const timeframe of allTimeframes) {
        // Use enhanced service with smart caching - will only generate if cache is stale
        await txOhlcvService.generateOHLCVCandles(contractAddress, timeframe);
        console.log(`[CRON] Generated ${timeframe} candles for ${tokenData.symbol}`);
      }

      // 3. Update timestamp
      await tx.token.update({
        where: { contractAddress: contractAddress.toLowerCase() },
        data: { updatedAt: new Date() },
      });
    },
    {
      timeout: 90000, // 90 seconds timeout to handle all 5 timeframes
    },
  );

  // Return success with reason
  const reason = hasRecentActivity ? 'active' : 'recently_viewed';
  return { processed: true, reason };
}

// Enhanced helper function for better token filtering
async function isTokenRecentlyViewed(tokenAddress: string): Promise<boolean> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const recentToken = await prisma.token.findFirst({
    where: {
      contractAddress: tokenAddress.toLowerCase(),
      updatedAt: { gte: sixHoursAgo },
    },
  });

  return !!recentToken;
}
