// backend/services/supply-tracking-service.ts (COMPLETE FILE WITH ALL UPDATES)

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

interface SupplyData {
  circulatingSupply: string;
  totalSupply: string;
  blockNumber?: number;
}

export class SupplyTrackingService {
  constructor(
    private prisma: PrismaClient,
    private provider: ethers.Provider,
  ) {}

  /**
   * Get supply at a specific timestamp
   * First checks database, then falls back to subgraph, then on-chain query
   */
  async getSupplyAtTimestamp(tokenAddress: string, timestamp: Date): Promise<SupplyData> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Try to get from database first (cached snapshot)
    const snapshot = await this.getSupplySnapshot(normalizedAddress, timestamp);
    if (snapshot) {
      return {
        circulatingSupply: snapshot.circulatingSupply,
        totalSupply: snapshot.totalSupply,
        blockNumber: snapshot.blockNumber || undefined,
      };
    }

    // Fallback: Try to get from subgraph (trade data)
    const subgraphSupply = await this.getSupplyFromSubgraph(normalizedAddress, timestamp);
    if (subgraphSupply) {
      // Cache this for future use
      await this.storeSupplySnapshot(
        normalizedAddress,
        timestamp,
        subgraphSupply.circulatingSupply,
        subgraphSupply.totalSupply,
        subgraphSupply.blockNumber,
      );
      return subgraphSupply;
    }

