# ACES Real-Time Data Architecture (All Phases)

## Executive Summary
- Goal: Transform ACES into a pure WebSocket, real-time trading platform with sub-second latency and zero rate-limit risk.
- Strategy: Multi-phase rollout that replaces polling/REST with a unified WebSocket Gateway, external data adapters, and client integrations (TradingView, dashboard, trading interface).
- Core Pillars:
  - WebSocket Gateway (single entry point, connection/state mgmt)
  - Subscription Deduplication (100–1000x fewer external calls)
  - Real-time Adapters (Goldsky, BitQuery, QuickNode, Aerodrome events)
  - Message Ordering + Sequencing Guarantor (trade correctness)
  - Monitoring, rate-limit telemetry, and load testing at scale

---

## Phase 1 — Foundation & Rate-Limit Prevention (DONE)
- Deliverables:
  - WebSocket Gateway at `/ws/gateway` (Fastify + @fastify/websocket)
  - Subscription Manager (max 100 subs/client; auto-cleanup)
  - Message Router (priority queue, wildcard topics, dead-letter)
  - Connection State Manager (heartbeat, zombie detection)
  - Subscription Deduplicator (100–1000x external call reduction)
  - Rate Limit Monitor (BitQuery/Goldsky/QuickNode/Aerodrome)
  - Stats Endpoints:
    - `GET /api/v1/ws/stats` (gateway, dedup, router)
    - `GET /api/v1/ws/dedup-stats` (savings, ratio)
    - `GET /api/v1/ws/rate-limits` (usage + alerts)
    - `GET /api/v1/ws/health` (liveness)
- Outcomes:
  - Zero-rate-limit architecture (dedup) ready for scale.
  - All unit tests passing (21+), type-safe, and documented.

---

## Phase 2 — External Data Source WebSocket Adapters
- Objective: Replace webhook/polling with native streaming wherever possible.
- Adapters:
  - Goldsky Subgraph (GraphQL Subscriptions)
    - Streams trade entities, bonding state changes.
  - BitQuery Streaming (GraphQL Subscriptions)
    - Streams DEX trades for price/OHLC aggregation.
  - QuickNode WebSocket (eth_subscribe)
    - Subscribes to `newHeads` and specific pool/log events.
  - Aerodrome via Events (QuickNode)
    - Use pool `Sync` events for reserve updates (no REST polling).
- Responsibilities:
  - Normalize events → internal format (trade, candle, pool-state).
  - Backpressure + rate-limit safety via Deduplicator.
  - Emit typed messages to Gateway topics (see Topics & Contracts below).

---

## Phase 3 — TradingView Real-Time Integration
- Objective: Make charts fully real-time without polling.
- Components:
  - Datafeed Implementation (IBasicDataFeed compliant)
    - `getBars` via WS request/response through Gateway
    - `subscribeBars` via WS streaming
  - Trade Sequencing Guarantor
    - Buffer and order trades by `(blockNumber, txIndex)`
    - 3–5s bounded wait; handle reorgs; monotonic timestamps
  - Performance:
    - WebWorker aggregation for high-frequency trades
    - Viewport throttling; cache last 30s–60s
- Result: Sub-second updates, strict ordering, stable FPS.

---

## Phase 4 — Dashboard Real-Time Streams
- Objective: Replace timer-based hooks with shared WS streams.
- Topics:
  - `dashboard.metrics` — price, mcap, 24h volume, % change
  - `trades.all` — recent trade tape across tokens
  - `portfolio.value` — per-user computed via subscribed tokens
- Guarantees:
  - Deduplicated upstream streams regardless of client count.
  - Client-side caching and visible staleness indicators.

---

## Phase 5 — Trade Interface in Real-Time
- Objective: Quotes/validation update continuously as users type.
- Topics:
  - `quote.realtime` — amountIn/side → amountOut, price impact, fees
  - `trade.validate` — balance, allowance, slippage, pool state
  - `supply.updates` — bonding supply progress → graduation signals
- Behavior:
  - Quotes refreshed per block and on pool `Sync` events.
  - Staleness timers; disable trade when disconnected.

---

## Phase 6 — Resilience & Operations
- Auto Reconnect: Exponential backoff (1s→30s, max 10 tries)
- Heartbeat: ping every 15s; pong timeout 5s; 3 misses = zombie
- Backpressure: drop non-critical updates >60/s; queue critical
- Adaptive Throttling (optional): slow producers at 80% usage
- Observability:
  - Metrics: dedup ratio, msg rates, p50/p99 latencies
  - Alerts: rate limits (80/95%), error spikes, disconnect storms

---

