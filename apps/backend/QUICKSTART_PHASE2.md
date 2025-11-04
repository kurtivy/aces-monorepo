# 🚀 Phase 2 Quick Start Guide

Get Phase 2 adapters up and running in minutes!

---

## ⚡ Quick Test

```bash
cd apps/backend

# Run all Phase 2 tests (should see 92 passing)
npm test -- quicknode-adapter.test.ts goldsky-adapter.test.ts bitquery-adapter.test.ts aerodrome-adapter-simple.test.ts phase2-integration.test.ts
```

**Expected Output:** ✅ Test Files: 5 passed | Tests: 92 passed

---

## 📦 Environment Setup

Create `.env` file in `apps/backend/`:

```bash
# QuickNode (required)
QUICKNODE_WS_URL=wss://your-quicknode-endpoint.com

# Goldsky (required)
GOLDSKY_WS_URL=wss://your-goldsky-endpoint.com
GOLDSKY_API_KEY=your-goldsky-api-key

# BitQuery (required)
BITQUERY_WS_URL=wss://streaming.bitquery.io/graphql
BITQUERY_API_KEY=your-bitquery-api-key
```

---

## 💻 Usage Example

### Basic Usage: Individual Adapters

```typescript
import { QuickNodeAdapter, GoldskyAdapter, BitQueryAdapter, AerodromeAdapter } from './adapters/external';

// 1. QuickNode - Blockchain events
const quickNode = new QuickNodeAdapter();
await quickNode.connect();

await quickNode.subscribeLogs(
  { address: '0xPOOL', topics: ['0xSYNC_SIGNATURE'] },
  (log) => console.log('Sync event:', log)
);

// 2. Goldsky - Trade events
const goldsky = new GoldskyAdapter();
await goldsky.connect();

await goldsky.subscribeToTrades('0xTOKEN', (trade) => {
  console.log(`Trade: ${trade.isBuy ? 'BUY' : 'SELL'} ${trade.tokenAmount}`);
});

// 3. BitQuery - DEX trades & candles
const bitQuery = new BitQueryAdapter();
await bitQuery.connect();

await bitQuery.subscribeToCandles('0xTOKEN', '1m', (candle) => {
  console.log(`Candle: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close}`);
});

// 4. Aerodrome - Pool reserves
const aerodrome = new AerodromeAdapter(quickNode);
await aerodrome.connect();

await aerodrome.subscribeToPool('0xPOOL', '0xTOKEN', (poolState) => {
  console.log(`Reserves: ${poolState.reserve0} / ${poolState.reserve1}`);
});
```

### Recommended: Use AdapterManager

```typescript
import { AdapterManager } from './services/websocket/adapter-manager';

// Initialize all adapters at once
const manager = new AdapterManager({
  quickNodeWsUrl: process.env.QUICKNODE_WS_URL,
  goldskyWsUrl: process.env.GOLDSKY_WS_URL,
  goldskyApiKey: process.env.GOLDSKY_API_KEY,
  bitQueryWsUrl: process.env.BITQUERY_WS_URL,
  bitQueryApiKey: process.env.BITQUERY_API_KEY,
});

// Connect all adapters
await manager.connect();

// Subscribe to trades (routes to Goldsky + BitQuery automatically)
await manager.subscribeToTrades('0xTOKEN', (trade) => {
  console.log('Trade:', trade);
});

// Subscribe to pool state (routes to Aerodrome)
await manager.subscribeToPoolState('0xPOOL', '0xTOKEN', (state) => {
  console.log('Pool state:', state);
});

// Get stats from all adapters
const stats = manager.getAllStats();
console.log('QuickNode:', stats.quickNode);
console.log('Goldsky:', stats.goldsky);
console.log('BitQuery:', stats.bitQuery);
console.log('Aerodrome:', stats.aerodrome);

// Cleanup
await manager.disconnect();
```

---

## 🧪 Testing

### Run Specific Adapter Tests

```bash
# QuickNode (24 tests)
npm test -- quicknode-adapter.test.ts

# Goldsky (24 tests)
npm test -- goldsky-adapter.test.ts

# BitQuery (27 tests)
npm test -- bitquery-adapter.test.ts

# Aerodrome (8 tests)
npm test -- aerodrome-adapter-simple.test.ts

# Integration (9 tests)
npm test -- phase2-integration.test.ts
```

### Run All Phase 2 Tests

```bash
npm test -- quicknode-adapter goldsky-adapter bitquery-adapter aerodrome-adapter phase2-integration
```

---

## 📊 Adapter Features

| Adapter | Purpose | Rate Limits | Latency |
|---------|---------|-------------|---------|
| **QuickNode** | Blockchain events (Sync) | None (paid) | ~200ms |
| **Goldsky** | Trade events, bonding status | Streaming (1 conn) | 100-500ms |
| **BitQuery** | DEX trades, OHLCV candles | 100 req/min | 500ms-1s |
| **Aerodrome** | Pool reserves, prices | None (uses QuickNode) | ~200ms |

---

## 🔍 Monitoring

```typescript
// Get stats from individual adapter
const adapter = new QuickNodeAdapter();
await adapter.connect();

const stats = adapter.getStats();
console.log(`
  Name: ${stats.name}
  Connected: ${stats.connected}
  Messages Received: ${stats.messagesReceived}
  Messages Emitted: ${stats.messagesEmitted}
  Errors: ${stats.errors}
  Last Message: ${stats.lastMessageAt}
  Uptime: ${stats.connectionUptime}ms
`);
```

---

## 🚨 Troubleshooting

### "Cannot connect to QuickNode"
- ✅ Verify `QUICKNODE_WS_URL` is correct
- ✅ Check QuickNode subscription is active
- ✅ Ensure WebSocket endpoint is enabled

### "Goldsky API key required"
- ✅ Set `GOLDSKY_API_KEY` environment variable
- ✅ Verify API key is valid

### "BitQuery rate limit exceeded"
- ✅ Reduce number of active subscriptions
- ✅ Use streaming subscriptions (1 per topic)
- ✅ Limit: 100 requests/minute

### "Aerodrome requires QuickNode"
- ✅ Connect QuickNode adapter first
- ✅ Ensure QuickNode is connected before Aerodrome

---

## 📚 Type Definitions

All adapters use unified types from `src/types/adapters/index.ts`:

```typescript
import {
  TradeEvent,
  PoolStateEvent,
  CandleData,
  BondingStatusEvent,
  AdapterEvent,
  AdapterEventType,
  AdapterStats,
} from './types/adapters';
```

---

## ✨ Next Steps

1. **Integrate with Phase 1 Gateway**
   ```typescript
   // Connect AdapterManager to SubscriptionDeduplicator
   manager.on('adapter_event', (event) => {
     deduplicator.emit(event);
   });
   ```

2. **Create Business Logic Routes**
   - `/ws/trades/:tokenAddress`
   - `/ws/pool/:poolAddress`
   - `/ws/bonding/:tokenAddress`
   - `/ws/candles/:tokenAddress/:timeframe`

3. **Frontend Integration**
   - Connect React dashboard to WebSocket endpoints
   - Display real-time trades
   - Update TradingView charts
   - Show bonding progress

---

**Phase 2 is ready for production! 🚀**

*See `PHASE2_COMPLETE.md` for detailed documentation.*

