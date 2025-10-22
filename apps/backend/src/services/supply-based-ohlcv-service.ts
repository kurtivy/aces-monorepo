import { Decimal } from 'decimal.js';

interface Trade {
  id: string;
  isBuy: boolean;
  tokenAmount: string;
  acesTokenAmount: string;
  supply: string; // Total supply AFTER the trade (in WEI)
  createdAt: string;
}

interface SubgraphToken {
  address: string;
  curve: number;
  steepness: string;
  floor: string;
}

interface Candle {
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
  circulatingSupply?: string; // Circulating supply at end of candle period
}

/**
 * Calculate OHLCV using bonding curve marginal prices at supply levels
 * This is how pump.fun displays bonding curve prices
 */
export class SupplyBasedOHLCVService {
  private subgraphUrl: string;
  private rpcUrl: string;
  private factoryAddress: string;
  private candlesCache = new Map<string, { candles: Candle[]; timestamp: number }>();
  private static readonly CACHE_TTL_MS = 2000;

  constructor() {
    this.subgraphUrl = process.env.GOLDSKY_SUBGRAPH_URL || '';
    this.rpcUrl =
      process.env.QUICKNODE_BASE_URL ||
      process.env.BASE_MAINNET_RPC_URL ||
      'https://mainnet.base.org'; // Base mainnet
    this.factoryAddress = '0x7e224ae4e6235bF18BBcb79cc2B5d04a7a6F8d1D'; // Factory proxy
    Decimal.set({ precision: 78 });
  }