## Phase 7 — Testing & Performance (Pre-Launch)
- Load Test: 1000–5000 concurrent WS clients; 3–5 subs each
- Latency Budget (end-to-end): p50 < 500ms; p99 < 2s
- Ordering: 100% trades ordered under jitter and bursts
- Failure Recovery: network flaps, backend restarts, reorgs

---

## Topics & Message Contracts (Canonical)
- Subscribe (client → gateway):
```json
{
  "type": "subscribe",
  "topic": "chart.realtime",
  "params": { "tokenAddress": "0x...", "timeframe": "15m", "chartType": "price|mcap" },
  "timestamp": 1730000000000
}
```
- Unsubscribe (client → gateway): same shape, `type: "unsubscribe"`.
- Data Update (gateway → client):
```json
{
  "type": "data_update",
  "topic": "chart.realtime",
  "data": { "candle": { "timestamp": 1730000000000, "open": 0.14, "high": 0.15, "low": 0.13, "close": 0.145, "volume": 1234 } },
  "timestamp": 1730000000123
}
```
- Request/Response (for `getBars`):
```json
// request
{ "type": "request", "requestId": "getBars_123", "topic": "chart.history", "params": { "tokenAddress": "0x...", "timeframe": "15m", "from": 1729990000, "to": 1730000000, "limit": 1000 }, "timestamp": 1730000000000 }

// response
{ "type": "response", "requestId": "getBars_123", "data": { "candles": [ { "timestamp": 1729995000, "open": 0.14, "high": 0.15, "low": 0.13, "close": 0.145, "volume": 1000 } ] }, "timestamp": 1730000000100 }
```
- Special Events:
  - `graduation_event` — token bonding → DEX, includes `poolAddress`, `dexLiveAt`.
  - `supply_update` — live bonding supply changes during trades.
  - `quote_update` — live quoting results with staleness clock.

---

## Scaling Plan
- WebSocket Gateway: horizontally scalable behind L4/L7 LB.
- Session Affinity: sticky sessions (WS) or centralized adapter bus.
- Deduplication: per-instance keyspace + optional shared cache (Redis) if multiple replicas.
- External Limits: monitor usage; auto-slow producers before hitting hard caps.

---

## SLOs & Targets
- End-to-End Latency: p50 < 500ms, p99 < 2000ms
- Trade Ordering Correctness: 100%
- Gateway Uptime: ≥ 99.9%
- Rate-Limit Incidents: 0 (per month)
- Max Clients Tested: 5000 (sustained), 10k (burst)

---

## Migration & Cleanup
- Current Status:
  - Legacy WS services disabled; kept for Phase 2 logic port.
  - New Gateway active with unit tests + docs.
- Post-Phase 2 Cleanup:
  - Delete `src/websockets/chart-data-socket.ts`
  - Delete `src/websockets/bonding-monitor-socket.ts`
  - Remove `DEPRECATED.md`

---

## Security & Compliance
- AuthN/AuthZ: preserve or extend existing Fastify auth plugin for WS if needed.
- Input Validation: validate `subscribe`/`request` params server-side.
- Abuse Prevention: per-client sub caps; topic allow-list; IP rate alerts.
- Secrets: API keys via env; never expose to clients.

---

## Implementation Pointers
- Gateway
  - `src/gateway/websocket-gateway.ts`
  - `src/services/websocket/*`
  - `src/routes/v1/websocket-stats.ts`
- Frontend (TradingView)
  - `apps/frontend/src/lib/tradingview/unified-datafeed.ts` (evolution → realtime datafeed)
- Tests & Docs
  - `apps/backend/test/websocket-gateway-phase1.test.ts`
  - `apps/backend/PHASE1_README.md`, `PHASE1_COMPLETE.md`

---

## Glossary
- Deduplication: collapsing N identical upstream subscriptions into 1 external stream.
- Graduation: bonding → DEX switch, changes pricing/supply dynamics.
- Sequencing Guarantor: ensures strict, monotonic trade/candle application.

---

## Roadmap Snapshot
- Phase 1: ✅ Foundation + dedup + monitoring
- Phase 2: 🔄 Real-time adapters (Goldsky/BitQuery/QuickNode/Aerodrome)
- Phase 3: 🔄 TradingView realtime + sequencing
- Phase 4: 🔄 Dashboard realtime streams
- Phase 5: 🔄 Trade quotes/validation realtime
- Phase 6: 🔄 Resilience (reconnect, backpressure, throttling)
- Phase 7: 🔄 Load + latency + failure testing

---

If you want, I can generate a sequence diagram or mermaid graphs in this document next.
