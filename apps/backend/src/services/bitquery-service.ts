import {
  getBitQueryConfig,
  BITQUERY_QUERIES,
  BASE_NETWORK,
  ACES_TOKEN_ADDRESS,
  TIMEFRAME_TO_SECONDS,
} from '../config/bitquery.config';
export class BitQueryPaymentRequiredError extends Error {
  constructor(message: string = 'BitQuery payment required') {
    super(message);
    this.name = 'BitQueryPaymentRequiredError';
  }
}

import type {
  BitQuerySwap,
  BitQueryCandle,
  BitQueryPoolState,
  BitQueryResponse,
  BitQueryTradingResponse,
  TradingTokensResponse,
  TradingTokensOHLC,
  LatestPriceResponse,
} from '../types/bitquery.types';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class BitQueryService {
  private config = getBitQueryConfig();
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly disabled: boolean;

  constructor() {
    console.log(
      '[BitQueryService Constructor] DISABLE_BITQUERY env var:',
      process.env.DISABLE_BITQUERY,
    );
    console.log('[BitQueryService Constructor] Type:', typeof process.env.DISABLE_BITQUERY);
    console.log(
      '[BitQueryService Constructor] Comparison result:',
      process.env.DISABLE_BITQUERY === 'true',
    );
    this.disabled = process.env.DISABLE_BITQUERY === 'true';
    if (this.disabled) {
      console.log('🚫 BitQuery service DISABLED via DISABLE_BITQUERY=true');
    } else {
      console.log('⚠️  BitQuery service is ENABLED');
    }
  }

  /**
   * Fetch recent swaps for a token pair
   */
  async getRecentSwaps(
    tokenAddress: string,
    poolAddress: string,
    options: {
      since?: Date;
      limit?: number;
    } = {},
  ): Promise<BitQuerySwap[]> {
    if (this.disabled) {
      console.log('[BitQuery] ⏸️  Skipping getRecentSwaps (service disabled)');
      return [];
    }

    console.log('[BitQuery] Fetching recent swaps:', {
      tokenAddress,
      poolAddress,
      since: options.since,
      limit: options.limit || 100,
    });

    const cacheKey = `swaps:${poolAddress}:${options.since?.getTime() || 'all'}`;
    const cached = this.getFromCache<BitQuerySwap[]>(cacheKey);
    if (cached) {
      console.log(`[BitQuery] ✅ Returning ${cached.length} cached swaps`);
      return cached;
    }

    try {
      const queryVariables: any = {
        network: BASE_NETWORK,
        poolAddress: poolAddress.toLowerCase(),
        limit: options.limit || 100,
      };

      // Only include since parameter if it's provided
      if (options.since) {
        queryVariables.since = options.since.toISOString();
      }

      // Create query based on whether since parameter is provided
      const queryToUse = options.since
        ? BITQUERY_QUERIES.GET_RECENT_SWAPS
        : BITQUERY_QUERIES.GET_RECENT_SWAPS_NO_SINCE;

      console.log('[BitQuery] Querying BitQuery API for swaps...');
      const response = await this.queryBitQuery<any>(queryToUse, queryVariables);

      const trades = response.data.EVM.DEXTrades;
      console.log(`[BitQuery] ✅ Received ${trades?.length || 0} trades from BitQuery`);

      const swaps = this.normalizeSwaps(trades || [], tokenAddress);
      console.log(`[BitQuery] ✅ Normalized to ${swaps.length} swaps`);

      this.setCache(cacheKey, swaps);
      return swaps;
    } catch (error) {
      console.error('[BitQuery] ❌ Failed to fetch swaps:', error);
      throw error;
    }
  }

  /**
   * Get token trades using DEXTradeByTokens (returns actual trader addresses)
   */
  async getTokenTrades(tokenAddress: string, limit: number = 100): Promise<BitQuerySwap[]> {
    if (this.disabled) {
      console.log('[BitQuery] ⏸️  Skipping getTokenTrades (service disabled)');
      return [];
    }

    console.log('[BitQuery] Fetching token trades:', {
      tokenAddress,
      limit,
    });

    const cacheKey = `token-trades:${tokenAddress}:${limit}`;
    const cached = this.getFromCache<BitQuerySwap[]>(cacheKey);
    if (cached) {
      console.log(`[BitQuery] ✅ Returning ${cached.length} cached token trades`);
      return cached;
    }

    try {
      const queryVariables = {
        network: BASE_NETWORK,
        tokenAddress: tokenAddress.toLowerCase(),
        limit,
      };

      console.log('[BitQuery] Querying BitQuery API for token trades...');
      const response = await this.queryBitQuery<any>(
        BITQUERY_QUERIES.GET_TOKEN_TRADES,
        queryVariables,
      );

      const trades = response.data.EVM.DEXTradeByTokens;
      console.log(`[BitQuery] ✅ Received ${trades?.length || 0} trades from BitQuery`);

      if (trades && trades.length > 0) {
        console.log('[BitQuery] Sample raw trade:', JSON.stringify(trades[0], null, 2));
      }

      const swaps = this.normalizeTokenTrades(trades || [], tokenAddress);
      console.log(`[BitQuery] ✅ Normalized to ${swaps.length} swaps`);

      this.setCache(cacheKey, swaps, 5000); // Cache for 5 seconds
      return swaps;
    } catch (error) {
      console.error('[BitQuery] ❌ Failed to fetch token trades:', error);
      throw error;
    }
  }

  /**
   * Fetch OHLC candles for a timeframe
   */
  async getOHLCCandles(
    tokenAddress: string,
    poolAddress: string,
    timeframe: string,
    options: {
      from?: Date;
      to?: Date;
      counterTokenAddress?: string;
    } = {},
  ): Promise<BitQueryCandle[]> {
    if (this.disabled) {
      console.log('[BitQuery] ⏸️  Skipping getOHLCCandles (service disabled)');
      return [];
    }

    const from = options.from || new Date(Date.now() - this.getTimeframeDuration(timeframe));
    const to = options.to || new Date();
    const counterTokenAddress = (options.counterTokenAddress || ACES_TOKEN_ADDRESS).toLowerCase();

    console.log('[BitQuery] Fetching OHLC candles:', {
      tokenAddress,
      poolAddress,
      timeframe,
      from: from.toISOString(),
      to: to.toISOString(),
      counterTokenAddress,
    });

    const cacheKey = `candles:${poolAddress}:${counterTokenAddress}:${timeframe}:${from.getTime()}:${to.getTime()}`;
    const cached = this.getFromCache<BitQueryCandle[]>(cacheKey);
    if (cached) {
      console.log(`[BitQuery] ✅ Returning ${cached.length} cached candles`);
      return cached;
    }

    try {
      const intervalMinutes = this.getIntervalMinutes(timeframe);

      console.log('[BitQuery] Querying BitQuery API for OHLC data with DEXTradeByTokens...');
      const response = await this.queryBitQuery<any>(BITQUERY_QUERIES.GET_OHLC_CANDLES, {
        network: BASE_NETWORK,
        poolAddress: poolAddress.toLowerCase(),
        tokenAddress: tokenAddress.toLowerCase(),
        counterToken: counterTokenAddress,
        from: from.toISOString(),
        to: to.toISOString(),
        intervalCount: intervalMinutes,
      });

      const candleData = response.data.EVM.DEXTradeByTokens;
      console.log(
        `[BitQuery] ✅ Received ${candleData?.length || 0} pre-aggregated candles from BitQuery`,
      );

      const candles = this.normalizeAggregatedCandles(candleData || []);
      console.log(`[BitQuery] ✅ Normalized to ${candles.length} candles`);

      if (candles.length > 0) {
        console.log('[BitQuery] First candle:', {
          timestamp: candles[0].timestamp,
          open: candles[0].open,
          close: candles[0].close,
          volume: candles[0].volume,
          trades: candles[0].trades,
        });
      }

      this.setCache(cacheKey, candles);
      return candles;
    } catch (error) {
      console.error('[BitQuery] ❌ Failed to fetch candles:', error);
      throw error;
    }
  }

  /**
   * Get current pool reserves and state
   */
  async getPoolState(poolAddress: string): Promise<BitQueryPoolState | null> {
    if (this.disabled) {
      console.log('[BitQuery] ⏸️  Skipping getPoolState (service disabled)');
      return null;
    }

    const cacheKey = `pool:${poolAddress}`;
    const cached = this.getFromCache<BitQueryPoolState>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.queryBitQuery<any>(BITQUERY_QUERIES.GET_POOL_STATE, {
        network: BASE_NETWORK,
        poolAddress: poolAddress.toLowerCase(),
      });

      // FIX: Access via response.data.EVM
      const poolState = this.normalizePoolState(response.data.EVM.BalanceUpdates, poolAddress);
      if (poolState) {
        this.setCache(cacheKey, poolState, 10000); // Cache pool state for 10s
      }
      return poolState;
    } catch (error) {
      console.error('[BitQuery] Failed to fetch pool state:', error);
      return null;
    }
  }

  /**
   * Get OHLC candles using Trading.Tokens query (more accurate USD pricing)
   */
  async getTradingTokensOHLC(
    tokenAddress: string,
    timeframe: string,
    options: {
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<BitQueryCandle[]> {
    if (this.disabled) {
      console.log('[BitQuery] ⏸️  Skipping getTradingTokensOHLC (service disabled)');
      return [];
    }

    const from = options.from || new Date(Date.now() - this.getTimeframeDuration(timeframe));
    const to = options.to || new Date();
    const intervalSeconds = TIMEFRAME_TO_SECONDS[timeframe] || this.getIntervalSeconds(timeframe);

    console.log('[BitQuery] Fetching Trading.Tokens OHLC:', {
      tokenAddress,
      timeframe,
      from: from.toISOString(),
      to: to.toISOString(),
      intervalSeconds,
    });

    const cacheKey = `trading-tokens:${tokenAddress}:${timeframe}:${from.getTime()}:${to.getTime()}`;
    const cached = this.getFromCache<BitQueryCandle[]>(cacheKey);
    if (cached) {
      console.log(`[BitQuery] ✅ Returning ${cached.length} cached Trading.Tokens candles`);
      return cached;
    }

    try {
      const response = await this.queryBitQueryTrading<TradingTokensResponse>(
        BITQUERY_QUERIES.GET_TRADING_TOKENS_OHLC,
        {
          tokenAddress: tokenAddress.toLowerCase(),
          from: from.toISOString(),
          to: to.toISOString(),
          intervalSeconds,
        },
      );

      const tokens = response.data.Trading.Tokens;
      console.log(`[BitQuery] ✅ Received ${tokens?.length || 0} Trading.Tokens candles`);

      const candles = this.normalizeTradingTokensCandles(tokens || []);
      console.log(`[BitQuery] ✅ Normalized to ${candles.length} candles`);

      this.setCache(cacheKey, candles);
      return candles;
    } catch (error) {
      console.error('[BitQuery] ❌ Failed to fetch Trading.Tokens candles:', error);
      throw error;
    }
  }

  /**
   * Get latest USD price for market cap calculation
   */
  async getLatestPriceUSD(tokenAddress: string): Promise<number | null> {
    if (this.disabled) {
      console.log('[BitQuery] ⏸️  Skipping getLatestPriceUSD (service disabled)');
      return null;
    }

    const cacheKey = `latest-price:${tokenAddress}`;
    const cached = this.getFromCache<number>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.queryBitQueryTrading<LatestPriceResponse>(
        BITQUERY_QUERIES.GET_LATEST_PRICE_USD,
        { tokenAddress: tokenAddress.toLowerCase() },
      );

      const tokens = response.data.Trading.Tokens;
      if (!tokens || tokens.length === 0) return null;

      const priceUsd = tokens[0].Price.Ohlc.Close;
      this.setCache(cacheKey, priceUsd, 5000); // Cache for 5 seconds
      return priceUsd;
    } catch (error) {
      console.error('[BitQuery] Failed to fetch latest price:', error);
      return null;
    }
  }

  /**
   * Calculate market cap: price × fixed supply (1 billion)
   */
  calculateMarketCap(priceUsd: number): string {
    const FIXED_SUPPLY = 1_000_000_000; // 1 billion
    const marketCap = priceUsd * FIXED_SUPPLY;
    return marketCap.toFixed(2);
  }

  /**
   * Execute GraphQL query with retry logic (for EVM queries)
   */
  private async queryBitQuery<T>(query: string, variables: any): Promise<BitQueryResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 402) {
            throw new BitQueryPaymentRequiredError('BitQuery HTTP 402: Payment Required');
          }
          throw new Error(`BitQuery HTTP ${response.status}: ${response.statusText}`);
        }

        // FIX: Use type assertion instead
        const data = (await response.json()) as BitQueryResponse<T>;

        if (data.errors && data.errors.length > 0) {
          throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[BitQuery] Attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelayMs * (attempt + 1)),
          );
        }
      }
    }

    throw lastError || new Error('BitQuery request failed after retries');
  }

  /**
   * Execute GraphQL query with retry logic (for Trading queries)
   */
  private async queryBitQueryTrading<T>(
    query: string,
    variables: any,
  ): Promise<BitQueryTradingResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 402) {
            throw new BitQueryPaymentRequiredError('BitQuery HTTP 402: Payment Required');
          }
          throw new Error(`BitQuery HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as BitQueryTradingResponse<T>;

        if (data.errors && data.errors.length > 0) {
          throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[BitQuery] Trading query attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelayMs * (attempt + 1)),
          );
        }
      }
    }

    throw lastError || new Error('BitQuery Trading request failed after retries');
  }

  /**
   * Normalize swap data from BitQuery response
   */
  private normalizeSwaps(trades: any[], tokenAddress: string): BitQuerySwap[] {
    const normalizedTokenAddress = tokenAddress.toLowerCase();

    return trades.map((trade) => {
      const tradeData = trade.Trade;
      const buyToken = tradeData.Buy.Currency.SmartContract.toLowerCase();
      const sellToken = tradeData.Sell.Currency.SmartContract.toLowerCase();

      // DEBUG: Log what BitQuery returns
      console.log('[BitQuery] RAW TRADE DATA:', {
        txHash: trade.Transaction.Hash,
        buyToken: buyToken,
        buySymbol: tradeData.Buy.Currency.Symbol,
        buyAmount: tradeData.Buy.Amount,
        sellToken: sellToken,
        sellSymbol: tradeData.Sell.Currency.Symbol,
        sellAmount: tradeData.Sell.Amount,
        targetToken: normalizedTokenAddress,
      });

      // BitQuery reports from POOL perspective, we need TRADER perspective
      // If pool BOUGHT token → trader SOLD token
      // If pool SOLD token → trader BOUGHT token
      const poolBoughtToken = buyToken === normalizedTokenAddress;
      const side: 'buy' | 'sell' = poolBoughtToken ? 'sell' : 'buy'; // INVERTED!

      console.log('[BitQuery] DIRECTION LOGIC:', {
        poolBoughtToken,
        side,
        reason: poolBoughtToken
          ? 'Pool bought token → Trader SOLD token'
          : 'Pool sold token → Trader BOUGHT token',
      });

      // Extract amounts
      const buyAmount = tradeData.Buy.Amount || '0';
      const sellAmount = tradeData.Sell.Amount || '0';
      const amountToken = poolBoughtToken ? buyAmount : sellAmount;
      const amountAces = poolBoughtToken ? sellAmount : buyAmount;

      // Extract prices
      const buyPrice = tradeData.Buy.Price || '0';
      const sellPrice = tradeData.Sell.Price || '0';
      const buyPriceUsd = tradeData.Buy.PriceInUSD || '0';
      const sellPriceUsd = tradeData.Sell.PriceInUSD || '0';

      // Token price is based on what the user paid/received
      const priceInAces = poolBoughtToken ? sellPrice : buyPrice;
      const priceInUsd = poolBoughtToken ? sellPriceUsd : buyPriceUsd;

      // Calculate volume in USD
      const volumeUsd = (parseFloat(amountToken) * parseFloat(priceInUsd)).toFixed(2);

      return {
        blockTime: new Date(trade.Block.Time),
        blockNumber: trade.Block.Number,
        txHash: trade.Transaction.Hash,
        sender: trade.Transaction.From || '0x0000000000000000000000000000000000000000',
        priceInAces,
        priceInUsd,
        amountToken,
        amountAces,
        volumeUsd,
        side,
      };
    });
  }

  /**
   * Normalize token trades from DEXTradeByTokens (NEW: Correct trader addresses)
   */
  private normalizeTokenTrades(trades: any[], tokenAddress: string): BitQuerySwap[] {
    const normalizedTokenAddress = tokenAddress.toLowerCase();

    return trades.map((trade) => {
      const tradeData = trade.Trade;
      const sideType = tradeData.Side.Type; // "buy" or "sell" (from ACES perspective)

      // DEXTradeByTokens logic:
      // Trade.Side.Type = "sell" means ACES was sold (token was BOUGHT) → user BOUGHT token
      // Trade.Side.Type = "buy" means ACES was bought (token was SOLD) → user SOLD token
      const side: 'buy' | 'sell' = sideType === 'sell' ? 'buy' : 'sell';

      console.log('[BitQuery] TOKEN TRADE:', {
        txHash: trade.Transaction.Hash,
        trader: trade.Transaction.From,
        sideType: sideType,
        interpretedAs: side,
        tokenAmount: tradeData.Amount,
        acesAmount: tradeData.Side.Amount,
        acesUSD: tradeData.Side.AmountInUSD,
        tokenPrice: tradeData.Price,
      });

      // Extract amounts
      const amountToken = tradeData.Amount || '0';
      const amountAces = tradeData.Side.Amount || '0';

      // Calculate price in USD from the trade
      const acesAmountUSD = parseFloat(tradeData.Side.AmountInUSD || '0');
      const tokenAmountNum = parseFloat(amountToken);
      let priceInUsd = '0';

      if (tokenAmountNum > 0 && acesAmountUSD > 0) {
        // Price per token = Total USD spent / Token amount
        priceInUsd = (acesAmountUSD / tokenAmountNum).toString();
      }

      // Price in ACES (from BitQuery)
      const priceInAces = tradeData.Price || '0';

      // Volume in USD
      const volumeUsd = acesAmountUSD.toFixed(2);

      return {
        blockTime: new Date(trade.Block.Time),
        blockNumber: trade.Block.Number,
        txHash: trade.Transaction.Hash,
        sender: trade.Transaction.From, // ACTUAL TRADER ADDRESS from Transaction.From!
        priceInAces,
        priceInUsd,
        amountToken,
        amountAces,
        volumeUsd,
        side,
      };
    });
  }

  /**
   * Normalize Trading.Tokens candles to BitQueryCandle format
   */
  private normalizeTradingTokensCandles(tokens: TradingTokensOHLC[]): BitQueryCandle[] {
    return tokens.map((item) => {
      const timestamp = new Date(item.Block.Time);
      const ohlc = item.Price.Ohlc;
      const volume = item.Volume;

      // BitQuery Trading.Tokens returns USD prices directly
      // We populate both USD and non-USD fields with the same values
      // since the frontend will use USD prices for DEX tokens (dataSource: 'dex')
      return {
        timestamp,
        open: ohlc.Open.toString(), // Use USD price as base (for candle body calculation)
        high: ohlc.High.toString(),
        low: ohlc.Low.toString(),
        close: ohlc.Close.toString(),
        openUsd: ohlc.Open.toString(),
        highUsd: ohlc.High.toString(),
        lowUsd: ohlc.Low.toString(),
        closeUsd: ohlc.Close.toString(),
        volume: volume.Base.toString(),
        volumeUsd: volume.Usd.toString(),
        trades: 0, // Not provided by this query
      };
    });
  }

  /**
   * Normalize pre-aggregated candle data from BitQuery DEXTradeByTokens
   */
  private normalizeAggregatedCandles(candleData: any[]): BitQueryCandle[] {
    return candleData.map((item) => {
      const timestamp = new Date(item.Block.Time);
      const trade = item.Trade;

      // DEXTradeByTokens with PriceInUSD aggregations returns USD prices directly
      const openUsd = trade.open?.toString() || '0';
      const highUsd = trade.high?.toString() || '0';
      const lowUsd = trade.low?.toString() || '0';
      const closeUsd = trade.close?.toString() || '0';

      // Volume data
      const volumeUsd = item.volumeUsd?.toString() || '0';
      const volume = item.volume?.toString() || '0';

      console.log('[BitQuery] Normalized DEX candle:', {
        timestamp: timestamp.toISOString(),
        openUsd,
        highUsd,
        lowUsd,
        closeUsd,
        volumeUsd,
        trades: item.tradesCount,
        hasWicks:
          parseFloat(highUsd) > parseFloat(openUsd) || parseFloat(lowUsd) < parseFloat(closeUsd),
        wickData: {
          high: parseFloat(highUsd),
          open: parseFloat(openUsd),
          close: parseFloat(closeUsd),
          low: parseFloat(lowUsd),
        },
      });

      return {
        timestamp,
        open: openUsd, // Use USD as base for DEX
        high: highUsd,
        low: lowUsd,
        close: closeUsd,
        openUsd,
        highUsd,
        lowUsd,
        closeUsd,
        volume,
        volumeUsd,
        trades: parseInt(item.tradesCount || '0'),
      };
    });
  }

  /**
   * LEGACY: Normalize candle data from BitQuery response (manual grouping - not used anymore)
   */
  private normalizeCandles(
    trades: any[],
    timeframe: string,
    tokenAddress: string,
  ): BitQueryCandle[] {
    const normalizedTokenAddress = tokenAddress.toLowerCase();

    // Group trades by time interval
    const candleMap = new Map<number, any[]>();

    trades.forEach((trade) => {
      const timestamp = new Date(trade.Block.Time).getTime();
      const intervalMs = this.getIntervalSeconds(timeframe) * 1000;
      const candleTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;

      if (!candleMap.has(candleTimestamp)) {
        candleMap.set(candleTimestamp, []);
      }
      candleMap.get(candleTimestamp)!.push(trade);
    });

    // Build OHLC candles from grouped trades
    const candles: BitQueryCandle[] = [];

    candleMap.forEach((tradesInCandle, timestamp) => {
      // Sort trades chronologically within the candle
      tradesInCandle.sort((a, b) => {
        return new Date(a.Block.Time).getTime() - new Date(b.Block.Time).getTime();
      });

      // Extract prices with proper token identification
      const priceData = tradesInCandle
        .map((trade) => {
          // Safely access nested properties with null checks
          const buyToken = trade?.Trade?.Buy?.Currency?.SmartContract?.toLowerCase();
          const sellToken = trade?.Trade?.Sell?.Currency?.SmartContract?.toLowerCase();

          if (!buyToken || !sellToken) {
            console.warn('[BitQuery] Trade missing currency smart contract:', {
              hasTrade: !!trade?.Trade,
              hasBuy: !!trade?.Trade?.Buy,
              hasSell: !!trade?.Trade?.Sell,
              hasBuyCurrency: !!trade?.Trade?.Buy?.Currency,
              hasSellCurrency: !!trade?.Trade?.Sell?.Currency,
            });
            return null;
          }

          // Determine which side has our target token
          const tokenIsBought = buyToken === normalizedTokenAddress;
          const tokenIsSold = sellToken === normalizedTokenAddress;

          if (!tokenIsBought && !tokenIsSold) {
            console.warn('[BitQuery] Trade does not involve target token:', {
              targetToken: normalizedTokenAddress,
              buyToken,
              sellToken,
            });
            return null;
          }

          // Calculate token price in terms of the other token (usually ACES)
          // If token is bought: price = sell amount / buy amount (what was paid per token)
          // If token is sold: price = buy amount / sell amount (what was received per token)
          const buyAmount = parseFloat(trade?.Trade?.Buy?.Amount || '0');
          const sellAmount = parseFloat(trade?.Trade?.Sell?.Amount || '0');
          const buyPriceUsd = parseFloat(trade?.Trade?.Buy?.PriceInUSD || '0');
          const sellPriceUsd = parseFloat(trade?.Trade?.Sell?.PriceInUSD || '0');

          if (buyAmount === 0 && sellAmount === 0) {
            console.warn('[BitQuery] Trade has zero amounts');
            return null;
          }

          let priceInAces: number;
          let priceInUsd: number;
          let volumeToken: number;

          if (tokenIsBought) {
            // Token was bought, so price = what was paid (sell side) / amount of token received (buy side)
            priceInAces = buyAmount > 0 ? sellAmount / buyAmount : 0;
            // Use the buy side USD price (BitQuery calculates this)
            priceInUsd = buyPriceUsd;
            volumeToken = buyAmount;
          } else {
            // Token was sold, so price = what was received (buy side) / amount of token sold (sell side)
            priceInAces = sellAmount > 0 ? buyAmount / sellAmount : 0;
            // Use the sell side USD price
            priceInUsd = sellPriceUsd;
            volumeToken = sellAmount;
          }

          return {
            priceInAces,
            priceInUsd,
            volumeToken,
            timestamp: new Date(trade.Block.Time).getTime(),
          };
        })
        .filter(
          (
            p,
          ): p is {
            priceInAces: number;
            priceInUsd: number;
            volumeToken: number;
            timestamp: number;
          } => p !== null && p.priceInAces > 0,
        );

      if (priceData.length === 0) {
        console.warn('[BitQuery] No valid prices for candle at', new Date(timestamp));
        return;
      }

      // Extract OHLC values
      const prices = priceData.map((p) => p.priceInAces);
      const pricesUsd = priceData.map((p) => p.priceInUsd);
      const volumes = priceData.map((p) => p.volumeToken);

      // Open = first trade price, Close = last trade price
      const open = prices[0].toString();
      const close = prices[prices.length - 1].toString();
      const high = Math.max(...prices).toString();
      const low = Math.min(...prices).toString();

      const openUsd = pricesUsd[0].toString();
      const closeUsd = pricesUsd[pricesUsd.length - 1].toString();
      const highUsd = Math.max(...pricesUsd).toString();
      const lowUsd = Math.min(...pricesUsd).toString();

      const volume = volumes.reduce((sum, v) => sum + v, 0).toString();
      const volumeUsd = volumes.reduce((sum, v, i) => sum + v * pricesUsd[i], 0).toFixed(2);

      candles.push({
        timestamp: new Date(timestamp),
        open,
        high,
        low,
        close,
        openUsd,
        highUsd,
        lowUsd,
        closeUsd,
        volume,
        volumeUsd,
        trades: tradesInCandle.length,
      });

      // DEBUG: Log each candle created
      console.log('[BitQuery] Created candle:', {
        timestamp: new Date(timestamp).toISOString(),
        open,
        high,
        low,
        close,
        trades: tradesInCandle.length,
      });
    });

    // Sort by timestamp
    const sortedCandles = candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log(
      `[BitQuery] ✅ Returning ${sortedCandles.length} candles (${sortedCandles[0]?.timestamp.toISOString()} to ${sortedCandles[sortedCandles.length - 1]?.timestamp.toISOString()})`,
    );

    return sortedCandles;
  }

  /**
   * Normalize pool state from BitQuery response
   */
  private normalizePoolState(balances: any[], poolAddress: string): BitQueryPoolState | null {
    if (!balances || balances.length < 2) return null;

    return {
      poolAddress,
      token0: {
        address: balances[0].Currency.SmartContract,
        symbol: balances[0].Currency.Symbol,
        decimals: balances[0].Currency.Decimals,
        reserve: balances[0].BalanceUpdate.Amount.toString(),
      },
      token1: {
        address: balances[1].Currency.SmartContract,
        symbol: balances[1].Currency.Symbol,
        decimals: balances[1].Currency.Decimals,
        reserve: balances[1].BalanceUpdate.Amount.toString(),
      },
      lastUpdated: new Date(balances[0].Block.Time),
      blockNumber: balances[0].Block.Number,
    };
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.config.cacheTtlMs),
    });
  }

  /**
   * Utility: Convert timeframe to duration
   */
  private getTimeframeDuration(timeframe: string): number {
    const durations: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return durations[timeframe] || durations['1h'];
  }

  /**
   * Utility: Convert timeframe to interval seconds
   */
  private getIntervalSeconds(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return intervals[timeframe] || 3600;
  }

  /**
   * Utility: Convert timeframe to interval minutes (for BitQuery DEXTradeByTokens)
   */
  private getIntervalMinutes(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    return intervals[timeframe] || 60;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
