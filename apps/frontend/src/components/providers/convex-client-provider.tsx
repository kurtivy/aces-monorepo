'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';

// Use placeholder when not configured so useQuery() doesn't throw; canvas falls back to SAMPLE_METADATA
const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL || 'https://placeholder.convex.cloud';
const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
