# 🧪 WebSocket Testing Guide

**Purpose:** Test all WebSocket endpoints and frontend hooks  
**Time:** 10-15 minutes  
**Tools:** wscat, browser DevTools

---

## 🎯 Quick Test Checklist

- [ ] Backend is running
- [ ] All WebSocket routes registered
- [ ] Can connect via wscat
- [ ] Frontend hooks work
- [ ] Data updates in real-time

---

## 🚀 Step 1: Start Backend

```bash
cd apps/backend
pnpm run dev

# Wait for:
# ✅ Phase 1 WebSocket Gateway initialized
# ✅ Phase 2 External Adapters connected (or warnings if env vars not set)
# ✅ Phase 3 WebSocket routes registered
# Server listening at http://localhost:3002
```

---

## 🧪 Step 2: Test Backend WebSocket Endpoints

### **Install wscat (if needed)**
```bash
npm install -g wscat
```

### **Test 1: Trades Endpoint**
```bash
wscat -c "ws://localhost:3002/api/v1/ws/trades/0xYOUR_TOKEN_ADDRESS"

# Expected output:
# Connected (press CTRL+C to quit)
# > {"type":"subscribed","data":{"tokenAddress":"0x...","sources":["goldsky","bitquery"]}}

# If you have real data flowing:
# > {"type":"trade","data":{"id":"0x123","isBuy":true,...},"timestamp":...}
```

### **Test 2: Bonding Endpoint**
```bash
wscat -c "ws://localhost:3002/api/v1/ws/bonding/0xYOUR_TOKEN_ADDRESS"

# Expected:
# > {"type":"subscribed","data":{"tokenAddress":"0x..."}}
# > {"type":"bonding_status","data":{"isBonded":false,"bondingProgress":0.45,...}}
```

### **Test 3: Candles Endpoint**
```bash
wscat -c "ws://localhost:3002/api/v1/ws/candles/0xYOUR_TOKEN_ADDRESS?timeframe=5m"

# Expected:
# > {"type":"subscribed","data":{"tokenAddress":"0x...","timeframe":"5m"}}
# > {"type":"candle","data":{"timestamp":...,"open":"1.0","high":"1.5",...}}
```

### **Test 4: TradingView Compatibility**
```bash
wscat -c "ws://localhost:3002/ws/chart"

# Expected:
# > {"type":"connected","message":"Connected to chart WebSocket..."}
```

### **Test 5: Check Stats**
```bash
curl http://localhost:3002/api/v1/ws/stats | jq

# Expected JSON with:
{
  "connectedClients": 0,
  "activeSubscriptions": 0,
  "adapters": {
    "quickNode": {...},
    "goldsky": {...},
    "bitQuery": {...},
    "aerodrome": {...}
  }
}
```

---

## 🎨 Step 3: Test Frontend Hooks

### **Start Frontend**
```bash
cd apps/frontend
npm run dev

# Open http://localhost:3000
```

### **Check DevTools**

1. Open **DevTools** (F12 or Cmd+Option+I)
2. Go to **Network** tab
3. Click **WS** filter
4. You should see:
   - Active WebSocket connections when components mount
   - Messages flowing in real-time

### **Test Component**

Create a test page: `apps/frontend/src/app/test-ws/page.tsx`

```typescript
'use client';

import { useRealtimeTrades } from '@/hooks/websocket';

export default function TestWSPage() {
  const tokenAddress = '0xYOUR_TOKEN_ADDRESS';
  
  const { 
    trades, 
    isConnected, 
    isConnecting, 
    error 
  } = useRealtimeTrades(tokenAddress, {
    debug: true,  // Enable console logs
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">WebSocket Test</h1>
      
      <div className="mb-4">
        <p>Status: {
          isConnecting ? '🟡 Connecting...' :
          isConnected ? '🟢 LIVE (WebSocket!)' :
          '🔴 Disconnected'
        }</p>
        {error && <p className="text-red-500">Error: {error}</p>}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">
          Real-Time Trades ({trades.length})
        </h2>
        {trades.slice(0, 10).map((trade) => (
          <div key={trade.id} className="border-b py-2">
            <span className={trade.isBuy ? 'text-green-500' : 'text-red-500'}>
              {trade.isBuy ? '↑ BUY' : '↓ SELL'}
            </span>
            {' '}
            {trade.tokenAmount} @ ${trade.priceUsd}
            <span className="text-xs text-gray-500 ml-2">
              Seq: {trade.sequenceNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Visit: `http://localhost:3000/test-ws`

**Expected:**
- 🟢 Status shows "LIVE (WebSocket!)"
- Trades appear instantly (if data is flowing)
- Console logs show connection events

---

## 📊 Step 4: Compare REST vs WebSocket

Create comparison page: `apps/frontend/src/app/compare/page.tsx`

