# 🚀 Goldsky Webhook Sink Setup Guide

**Complete guide to configure Goldsky Mirror Pipeline for real-time trading data**

---

## 📋 Prerequisites

- ✅ Goldsky account with subgraph deployed
- ✅ Backend webhook endpoint: `/api/webhooks/goldsky/trades`
- ✅ Environment variable: `GOLDSKY_WEBHOOK_SECRET`

---

## 🔧 Step 1: Create Webhook Secret

### **In Goldsky Dashboard:**

1. Go to **Settings** → **Secrets**
2. Click **Create Secret**
3. Configure:

```json
{
  "name": "ACES_WEBHOOK_SECRET",
  "type": "httpauth",
  "secretKey": "x-webhook-secret",
  "secretValue": "YOUR_SUPER_SECRET_TOKEN_HERE"
}
```

**Security Best Practice:**
```bash
# Generate a strong secret
openssl rand -base64 32

# Example output: 
# JK7xQp9mN2vR8sT4wY6zB3cD5eF1gH8i
```

---

## 🔧 Step 2: Update Backend Environment

### **Add to `.env`:**

```bash
# Goldsky Webhook Authentication
GOLDSKY_WEBHOOK_SECRET=JK7xQp9mN2vR8sT4wY6zB3cD5eF1gH8i

# Your Backend URL (for Goldsky to send webhooks to)
BACKEND_URL=https://your-api.com
```

---

## 🔧 Step 3: Deploy Pipeline to Goldsky

### **Option A: Goldsky CLI (Recommended)**

```bash
# Install Goldsky CLI
npm install -g @goldsky/cli

# Login
goldsky login

# Deploy pipeline
goldsky pipeline deploy goldsky-pipeline.yaml

# Check status
goldsky pipeline status aces-trading-stream

# View logs
goldsky pipeline logs aces-trading-stream --follow
```

### **Option B: Goldsky Dashboard (Web UI)**

1. Go to **Pipelines** → **Create Pipeline**
2. Upload `goldsky-pipeline.yaml`
3. Select your subgraph source
4. Configure webhook sink:
   - URL: `https://your-api.com/api/webhooks/goldsky/trades`
   - Secret: Select `ACES_WEBHOOK_SECRET`
   - Batch size: `10`
   - Batch interval: `1000ms`
5. Click **Deploy**

---

## 🔧 Step 4: Verify Webhook Authentication

Your backend webhook already has authentication! Let's verify it works:

```typescript
// apps/backend/src/routes/webhooks/goldsky.ts

fastify.post('/goldsky/trades', async (request, reply) => {
  // ✅ Verify webhook signature
  const signature = request.headers['x-webhook-secret'];
  
  if (signature !== process.env.GOLDSKY_WEBHOOK_SECRET) {
    console.error('❌ Invalid webhook signature');
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  
  // ✅ Process trades
  const trades = request.body; // Array of trades (batched)
  
  console.log(`✅ Received ${trades.length} trades from Goldsky`);
  
  // Store in memory for WebSocket streaming
  for (const trade of trades) {
    memoryStore.storeTrade(trade);
  }
  
  return reply.code(200).send({ success: true, processed: trades.length });
});
```

---

## 📊 Step 5: Configure Subgraph Entities

### **In Goldsky Dashboard → Pipeline → Sources:**

Select which entities to stream:

```yaml
entities:
  - Swap         # ✅ Trade events
  - Token        # ✅ Token metadata
  - Pool         # ⚠️  Optional: Pool state changes
  - User         # ⚠️  Optional: User activity
```

**For trading platform, you only need:**
- ✅ `Swap` (trade events)
- ✅ `Token` (token metadata)

---

## 🧪 Step 6: Test Pipeline

### **Test 1: Send Test Event**

```bash
curl -X POST https://your-api.com/api/webhooks/goldsky/trades \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '[{
    "id": "0xtest123",
    "token_address": "0x1234567890abcdef",
    "trader": "0xuser",
    "is_buy": true,
    "token_amount": "1000000000000000000",
    "aces_token_amount": "50000000000000000",
    "price": "0.05",
    "supply": "100000000000000000000",
    "timestamp": 1698765400,
    "block_number": 12345678,
    "transaction_hash": "0xtest123"
  }]'
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 1
}
```

### **Test 2: Check Memory Store**

```bash
curl https://your-api.com/api/v1/ws/stats
```

**Expected Response:**
```json
{
  "connectedClients": 0,
  "activeSubscriptions": 0,
  "totalTradesStored": 1,    // ✅ Should be > 0
  "totalWebhooksReceived": 1, // ✅ Should be > 0
  "totalBroadcasts": 0
}
```

### **Test 3: Connect WebSocket**

```javascript
// Frontend test
const ws = new WebSocket('wss://your-api.com/api/v1/ws/trades/0x1234567890abcdef');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('✅ Received trade:', message);
};
```

---

## 📊 Step 7: Monitor Performance

### **Check Pipeline Stats (Goldsky Dashboard):**

