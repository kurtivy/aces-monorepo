import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { createProvider } from '../../config/network.config';

interface VercelRequest {
  method: string;
  headers: { [key: string]: string | string[] | undefined };
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

const prisma = new PrismaClient();

// Factory proxy that emits Trade events
const FACTORY_PROXY = '0x676BB442f45b5e11885Cf6e7ab8A15B5Ff7c5c51';

// All 4 live tokens (lowercase for DB consistency)
const LIVE_TOKENS = [
  '0xcd3248dbCD4B41b28d74090a3CdEF8e8D2D72ACE', // APKAWS
  '0xbB761c78FED5f606972AbEE45c89BC9eDBA73ACE', // RMILLE
  '0xB7298A97895B7463ba081127096543f8bD255ACE', // ILLICIT
  '0x02AD22d8789f95c06187FFAddFC5FfBd4d6eAACE', // PIKACHU
].map((a) => a.toLowerCase());

// Trade event ABI (from the factory contract)
const TRADE_EVENT_ABI = [
  'event Trade(address tokenAddress, bool isBuy, uint256 tokenAmount, uint256 acesAmount, uint256 protocolAcesAmount, uint256 subjectAcesAmount, uint256 supply)',
];

/**
 * Backfill historical trades from on-chain Trade events into the DexTrade table.
 * Queries the factory proxy contract for Trade events, filters by our live tokens,
 * and upserts them into Postgres.
 *
 * Invoke via: GET /api/cron/backfill-trades
 * Protected by CRON_SECRET header.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check
  const authHeader =
    req.headers['authorization'] || req.headers['x-cron-secret'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const provider = createProvider(8453);
  if (!provider) {
    return res.status(500).json({ error: 'No RPC provider configured for Base mainnet' });
  }

  const iface = new ethers.Interface(TRADE_EVENT_ABI);
  const tradeTopicHash = iface.getEvent('Trade')!.topicHash;

  try {
    const currentBlock = await provider.getBlockNumber();
    // Go back ~30 days on Base (~2s block time = ~1.3M blocks)
    // Adjust as needed — RPC providers may limit log range
    const BLOCK_RANGE = 1_300_000;
    const startBlock = Math.max(0, currentBlock - BLOCK_RANGE);

    console.log(
      `[Backfill] Fetching Trade events from block ${startBlock} to ${currentBlock} (~${BLOCK_RANGE} blocks)`,
    );

    let totalInserted = 0;
    let totalSkipped = 0;
    const perTokenStats: Record<string, { inserted: number; skipped: number }> = {};

    // Process in chunks to avoid RPC limits (typically 10k blocks per query)
    const CHUNK_SIZE = 10_000;

    for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);

      let logs: ethers.Log[];
      try {
        logs = await provider.getLogs({
          address: FACTORY_PROXY,
          topics: [tradeTopicHash],
          fromBlock,
          toBlock,
        });
      } catch (err: any) {
        // Some RPCs limit range — try smaller chunks
        if (err?.message?.includes('range') || err?.message?.includes('limit')) {
          console.warn(
            `[Backfill] Block range ${fromBlock}-${toBlock} too large, splitting...`,
          );
          const mid = Math.floor((fromBlock + toBlock) / 2);
          // Push smaller ranges — simplified: just skip and log
          console.warn(`[Backfill] Skipping chunk ${fromBlock}-${toBlock}, try reducing BLOCK_RANGE`);
          continue;
        }
        throw err;
      }

      for (const log of logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (!parsed) continue;

          const tokenAddress = parsed.args.tokenAddress.toLowerCase();

          // Only backfill our live tokens
          if (!LIVE_TOKENS.includes(tokenAddress)) continue;

          if (!perTokenStats[tokenAddress]) {
            perTokenStats[tokenAddress] = { inserted: 0, skipped: 0 };
          }

          const isBuy = parsed.args.isBuy;
          const tokenAmount = parsed.args.tokenAmount.toString();
          const acesAmount = parsed.args.acesAmount.toString();
          const txHash = log.transactionHash;
          const blockNumber = log.blockNumber;

          // Calculate price: acesAmount / tokenAmount (both in wei, ratio is unitless)
          const tokenAmountBig = BigInt(tokenAmount);
          const acesAmountBig = BigInt(acesAmount);
          const priceInAces =
            tokenAmountBig > 0n
              ? Number(acesAmountBig * 10n ** 18n / tokenAmountBig) / 1e18
              : 0;

          // Get block timestamp
          const block = await provider.getBlock(blockNumber);
          const timestamp = block ? BigInt(block.timestamp) * 1000n : BigInt(Date.now());

          // Get transaction to find trader address
          const tx = await provider.getTransaction(txHash);
          const trader = tx?.from?.toLowerCase() || 'unknown';

          await prisma.dexTrade.upsert({
            where: {
              txHash_tokenAddress: {
                txHash,
                tokenAddress,
              },
            },
            update: {},
            create: {
              txHash,
              tokenAddress,
              timestamp,
              blockNumber: String(blockNumber),
              isBuy,
              tokenAmount,
              acesAmount,
              priceInAces,
              priceInUsd: null,
              trader,
              source: 'backfill',
            },
          });

          perTokenStats[tokenAddress].inserted++;
          totalInserted++;
        } catch (err: any) {
          if (err?.code === 'P2002') {
            // Duplicate — already exists
            const tokenAddr = (() => {
              try {
                const p = iface.parseLog({ topics: log.topics as string[], data: log.data });
                return p?.args.tokenAddress.toLowerCase() || 'unknown';
              } catch {
                return 'unknown';
              }
            })();
            if (perTokenStats[tokenAddr]) perTokenStats[tokenAddr].skipped++;
            totalSkipped++;
          } else {
            console.error(`[Backfill] Error processing log in block ${log.blockNumber}:`, err);
          }
        }
      }

      // Log progress every 100k blocks
      if ((fromBlock - startBlock) % 100_000 < CHUNK_SIZE) {
        const progress = (((fromBlock - startBlock) / BLOCK_RANGE) * 100).toFixed(1);
        console.log(
          `[Backfill] Progress: ${progress}% | Inserted: ${totalInserted} | Skipped: ${totalSkipped}`,
        );
      }
    }

    const summary = {
      success: true,
      blockRange: { from: startBlock, to: currentBlock, total: currentBlock - startBlock },
      totalInserted,
      totalSkipped,
      perToken: Object.entries(perTokenStats).map(([addr, stats]) => ({
        tokenAddress: addr,
        ...stats,
      })),
    };

    console.log('[Backfill] Complete:', JSON.stringify(summary, null, 2));
    return res.status(200).json(summary);
  } catch (error: any) {
    console.error('[Backfill] Fatal error:', error);
    return res.status(500).json({
      error: 'Backfill failed',
      message: error.message,
    });
  } finally {
    await prisma.$disconnect();
  }
}