    // Last resort: Get current supply (not historical, but better than nothing)
    console.warn(
      `[SupplyTracking] No historical data for ${tokenAddress} at ${timestamp}, using current supply`,
    );
    return await this.getCurrentSupplyOnChain(normalizedAddress);
  }

  /**
   * Get current supply directly from blockchain
   * UPDATED: Prefer subgraph, fallback to on-chain
   */
  async getCurrentSupplyOnChain(tokenAddress: string): Promise<SupplyData> {
    try {
      // First try to get from subgraph (cheaper and more reliable)
      const subgraphSupply = await this.getSupplyFromSubgraph(
        tokenAddress.toLowerCase(),
        new Date(),
      );

      if (subgraphSupply) {
        console.log('[SupplyTracking] Got supply from subgraph');
        return subgraphSupply;
      }

      // Only query on-chain if subgraph fails
      console.log('[SupplyTracking] Querying on-chain as fallback...');

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function totalSupply() view returns (uint256)'],
        this.provider,
      );

      const factoryAddress =
        process.env.AERODROME_FACTORY_ADDRESS || '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';
      const factoryContract = new ethers.Contract(
        factoryAddress,
        [
          'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination, uint256 tokensBondedAt, bool tokenBonded)',
        ],
        this.provider,
      );

      const [totalSupplyBN, tokenData] = await Promise.all([
        tokenContract.totalSupply(),
        factoryContract.tokens(tokenAddress),
      ]);

      const circulatingSupply = ethers.formatEther(totalSupplyBN);
      const bondingTarget = ethers.formatEther(tokenData[6]); // tokensBondedAt
      const isBonded = tokenData[7]; // tokenBonded

      return {
        circulatingSupply,
        totalSupply: isBonded ? circulatingSupply : bondingTarget,
      };
    } catch (error) {
      console.error('[SupplyTracking] On-chain query failed:', error);
      // Return safe defaults - this is better than crashing
      return {
        circulatingSupply: '0',
        totalSupply: '30000000', // Default bonding target
      };
    }
  }

  /**
   * Get supply from database snapshot (near timestamp)
   */
  private async getSupplySnapshot(
    tokenAddress: string,
    timestamp: Date,
  ): Promise<{
    circulatingSupply: string;
    totalSupply: string;
    blockNumber: number | null;
  } | null> {
    try {
      // Find snapshot closest to the requested timestamp (within 1 hour)
      const oneHourBefore = new Date(timestamp.getTime() - 60 * 60 * 1000);
      const oneHourAfter = new Date(timestamp.getTime() + 60 * 60 * 1000);

      const snapshot = await this.prisma.tokenSupplySnapshot.findFirst({
        where: {
          contractAddress: tokenAddress,
          timestamp: {
            gte: oneHourBefore,
            lte: oneHourAfter,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      if (snapshot) {
        return {
          circulatingSupply: snapshot.circulatingSupply,
          totalSupply: snapshot.totalSupply,
          blockNumber: snapshot.blockNumber,
        };
      }

      return null;
    } catch (error) {
      console.error('[SupplyTracking] Database query failed:', error);
      return null;
    }
  }

  /**
   * Get supply from subgraph (trade history)
   * UPDATED: Better error handling and fallbacks
   */
  private async getSupplyFromSubgraph(
    tokenAddress: string,
    timestamp: Date,
  ): Promise<SupplyData | null> {
    try {
      const timestampSec = Math.floor(timestamp.getTime() / 1000);

      const query = `{
        trades(
          where: {
            token: "${tokenAddress}",
            createdAt_lte: ${timestampSec}
          }
          orderBy: createdAt
          orderDirection: desc
          first: 1
        ) {
          id
          tokenSupply
          blockNumber
          createdAt
        }
        tokens(where: {address: "${tokenAddress}"}) {
          tokensBondedAt
          bonded
          supply
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.warn('[SupplyTracking] Subgraph request failed:', response.status);
        return null;
      }

      const data = (await response.json()) as any;

      // Check if we have token data
      const token = data.data?.tokens?.[0];

      if (!token) {
        console.warn('[SupplyTracking] Token not found in subgraph:', tokenAddress);
        return null;
      }

      // If we have a recent trade, use its supply
      if (data.data?.trades?.[0]) {
        const trade = data.data.trades[0];
        return {
          circulatingSupply: trade.tokenSupply || token.supply || '0',
          totalSupply: token.bonded
            ? trade.tokenSupply || token.supply || '0'
            : token.tokensBondedAt || '30000000',
          blockNumber: parseInt(trade.blockNumber),
        };
      }

      // No trades yet, use token's current supply
      if (token.supply) {
        return {
          circulatingSupply: token.supply,
          totalSupply: token.bonded ? token.supply : token.tokensBondedAt || '30000000',
        };
      }

      return null;
    } catch (error) {
      console.error('[SupplyTracking] Subgraph query failed:', error);
      return null;
    }
  }

  /**
   * Store supply snapshot for caching
   */
  async storeSupplySnapshot(
    tokenAddress: string,
    timestamp: Date,
    circulatingSupply: string,
    totalSupply: string,
    blockNumber?: number,
    tradeId?: string,
  ): Promise<void> {
    try {
      await this.prisma.tokenSupplySnapshot.upsert({
        where: {
          contractAddress_timestamp: {
            contractAddress: tokenAddress,
            timestamp,
          },
        },
        update: {
          circulatingSupply,
          totalSupply,
          blockNumber,
          tradeId,
        },
        create: {
          contractAddress: tokenAddress,
          timestamp,
          circulatingSupply,
          totalSupply,
          blockNumber,
          tradeId,
        },
      });
    } catch (error) {
      console.error('[SupplyTracking] Failed to store snapshot:', error);
    }
  }

  /**
   * Backfill supply snapshots for existing candles
   * UPDATED: Rate limiting and better error handling
   */
  async backfillSupplyData(tokenAddress: string): Promise<number> {
    try {
      console.log(`[SupplyTracking] Backfilling supply data for ${tokenAddress}...`);

      // Get all candles without supply data (limit to 50 per run)
      const candles = await this.prisma.tokenOHLCV.findMany({
        where: {
          contractAddress: tokenAddress.toLowerCase(),
          circulatingSupply: null,
        },
        orderBy: {
          timestamp: 'asc',
        },
        take: 50, // Limit to 50 candles per run to avoid rate limits
      });

      console.log(`[SupplyTracking] Found ${candles.length} candles to backfill (max 50 per run)`);

      if (candles.length === 0) {
        console.log('[SupplyTracking] No candles need backfilling');
        return 0;
      }

      let updated = 0;
      let failed = 0;

      for (const candle of candles) {
        try {
          const supply = await this.getSupplyAtTimestamp(tokenAddress, candle.timestamp);

          // Skip if supply is 0 (likely error)
          if (parseFloat(supply.circulatingSupply) === 0) {
            console.warn(`[SupplyTracking] Skipping candle with 0 supply at ${candle.timestamp}`);
            failed++;
            continue;
          }

          // Calculate market cap
          const priceInAces = parseFloat(candle.close);
          const marketCapAces = (parseFloat(supply.circulatingSupply) * priceInAces).toFixed(2);

          // Calculate USD market cap if we have USD price
          const marketCapUsd = candle.closeUsd
            ? (parseFloat(supply.circulatingSupply) * parseFloat(candle.closeUsd)).toFixed(2)
            : null;

          await this.prisma.tokenOHLCV.update({
            where: { id: candle.id },
            data: {
              circulatingSupply: supply.circulatingSupply,
              totalSupply: supply.totalSupply,
              marketCapAces,
              marketCapUsd,
            },
          });

          updated++;

          if (updated % 5 === 0) {
            console.log(`[SupplyTracking] Progress: ${updated}/${candles.length}`);
            // Small delay every 5 updates to avoid overwhelming subgraph
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`[SupplyTracking] Error updating candle at ${candle.timestamp}:`, error);
          failed++;

          // Stop if too many failures
          if (failed > 10) {
            console.error('[SupplyTracking] Too many failures, stopping backfill');
            break;
          }
        }
      }

      console.log(`[SupplyTracking] ✅ Backfilled ${updated} candles (${failed} failed)`);

      if (failed > 0) {
        console.log('[SupplyTracking] ⚠️  Some candles failed. Run backfill again to retry.');
      }

      return updated;
    } catch (error) {
      console.error('[SupplyTracking] Backfill failed:', error);
      throw error;
    }
  }

  /**
   * Backfill all tokens with missing supply data
   * Run this for production data population
   */
  async backfillAllTokens(maxTokens: number = 10): Promise<void> {
    try {
      console.log('[SupplyTracking] Starting backfill for all tokens...\n');

      // Get unique tokens with candles missing supply data
      const tokensNeedingBackfill = await this.prisma.tokenOHLCV.groupBy({
        by: ['contractAddress'],
        where: {
          circulatingSupply: null,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: maxTokens,
      });

      console.log(`Found ${tokensNeedingBackfill.length} tokens needing backfill\n`);

      for (let i = 0; i < tokensNeedingBackfill.length; i++) {
        const token = tokensNeedingBackfill[i];
        console.log(
          `[${i + 1}/${tokensNeedingBackfill.length}] Processing ${token.contractAddress}...`,
        );
        console.log(`   Candles to update: ${token._count.id}`);

        try {
          const updated = await this.backfillSupplyData(token.contractAddress);
          console.log(`   ✅ Updated ${updated} candles\n`);

          // Rate limit: Wait 2 seconds between tokens
          if (i < tokensNeedingBackfill.length - 1) {
            console.log('   Waiting 2 seconds before next token...\n');
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`   ❌ Error:`, error);
          console.log('   Continuing to next token...\n');
        }
      }

      console.log('✅ Backfill complete for all tokens!');
    } catch (error) {
      console.error('[SupplyTracking] Backfill all tokens failed:', error);
      throw error;
    }
  }

  /**
   * Get statistics about supply data coverage
   */
  async getSupplyCoverage(): Promise<{
    totalCandles: number;
    candlesWithSupply: number;
    candlesWithoutSupply: number;
    coveragePercentage: number;
    tokensWithSupply: number;
    tokensWithoutSupply: number;
  }> {
    try {
      const totalCandles = await this.prisma.tokenOHLCV.count();
      const candlesWithSupply = await this.prisma.tokenOHLCV.count({
        where: { circulatingSupply: { not: null } },
      });
      const candlesWithoutSupply = totalCandles - candlesWithSupply;

      const tokensWithSupply = await this.prisma.tokenOHLCV.groupBy({
        by: ['contractAddress'],
        where: { circulatingSupply: { not: null } },
      });

      const tokensWithoutSupply = await this.prisma.tokenOHLCV.groupBy({
        by: ['contractAddress'],
        where: { circulatingSupply: null },
      });

      return {
        totalCandles,
        candlesWithSupply,
        candlesWithoutSupply,
        coveragePercentage: totalCandles > 0 ? (candlesWithSupply / totalCandles) * 100 : 0,
        tokensWithSupply: tokensWithSupply.length,
        tokensWithoutSupply: tokensWithoutSupply.length,
      };
    } catch (error) {
      console.error('[SupplyTracking] Failed to get coverage stats:', error);
      throw error;
    }
  }
}
