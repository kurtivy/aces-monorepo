# ⚡ Phase 1 Quick Start Guide

## 1️⃣ Start the Backend (1 minute)

```bash
cd /Users/cyruskind/git/aces-monorepo/apps/backend
npm run dev
```

**Look for this output:**
```
========================================
🚀 WebSocket Gateway - Phase 1
========================================
✅ WebSocket Gateway initialized on /ws/gateway
✅ Phase 1 WebSocket Gateway initialized
```

**✅ If you see this, Phase 1 is running!**

---

## 2️⃣ Test WebSocket Connection (30 seconds)

### Option A: Using wscat (recommended)
```bash
npm install -g wscat
wscat -c ws://localhost:3002/ws/gateway
```

You should see:
```json
< {"type":"connected","clientId":"client_...","timestamp":...}
```

Type this and press Enter:
```json
{"type":"subscribe","topic":"chart.realtime","params":{"tokenAddress":"0xABC","timeframe":"15m"},"timestamp":1730000000}
```

You should see:
```json
< {"type":"subscription_success","topic":"chart.realtime",...}
```

### Option B: Using our test script
```bash
npx ts-node test/manual-websocket-client.ts
```

---

## 3️⃣ Check Stats (30 seconds)

Open in browser:
```
http://localhost:3002/api/v1/ws/stats
```

Or with curl:
```bash
curl http://localhost:3002/api/v1/ws/stats | jq
```

You should see:
```json
{
  "success": true,
  "data": {
    "connectedClients": 1,
    "activeSubscriptions": 1,
    "deduplication": {
      "externalSubscriptions": 1,
      "totalClients": 1,
      "dedupRatio": 1
    }
  }
}
```

---

## 4️⃣ Test Deduplication (2 minutes)

**The Magic:** Open 3 terminals and connect 3 clients to the SAME token:

**Terminal 1:**
```bash
wscat -c ws://localhost:3002/ws/gateway
# Send: {"type":"subscribe","topic":"chart.realtime","params":{"tokenAddress":"0xABC"},"timestamp":1730000000}
```

**Terminal 2:**
```bash
wscat -c ws://localhost:3002/ws/gateway
# Send: {"type":"subscribe","topic":"chart.realtime","params":{"tokenAddress":"0xABC"},"timestamp":1730000000}
```

**Terminal 3:**
```bash
wscat -c ws://localhost:3002/ws/gateway
# Send: {"type":"subscribe","topic":"chart.realtime","params":{"tokenAddress":"0xABC"},"timestamp":1730000000}
```

**Terminal 4 (check stats):**
```bash
curl http://localhost:3002/api/v1/ws/dedup-stats | jq
```

**Expected Result:**
```json
{
  "data": {
    "externalSubscriptions": 1,     // ← Only 1 external subscription!
    "totalClients": 3,               // ← But 3 clients connected
    "dedupRatio": 3                  // ← 3x deduplication!
  }
}
```

**🎉 That's the rate limit prevention in action!**

---

## 5️⃣ Run Tests (1 minute)

```bash
npm test test/websocket-gateway-phase1.test.ts
```

Expected:
```
✓ 21 tests passed
```

---

## 🎯 Success Checklist

- [ ] Backend starts without errors
- [ ] Can connect via WebSocket
- [ ] Stats endpoint returns data
- [ ] Deduplication works (3 clients = 1 external sub)
- [ ] All 21 tests pass

**If all checked: Phase 1 is working perfectly! ✅**

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3002 is in use
lsof -i :3002

# Kill existing process
kill -9 <PID>

# Try again
npm run dev
```

### Can't connect to WebSocket
```bash
# Check if backend is running
curl http://localhost:3002/health/live

# Should return: {"status":"ok"}
```

### Tests fail
```bash
# Type check first
npm run type-check

# If no errors, tests should pass
npm test test/websocket-gateway-phase1.test.ts
```

---

## 📚 Next Steps

1. ✅ Phase 1 working? Awesome!
2. 📖 Read `PHASE1_README.md` for full documentation
3. 🔬 Explore the code in `src/gateway/` and `src/services/websocket/`
4. 🚀 Ready for Phase 2? Let's add external data sources!

---

## 🆘 Need Help?

**Check these files:**
- `PHASE1_README.md` - Full documentation
- `PHASE1_COMPLETE.md` - Test results & summary
- `test/manual-websocket-client.ts` - Example client code

**Backend logs to watch:**
```bash
npm run dev

# Look for these messages:
[Deduplicator] ♻️  Reusing existing external subscription
[RateLimitMonitor] BitQuery: 1.8% - healthy
[ConnectionStateManager] 💓 Heartbeat check: N clients
```

---

**Total Time:** ~5 minutes to verify Phase 1 works perfectly! ⚡

