/**
 * Shared trading-related constants for backend services.
 *
 * MIN_VISIBLE_TRADE_USD defines the minimum total USD value a trade must have
 * before we treat it as meaningful in downstream aggregation. Trades below this
 * threshold are ignored for ingestion and candle shaping to prevent micro-trades
 * (dust) from collapsing charts.
 */
const DEFAULT_MIN_VISIBLE_USD = 0.01;

const parsedThreshold = Number.parseFloat(process.env.MIN_VISIBLE_TRADE_USD || '');

export const MIN_VISIBLE_TRADE_USD =
  Number.isFinite(parsedThreshold) && parsedThreshold >= 0
    ? parsedThreshold
    : DEFAULT_MIN_VISIBLE_USD;











