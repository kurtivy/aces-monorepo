// FUTURE: Replace GeckoTerminal with self-hosted OHLCV built from tradeSyncer data.
// tradeSyncer already captures every swap into Convex — a query that buckets trades
// by time interval would give full control over all timeframes (including sub-hourly),
// work for any pool type (V2/CL), and remove the dependency on GeckoTerminal indexing.
const BASE_URL = "https://api.geckoterminal.com/api/v2";
const NETWORK = "base";

export interface OhlcvCandle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Sub-hourly timeframes (1m/5m/15m) removed — GeckoTerminal only retains
// a short window of minute-level data, so sparse tokens return 1-2 candles
// even though hourly/daily data has full history.
export type Timeframe = "1h" | "4h" | "1d";

const TIMEFRAME_CONFIG: Record<
  Timeframe,
  { period: "hour" | "day"; aggregate: number; limit: number }
> = {
  "1h": { period: "hour", aggregate: 1, limit: 1000 },  // ~42 days — high limit for sparse tokens
  "4h": { period: "hour", aggregate: 4, limit: 180 },   // ~30 days
  "1d": { period: "day", aggregate: 1, limit: 365 },    // ~1 year
};

/**
 * Looks up the top liquidity pool for a given token on Base.
 * Returns the pool address string, or null if not found.
 */
export async function fetchPoolAddress(
  tokenAddress: string,
): Promise<string | null> {
  const url = `${BASE_URL}/networks/${NETWORK}/tokens/${tokenAddress}/pools?page=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const pools = json?.data;
  if (!Array.isArray(pools) || pools.length === 0) return null;

  // First pool is highest liquidity by default
  const poolId: string = pools[0].id; // format: "base_0x..."
  return poolId.replace(`${NETWORK}_`, "");
}

/**
 * Fetches OHLCV candle data for a pool on Base.
 * Returns candles sorted ascending by time (oldest first).
 */
export async function fetchOhlcv(
  poolAddress: string,
  timeframe: Timeframe,
): Promise<OhlcvCandle[]> {
  const { period, aggregate, limit } = TIMEFRAME_CONFIG[timeframe];
  // currency=token returns price in the quote token (ACES), not USD.
  // RWA tokens trade against ACES, so USD-denominated OHLCV is extremely sparse
  // while token-denominated data captures every swap.
  const url =
    `${BASE_URL}/networks/${NETWORK}/pools/${poolAddress}/ohlcv/${period}` +
    `?aggregate=${aggregate}&limit=${limit}&currency=token`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const json = await res.json();
  const list: number[][] = json?.data?.attributes?.ohlcv_list;
  if (!Array.isArray(list) || list.length === 0) return [];

  // API returns descending — reverse for chart (oldest first)
  const candles = list
    .map(([timestamp, open, high, low, close, volume]) => ({
      time: timestamp as number,
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
      volume: volume as number,
    }))
    .reverse();

  // Deduplicate by timestamp (keep last occurrence) and filter invalid values
  const seen = new Map<number, OhlcvCandle>();
  for (const c of candles) {
    if (!Number.isFinite(c.open) || !Number.isFinite(c.close)) continue;
    if (!Number.isFinite(c.high) || !Number.isFinite(c.low)) continue;
    seen.set(c.time, c);
  }

  return Array.from(seen.values()).sort((a, b) => a.time - b.time);
}
