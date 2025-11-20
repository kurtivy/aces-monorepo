# 🚀 Phase 3 Quick Start: Real-Time WebSocket Feeds

Get your real-time WebSocket data feeds up and running!

---

## ⚡ Quick Test

```bash
cd apps/backend

# Run all tests (should see 107 passing)
npm test -- quicknode goldsky bitquery aerodrome phase2-integration phase3-websocket-routes
```

**Expected Output:** ✅ Test Files: 6 passed | Tests: 107 passed

---

## 📦 Environment Setup

Make sure these are in your `.env`:

```bash
# QuickNode (required for WebSocket)
QUICKNODE_WS_URL=wss://your-quicknode-endpoint.com

# Goldsky (required for trades & bonding)
GOLDSKY_WS_URL=wss://your-goldsky-endpoint.com
GOLDSKY_API_KEY=your-goldsky-api-key

# BitQuery (required for candles)
BITQUERY_WS_URL=wss://streaming.bitquery.io/graphql
BITQUERY_API_KEY=your-bitquery-api-key
```

---

## 🚀 Start the Server

```bash
npm run dev
```

**You should see:**
```
✅ Phase 1 WebSocket Gateway initialized
✅ Phase 2 External Adapters connected
✅ Phase 3 WebSocket routes registered
```

**If adapters fail to connect:**
```
⚠️  Phase 2 Adapters failed to connect
⚠️  WebSocket streaming disabled - falling back to REST APIs
```
*(Check your environment variables)*

---

## 💻 Test WebSocket Endpoints

### Option 1: Using `wscat` (CLI)

```bash
# Install wscat
npm install -g wscat

# Test trades endpoint
wscat -c "ws://localhost:8080/api/v1/ws/trades/0xYOUR_TOKEN_ADDRESS"

# Test bonding endpoint
wscat -c "ws://localhost:8080/api/v1/ws/bonding/0xYOUR_TOKEN_ADDRESS"

# Test pools endpoint
wscat -c "ws://localhost:8080/api/v1/ws/pools/0xPOOL_ADDRESS?token=0xTOKEN"

# Test candles endpoint
wscat -c "ws://localhost:8080/api/v1/ws/candles/0xTOKEN?timeframe=1m"
```

**Expected Response:**
```json
{"type":"subscribed","data":{"tokenAddress":"0x...","message":"Streaming real-time trades"},"timestamp":1698765432000}
{"type":"trade","data":{...},"timestamp":1698765432000}
{"type":"trade","data":{...},"timestamp":1698765433000}
```

### Option 2: Using Browser Console

```javascript
// Open browser console and paste:
const ws = new WebSocket('ws://localhost:8080/api/v1/ws/trades/0xYOUR_TOKEN');

ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('Error:', e);
ws.onclose = () => console.log('Disconnected');
```

### Option 3: Using Postman

1. Open Postman
2. Create new **WebSocket Request**
3. URL: `ws://localhost:8080/api/v1/ws/trades/0xTOKEN`
4. Click **Connect**
5. Watch messages stream in!

---

## 📡 Available WebSocket Endpoints

### 1. **Real-Time Trades**
```
ws://localhost:8080/api/v1/ws/trades/:tokenAddress
```

**What you'll receive:**
```json
{
  "type": "trade",
  "data": {
    "id": "0xtx123",
    "tokenAddress": "0xTOKEN",
    "trader": "0xTRADER",
    "isBuy": true,
    "tokenAmount": "1000000000000000000",
    "acesAmount": "500000000000000000",
    "pricePerToken": "0.5",
    "timestamp": 1698765432,
    "blockNumber": 1000,
    "transactionHash": "0xtx123",
    "source": "goldsky"
  },
  "timestamp": 1698765432000
}
```

---

### 2. **Real-Time Bonding Status**
```
ws://localhost:8080/api/v1/ws/bonding/:tokenAddress
```

**What you'll receive:**
```json
{
  "type": "bonding_status",
  "data": {
    "tokenAddress": "0xTOKEN",
    "isBonded": false,
    "supply": "1000000000000000000",
    "bondingProgress": 0.75,
    "poolAddress": null
  },
  "timestamp": 1698765432000
}
```

---

### 3. **Real-Time Pool Reserves**
```
ws://localhost:8080/api/v1/ws/pools/:poolAddress?token=0xTOKEN
```

**What you'll receive:**
```json
{
  "type": "pool_state",
  "data": {
    "poolAddress": "0xPOOL",
    "tokenAddress": "0xTOKEN",
    "reserve0": "1000000000000000000",
    "reserve1": "500000000000000000",
    "priceToken0": "500000000000000000",
    "priceToken1": "2000000000000000000",
    "blockNumber": 1000
  },
  "timestamp": 1698765432000
}
```

---

