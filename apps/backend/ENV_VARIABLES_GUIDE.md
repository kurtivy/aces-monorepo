# 🔐 Environment Variables Guide

**Complete list of environment variables for WebSocket streaming and Goldsky integration**

---

## ✅ What You Already Have (Keep Using)

These existing environment variables are **still used** by the new architecture:

```bash
# ✅ Already have - KEEP USING
GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_xxx/subgraphs/xxx/xxx/gn
QUICKNODE_BASE_URL=https://xxx.base-mainnet.quiknode.pro/xxx/
BASE_MAINNET_RPC_URL=https://xxx.base-mainnet.quiknode.pro/xxx/  # Same as above
```

---

## 🆕 What You Need to ADD

### **1. GOLDSKY_WEBHOOK_SECRET** ✨ **REQUIRED**

This is the **only new required variable** for the webhook → memory → WebSocket architecture:

```bash
# 🆕 NEW - Generate a secure secret
GOLDSKY_WEBHOOK_SECRET=your-super-secret-webhook-token-here
```

**How to generate:**
```bash
# Option 1: OpenSSL (recommended)
openssl rand -base64 32
# Example output: JK7xQp9mN2vR8sT4wY6zB3cD5eF1gH8i

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Just make one up (at least 32 characters)
GOLDSKY_WEBHOOK_SECRET=my-ultra-secret-webhook-token-2024-production
```

**⚠️ Important:** 
- Use the **SAME secret** in both:
  1. Your `.env` file (backend)
  2. Goldsky Dashboard (when creating webhook sink)

---

## 🔌 Optional WebSocket Variables (Currently Not Needed)

