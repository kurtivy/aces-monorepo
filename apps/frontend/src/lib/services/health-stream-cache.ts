/**
 * Shared health cache for one-shot and SSE stream routes.
 * - Per-token: at most one getTokenHealth per HEALTH_CACHE_TTL_MS (dedupe by key).
 * - Global: at most MAX_CONCURRENT_HEALTH_FETCHES getTokenHealth in flight (queue the rest).
 * Safe for Alchemy/rate limits even with hundreds of users on different tokens.
 */

import type { PrismaClient } from '@prisma/client';
import type { TokenHealthData } from '@/lib/api/token-health';
import { getTokenHealth } from './token-health';

const HEALTH_CACHE_TTL_MS = 5000; // 5 seconds - align with MarketCapService cache
const HEALTH_STALE_TTL_MS = 60000; // 1 minute - serve stale while revalidating

/** Max concurrent getTokenHealth() across all tokens — prevents RPC burst when 300 users hit different pages */
const MAX_CONCURRENT_HEALTH_FETCHES = 20;

export type HealthResponse = { success: true; data: TokenHealthData; timestamp: number };

const healthCache = new Map<string, { data: HealthResponse; timestamp: number }>();
const healthPendingRequests = new Map<string, Promise<HealthResponse>>();

/** Semaphore: limit concurrent getTokenHealth so we don't burst Alchemy when many users on different tokens */
let activeHealthFetches = 0;
const waitQueue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (activeHealthFetches < MAX_CONCURRENT_HEALTH_FETCHES) {
    activeHealthFetches++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeHealthFetches++;
      resolve();
    });
  });
}

function release(): void {
  activeHealthFetches--;
  if (waitQueue.length > 0 && activeHealthFetches < MAX_CONCURRENT_HEALTH_FETCHES) {
    const next = waitQueue.shift();
    if (next) next();
  }
}

function cacheKey(address: string, chainId: number, currency: string): string {
  return `${address.toLowerCase()}:${chainId}:${currency}`;
}

/**
 * Get token health with shared cache, per-token dedupe, and global concurrency limit.
 * - Fresh (< 5s): return cached, no RPC.
 * - Stale (< 60s): return cached, trigger one background refresh (deduped per key).
 * - Missing or very stale: await one fetch (deduped per key; waits for semaphore if at limit).
 * With 300 users: same token → 1 fetch (dedupe); 300 different tokens → max 20 in flight, rest queued.
 */
export async function getHealthCached(
  prisma: PrismaClient,
  address: string,
  chainId: number,
  currency: 'usd' | 'aces',
): Promise<HealthResponse> {
  const key = cacheKey(address, chainId, currency);
  const cached = healthCache.get(key);
  const now = Date.now();

  const fetchAndCache = async (): Promise<HealthResponse> => {
    await acquire();
    try {
      const data = await getTokenHealth(prisma, address, chainId, currency);
      const response: HealthResponse = {
        success: true,
        data,
        timestamp: Date.now(),
      };
      healthCache.set(key, { data: response, timestamp: Date.now() });
      return response;
    } finally {
      healthPendingRequests.delete(key);
      release();
    }
  };

  if (cached) {
    const age = now - cached.timestamp;
    if (age < HEALTH_CACHE_TTL_MS) {
      return cached.data;
    }
    if (age < HEALTH_STALE_TTL_MS) {
      if (!healthPendingRequests.has(key)) {
        const promise = fetchAndCache();
        healthPendingRequests.set(key, promise);
        promise.catch((err) => console.error('[HealthCache] Background refresh failed:', err));
      }
      return cached.data;
    }
  }

  if (healthPendingRequests.has(key)) {
    return healthPendingRequests.get(key)!;
  }

  const promise = fetchAndCache();
  healthPendingRequests.set(key, promise);
  return promise;
}
