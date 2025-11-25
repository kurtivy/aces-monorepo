/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Cache helper utilities for chart aggregation service.
 */

const TIMEFRAME_BUCKET_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

const RECENT_RANGE_THRESHOLD_MS = 60 * 1000; // 60 seconds
const CACHE_KEY_PREFIX = 'chart';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

export interface CacheOptions {
  maxSize?: number;
}

export interface CacheKeyParams {
  tokenAddress: string;
  timeframe: string;
  from: Date;
  to: Date;
}

function normalizeTimeframe(timeframe: string): string {
  const normalized = timeframe.toLowerCase();
  if (!TIMEFRAME_BUCKET_MS[normalized]) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }
  return normalized;
}

function ensureValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
}

function ensureValidToken(tokenAddress: string): void {
  if (!tokenAddress || typeof tokenAddress !== 'string') {
    throw new Error('Token address required');
  }
}

export function bucketTimestamp(date: Date, timeframe: string): number {
  ensureValidDate(date);
  const normalizedTf = normalizeTimeframe(timeframe);
  const bucketSize = TIMEFRAME_BUCKET_MS[normalizedTf];
  const ms = date.getTime();
  return Math.floor(ms / bucketSize) * bucketSize;
}

export function getCacheKey(
  tokenAddress: string,
  timeframe: string,
  from: Date,
  to: Date,
): string {
  ensureValidToken(tokenAddress);
  ensureValidDate(from);
  ensureValidDate(to);

  if (from.getTime() > to.getTime()) {
    throw new Error('Invalid date range: from must be before to');
  }

  const normalizedToken = tokenAddress.toLowerCase();
  const normalizedTf = normalizeTimeframe(timeframe);
  const bucketedFrom = bucketTimestamp(from, normalizedTf);
  const bucketedTo = bucketTimestamp(to, normalizedTf);

  return `${CACHE_KEY_PREFIX}:${normalizedToken}:${normalizedTf}:${bucketedFrom}:${bucketedTo}`;
}

export function isCacheable(from: Date, to: Date, now: number = Date.now()): boolean {
  ensureValidDate(from);
  ensureValidDate(to);

  if (from.getTime() > to.getTime()) {
    return false;
  }

  const timeUntilNow = now - to.getTime();
  return timeUntilNow > RECENT_RANGE_THRESHOLD_MS;
}

export function invalidateCacheForToken<T>(
  tokenAddress: string,
  cache: Map<string, CacheEntry<T>>,
): void {
  if (!tokenAddress) return;
  const normalized = tokenAddress.toLowerCase();
  const keysToDelete: string[] = [];

  cache.forEach((_value, key) => {
    const [, token] = key.split(':');
    if (token === normalized) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => cache.delete(key));
}

export function getCacheEntry<T>(
  cache: Map<string, CacheEntry<T>>,
  tokenAddress: string,
  timeframe: string,
  from: Date,
  to: Date,
): CacheEntry<T> | undefined {
  const key = getCacheKey(tokenAddress, timeframe, from, to);
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  // Mark as recently used for LRU policy
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function setCacheEntry<T>(
  cache: Map<string, CacheEntry<T>>,
  tokenAddress: string,
  timeframe: string,
  from: Date,
  to: Date,
  entry: CacheEntry<T>,
  options: CacheOptions = {},
): void {
  const key = getCacheKey(tokenAddress, timeframe, from, to);
  cache.set(key, entry);

  const maxSize = options.maxSize ?? Infinity;
  if (cache.size > maxSize) {
    const excess = cache.size - maxSize;
    for (let i = 0; i < excess; i++) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (!firstKey) break;
      cache.delete(firstKey);
    }
  }
}

export function clearCache(cache: Map<string, CacheEntry>, tokenAddress?: string): void {
  if (!tokenAddress) {
    cache.clear();
    return;
  }

  invalidateCacheForToken(tokenAddress, cache);
}

export function getPendingRequestKey(params: CacheKeyParams): string {
  const { tokenAddress, timeframe, from, to } = params;
  const normalizedToken = tokenAddress.toLowerCase();
  const normalizedTf = normalizeTimeframe(timeframe);
  const bucketedFrom = bucketTimestamp(from, normalizedTf);
  const bucketedTo = bucketTimestamp(to, normalizedTf);
  return `${normalizedToken}:${normalizedTf}:${bucketedFrom}:${bucketedTo}`;
}

export async function coalesceRequest<T>(
  pending: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = pending.get(key);
  if (existing) {
    return existing;
  }

  const promise = factory()
    .then((result) => {
      pending.delete(key);
      return result;
    })
    .catch((error) => {
      pending.delete(key);
      throw error;
    });

  pending.set(key, promise);
  return promise;
}

