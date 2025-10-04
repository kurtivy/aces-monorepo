import { PrismaClient, TokenPhase, TokenPriceSource } from '@prisma/client';
import { AerodromeDataService } from '../../services/aerodrome-data-service';
import { createProvider, getNetworkConfig } from '../../config/network.config';

interface VercelRequest {
  method: string;
  headers: { [key: string]: string | string[] | undefined };
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

const prisma = new PrismaClient();

const mainnetConfig = getNetworkConfig(8453);
const provider = createProvider(8453);

const aerodromeService = (() => {
  try {
    if (!mainnetConfig.aerodromeFactory || !mainnetConfig.acesToken) {
      return null;
    }

    return new AerodromeDataService({
      provider: provider ?? undefined,
      rpcUrl: provider ? undefined : mainnetConfig.rpcUrl,
      factoryAddress: mainnetConfig.aerodromeFactory,
      acesTokenAddress: mainnetConfig.acesToken,
      apiBaseUrl: process.env.AERODROME_API_BASE_URL,
      apiKey: process.env.AERODROME_API_KEY,
      defaultStable: process.env.AERODROME_DEFAULT_STABLE === 'true',
      mockEnabled:
        process.env.USE_DEX_MOCKS === 'true' ||
        !mainnetConfig.rpcUrl ||
        !mainnetConfig.aerodromeRouter,
    });
  } catch (error) {
    console.error('[LP CRON] Failed to initialise AerodromeDataService', error);
    return null;
  }
})();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    await prisma.$disconnect();
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isVercelCron = Boolean(req.headers['x-vercel-cron']);
  if (!isVercelCron) {
    const cronSecret = req.headers['x-vercel-cron-signature'] || req.headers.authorization;
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      await prisma.$disconnect();
      return res.status(401).json({ error: 'Unauthorized cron caller' });
    }
  }

  if (process.env.ENABLE_LP_AUTOMATION !== 'true') {
    await prisma.$disconnect();
    return res.status(200).json({
      message: 'LP automation disabled',
      timestamp: new Date().toISOString(),
    });
  }

  if (!aerodromeService) {
    await prisma.$disconnect();
    return res.status(500).json({
      error: 'Aerodrome service unavailable',
      timestamp: new Date().toISOString(),
    });
  }

  const start = Date.now();
  const summary = {
    checked: 0,
    bonded: 0,
    updated: 0,
    missingPools: 0,
    failures: 0,
    details: [] as Array<{ address: string; status: string; info?: string }>,
  };

  try {
    const candidateTokens = await prisma.token.findMany({
      where: {
        priceSource: TokenPriceSource.BONDING_CURVE,
        phase: TokenPhase.BONDING_CURVE,
        poolAddress: null,
        chainId: 8453,
      },
      select: {
        contractAddress: true,
        symbol: true,
      },
    });

    if (candidateTokens.length === 0) {
      return res.status(200).json({
        message: 'No tokens require LP sync',
        durationMs: Date.now() - start,
        summary,
      });
    }

    const bondedStatuses = await fetchBondedStatuses(
      candidateTokens.map((token) => token.contractAddress),
    );

    for (const token of candidateTokens) {
      const address = token.contractAddress.toLowerCase();
      summary.checked += 1;

      const status = bondedStatuses[address];
      if (!status?.bonded) {
        summary.details.push({ address, status: 'pending' });
        continue;
      }

      summary.bonded += 1;

      try {
        const poolState = await aerodromeService.getPoolState(address);
        if (!poolState) {
          summary.missingPools += 1;
          summary.details.push({ address, status: 'bonded_no_pool' });
          continue;
        }

        await prisma.token.update({
          where: { contractAddress: address },
          data: {
            phase: TokenPhase.DEX_TRADING,
            priceSource: TokenPriceSource.DEX,
            poolAddress: poolState.poolAddress.toLowerCase(),
            dexLiveAt: new Date(),
          },
        });

        summary.updated += 1;
        summary.details.push({ address, status: 'updated', info: poolState.poolAddress });
      } catch (poolError) {
        summary.failures += 1;
        summary.details.push({
          address,
          status: 'error',
          info: poolError instanceof Error ? poolError.message : 'Unknown error',
        });
      }
    }

    return res.status(200).json({
      message: 'LP sync complete',
      durationMs: Date.now() - start,
      summary,
    });
  } catch (error) {
    console.error('[LP CRON] Fatal error', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function fetchBondedStatuses(addresses: string[]) {
  if (!process.env.GOLDSKY_SUBGRAPH_URL) {
    throw new Error('GOLDSKY_SUBGRAPH_URL not configured');
  }

  const uniqueAddresses = Array.from(new Set(addresses.map((addr) => addr.toLowerCase())));
  const batchSize = 25;
  const result: Record<string, { bonded: boolean }> = {};

  for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
    const batch = uniqueAddresses.slice(i, i + batchSize);

    const query = `
      query ($addresses: [String!]) {
        tokens(where: { address_in: $addresses }) {
          address
          bonded
        }
      }
    `;

    const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { addresses: batch } }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const json = (await response.json()) as any;
    if (json.errors) {
      throw new Error(`Subgraph errors: ${JSON.stringify(json.errors)}`);
    }

    const tokens = json.data?.tokens ?? [];
    for (const token of tokens) {
      result[(token.address as string).toLowerCase()] = { bonded: token.bonded };
    }
  }

  return result;
}