  /**
   * Build candles from trades using bonding curve marginal prices when possible.
   * Falls back to pre-aggregated subgraph candles if trades or params are unavailable.
   */
  async getCandles(
    tokenAddress: string,
    timeframe: '5m' | '15m' | '1h' | '4h' | '1d',
    limit = 1000,
  ): Promise<Candle[]> {
    try {
      const cacheKey = `${tokenAddress.toLowerCase()}::${timeframe}::${limit}`;
      const cached = this.candlesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < SupplyBasedOHLCVService.CACHE_TTL_MS) {
        console.log(`[SupplyBasedOHLCV] ✅ Using cached ${timeframe} candles: ${cached.candles.length}`);
        return cached.candles;
      }
      // Try trade-based pipeline first
      console.log(`[SupplyBasedOHLCV] 🔄 Building ${timeframe} candles from trades for ${tokenAddress.slice(0, 8)}...`);

      const tokenParams = await this.fetchTokenParameters(tokenAddress);
      if (tokenParams) {
        // Heuristic trade limit: enough to cover recent history across timeframes
        const TRADE_LIMIT = Math.max(500, Math.min(5000, limit * 10));
        const trades = await this.fetchTradesWithSupply(tokenAddress, TRADE_LIMIT);

        console.log(`[SupplyBasedOHLCV] 📊 Fetched ${trades?.length || 0} trades for ${timeframe}`);

        if (trades && trades.length > 0) {
          const priced = await this.calculateMarginalPrices(trades, tokenParams);
          const candles = this.aggregateTradesToCandles(priced, timeframe);

          console.log(`[SupplyBasedOHLCV] 🕯️  Trade-based aggregation produced ${candles.length} ${timeframe} candles`);

          if (candles.length > 0) {
            const result = candles.slice(-limit);
            this.candlesCache.set(cacheKey, { candles: result, timestamp: Date.now() });
            console.log(`[SupplyBasedOHLCV] ✅ Returning ${result.length} trade-based candles for ${timeframe}`);
            return result;
          } else {
            console.warn(`[SupplyBasedOHLCV] ⚠️  Trade aggregation returned 0 candles for ${timeframe}`);
          }
        } else {
          console.log('[SupplyBasedOHLCV] ⚠️  No trades returned for token; falling back to subgraph');
        }
      } else {
        console.log('[SupplyBasedOHLCV] ⚠️  No token params found; trying direct trade aggregation');
        // If token params are missing, derive price directly from trade amounts
        const TRADE_LIMIT = Math.max(500, Math.min(5000, limit * 10));
        const trades = await this.fetchTradesWithSupply(tokenAddress, TRADE_LIMIT);

        console.log(`[SupplyBasedOHLCV] 📊 Fetched ${trades?.length || 0} trades for direct aggregation`);

        if (trades && trades.length > 0) {
          // Derive ACES-per-token price from emitted trade amounts
          const priced = trades.map((t) => {
            const tokenAmt = new Decimal(t.tokenAmount).div(new Decimal(10).pow(18));
            const acesAmt = new Decimal(t.acesTokenAmount).div(new Decimal(10).pow(18));
            const marginalPrice = tokenAmt.gt(0) ? acesAmt.div(tokenAmt) : new Decimal(0);
            return { ...t, marginalPrice } as Trade & { marginalPrice: Decimal };
          });

          const candles = this.aggregateTradesToCandles(priced, timeframe);
          console.log(`[SupplyBasedOHLCV] 🕯️  Direct aggregation produced ${candles.length} ${timeframe} candles`);
          
          if (candles.length > 0) {
            const result = candles.slice(-limit);
            this.candlesCache.set(cacheKey, { candles: result, timestamp: Date.now() });
            console.log(`[SupplyBasedOHLCV] ✅ Returning ${result.length} direct-aggregated candles for ${timeframe}`);
            return result;
          } else {
            console.warn(`[SupplyBasedOHLCV] ⚠️  Direct aggregation returned 0 candles for ${timeframe}`);
          }
        }
      }

      // Fallback: pre-aggregated subgraph candles (existing behavior)
      console.log(`[SupplyBasedOHLCV] 🔄 Falling back to pre-aggregated ${timeframe} candles from subgraph`);

      // Map timeframe to subgraph entity name
      const entityMap: Record<string, string> = {
        '5m': 'tokenFives',
        '15m': 'tokenFifteens',
        '1h': 'tokenHours',
        '4h': 'tokenFourHours',
        '1d': 'tokenDays',
      };

      const entityName = entityMap[timeframe];
      if (!entityName) {
        console.error(`[SupplyBasedOHLCV] ❌ Unsupported timeframe: ${timeframe}`);
        throw new Error(`Unsupported timeframe: ${timeframe}`);
      }

      const query = `{
        tokens(where: {address: "${tokenAddress.toLowerCase()}"}) {
          buyPrice
          sellPrice
          supply
          ${entityName}(first: ${limit}, orderBy: id, orderDirection: desc) {
            id
            tradesCount
            tokensBought
            tokensSold
            open
            high
            low
            close
          }
        }
      }`;

      console.log(`[SupplyBasedOHLCV] 📡 Querying subgraph for ${entityName}...`);

      const response = await fetch(this.subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error(`[SupplyBasedOHLCV] ❌ Subgraph request failed: ${response.status}`);
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      interface SubgraphCandleResponse {
        data: {
          tokens: Array<{
            buyPrice?: string;
            sellPrice?: string;
            supply?: string;
            [key: string]:
              | Array<{
                  id: string;
                  tradesCount: number;
                  tokensBought: string;
                  tokensSold: string;
                  open: string;
                  high: string;
                  low: string;
                  close: string;
                }>
              | string
              | undefined;
          }>;
        };
        errors?: unknown[];
      }

      const result = (await response.json()) as SubgraphCandleResponse;

      if (result.errors) {
        console.error(`[SupplyBasedOHLCV] ❌ Subgraph errors: ${JSON.stringify(result.errors)}`);
        throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
      }

      if (!result.data.tokens || result.data.tokens.length === 0) {
        console.warn(`[SupplyBasedOHLCV] ⚠️  No token data found in subgraph for ${tokenAddress.slice(0, 8)}...`);
        return [];
      }

      const tokenData = result.data.tokens[0];
      const rawCandles =
        (tokenData[entityName] as Array<{
          id: string;
          tradesCount: number;
          tokensBought: string;
          tokensSold: string;
          open: string;
          high: string;
          low: string;
          close: string;
        }>) || [];

      console.log(`[SupplyBasedOHLCV] 📊 Subgraph returned ${rawCandles.length} pre-aggregated ${timeframe} candles`);

      if (rawCandles.length === 0) {
        console.warn(`[SupplyBasedOHLCV] ⚠️  No ${timeframe} candles found in subgraph for ${tokenAddress.slice(0, 8)}...`);
        return [];
      }

      console.log(`[SupplyBasedOHLCV] ✅ Fetched ${rawCandles.length} pre-aggregated candles from subgraph`);

      let candles: Candle[] = rawCandles
        .map(
          (candle: {
            id: string;
            tradesCount: number;
            tokensBought: string;
            tokensSold: string;
            open: string;
            high: string;
            low: string;
            close: string;
          }): Candle | null => {
            const parts = candle.id.split('-');
            if (parts.length !== 2) {
              // console.warn(`[SupplyBasedOHLCV] Invalid candle ID format: ${candle.id}`);
              return null;
            }

            const periodId = parseInt(parts[1], 10);
            const intervalSeconds: Record<string, number> = {
              '5m': 300,
              '15m': 900,
              '1h': 3600,
              '4h': 14400,
              '1d': 86400,
            };

            const timestamp = new Date(periodId * intervalSeconds[timeframe] * 1000);

            const PRICE_DIVISOR = new Decimal(10).pow(22);

            const open = new Decimal(candle.open).div(PRICE_DIVISOR).toString();
            const high = new Decimal(candle.high).div(PRICE_DIVISOR).toString();
            const low = new Decimal(candle.low).div(PRICE_DIVISOR).toString();
            const close = new Decimal(candle.close).div(PRICE_DIVISOR).toString();

            const TOKEN_DIVISOR = new Decimal(10).pow(18);
            const tokensBought = new Decimal(candle.tokensBought || '0').div(TOKEN_DIVISOR);
            const tokensSold = new Decimal(candle.tokensSold || '0').div(TOKEN_DIVISOR);
            const volume = tokensBought.add(tokensSold).toString();

            return {
              timestamp,
              open,
              high,
              low,
              close,
              volume,
              trades: candle.tradesCount,
            };
          },
        )
        .filter((candle): candle is Candle => candle !== null)
        .sort((a: Candle, b: Candle) => a.timestamp.getTime() - b.timestamp.getTime());

      // Always return the latest N candles; frontend will window by range
      if (candles.length > limit) {
        candles = candles.slice(-limit);
      }

      console.log(`[SupplyBasedOHLCV] ✅ Returning ${candles.length} subgraph candles for ${timeframe} (caching for ${SupplyBasedOHLCVService.CACHE_TTL_MS}ms)`);
      this.candlesCache.set(cacheKey, { candles, timestamp: Date.now() });
      return candles;
    } catch (error) {
      console.error(`[SupplyBasedOHLCV] ❌ Error getting ${timeframe} candles for ${tokenAddress.slice(0, 8)}...:`, error);
      throw error;
    }
  }

