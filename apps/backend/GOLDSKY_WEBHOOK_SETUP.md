# 🚀 Goldsky Webhook Sink Setup - Step by Step

**How to create a Goldsky Mirror Pipeline (Webhook Sink) for real-time trading data**

---

## 📋 Prerequisites

- ✅ Goldsky account (https://goldsky.com)
- ✅ Your subgraph already deployed on Goldsky
- ✅ Backend webhook endpoint ready (`/api/webhooks/goldsky/trades`)
- ✅ `GOLDSKY_WEBHOOK_SECRET` in your `.env`

---

## 🎯 Quick Overview

Goldsky has **2 types of webhooks**:

1. **Subgraph Webhooks** ❌ - One event at a time, basic retries
2. **Webhook Sink (Mirror Pipeline)** ✅ - Batched, backpressure, SQL transforms, perfect for trading!

**You want: Webhook Sink (Mirror Pipeline)** 🎯

---

## 🔧 Step 1: Access Goldsky Dashboard

### **Option A: Goldsky Web UI**
1. Go to: https://app.goldsky.com
2. Login with your account
3. Click on your project
4. Go to **"Pipelines"** tab (left sidebar)

### **Option B: Goldsky CLI** (Recommended)
```bash
# Install CLI
npm install -g @goldsky/cli

# Login
goldsky login

# You'll be prompted to authenticate via browser
```

---

## 🔧 Step 2: Get Your Subgraph ID

You need to know your subgraph's name. You can find it in your existing `GOLDSKY_SUBGRAPH_URL`:

```bash
# Your current URL looks like:
GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_<PROJECT_ID>/subgraphs/<SUBGRAPH_NAME>/<VERSION>/gn

# Extract the subgraph name:
# Example: "aces-dex-v1" or "base-aces-trading"
```

**Find it:**
```bash
# Option 1: Check your .env
grep GOLDSKY_SUBGRAPH_URL .env

# Option 2: List your subgraphs
goldsky subgraph list
```

---

## 🔧 Step 3: Create Webhook Secret in Goldsky

### **Option A: Web UI**
1. Go to **Settings** → **Secrets**
2. Click **"Create Secret"**
3. Fill in:
   ```
   Name: ACES_WEBHOOK_SECRET
   Type: HTTP Auth
   Auth Type: Header
   Header Name: x-webhook-secret
   Header Value: <paste your secret from .env>
   ```

### **Option B: CLI**
```bash
# Get your secret from .env
echo $GOLDSKY_WEBHOOK_SECRET

# Create secret in Goldsky
goldsky secret create \
  --name ACES_WEBHOOK_SECRET \
  --type httpauth \
  --value "YOUR_SECRET_HERE"

# Verify it was created
goldsky secret list
```

---

## 🔧 Step 4: Create Pipeline Configuration File

Create `goldsky-pipeline.yaml` in your backend directory:

```yaml
# apps/backend/goldsky-pipeline.yaml

name: aces-trading-stream
version: 1

# 📊 SOURCE: Your existing subgraph
sources:
  - type: subgraph
    name: YOUR_SUBGRAPH_NAME_HERE  # Replace with your subgraph name
    # Example names:
    # - aces-dex-v1
    # - base-aces-trading
    # - aces-bonding-curve-v1

# 🔄 TRANSFORM: SQL to filter and format trades
transforms:
  - type: sql
    sql: |
      SELECT
        id,
        token_address,
        trader,
        is_buy,
        token_amount,
        aces_token_amount,
        price,
        supply,
        timestamp,
        block_number,
        transaction_hash
      FROM trades
      WHERE timestamp > UNIX_TIMESTAMP() - 3600
      ORDER BY timestamp DESC, block_number DESC

# 🎯 SINK: Your backend webhook
sinks:
  - type: webhook
    # 🔗 YOUR BACKEND URL (replace with your actual domain)
    url: https://YOUR_DOMAIN_HERE/api/webhooks/goldsky/trades
    # Local dev: http://localhost:3002/api/webhooks/goldsky/trades
    # Production: https://api.yourdomain.com/api/webhooks/goldsky/trades
    
    # 🔐 Use the secret you created
    secret_name: ACES_WEBHOOK_SECRET
    
    # ⚡ Performance settings for high-volume trading
    batch_size: 10           # Send 10 trades at once
    batch_interval: 1000     # Or every 1 second
    
    # 🔄 Retry settings
    max_retries: 5
    retry_backoff: exponential
    
    # 📊 Backpressure
    max_concurrent: 10
    
    # 🎯 Custom headers (optional)
    headers:
      Content-Type: application/json
      X-Goldsky-Source: webhook-sink
      X-Pipeline-Name: aces-trading-stream
```

---

## 🔧 Step 5: Deploy the Pipeline

### **Option A: CLI (Recommended)**
```bash
# Navigate to backend directory
cd apps/backend

# Deploy pipeline
goldsky pipeline deploy goldsky-pipeline.yaml

# You'll see output like:
# ✅ Pipeline 'aces-trading-stream' deployed successfully
# 📊 Starting to process events...
```

### **Option B: Web UI**
1. Go to **Pipelines** → **Create Pipeline**
2. Click **"Upload YAML"**
3. Upload your `goldsky-pipeline.yaml`
4. Review configuration
5. Click **"Deploy"**

---

## 🔧 Step 6: Verify Pipeline is Running

### **CLI:**
```bash
# Check status
goldsky pipeline status aces-trading-stream

# Should show:
# Status: RUNNING
# Events processed: 123
# Last event: 2 seconds ago

# View logs (real-time)
goldsky pipeline logs aces-trading-stream --follow

# View recent logs
goldsky pipeline logs aces-trading-stream --tail 100
```

### **Web UI:**
1. Go to **Pipelines**
2. Click on `aces-trading-stream`
3. See dashboard with:
   - Status: Running ✅
   - Events processed
   - Webhooks sent
   - Success rate
   - Latency

---

## 🧪 Step 7: Test the Webhook

### **Test 1: Check Webhook Health**
```bash
curl http://localhost:3002/api/webhooks/goldsky/health

# Expected:
# {
#   "success": true,
#   "message": "GoldSky webhook endpoint is healthy",
#   "timestamp": "2024-10-30T..."
# }
```

### **Test 2: Send Test Webhook**
```bash
# Get test payload
curl http://localhost:3002/api/webhooks/goldsky/test

# This will show you:
# - Example payload structure
# - Curl command to test
```

### **Test 3: Simulate Goldsky Webhook**
```bash
curl -X POST http://localhost:3002/api/webhooks/goldsky/trades \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET_HERE" \
  -d '{
    "op": "INSERT",
    "data": {
      "id": "0xtest123",
      "token": "0x1234567890abcdef",
      "trader": "0xuser123",
      "is_buy": true,
      "token_amount": "1000000000000000000",
      "aces_token_amount": "50000000000000000",
      "supply": "100000000000000000000",
      "block_number": "12345678",
      "created_at": "1698765400"
    }
  }'

# Expected:
# {
#   "success": true,
#   "processed": 1
# }
```

### **Test 4: Check Memory Store**
```bash
curl http://localhost:3002/api/v1/ws/stats | jq

# Should show trades in memory:
# {
#   "memoryStore": {
#     "totalTradesStored": 1,
#     "totalWebhooksReceived": 1,
#     "tradesInMemory": 1
#   }
# }
```

---

## 🔧 Step 8: Configure for Production

### **Update Pipeline for Your Domain**

Edit `goldsky-pipeline.yaml`:
```yaml
sinks:
  - type: webhook
    # 🔗 Production URL
    url: https://api.yourdomain.com/api/webhooks/goldsky/trades
    
    # 🚀 High-volume settings
    batch_size: 20           # Larger batches for production
    batch_interval: 500      # Faster interval (500ms)
    max_concurrent: 20       # More concurrency
```

### **Redeploy:**
```bash
goldsky pipeline deploy goldsky-pipeline.yaml --force
```

---

## 📊 Step 9: Monitor in Production

### **Check Pipeline Health**
```bash
# Pipeline status
goldsky pipeline status aces-trading-stream

# Recent logs
goldsky pipeline logs aces-trading-stream --tail 50

# Follow live
goldsky pipeline logs aces-trading-stream --follow
```

### **Check Backend Stats**
```bash
# WebSocket stats
curl https://api.yourdomain.com/api/v1/ws/stats | jq

# Should show:
# - totalTradesStored
# - totalWebhooksReceived
# - totalBroadcasts
# - connectedClients
```

### **Expected Metrics:**
```
✅ Pipeline Status: RUNNING
✅ Events Processed: 10,000+
✅ Webhook Success Rate: 99.9%
✅ Average Latency: <100ms
✅ Batches Sent: 1,000+
✅ Last Event: <5 seconds ago
```

---

## 🚨 Troubleshooting

### **Problem: Pipeline not receiving events**
```bash
# Check if subgraph is indexing
goldsky subgraph status YOUR_SUBGRAPH_NAME

# Check pipeline logs
goldsky pipeline logs aces-trading-stream --tail 100

# Restart pipeline
goldsky pipeline restart aces-trading-stream
```

### **Problem: Webhooks failing (401 Unauthorized)**
```bash
# Verify secrets match
echo $GOLDSKY_WEBHOOK_SECRET  # Your .env
goldsky secret list           # Goldsky secrets

# Update secret if different
goldsky secret update ACES_WEBHOOK_SECRET --value "NEW_SECRET"

# Redeploy pipeline
goldsky pipeline deploy goldsky-pipeline.yaml --force
```

### **Problem: Backend not receiving webhooks**
```bash
# Check backend logs
pm2 logs backend

# Test webhook directly
curl -X POST https://api.yourdomain.com/api/webhooks/goldsky/health

# Check firewall/network
# Make sure your backend is accessible from Goldsky's IPs
```

### **Problem: High latency or rate limiting**
```yaml
# Increase batch size in pipeline
batch_size: 50
batch_interval: 200

# Increase concurrency
max_concurrent: 30
```

---

## 📋 Complete Checklist

- [ ] 1. Install Goldsky CLI: `npm install -g @goldsky/cli`
- [ ] 2. Login: `goldsky login`
- [ ] 3. Find your subgraph name: `goldsky subgraph list`
- [ ] 4. Generate webhook secret: `openssl rand -base64 32`
- [ ] 5. Add to `.env`: `GOLDSKY_WEBHOOK_SECRET=...`
- [ ] 6. Create secret in Goldsky: `goldsky secret create ...`
- [ ] 7. Create `goldsky-pipeline.yaml` with your subgraph name
- [ ] 8. Update webhook URL in YAML (your domain)
- [ ] 9. Deploy pipeline: `goldsky pipeline deploy goldsky-pipeline.yaml`
- [ ] 10. Check status: `goldsky pipeline status aces-trading-stream`
- [ ] 11. Test webhook: `curl .../api/webhooks/goldsky/health`
- [ ] 12. Verify trades flowing: `curl .../api/v1/ws/stats`
- [ ] 13. Connect WebSocket: `wscat -c ws://.../api/v1/ws/trades/0xTOKEN`

---

## 🎯 Quick Start (Copy-Paste)

```bash
# 1. Install CLI
npm install -g @goldsky/cli

# 2. Login
goldsky login

# 3. List subgraphs to find yours
goldsky subgraph list

# 4. Generate secret
export WEBHOOK_SECRET=$(openssl rand -base64 32)
echo "GOLDSKY_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> .env

# 5. Create secret in Goldsky
goldsky secret create \
  --name ACES_WEBHOOK_SECRET \
  --type httpauth \
  --value "$WEBHOOK_SECRET"

# 6. Create pipeline file (edit YOUR_SUBGRAPH_NAME and YOUR_DOMAIN)
cat > goldsky-pipeline.yaml << 'EOF'
name: aces-trading-stream
version: 1

sources:
  - type: subgraph
    name: YOUR_SUBGRAPH_NAME_HERE

transforms:
  - type: sql
    sql: |
      SELECT * FROM trades
      WHERE timestamp > UNIX_TIMESTAMP() - 3600
      ORDER BY timestamp DESC

sinks:
  - type: webhook
    url: https://YOUR_DOMAIN_HERE/api/webhooks/goldsky/trades
    secret_name: ACES_WEBHOOK_SECRET
    batch_size: 10
    batch_interval: 1000
    max_retries: 5
    max_concurrent: 10
EOF

# 7. Deploy
goldsky pipeline deploy goldsky-pipeline.yaml

# 8. Check status
goldsky pipeline status aces-trading-stream

# 9. View logs
goldsky pipeline logs aces-trading-stream --follow
```

---

## 📚 Resources

- **Goldsky Docs**: https://docs.goldsky.com
- **Mirror Pipelines**: https://docs.goldsky.com/mirror/overview
- **Webhook Sinks**: https://docs.goldsky.com/mirror/sinks/webhook
- **CLI Reference**: https://docs.goldsky.com/cli
- **Support**: Discord - https://discord.gg/goldsky

---

## ✅ Success Indicators

**You'll know it's working when:**

1. ✅ Goldsky pipeline shows "RUNNING" status
2. ✅ Backend logs show "Received batched webhook"
3. ✅ `/api/v1/ws/stats` shows `totalTradesStored > 0`
4. ✅ WebSocket clients receive real-time trades
5. ✅ Sequence numbers increment: 1, 2, 3, 4...
6. ✅ <100ms latency from blockchain to frontend

---

**Need help? Your pipeline should look like the comparison table in your screenshot - you want the "Webhook Sink (Mirror)" column! 🚀**