```
Pipeline: aces-trading-stream
├─ Status: ✅ Running
├─ Events Processed: 1,234,567
├─ Webhooks Sent: 123,456 (batched)
├─ Success Rate: 99.9%
├─ Avg Latency: 45ms
└─ Last Event: 2 seconds ago
```

### **Check Backend Stats:**

```bash
curl https://your-api.com/api/v1/ws/stats | jq
```

```json
{
  "memoryStore": {
    "totalTradesStored": 1234567,
    "totalWebhooksReceived": 123456,
    "totalBroadcasts": 456789,
    "tradesInMemory": 1000,
    "oldestTradeAge": "5m ago"
  },
  "websocket": {
    "connectedClients": 42,
    "activeSubscriptions": 67,
    "totalMessagesSent": 456789
  }
}
```

---

## 🎯 Performance Tuning

### **For Low-Volume Trading (<100 trades/min):**

```yaml
sinks:
  - type: webhook
    batch_size: 5           # Smaller batches
    batch_interval: 2000    # 2 seconds
    max_concurrent: 5       # Less concurrency
```

### **For High-Volume Trading (>1000 trades/min):**

```yaml
sinks:
  - type: webhook
    batch_size: 50          # Larger batches
    batch_interval: 500     # 500ms
    max_concurrent: 20      # More concurrency
```

### **For Ultra-High-Volume (>10,000 trades/min):**

```yaml
sinks:
  - type: webhook
    batch_size: 100         # Maximum batching
    batch_interval: 100     # 100ms
    max_concurrent: 50      # High concurrency
    
    # Add load balancing
    endpoints:
      - https://api-1.your-domain.com/webhooks/goldsky
      - https://api-2.your-domain.com/webhooks/goldsky
      - https://api-3.your-domain.com/webhooks/goldsky
```

---

## 🚨 Troubleshooting

### **Problem: Webhook not receiving data**

```bash
# Check pipeline status
goldsky pipeline status aces-trading-stream

# Check logs
goldsky pipeline logs aces-trading-stream --tail 100

# Test webhook endpoint
curl -X POST https://your-api.com/api/webhooks/goldsky/trades \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '[{"test": "data"}]'
```

### **Problem: 401 Unauthorized**

```bash
# Verify secret matches
echo $GOLDSKY_WEBHOOK_SECRET

# Check backend logs
pm2 logs backend

# Verify Goldsky secret
goldsky secrets list
```

### **Problem: High latency**

```yaml
# Increase batch size
batch_size: 20  # Instead of 10

# Decrease batch interval
batch_interval: 500  # Instead of 1000

# Add concurrent processing
max_concurrent: 20  # Instead of 10
```

### **Problem: Memory overflow**

```typescript
// Increase memory limit in goldsky-memory-store.ts
const memoryStore = new GoldskyMemoryStore({
  maxTradesPerToken: 500,      // Increase from 100
  maxTokens: 200,              // Increase from 100
  cleanupIntervalMs: 60000,    // Clean up every minute
});
```

---

## 🎯 Production Checklist

- [ ] Goldsky pipeline deployed and running
- [ ] Webhook secret configured and verified
- [ ] Backend receiving webhooks (check logs)
- [ ] Memory store storing trades (check `/api/v1/ws/stats`)
- [ ] WebSocket clients can connect
- [ ] Historical trades delivered in order
- [ ] Real-time trades streaming correctly
- [ ] Sequence numbers incrementing properly
- [ ] No memory leaks (monitor over 24h)
- [ ] Error handling working (test with invalid data)
- [ ] Monitoring and alerts configured

---

## 📊 Expected Performance

| Metric | Target | Your Result |
|--------|--------|-------------|
| **Webhook Latency** | <100ms | ___ ms |
| **Memory Store Write** | <1ms | ___ ms |
| **WebSocket Broadcast** | <5ms | ___ ms |
| **End-to-End Latency** | <200ms | ___ ms |
| **Trades per Second** | >1000 | ___ tps |
| **Concurrent Clients** | >100 | ___ clients |
| **Memory Usage** | <500MB | ___ MB |

---

## 🔗 Useful Links

- [Goldsky Docs: Webhook Sinks](https://docs.goldsky.com/guides/sinks/webhook)
- [Goldsky CLI Reference](https://docs.goldsky.com/cli)
- [Mirror Pipeline Examples](https://github.com/goldsky-io/examples)

---

## ✅ Summary

**Your architecture is OPTIMAL:**

```
Blockchain → Goldsky Subgraph → Webhook Sink → Your Backend → WebSocket → Frontend
   (data)       (indexing)        (batching)     (memory)      (streaming)   (real-time)
```

**Benefits:**
1. ✅ **Batched delivery** - 10 trades at once (configurable)
2. ✅ **Automatic retries** - No data loss
3. ✅ **Backpressure** - Handles high volume
4. ✅ **Ultra-fast** - <1ms memory reads
5. ✅ **Sequential** - Guaranteed time order
6. ✅ **Scalable** - Handles 1000s of concurrent users

**This is the RIGHT approach for a high-volume trading platform!** 🚀

---

*Questions? Check the Goldsky Discord or docs.goldsky.com*