These are **optional** and only needed if you want direct WebSocket connections to external services (not currently used since we're using the webhook approach):

```bash
# ⚠️ OPTIONAL - Not currently needed for production
# Only use if you want to switch from webhook to direct WebSocket

# QuickNode WebSocket (blockchain events)
QUICKNODE_WS_URL=wss://xxx.base-mainnet.quiknode.pro/xxx/

# Goldsky WebSocket (not available for subgraphs)
GOLDSKY_WS_URL=wss://api.goldsky.com/ws/...  # Not available
GOLDSKY_API_KEY=your-goldsky-api-key  # Not needed for webhooks

# BitQuery WebSocket (alternative DEX data)
BITQUERY_WS_URL=wss://streaming.bitquery.io/graphql
BITQUERY_API_KEY=your-bitquery-api-key
```

**Note:** We're using **webhooks** for Goldsky (not WebSocket), so you **don't need** `GOLDSKY_WS_URL` or `GOLDSKY_API_KEY`.

---

## 📋 Complete Environment Variable Checklist

### **✅ Required (You Already Have)**
- [x] `GOLDSKY_SUBGRAPH_URL` - For REST API queries
- [x] `QUICKNODE_BASE_URL` or `BASE_MAINNET_RPC_URL` - For blockchain reads

### **✅ Required (New - You Need to Add)**
- [ ] `GOLDSKY_WEBHOOK_SECRET` - For webhook authentication

### **⚠️ Optional (Not Currently Needed)**
- [ ] `QUICKNODE_WS_URL` - Only if you want real-time blockchain events
- [ ] `BITQUERY_API_KEY` - Only if you want BitQuery DEX data
- [ ] `BITQUERY_WS_URL` - Only if you want BitQuery real-time data

---

## 🚀 Your Current Architecture (No New Services Needed!)

```
┌─────────────────┐
│ Goldsky Webhook │ ← Uses existing GOLDSKY_SUBGRAPH_URL (webhook endpoint)
│     Sink        │ ← New: GOLDSKY_WEBHOOK_SECRET (authentication)
└────────┬────────┘
         │ Batched events (10 at a time)
         ↓
┌─────────────────┐
│  Your Backend   │
│  Memory Store   │ ← Stores in JavaScript Map (no database!)
└────────┬────────┘
         │ Real-time broadcast
         ↓
┌─────────────────┐
│   WebSocket     │
│  → Frontend     │ ← Sub-100ms latency
└─────────────────┘
```

**You already have everything except the webhook secret!** 🎉

---

## 🔧 How to Add the New Variable

### **Step 1: Generate Secret**
```bash
openssl rand -base64 32
```

### **Step 2: Add to Your `.env`**
```bash
# apps/backend/.env

# Existing variables (keep as-is)
GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_xxx/subgraphs/xxx/xxx/gn
QUICKNODE_BASE_URL=https://xxx.base-mainnet.quiknode.pro/xxx/

# 🆕 NEW: Add this line
GOLDSKY_WEBHOOK_SECRET=JK7xQp9mN2vR8sT4wY6zB3cD5eF1gH8i
```

### **Step 3: Configure in Goldsky Dashboard**

When creating your webhook sink in Goldsky:

```json
{
  "name": "ACES_WEBHOOK_SECRET",
  "type": "httpauth",
  "secretKey": "x-webhook-secret",
  "secretValue": "JK7xQp9mN2vR8sT4wY6zB3cD5eF1gH8i"  // Same as your .env
}
```

---

## 📊 Environment Variable Usage

| Variable | Used By | Required | You Have? |
|----------|---------|----------|-----------|
| `GOLDSKY_SUBGRAPH_URL` | REST API queries, existing code | ✅ Yes | ✅ Yes |
| `QUICKNODE_BASE_URL` | Blockchain reads (REST) | ✅ Yes | ✅ Yes |
| `GOLDSKY_WEBHOOK_SECRET` | Webhook authentication | ✅ Yes | ❌ **ADD THIS** |
| `QUICKNODE_WS_URL` | Real-time blockchain events | ⚠️ Optional | ❌ Not needed |
| `GOLDSKY_WS_URL` | N/A (webhooks used instead) | ❌ No | ❌ Not needed |
| `GOLDSKY_API_KEY` | N/A (webhooks used instead) | ❌ No | ❌ Not needed |
| `BITQUERY_WS_URL` | Alternative DEX data | ⚠️ Optional | ❌ Not needed |
| `BITQUERY_API_KEY` | Alternative DEX data | ⚠️ Optional | ❌ Not needed |

---

## 🧪 Testing Your Setup

### **1. Verify Existing Variables**
```bash
# Should show your URLs
echo $GOLDSKY_SUBGRAPH_URL
echo $QUICKNODE_BASE_URL
```

### **2. Add New Secret**
```bash
# Generate and add to .env
echo "GOLDSKY_WEBHOOK_SECRET=$(openssl rand -base64 32)" >> .env
```

### **3. Restart Backend**
```bash
cd apps/backend
pnpm run dev
```

### **4. Check Logs**
```bash
# Should see:
✅ Phase 1 WebSocket Gateway initialized
⚠️  Phase 2 Adapters failed to connect: (Expected - no direct WebSocket)
✅ Phase 3 WebSocket routes registered

# This is CORRECT! We're using webhooks, not direct WebSocket
```

### **5. Test Webhook Endpoint**
```bash
curl -X POST http://localhost:3002/api/webhooks/goldsky/health
# Should return: { "success": true, "message": "GoldSky webhook endpoint is healthy" }
```

---

## 🎯 Summary

### **What Changed:**
- ✅ Webhook approach (not direct WebSocket to Goldsky)
- ✅ Memory-based storage (not database polling)
- ✅ Sequential delivery with sequence numbers

### **What You Need to Do:**
1. ✅ Generate webhook secret: `openssl rand -base64 32`
2. ✅ Add `GOLDSKY_WEBHOOK_SECRET` to `.env`
3. ✅ Configure same secret in Goldsky Dashboard
4. ✅ Deploy Goldsky pipeline (see `GOLDSKY_SETUP_GUIDE.md`)

### **What You DON'T Need:**
- ❌ `GOLDSKY_WS_URL` - Not using direct WebSocket
- ❌ `GOLDSKY_API_KEY` - Not needed for webhooks
- ❌ New database - Using in-memory storage
- ❌ New services - Everything uses existing infrastructure

---

## ✅ Your Final `.env` File

```bash
# ===================================
# EXISTING (Keep as-is)
# ===================================
GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_xxx/subgraphs/xxx/xxx/gn
QUICKNODE_BASE_URL=https://xxx.base-mainnet.quiknode.pro/xxx/
BASE_MAINNET_RPC_URL=https://xxx.base-mainnet.quiknode.pro/xxx/

# ===================================
# NEW (Add this one line)
# ===================================
GOLDSKY_WEBHOOK_SECRET=JK7xQp9mN2vR8sT4wY6zB3cD5eF1gH8i

# ===================================
# OPTIONAL (Not currently needed)
# ===================================
# QUICKNODE_WS_URL=wss://xxx.base-mainnet.quiknode.pro/xxx/
# BITQUERY_API_KEY=xxx
# BITQUERY_WS_URL=wss://streaming.bitquery.io/graphql
```

---

## 🚨 Common Questions

### **Q: Do I need to change GOLDSKY_SUBGRAPH_URL?**
**A:** No! Keep using your existing URL. It's still used for REST API queries.

### **Q: Do I need a new Goldsky API key?**
**A:** No! Webhooks don't require an API key. Just the secret you generate.

### **Q: Do I need QuickNode WebSocket URL?**
**A:** Optional. The webhook-based architecture works without it. You can add it later for real-time blockchain events.

### **Q: Will old code still work?**
**A:** Yes! All existing REST API calls still work. The new architecture adds real-time WebSocket on top.

### **Q: How do I know if it's working?**
**A:** 
1. Backend starts without errors
2. `/api/webhooks/goldsky/health` returns success
3. After deploying Goldsky pipeline, check `/api/v1/ws/stats` for trade counts

---

**You only need to add ONE new environment variable: `GOLDSKY_WEBHOOK_SECRET`** 🎯

Everything else you already have! 🚀