  /**
   * Fetch trades with supply information from subgraph
   */
  private async fetchTradesWithSupply(tokenAddress: string, limit: number): Promise<Trade[]> {
    const whereClause = `token_: {address: "${tokenAddress.toLowerCase()}"}`;

    const PAGE_SIZE = Math.min(1000, Math.max(1, limit));
    const totalToFetch = Math.max(1, limit);
    let fetched: Trade[] = [];
    let skip = 0;

    while (fetched.length < totalToFetch) {
      const remaining = totalToFetch - fetched.length;
      const pageSize = Math.min(PAGE_SIZE, remaining);

      const query = `{
        trades(
          where: {${whereClause}}
          orderBy: createdAt
          orderDirection: desc
          first: ${pageSize}
          skip: ${skip}
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
        }
      }`;

      const response = await fetch(this.subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      interface TradesResponse {
        data: { trades: Trade[] };
        errors?: unknown[];
      }

      const result = (await response.json()) as TradesResponse;

      if (result.errors) {
        throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
      }

      const page = result.data.trades || [];
      fetched = fetched.concat(page);

      if (page.length < pageSize) {
        break;
      }
      skip += pageSize;
    }

    return fetched;
  }

  /**
   * Fetch token parameters from subgraph
   * Query through TokenFive to get the nested token fields
   */
  private async fetchTokenParameters(tokenAddress: string): Promise<SubgraphToken | null> {
    const query = `{
      tokens(where: {address: "${tokenAddress.toLowerCase()}"}) {
        address
        curve
        steepness
        floor
      }
    }`;

    const response = await fetch(this.subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('[SupplyBasedOHLCV] Subgraph request failed:', response.status);
      return null;
    }

    interface TokenResponse {
      data: { tokens: SubgraphToken[] };
      errors?: unknown[];
    }

    const result = (await response.json()) as TokenResponse;

    if (result.errors) {
      // eslint-disable-next-line no-console
      console.error('[SupplyBasedOHLCV] Subgraph query errors:', result.errors);
      return null;
    }

    if (!result.data.tokens || result.data.tokens.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[SupplyBasedOHLCV] No token found, trying alternative query with TokenFive');

      // Try alternative query through TokenFive
      const altQuery = `{
        tokenFives(where: {token_: {address: "${tokenAddress.toLowerCase()}"}}, first: 1) {
          token {
            address
            curve
            steepness
            floor
          }
        }
      }`;

      const altResponse = await fetch(this.subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: altQuery }),
      });

