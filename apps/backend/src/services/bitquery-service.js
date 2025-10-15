"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitQueryService = exports.BitQueryPaymentRequiredError = void 0;
var bitquery_config_1 = require("../config/bitquery.config");
var BitQueryPaymentRequiredError = /** @class */ (function (_super) {
    __extends(BitQueryPaymentRequiredError, _super);
    function BitQueryPaymentRequiredError(message) {
        if (message === void 0) { message = 'BitQuery payment required'; }
        var _this = _super.call(this, message) || this;
        _this.name = 'BitQueryPaymentRequiredError';
        return _this;
    }
    return BitQueryPaymentRequiredError;
}(Error));
exports.BitQueryPaymentRequiredError = BitQueryPaymentRequiredError;
var BitQueryService = /** @class */ (function () {
    function BitQueryService() {
        this.config = (0, bitquery_config_1.getBitQueryConfig)();
        this.cache = new Map();
    }
    /**
     * Fetch recent swaps for a token pair
     */
    BitQueryService.prototype.getRecentSwaps = function (tokenAddress_1, poolAddress_1) {
        return __awaiter(this, arguments, void 0, function (tokenAddress, poolAddress, options) {
            var cacheKey, cached, queryVariables, queryToUse, response, trades, swaps, error_1;
            var _a;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log('[BitQuery] Fetching recent swaps:', {
                            tokenAddress: tokenAddress,
                            poolAddress: poolAddress,
                            since: options.since,
                            limit: options.limit || 100,
                        });
                        cacheKey = "swaps:".concat(poolAddress, ":").concat(((_a = options.since) === null || _a === void 0 ? void 0 : _a.getTime()) || 'all');
                        cached = this.getFromCache(cacheKey);
                        if (cached) {
                            console.log("[BitQuery] \u2705 Returning ".concat(cached.length, " cached swaps"));
                            return [2 /*return*/, cached];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        queryVariables = {
                            network: bitquery_config_1.BASE_NETWORK,
                            poolAddress: poolAddress.toLowerCase(),
                            limit: options.limit || 100,
                        };
                        // Only include since parameter if it's provided
                        if (options.since) {
                            queryVariables.since = options.since.toISOString();
                        }
                        queryToUse = options.since
                            ? bitquery_config_1.BITQUERY_QUERIES.GET_RECENT_SWAPS
                            : bitquery_config_1.BITQUERY_QUERIES.GET_RECENT_SWAPS_NO_SINCE;
                        console.log('[BitQuery] Querying BitQuery API for swaps...');
                        return [4 /*yield*/, this.queryBitQuery(queryToUse, queryVariables)];
                    case 2:
                        response = _b.sent();
                        trades = response.data.EVM.DEXTrades;
                        console.log("[BitQuery] \u2705 Received ".concat((trades === null || trades === void 0 ? void 0 : trades.length) || 0, " trades from BitQuery"));
                        swaps = this.normalizeSwaps(trades || [], tokenAddress);
                        console.log("[BitQuery] \u2705 Normalized to ".concat(swaps.length, " swaps"));
                        this.setCache(cacheKey, swaps);
                        return [2 /*return*/, swaps];
                    case 3:
                        error_1 = _b.sent();
                        console.error('[BitQuery] ❌ Failed to fetch swaps:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch OHLC candles for a timeframe
     */
    BitQueryService.prototype.getOHLCCandles = function (tokenAddress_1, poolAddress_1, timeframe_1) {
        return __awaiter(this, arguments, void 0, function (tokenAddress, poolAddress, timeframe, options) {
            var from, to, counterTokenAddress, cacheKey, cached, intervalMinutes, response, candleData, candles, error_2;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        from = options.from || new Date(Date.now() - this.getTimeframeDuration(timeframe));
                        to = options.to || new Date();
                        counterTokenAddress = (options.counterTokenAddress || bitquery_config_1.ACES_TOKEN_ADDRESS).toLowerCase();
                        console.log('[BitQuery] Fetching OHLC candles:', {
                            tokenAddress: tokenAddress,
                            poolAddress: poolAddress,
                            timeframe: timeframe,
                            from: from.toISOString(),
                            to: to.toISOString(),
                            counterTokenAddress: counterTokenAddress,
                        });
                        cacheKey = "candles:".concat(poolAddress, ":").concat(counterTokenAddress, ":").concat(timeframe, ":").concat(from.getTime(), ":").concat(to.getTime());
                        cached = this.getFromCache(cacheKey);
                        if (cached) {
                            console.log("[BitQuery] \u2705 Returning ".concat(cached.length, " cached candles"));
                            return [2 /*return*/, cached];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        intervalMinutes = this.getIntervalMinutes(timeframe);
                        console.log('[BitQuery] Querying BitQuery API for OHLC data with DEXTradeByTokens...');
                        return [4 /*yield*/, this.queryBitQuery(bitquery_config_1.BITQUERY_QUERIES.GET_OHLC_CANDLES, {
                                network: bitquery_config_1.BASE_NETWORK,
                                poolAddress: poolAddress.toLowerCase(),
                                tokenAddress: tokenAddress.toLowerCase(),
                                counterToken: counterTokenAddress,
                                from: from.toISOString(),
                                to: to.toISOString(),
                                intervalCount: intervalMinutes,
                            })];
                    case 2:
                        response = _a.sent();
                        candleData = response.data.EVM.DEXTradeByTokens;
                        console.log("[BitQuery] \u2705 Received ".concat((candleData === null || candleData === void 0 ? void 0 : candleData.length) || 0, " pre-aggregated candles from BitQuery"));
                        candles = this.normalizeAggregatedCandles(candleData || []);
                        console.log("[BitQuery] \u2705 Normalized to ".concat(candles.length, " candles"));
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
                        return [2 /*return*/, candles];
                    case 3:
                        error_2 = _a.sent();
                        console.error('[BitQuery] ❌ Failed to fetch candles:', error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current pool reserves and state
     */
    BitQueryService.prototype.getPoolState = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, response, poolState, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "pool:".concat(poolAddress);
                        cached = this.getFromCache(cacheKey);
                        if (cached)
                            return [2 /*return*/, cached];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.queryBitQuery(bitquery_config_1.BITQUERY_QUERIES.GET_POOL_STATE, {
                                network: bitquery_config_1.BASE_NETWORK,
                                poolAddress: poolAddress.toLowerCase(),
                            })];
                    case 2:
                        response = _a.sent();
                        poolState = this.normalizePoolState(response.data.EVM.BalanceUpdates, poolAddress);
                        if (poolState) {
                            this.setCache(cacheKey, poolState, 10000); // Cache pool state for 10s
                        }
                        return [2 /*return*/, poolState];
                    case 3:
                        error_3 = _a.sent();
                        console.error('[BitQuery] Failed to fetch pool state:', error_3);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get OHLC candles using Trading.Tokens query (more accurate USD pricing)
     */
    BitQueryService.prototype.getTradingTokensOHLC = function (tokenAddress_1, timeframe_1) {
        return __awaiter(this, arguments, void 0, function (tokenAddress, timeframe, options) {
            var from, to, intervalSeconds, cacheKey, cached, response, tokens, candles, error_4;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        from = options.from || new Date(Date.now() - this.getTimeframeDuration(timeframe));
                        to = options.to || new Date();
                        intervalSeconds = bitquery_config_1.TIMEFRAME_TO_SECONDS[timeframe] || this.getIntervalSeconds(timeframe);
                        console.log('[BitQuery] Fetching Trading.Tokens OHLC:', {
                            tokenAddress: tokenAddress,
                            timeframe: timeframe,
                            from: from.toISOString(),
                            to: to.toISOString(),
                            intervalSeconds: intervalSeconds,
                        });
                        cacheKey = "trading-tokens:".concat(tokenAddress, ":").concat(timeframe, ":").concat(from.getTime(), ":").concat(to.getTime());
                        cached = this.getFromCache(cacheKey);
                        if (cached) {
                            console.log("[BitQuery] \u2705 Returning ".concat(cached.length, " cached Trading.Tokens candles"));
                            return [2 /*return*/, cached];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.queryBitQueryTrading(bitquery_config_1.BITQUERY_QUERIES.GET_TRADING_TOKENS_OHLC, {
                                tokenAddress: tokenAddress.toLowerCase(),
                                from: from.toISOString(),
                                to: to.toISOString(),
                                intervalSeconds: intervalSeconds,
                            })];
                    case 2:
                        response = _a.sent();
                        tokens = response.data.Trading.Tokens;
                        console.log("[BitQuery] \u2705 Received ".concat((tokens === null || tokens === void 0 ? void 0 : tokens.length) || 0, " Trading.Tokens candles"));
                        candles = this.normalizeTradingTokensCandles(tokens || []);
                        console.log("[BitQuery] \u2705 Normalized to ".concat(candles.length, " candles"));
                        this.setCache(cacheKey, candles);
                        return [2 /*return*/, candles];
                    case 3:
                        error_4 = _a.sent();
                        console.error('[BitQuery] ❌ Failed to fetch Trading.Tokens candles:', error_4);
                        throw error_4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get latest USD price for market cap calculation
     */
    BitQueryService.prototype.getLatestPriceUSD = function (tokenAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, response, tokens, priceUsd, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "latest-price:".concat(tokenAddress);
                        cached = this.getFromCache(cacheKey);
                        if (cached)
                            return [2 /*return*/, cached];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.queryBitQueryTrading(bitquery_config_1.BITQUERY_QUERIES.GET_LATEST_PRICE_USD, { tokenAddress: tokenAddress.toLowerCase() })];
                    case 2:
                        response = _a.sent();
                        tokens = response.data.Trading.Tokens;
                        if (!tokens || tokens.length === 0)
                            return [2 /*return*/, null];
                        priceUsd = tokens[0].Price.Ohlc.Close;
                        this.setCache(cacheKey, priceUsd, 5000); // Cache for 5 seconds
                        return [2 /*return*/, priceUsd];
                    case 3:
                        error_5 = _a.sent();
                        console.error('[BitQuery] Failed to fetch latest price:', error_5);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate market cap: price × fixed supply (1 billion)
     */
    BitQueryService.prototype.calculateMarketCap = function (priceUsd) {
        var FIXED_SUPPLY = 1000000000; // 1 billion
        var marketCap = priceUsd * FIXED_SUPPLY;
        return marketCap.toFixed(2);
    };
    /**
     * Execute GraphQL query with retry logic (for EVM queries)
     */
    BitQueryService.prototype.queryBitQuery = function (query, variables) {
        return __awaiter(this, void 0, void 0, function () {
            var lastError, _loop_1, this_1, attempt, state_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lastError = null;
                        _loop_1 = function (attempt) {
                            var controller_1, timeout, response, data, error_6;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 3, , 6]);
                                        controller_1 = new AbortController();
                                        timeout = setTimeout(function () { return controller_1.abort(); }, this_1.config.requestTimeoutMs);
                                        return [4 /*yield*/, fetch(this_1.config.endpoint, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: "Bearer ".concat(this_1.config.apiKey),
                                                },
                                                body: JSON.stringify({ query: query, variables: variables }),
                                                signal: controller_1.signal,
                                            })];
                                    case 1:
                                        response = _b.sent();
                                        clearTimeout(timeout);
                                        if (!response.ok) {
                                            if (response.status === 402) {
                                                throw new BitQueryPaymentRequiredError('BitQuery HTTP 402: Payment Required');
                                            }
                                            throw new Error("BitQuery HTTP ".concat(response.status, ": ").concat(response.statusText));
                                        }
                                        return [4 /*yield*/, response.json()];
                                    case 2:
                                        data = (_b.sent());
                                        if (data.errors && data.errors.length > 0) {
                                            throw new Error("BitQuery GraphQL errors: ".concat(JSON.stringify(data.errors)));
                                        }
                                        return [2 /*return*/, { value: data }];
                                    case 3:
                                        error_6 = _b.sent();
                                        lastError = error_6 instanceof Error ? error_6 : new Error(String(error_6));
                                        console.warn("[BitQuery] Attempt ".concat(attempt + 1, " failed:"), lastError.message);
                                        if (!(attempt < this_1.config.maxRetries - 1)) return [3 /*break*/, 5];
                                        return [4 /*yield*/, new Promise(function (resolve) {
                                                return setTimeout(resolve, _this.config.retryDelayMs * (attempt + 1));
                                            })];
                                    case 4:
                                        _b.sent();
                                        _b.label = 5;
                                    case 5: return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        attempt = 0;
                        _a.label = 1;
                    case 1:
                        if (!(attempt < this.config.maxRetries)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(attempt)];
                    case 2:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        _a.label = 3;
                    case 3:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 4: throw lastError || new Error('BitQuery request failed after retries');
                }
            });
        });
    };
    /**
     * Execute GraphQL query with retry logic (for Trading queries)
     */
    BitQueryService.prototype.queryBitQueryTrading = function (query, variables) {
        return __awaiter(this, void 0, void 0, function () {
            var lastError, _loop_2, this_2, attempt, state_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lastError = null;
                        _loop_2 = function (attempt) {
                            var controller_2, timeout, response, data, error_7;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 3, , 6]);
                                        controller_2 = new AbortController();
                                        timeout = setTimeout(function () { return controller_2.abort(); }, this_2.config.requestTimeoutMs);
                                        return [4 /*yield*/, fetch(this_2.config.endpoint, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: "Bearer ".concat(this_2.config.apiKey),
                                                },
                                                body: JSON.stringify({ query: query, variables: variables }),
                                                signal: controller_2.signal,
                                            })];
                                    case 1:
                                        response = _b.sent();
                                        clearTimeout(timeout);
                                        if (!response.ok) {
                                            if (response.status === 402) {
                                                throw new BitQueryPaymentRequiredError('BitQuery HTTP 402: Payment Required');
                                            }
                                            throw new Error("BitQuery HTTP ".concat(response.status, ": ").concat(response.statusText));
                                        }
                                        return [4 /*yield*/, response.json()];
                                    case 2:
                                        data = (_b.sent());
                                        if (data.errors && data.errors.length > 0) {
                                            throw new Error("BitQuery GraphQL errors: ".concat(JSON.stringify(data.errors)));
                                        }
                                        return [2 /*return*/, { value: data }];
                                    case 3:
                                        error_7 = _b.sent();
                                        lastError = error_7 instanceof Error ? error_7 : new Error(String(error_7));
                                        console.warn("[BitQuery] Trading query attempt ".concat(attempt + 1, " failed:"), lastError.message);
                                        if (!(attempt < this_2.config.maxRetries - 1)) return [3 /*break*/, 5];
                                        return [4 /*yield*/, new Promise(function (resolve) {
                                                return setTimeout(resolve, _this.config.retryDelayMs * (attempt + 1));
                                            })];
                                    case 4:
                                        _b.sent();
                                        _b.label = 5;
                                    case 5: return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        attempt = 0;
                        _a.label = 1;
                    case 1:
                        if (!(attempt < this.config.maxRetries)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_2(attempt)];
                    case 2:
                        state_2 = _a.sent();
                        if (typeof state_2 === "object")
                            return [2 /*return*/, state_2.value];
                        _a.label = 3;
                    case 3:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 4: throw lastError || new Error('BitQuery Trading request failed after retries');
                }
            });
        });
    };
    /**
     * Normalize swap data from BitQuery response
     */
    BitQueryService.prototype.normalizeSwaps = function (trades, tokenAddress) {
        var normalizedTokenAddress = tokenAddress.toLowerCase();
        return trades.map(function (trade) {
            var tradeData = trade.Trade;
            var buyToken = tradeData.Buy.Currency.SmartContract.toLowerCase();
            var sellToken = tradeData.Sell.Currency.SmartContract.toLowerCase();
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
            var poolBoughtToken = buyToken === normalizedTokenAddress;
            var side = poolBoughtToken ? 'sell' : 'buy'; // INVERTED!
            console.log('[BitQuery] DIRECTION LOGIC:', {
                poolBoughtToken: poolBoughtToken,
                side: side,
                reason: poolBoughtToken
                    ? 'Pool bought token → Trader SOLD token'
                    : 'Pool sold token → Trader BOUGHT token',
            });
            // Extract amounts
            var buyAmount = tradeData.Buy.Amount || '0';
            var sellAmount = tradeData.Sell.Amount || '0';
            var amountToken = poolBoughtToken ? buyAmount : sellAmount;
            var amountAces = poolBoughtToken ? sellAmount : buyAmount;
            // Extract prices
            var buyPrice = tradeData.Buy.Price || '0';
            var sellPrice = tradeData.Sell.Price || '0';
            var buyPriceUsd = tradeData.Buy.PriceInUSD || '0';
            var sellPriceUsd = tradeData.Sell.PriceInUSD || '0';
            // Token price is based on what the user paid/received
            var priceInAces = poolBoughtToken ? sellPrice : buyPrice;
            var priceInUsd = poolBoughtToken ? sellPriceUsd : buyPriceUsd;
            // Calculate volume in USD
            var volumeUsd = (parseFloat(amountToken) * parseFloat(priceInUsd)).toFixed(2);
            return {
                blockTime: new Date(trade.Block.Time),
                blockNumber: trade.Block.Number,
                txHash: trade.Transaction.Hash,
                sender: tradeData.Sender || '0x0000000000000000000000000000000000000000',
                priceInAces: priceInAces,
                priceInUsd: priceInUsd,
                amountToken: amountToken,
                amountAces: amountAces,
                volumeUsd: volumeUsd,
                side: side,
            };
        });
    };
    /**
     * Normalize Trading.Tokens candles to BitQueryCandle format
     */
    BitQueryService.prototype.normalizeTradingTokensCandles = function (tokens) {
        return tokens.map(function (item) {
            var timestamp = new Date(item.Block.Time);
            var ohlc = item.Price.Ohlc;
            var volume = item.Volume;
            return {
                timestamp: timestamp,
                open: '0', // Not used for USD
                high: '0',
                low: '0',
                close: '0',
                openUsd: ohlc.Open.toString(),
                highUsd: ohlc.High.toString(),
                lowUsd: ohlc.Low.toString(),
                closeUsd: ohlc.Close.toString(),
                volume: volume.Base.toString(),
                volumeUsd: volume.Usd.toString(),
                trades: 0, // Not provided by this query
            };
        });
    };
    /**
     * Normalize pre-aggregated candle data from BitQuery DEXTradeByTokens
     */
    BitQueryService.prototype.normalizeAggregatedCandles = function (candleData) {
        return candleData.map(function (item) {
            var _a, _b, _c, _d, _e;
            var timestamp = new Date(item.Block.Time);
            var trade = item.Trade;
            // BitQuery DEXTradeByTokens gives us OHLC directly
            var open = ((_a = trade.open) === null || _a === void 0 ? void 0 : _a.toString()) || '0';
            var high = ((_b = trade.high) === null || _b === void 0 ? void 0 : _b.toString()) || '0';
            var low = ((_c = trade.low) === null || _c === void 0 ? void 0 : _c.toString()) || '0';
            var close = ((_d = trade.close) === null || _d === void 0 ? void 0 : _d.toString()) || '0';
            // Get USD price (average of OHLC for now, could be refined)
            var avgPrice = (parseFloat(open) + parseFloat(high) + parseFloat(low) + parseFloat(close)) / 4;
            var priceUsd = trade.PriceInUSD || 0;
            // Calculate USD values
            var openUsd = (parseFloat(open) * priceUsd).toString();
            var highUsd = (parseFloat(high) * priceUsd).toString();
            var lowUsd = (parseFloat(low) * priceUsd).toString();
            var closeUsd = (parseFloat(close) * priceUsd).toString();
            // Volume data
            var volume = ((_e = item.baseVolume) === null || _e === void 0 ? void 0 : _e.toString()) || '0';
            var volumeUsd = (parseFloat(volume) * priceUsd).toFixed(2);
            console.log('[BitQuery] Normalized candle:', {
                timestamp: timestamp.toISOString(),
                open: open,
                high: high,
                low: low,
                close: close,
                volume: volume,
                trades: item.tradesCount,
            });
            return {
                timestamp: timestamp,
                open: open,
                high: high,
                low: low,
                close: close,
                openUsd: openUsd,
                highUsd: highUsd,
                lowUsd: lowUsd,
                closeUsd: closeUsd,
                volume: volume,
                volumeUsd: volumeUsd,
                trades: parseInt(item.tradesCount || '0'),
            };
        });
    };
    /**
     * LEGACY: Normalize candle data from BitQuery response (manual grouping - not used anymore)
     */
    BitQueryService.prototype.normalizeCandles = function (trades, timeframe, tokenAddress) {
        var _this = this;
        var _a, _b;
        var normalizedTokenAddress = tokenAddress.toLowerCase();
        // Group trades by time interval
        var candleMap = new Map();
        trades.forEach(function (trade) {
            var timestamp = new Date(trade.Block.Time).getTime();
            var intervalMs = _this.getIntervalSeconds(timeframe) * 1000;
            var candleTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;
            if (!candleMap.has(candleTimestamp)) {
                candleMap.set(candleTimestamp, []);
            }
            candleMap.get(candleTimestamp).push(trade);
        });
        // Build OHLC candles from grouped trades
        var candles = [];
        candleMap.forEach(function (tradesInCandle, timestamp) {
            // Sort trades chronologically within the candle
            tradesInCandle.sort(function (a, b) {
                return new Date(a.Block.Time).getTime() - new Date(b.Block.Time).getTime();
            });
            // Extract prices with proper token identification
            var priceData = tradesInCandle
                .map(function (trade) {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
                // Safely access nested properties with null checks
                var buyToken = (_d = (_c = (_b = (_a = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _a === void 0 ? void 0 : _a.Buy) === null || _b === void 0 ? void 0 : _b.Currency) === null || _c === void 0 ? void 0 : _c.SmartContract) === null || _d === void 0 ? void 0 : _d.toLowerCase();
                var sellToken = (_h = (_g = (_f = (_e = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _e === void 0 ? void 0 : _e.Sell) === null || _f === void 0 ? void 0 : _f.Currency) === null || _g === void 0 ? void 0 : _g.SmartContract) === null || _h === void 0 ? void 0 : _h.toLowerCase();
                if (!buyToken || !sellToken) {
                    console.warn('[BitQuery] Trade missing currency smart contract:', {
                        hasTrade: !!(trade === null || trade === void 0 ? void 0 : trade.Trade),
                        hasBuy: !!((_j = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _j === void 0 ? void 0 : _j.Buy),
                        hasSell: !!((_k = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _k === void 0 ? void 0 : _k.Sell),
                        hasBuyCurrency: !!((_m = (_l = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _l === void 0 ? void 0 : _l.Buy) === null || _m === void 0 ? void 0 : _m.Currency),
                        hasSellCurrency: !!((_p = (_o = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _o === void 0 ? void 0 : _o.Sell) === null || _p === void 0 ? void 0 : _p.Currency),
                    });
                    return null;
                }
                // Determine which side has our target token
                var tokenIsBought = buyToken === normalizedTokenAddress;
                var tokenIsSold = sellToken === normalizedTokenAddress;
                if (!tokenIsBought && !tokenIsSold) {
                    console.warn('[BitQuery] Trade does not involve target token:', {
                        targetToken: normalizedTokenAddress,
                        buyToken: buyToken,
                        sellToken: sellToken,
                    });
                    return null;
                }
                // Calculate token price in terms of the other token (usually ACES)
                // If token is bought: price = sell amount / buy amount (what was paid per token)
                // If token is sold: price = buy amount / sell amount (what was received per token)
                var buyAmount = parseFloat(((_r = (_q = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _q === void 0 ? void 0 : _q.Buy) === null || _r === void 0 ? void 0 : _r.Amount) || '0');
                var sellAmount = parseFloat(((_t = (_s = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _s === void 0 ? void 0 : _s.Sell) === null || _t === void 0 ? void 0 : _t.Amount) || '0');
                var buyPriceUsd = parseFloat(((_v = (_u = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _u === void 0 ? void 0 : _u.Buy) === null || _v === void 0 ? void 0 : _v.PriceInUSD) || '0');
                var sellPriceUsd = parseFloat(((_x = (_w = trade === null || trade === void 0 ? void 0 : trade.Trade) === null || _w === void 0 ? void 0 : _w.Sell) === null || _x === void 0 ? void 0 : _x.PriceInUSD) || '0');
                if (buyAmount === 0 && sellAmount === 0) {
                    console.warn('[BitQuery] Trade has zero amounts');
                    return null;
                }
                var priceInAces;
                var priceInUsd;
                var volumeToken;
                if (tokenIsBought) {
                    // Token was bought, so price = what was paid (sell side) / amount of token received (buy side)
                    priceInAces = buyAmount > 0 ? sellAmount / buyAmount : 0;
                    // Use the buy side USD price (BitQuery calculates this)
                    priceInUsd = buyPriceUsd;
                    volumeToken = buyAmount;
                }
                else {
                    // Token was sold, so price = what was received (buy side) / amount of token sold (sell side)
                    priceInAces = sellAmount > 0 ? buyAmount / sellAmount : 0;
                    // Use the sell side USD price
                    priceInUsd = sellPriceUsd;
                    volumeToken = sellAmount;
                }
                return {
                    priceInAces: priceInAces,
                    priceInUsd: priceInUsd,
                    volumeToken: volumeToken,
                    timestamp: new Date(trade.Block.Time).getTime(),
                };
            })
                .filter(function (p) { return p !== null && p.priceInAces > 0; });
            if (priceData.length === 0) {
                console.warn('[BitQuery] No valid prices for candle at', new Date(timestamp));
                return;
            }
            // Extract OHLC values
            var prices = priceData.map(function (p) { return p.priceInAces; });
            var pricesUsd = priceData.map(function (p) { return p.priceInUsd; });
            var volumes = priceData.map(function (p) { return p.volumeToken; });
            // Open = first trade price, Close = last trade price
            var open = prices[0].toString();
            var close = prices[prices.length - 1].toString();
            var high = Math.max.apply(Math, prices).toString();
            var low = Math.min.apply(Math, prices).toString();
            var openUsd = pricesUsd[0].toString();
            var closeUsd = pricesUsd[pricesUsd.length - 1].toString();
            var highUsd = Math.max.apply(Math, pricesUsd).toString();
            var lowUsd = Math.min.apply(Math, pricesUsd).toString();
            var volume = volumes.reduce(function (sum, v) { return sum + v; }, 0).toString();
            var volumeUsd = volumes.reduce(function (sum, v, i) { return sum + v * pricesUsd[i]; }, 0).toFixed(2);
            candles.push({
                timestamp: new Date(timestamp),
                open: open,
                high: high,
                low: low,
                close: close,
                openUsd: openUsd,
                highUsd: highUsd,
                lowUsd: lowUsd,
                closeUsd: closeUsd,
                volume: volume,
                volumeUsd: volumeUsd,
                trades: tradesInCandle.length,
            });
            // DEBUG: Log each candle created
            console.log('[BitQuery] Created candle:', {
                timestamp: new Date(timestamp).toISOString(),
                open: open,
                high: high,
                low: low,
                close: close,
                trades: tradesInCandle.length,
            });
        });
        // Sort by timestamp
        var sortedCandles = candles.sort(function (a, b) { return a.timestamp.getTime() - b.timestamp.getTime(); });
        console.log("[BitQuery] \u2705 Returning ".concat(sortedCandles.length, " candles (").concat((_a = sortedCandles[0]) === null || _a === void 0 ? void 0 : _a.timestamp.toISOString(), " to ").concat((_b = sortedCandles[sortedCandles.length - 1]) === null || _b === void 0 ? void 0 : _b.timestamp.toISOString(), ")"));
        return sortedCandles;
    };
    /**
     * Normalize pool state from BitQuery response
     */
    BitQueryService.prototype.normalizePoolState = function (balances, poolAddress) {
        if (!balances || balances.length < 2)
            return null;
        return {
            poolAddress: poolAddress,
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
    };
    /**
     * Cache management
     */
    BitQueryService.prototype.getFromCache = function (key) {
        var entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    };
    BitQueryService.prototype.setCache = function (key, data, ttlMs) {
        this.cache.set(key, {
            data: data,
            expiresAt: Date.now() + (ttlMs || this.config.cacheTtlMs),
        });
    };
    /**
     * Utility: Convert timeframe to duration
     */
    BitQueryService.prototype.getTimeframeDuration = function (timeframe) {
        var durations = {
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
        };
        return durations[timeframe] || durations['1h'];
    };
    /**
     * Utility: Convert timeframe to interval seconds
     */
    BitQueryService.prototype.getIntervalSeconds = function (timeframe) {
        var intervals = {
            '5m': 300,
            '15m': 900,
            '1h': 3600,
            '4h': 14400,
            '1d': 86400,
        };
        return intervals[timeframe] || 3600;
    };
    /**
     * Utility: Convert timeframe to interval minutes (for BitQuery DEXTradeByTokens)
     */
    BitQueryService.prototype.getIntervalMinutes = function (timeframe) {
        var intervals = {
            '5m': 5,
            '15m': 15,
            '1h': 60,
            '4h': 240,
            '1d': 1440,
        };
        return intervals[timeframe] || 60;
    };
    /**
     * Clear cache (useful for testing)
     */
    BitQueryService.prototype.clearCache = function () {
        this.cache.clear();
    };
    return BitQueryService;
}());
exports.BitQueryService = BitQueryService;
