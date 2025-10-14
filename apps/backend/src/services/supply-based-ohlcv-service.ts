import { Decimal } from 'decimal.js';
import { ethers } from 'ethers';

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
   * Fetch trades with supply information and calculate marginal prices
   */
  async getCandles(
    tokenAddress: string,
    timeframe: '5m' | '15m' | '1h' | '4h' | '1d',
    limit = 1000,
  ): Promise<Candle[]> {
    try {
      // Fetch trades with supply data
      const trades = await this.fetchTradesWithSupply(tokenAddress, limit);

      if (trades.length === 0) {
        return [];
      }

      // Fetch token parameters (curve, steepness, floor)
      const tokenParams = await this.fetchTokenParameters(tokenAddress);

      if (!tokenParams) {
        throw new Error('Could not fetch token parameters');
      }

      // Calculate marginal price for each trade
      const tradesWithPrices = await this.calculateMarginalPrices(trades, tokenParams);

      // Aggregate into OHLCV candles
      return this.aggregateTradesToCandles(tradesWithPrices, timeframe);
    } catch (error) {
      console.error('[SupplyBasedOHLCV] Error getting candles:', error);
      throw error;
    }
  }

  /**
   * Fetch trades with supply information from subgraph
   */
  private async fetchTradesWithSupply(tokenAddress: string, limit: number): Promise<Trade[]> {
    const query = `{
      trades(
        where: {token_: {address: "${tokenAddress.toLowerCase()}"}}
        orderBy: createdAt
        orderDirection: desc
        first: ${limit}
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
      errors?: any[];
    }

    const result = (await response.json()) as TradesResponse;

    if (result.errors) {
      throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data.trades || [];
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
      console.error('[SupplyBasedOHLCV] Subgraph request failed:', response.status);
      return null;
    }

    interface TokenResponse {
      data: { tokens: SubgraphToken[] };
      errors?: any[];
    }

    const result = (await response.json()) as TokenResponse;

    if (result.errors) {
      console.error('[SupplyBasedOHLCV] Subgraph query errors:', result.errors);
      return null;
    }

    if (!result.data.tokens || result.data.tokens.length === 0) {
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