```typescript
'use client';

import { useTradeHistory } from '@/hooks/rwa/use-trade-history';       // OLD
import { useTradeHistoryV2 } from '@/hooks/rwa/use-trade-history-v2'; // NEW

export default function ComparePage() {
  const tokenAddress = '0xYOUR_TOKEN_ADDRESS';
  
  const restData = useTradeHistory(tokenAddress, { intervalMs: 3000 });
  const wsData = useTradeHistoryV2(tokenAddress);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">REST vs WebSocket</h1>
      
      <div className="grid grid-cols-2 gap-4">
        {/* REST */}
        <div className="border p-4 rounded">
          <h2 className="text-xl font-bold mb-2">
            OLD: REST Polling
          </h2>
          <div className="mb-2">
            <p>Status: {restData.isConnected ? '✅' : '❌'}</p>
            <p>Trades: {restData.trades.length}</p>
            <p className="text-sm text-gray-500">
              Updates every 3-10 seconds
            </p>
          </div>
          {restData.trades.slice(0, 5).map((trade) => (
            <div key={trade.id} className="text-sm py-1">
              {trade.direction === 'buy' ? '↑' : '↓'} {trade.tokenAmount}
            </div>
          ))}
        </div>

        {/* WebSocket */}
        <div className="border p-4 rounded bg-green-50">
          <h2 className="text-xl font-bold mb-2">
            NEW: WebSocket {wsData.isConnected && '🟢'}
          </h2>
          <div className="mb-2">
            <p>Status: {wsData.isConnected ? '🟢 LIVE' : '❌'}</p>
            <p>Trades: {wsData.trades.length}</p>
            <p className="text-sm text-green-600 font-semibold">
              Updates in 100-500ms! ⚡
            </p>
          </div>
          {wsData.trades.slice(0, 5).map((trade) => (
            <div key={trade.id} className="text-sm py-1">
              {trade.direction === 'buy' ? '↑' : '↓'} {trade.tokenAmount}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h3 className="font-bold mb-2">Trigger a Trade to See the Difference:</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>REST (left): Takes 3-10 seconds to update</li>
          <li>WebSocket (right): Updates in 100-500ms!</li>
          <li>Open DevTools → Network to see the difference</li>
        </ul>
      </div>
    </div>
  );
}
```

Visit: `http://localhost:3000/compare`

**Test:**
1. Trigger a trade on your platform
2. Watch both sides update
3. WebSocket side should update **10-30x faster!**

---

## 🔍 Step 5: Verify in DevTools

### **Check 1: WebSocket Connections**

1. Open DevTools (F12)
2. Network tab → **WS** filter
3. You should see:
   ```
   ws://localhost:3002/api/v1/ws/trades/0xTOKEN  [Status: 101 Switching Protocols]
   ```
4. Click on the connection
5. **Messages** tab shows:
   ```
   ↑ (sent)     {"type":"ping"}
   ↓ (received) {"type":"subscribed",...}
   ↓ (received) {"type":"trade","data":{...}}
   ```

### **Check 2: No More Polling**

1. Network tab → **XHR** filter
2. You should **NOT** see:
   ```bash
   ❌ GET /api/v1/tokens/0xTOKEN/trades  [every 3s]
   ```
3. Old REST polling is gone!

### **Check 3: Console Logs**

With `debug: true` enabled, console shows:
```
[useRealtimeTrades] Connecting to: ws://localhost:3002/api/v1/ws/trades/0xTOKEN
[useRealtimeTrades] Connected!
[useRealtimeTrades] Received message: subscribed
[useRealtimeTrades] Received message: trade
[useRealtimeTrades] New trade received: {id: '0x123', isBuy: true, ...}
```

---

## ✅ Success Criteria

After testing, you should have:

- [x] Backend WebSocket routes responding
- [x] wscat can connect to all endpoints
- [x] Frontend hooks connect successfully
- [x] DevTools shows active WS connections
- [x] No more REST polling (XHR tab empty)
- [x] Real-time updates working (< 1 second)
- [x] Auto-reconnection works (test by stopping backend)

---

## 🚨 Troubleshooting

### **Problem: wscat connection refused**

```bash
# Check backend is running:
curl http://localhost:3002/api/v1/ws/stats

# Check logs:
cd apps/backend
pnpm run dev

# Look for: ✅ Phase 3 WebSocket routes registered
```

### **Problem: Frontend not connecting**

```bash
# Check environment variable:
echo $NEXT_PUBLIC_API_URL

# Should be:
http://localhost:3002  # or your backend URL
```

### **Problem: No data received**

```bash
# Check if adapters are connected:
curl http://localhost:3002/api/v1/ws/stats | jq '.adapters'

# If adapters show "connected: false":
# - Check environment variables (QUICKNODE_WS_URL, etc.)
# - Check backend logs for connection errors
```

### **Problem: Goldsky data not flowing**

```bash
# Check if webhook is configured:
curl http://localhost:3002/api/webhooks/goldsky/health

# If webhook not set up:
# - Follow GOLDSKY_SETUP_GUIDE.md
# - Use ngrok to expose local server
# - Configure webhook in Goldsky dashboard
```

---

## 📊 Performance Testing

### **Measure Latency**

```typescript
// Add to your test component:
const [lastUpdate, setLastUpdate] = useState(Date.now());

useEffect(() => {
  if (trades.length > 0) {
    const tradeTime = trades[0].timestamp * 1000;
    const now = Date.now();
    const latency = now - tradeTime;
    console.log(`Latency: ${latency}ms`);
    setLastUpdate(now);
  }
}, [trades]);

// Expected latency:
// WebSocket: 100-500ms
// REST: 3000-10000ms
```

### **Measure API Calls**

```bash
# Before (REST polling):
# Open DevTools → Network → XHR
# Count requests per minute: 20-60

# After (WebSocket):
# Open DevTools → Network → WS
# Active connections: 1-3 (persistent)
# No polling requests!
```

---

## 🎉 You're Done!

If all tests pass, you now have:

- ✅ Real-time WebSocket data streaming
- ✅ 10-100x faster updates
- ✅ 99% fewer API calls
- ✅ Auto-reconnection working
- ✅ Sequential data guarantee

**Your platform is fully real-time! 🚀**

---

## 📚 Next Steps

1. **Replace old hooks** across your codebase
2. **Add WebSocket price endpoint** to backend
3. **Migrate TradingView datafeed** to use `useRealtimeCandles`
4. **Deploy to production** and enjoy instant updates!

---

*Test Guide Complete - October 30, 2025*