      if (!altResponse.ok) {
        return null;
      }

      interface AltTokenResponse {
        data: { tokenFives: Array<{ token: SubgraphToken }> };
      }

      const altResult = (await altResponse.json()) as AltTokenResponse;

      if (altResult.data.tokenFives && altResult.data.tokenFives.length > 0) {
        const tokenData = altResult.data.tokenFives[0].token;
        // eslint-disable-next-line no-console
        console.log('[SupplyBasedOHLCV] Found token params via TokenFive:', {
          curve: tokenData.curve,
          steepness: tokenData.steepness,
          floor: tokenData.floor,
        });
        return tokenData;
      }
    }

    const tokenData = result.data.tokens[0] || null;
    if (tokenData) {
      // eslint-disable-next-line no-console
      console.log('[SupplyBasedOHLCV] Found token params directly:', {
        curve: tokenData.curve,
        steepness: tokenData.steepness,
        floor: tokenData.floor,
      });
    }

    return tokenData;
  }

  /**
   * Calculate marginal price using bonding curve formula
   * This returns the price to buy 1 token at a specific supply level
   */
  private calculateQuadraticPrice(
    supply: Decimal,
    amount: Decimal,
    steepness: Decimal,
    floor: Decimal,
  ): Decimal {
    // Quadratic bonding curve formula from contract (line 286-289):
    // sum1 = (supply - 1) * supply * (2 * (supply - 1) + 1) / 6
    // sum2 = (supply - 1 + amount) * (supply + amount) * (2 * (supply - 1 + amount) + 1) / 6
    // summation = sum2 - sum1
    // price = (summation * 1 ether) / steepness + (floor * amount)

    const supplyMinus1 = supply.sub(1);
    const sum1 = supplyMinus1.mul(supply).mul(supplyMinus1.mul(2).add(1)).div(6);

    const supplyMinus1PlusAmount = supplyMinus1.add(amount);
    const supplyPlusAmount = supply.add(amount);
    const sum2 = supplyMinus1PlusAmount
      .mul(supplyPlusAmount)
      .mul(supplyMinus1PlusAmount.mul(2).add(1))
      .div(6);

    const summation = sum2.sub(sum1);

    // Price in WEI = (summation * 1 ether) / steepness + (floor * amount)
    // Note: floor and summation are already in whole number units
    const ONE_ETHER = new Decimal(10).pow(18);
    const price = summation.mul(ONE_ETHER).div(steepness).add(floor.mul(amount));

    return price;
  }

  /**
   * Calculate marginal prices for all trades
   */
  private async calculateMarginalPrices(
    trades: Trade[],
    tokenParams: SubgraphToken,
  ): Promise<Array<Trade & { marginalPrice: Decimal }>> {
    const steepness = new Decimal(tokenParams.steepness);
    const floor = new Decimal(tokenParams.floor);

    return trades.map((trade) => {
      // Supply is in WEI, convert to whole tokens
      const supplyWei = new Decimal(trade.supply);
      const supply = supplyWei.div(new Decimal(10).pow(18));
      const amount = new Decimal(1); // Price for 1 token

      // Calculate marginal price at this supply level
      let marginalPrice: Decimal;

      if (tokenParams.curve === 0) {
        // Quadratic
        // The formula already returns price in WEI, so just convert to ACES
        const priceWei = this.calculateQuadraticPrice(supply, amount, steepness, floor);
        marginalPrice = priceWei.div(new Decimal(10).pow(18));
      } else {
        // Linear (if needed later)
        marginalPrice = new Decimal(0);
      }

      return {
        ...trade,
        marginalPrice: marginalPrice,
      };
    });
  }

  /**
   * Aggregate trades into OHLCV candles based on marginal prices
   */
  private aggregateTradesToCandles(
    trades: Array<Trade & { marginalPrice: Decimal }>,
    timeframe: string,
  ): Candle[] {
    const intervalMs = this.getIntervalMs(timeframe);
    const candleMap = new Map<
      number,
      {
        prices: Decimal[];
        volumes: Decimal[];
        timestamps: number[];
        supplies: string[]; // Track supply at each trade
      }
    >();

    // Group trades by candle period
    for (const trade of trades) {
      const timestamp = parseInt(trade.createdAt) * 1000;
      const candleTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;

      const tokens = new Decimal(trade.tokenAmount).div(new Decimal(10).pow(18));

      if (!candleMap.has(candleTimestamp)) {
        candleMap.set(candleTimestamp, { prices: [], volumes: [], timestamps: [], supplies: [] });
      }

      const candle = candleMap.get(candleTimestamp)!;
      candle.prices.push(trade.marginalPrice);
      candle.volumes.push(tokens);
      candle.timestamps.push(timestamp);
      candle.supplies.push(trade.supply);
    }

    // Convert to OHLCV candles
    const candles: Candle[] = [];

    for (const [timestamp, data] of candleMap.entries()) {
      if (data.prices.length === 0) continue;

      // Sort by timestamp to get correct open/close
      const sorted = data.prices
        .map((price, i) => ({
          price,
          volume: data.volumes[i],
          timestamp: data.timestamps[i],
          supply: data.supplies[i],
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      const prices = sorted.map((s) => s.price);
      const open = prices[0].toString();
      const close = prices[prices.length - 1].toString();
      const high = Decimal.max(...prices).toString();
      const low = Decimal.min(...prices).toString();
      const volume = data.volumes.reduce((sum, v) => sum.add(v), new Decimal(0)).toString();

      // Use the closing supply (last trade in this candle period)
      const closingSupply = sorted[sorted.length - 1].supply;
      const circulatingSupply = new Decimal(closingSupply).div(new Decimal(10).pow(18)).toString();

      candles.push({
        timestamp: new Date(timestamp),
        open,
        high,
        low,
        close,
        volume,
        trades: data.prices.length,
        circulatingSupply,
      });
    }

    // Sort by timestamp ascending
    return candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private getIntervalMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[timeframe] || intervals['1h'];
  }
}