### 4. **Real-Time Candles (TradingView)**
```
ws://localhost:8080/api/v1/ws/candles/:tokenAddress?timeframe=1m
```

**Timeframes:** `1m`, `5m`, `15m`, `1h`, `4h`, `1d`

**What you'll receive:**
```json
{
  "type": "candle",
  "data": {
    "timestamp": 1698765420,
    "timeframe": "5m",
    "open": "1.0",
    "high": "1.5",
    "low": "0.9",
    "close": "1.2",
    "volume": "10000",
    "trades": 50
  },
  "timestamp": 1698765432000
}
```

---

## 🧪 Frontend Integration

### React Hook Example

```typescript
import { useEffect, useState } from 'react';

function useRealtimeTrades(tokenAddress: string) {
  const [trades, setTrades] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:8080/api/v1/ws/trades/${tokenAddress}`
    );

    ws.onopen = () => {
      console.log('Connected to trades WebSocket');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'trade') {
        setTrades((prev) => [message.data, ...prev].slice(0, 50)); // Keep last 50
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setConnected(false);
    };

    // Cleanup
    return () => {
      ws.close();
    };
  }, [tokenAddress]);

  return { trades, connected };
}

// Usage in component:
function TradesPanel({ tokenAddress }: { tokenAddress: string }) {
  const { trades, connected } = useRealtimeTrades(tokenAddress);

  return (
    <div>
      {connected && <span>🟢 Live</span>}
      {trades.map((trade) => (
        <div key={trade.id}>
          {trade.isBuy ? '🟢 BUY' : '🔴 SELL'} {trade.tokenAmount}
        </div>
      ))}
    </div>
  );
}
```

---

## 🔍 Monitoring & Debugging

### Check Gateway Stats
```bash
curl http://localhost:8080/api/v1/ws/stats
```

**Response:**
```json
{
  "connectedClients": 5,
  "activeSubscriptions": 12,
  "totalMessagesReceived": 1500,
  "totalMessagesSent": 3000,
  "uptimeMs": 300000
}
```

### Check Adapter Stats
```bash
curl http://localhost:8080/api/v1/ws/stats
```

**Look for:**
```json
{
  "adapters": {
    "quickNode": { "connected": true, "messagesReceived": 500 },
    "goldsky": { "connected": true, "messagesReceived": 800 },
    "bitQuery": { "connected": true, "messagesReceived": 300 },
    "aerodrome": { "connected": true, "messagesReceived": 100 }
  }
}
```

---

## 🚨 Troubleshooting

### "WebSocket adapters not connected"

**Check logs:**
```bash
npm run dev | grep "Phase 2"
```

**Look for:**
```
✅ Phase 2 External Adapters connected
```

**If you see:**
```
⚠️  Phase 2 Adapters failed to connect
```

**Solution:** Check environment variables are set correctly

---

### No messages coming through

1. **Check if token has activity:**
   ```bash
   # Use REST API to verify token exists
   curl http://localhost:8080/api/v1/tokens/0xTOKEN
   ```

2. **Check adapter stats:**
   ```bash
   curl http://localhost:8080/api/v1/ws/stats
   ```

3. **Check server logs:**
   ```bash
   npm run dev
   # Watch for [WS:Trades], [WS:Bonding], etc. logs
   ```

---

### WebSocket closes immediately

**Check error message:**
```javascript
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'error') {
    console.error('Server error:', msg.message);
  }
};
```

**Common errors:**
- `Missing required query parameter: token` → Add `?token=0x...` to pools endpoint
- `Invalid timeframe` → Use valid timeframe: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`
- `WebSocket adapters not connected` → Check environment variables

---

## 📊 Performance Metrics

**Expected Performance:**
- **Connection Time:** < 100ms
- **First Message:** < 1s after connection
- **Message Latency:** 100-500ms (Goldsky/QuickNode), 500ms-1s (BitQuery)
- **Messages/Second:** Varies by token activity (1-100/s)

**Monitor with:**
```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/ws/trades/0xTOKEN');
let messageCount = 0;
let startTime = Date.now();

ws.onmessage = () => {
  messageCount++;
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`Messages/sec: ${(messageCount / elapsed).toFixed(2)}`);
};
```

---

## ✅ Next Steps

1. **Update Frontend Dashboard**
   - Replace REST polling with WebSocket hooks
   - Add real-time trade feed
   - Update bonding progress bar

2. **Integrate TradingView**
   - Wire candles WebSocket to `onRealtimeCallback`
   - Remove REST historical data fetching

3. **Add Features**
   - Multi-token subscriptions
   - Trade alerts (large trades)
   - Price alerts

---

**Phase 3 is live! Your data feeds now use WebSockets! 🚀**

*See `PHASE3_COMPLETE.md` for full documentation.*

