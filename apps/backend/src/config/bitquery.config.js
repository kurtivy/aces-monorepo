"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEFRAME_TO_SECONDS = exports.WETH_USDC_POOL_ADDRESS = exports.ACES_WETH_POOL_ADDRESS = exports.USDC_TOKEN_ADDRESS = exports.WETH_TOKEN_ADDRESS = exports.ACES_TOKEN_ADDRESS = exports.BASE_NETWORK = exports.BITQUERY_QUERIES = void 0;
exports.getBitQueryConfig = getBitQueryConfig;
var zod_1 = require("zod");
var BitQueryConfigSchema = zod_1.z.object({
    apiKey: zod_1.z.string().min(1, 'BITQUERY_API_KEY is required'),
    endpoint: zod_1.z.string().url().default('https://streaming.bitquery.io/graphql'),
    pollIntervalMs: zod_1.z.number().default(2500),
    cacheTtlMs: zod_1.z.number().default(5000),
    requestTimeoutMs: zod_1.z.number().default(10000),
    maxRetries: zod_1.z.number().default(3),
    retryDelayMs: zod_1.z.number().default(1000),
});
function getBitQueryConfig() {
    var config = BitQueryConfigSchema.parse({
        apiKey: process.env.BITQUERY_API_KEY,
        endpoint: process.env.BITQUERY_ENDPOINT,
        pollIntervalMs: parseInt(process.env.BITQUERY_POLL_INTERVAL_MS || '2500'),
        cacheTtlMs: parseInt(process.env.BITQUERY_CACHE_TTL_MS || '5000'),
        requestTimeoutMs: parseInt(process.env.BITQUERY_REQUEST_TIMEOUT_MS || '10000'),
        maxRetries: parseInt(process.env.BITQUERY_MAX_RETRIES || '3'),
        retryDelayMs: parseInt(process.env.BITQUERY_RETRY_DELAY_MS || '1000'),
    });
    return config;
}
// BitQuery GraphQL queries as constants
exports.BITQUERY_QUERIES = {
    // Get recent swaps for a token pair
    GET_RECENT_SWAPS: "\n    query GetRecentSwaps(\n      $network: evm_network\n      $poolAddress: String!\n      $since: DateTime\n      $limit: Int\n    ) {\n      EVM(network: $network) {\n        DEXTrades(\n          where: {\n            Trade: {\n              Dex: {\n                SmartContract: { is: $poolAddress }\n              }\n            }\n            Block: {\n              Time: { since: $since }\n            }\n          }\n          orderBy: { descending: Block_Time }\n          limit: { count: $limit }\n        ) {\n          Block {\n            Time\n            Number\n          }\n          Transaction {\n            Hash\n          }\n          Trade {\n            Sender\n            Buy {\n              Amount\n              Currency {\n                Symbol\n                SmartContract\n                Decimals\n              }\n              Price\n              PriceInUSD\n            }\n            Sell {\n              Amount\n              Currency {\n                Symbol\n                SmartContract\n                Decimals\n              }\n              Price\n              PriceInUSD\n            }\n            Dex {\n              ProtocolName\n              ProtocolFamily\n            }\n          }\n        }\n      }\n    }\n  ",
    // Get recent swaps for a token pair without since filter
    GET_RECENT_SWAPS_NO_SINCE: "\n    query GetRecentSwapsNoSince(\n      $network: evm_network\n      $poolAddress: String!\n      $limit: Int\n    ) {\n      EVM(network: $network) {\n        DEXTrades(\n          where: {\n            Trade: {\n              Dex: {\n                SmartContract: { is: $poolAddress }\n              }\n            }\n          }\n          orderBy: { descending: Block_Time }\n          limit: { count: $limit }\n        ) {\n          Block {\n            Time\n            Number\n          }\n          Transaction {\n            Hash\n          }\n          Trade {\n            Sender\n            Buy {\n              Amount\n              Currency {\n                Symbol\n                SmartContract\n                Decimals\n              }\n              Price\n              PriceInUSD\n            }\n            Sell {\n              Amount\n              Currency {\n                Symbol\n                SmartContract\n                Decimals\n              }\n              Price\n              PriceInUSD\n            }\n            Dex {\n              ProtocolName\n              ProtocolFamily\n            }\n          }\n        }\n      }\n    }\n  ",
    // Get OHLC data (aggregated candles) using DEXTradeByTokens
    GET_OHLC_CANDLES: "\n    query GetOHLCCandles(\n      $network: evm_network\n      $poolAddress: String!\n      $tokenAddress: String!\n      $counterToken: String!\n      $from: DateTime!\n      $to: DateTime!\n      $intervalCount: Int!\n    ) {\n      EVM(dataset: archive, network: $network) {\n        DEXTradeByTokens(\n          where: {\n            Block: { Time: { since: $from, till: $to } }\n            Trade: {\n              Dex: { SmartContract: { is: $poolAddress } }\n              Currency: { SmartContract: { is: $tokenAddress } }\n              Side: { Currency: { SmartContract: { is: $counterToken } } }\n            }\n          }\n          orderBy: { ascendingByField: \"Block_Time\" }\n        ) {\n          Block {\n            Time(interval: { in: minutes, count: $intervalCount })\n          }\n          Trade {\n            open: Price(minimum: Block_Time)\n            close: Price(maximum: Block_Time)\n            high: Price(maximum: Trade_Price)\n            low: Price(minimum: Trade_Price)\n            PriceInUSD\n          }\n          tradesCount: count\n          baseVolume: sum(of: Trade_Amount)\n          quoteVolume: sum(of: Trade_Side_Amount)\n        }\n      }\n    }\n  ",
    // Get current pool state
    GET_POOL_STATE: "\n    query GetPoolState(\n      $network: evm_network\n      $poolAddress: String!\n    ) {\n      EVM(network: $network) {\n        BalanceUpdates(\n          where: {\n            BalanceUpdate: {\n              Address: { is: $poolAddress }\n            }\n          }\n          orderBy: { descending: Block_Number }\n          limit: { count: 2 }\n        ) {\n          Currency {\n            Symbol\n            SmartContract\n            Decimals\n          }\n          BalanceUpdate {\n            Amount\n          }\n          Block {\n            Time\n            Number\n          }\n        }\n      }\n    }\n  ",
    // Get OHLC data using Trading.Tokens query (accurate USD pricing)
    GET_TRADING_TOKENS_OHLC: "\n    query GetTradingTokensOHLC(\n      $tokenAddress: String!\n      $from: DateTime!\n      $to: DateTime!\n      $intervalSeconds: Int!\n    ) {\n      Trading {\n        Tokens(\n          where: {\n            Volume: { Usd: { gt: 0 } }\n            Token: { Address: { is: $tokenAddress } }\n            Interval: { Time: { Duration: { eq: $intervalSeconds } } }\n            Block: { Time: { since: $from, till: $to } }\n          }\n        ) {\n          Block { Time Timestamp }\n          Interval { Time { Start End Duration } }\n          Price {\n            IsQuotedInUsd\n            Ohlc { Open High Low Close }\n          }\n          Volume { Base Quote Usd }\n          Token { Address Symbol Name }\n        }\n      }\n    }\n  ",
    // Get latest price for market cap calculation
    GET_LATEST_PRICE_USD: "\n    query GetLatestPriceUSD($tokenAddress: String!) {\n      Trading {\n        Tokens(\n          where: {\n            Token: { Address: { is: $tokenAddress } }\n          }\n          orderBy: { descending: Block_Time }\n          limit: { count: 1 }\n        ) {\n          Block { Time }\n          Price { Ohlc { Close } }\n        }\n      }\n    }\n  ",
};
exports.BASE_NETWORK = 'base'; // BitQuery network identifier for Base
exports.ACES_TOKEN_ADDRESS = '0x55337650856299363c496065C836B9C6E9dE0367'; // ACES token on Base
exports.WETH_TOKEN_ADDRESS = '0x4200000000000000000000000000000000000006'; // Canonical WETH on Base
exports.USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
var acesWethPoolEnv = process.env.AERODROME_ACES_WETH_POOL || process.env.BITQUERY_ACES_WETH_POOL || '';
var wethUsdcPoolEnv = process.env.WETH_USDC_POOL || process.env.BITQUERY_WETH_USDC_POOL || '';
exports.ACES_WETH_POOL_ADDRESS = acesWethPoolEnv ? acesWethPoolEnv.toLowerCase() : '';
exports.WETH_USDC_POOL_ADDRESS = wethUsdcPoolEnv ? wethUsdcPoolEnv.toLowerCase() : '';
// Timeframe to seconds mapping for Trading.Tokens query
exports.TIMEFRAME_TO_SECONDS = {
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
};
