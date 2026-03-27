---
name: No SSR - client-side only
description: User wants client-side rendering only, no SSR. TanStack Start power is client-side.
type: feedback
---

Do NOT use server-side rendering. This is a Web3 app — wallet connections, Convex subscriptions, and on-chain reads all happen client-side. SSR adds no value and complicates things.

**Why:** The user explicitly stated the power of TanStack Start is client-side. SSR is unnecessary overhead for a crypto trading platform where all data is fetched in the browser.

**How to apply:** Keep `defaultSsr: false` in the router config. Never verify pages by curling the server for SSR output. Test in the browser instead.
