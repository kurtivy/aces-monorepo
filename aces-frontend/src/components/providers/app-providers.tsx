import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { WagmiProvider } from "wagmi";
import { type ReactNode, useState } from "react";
import { getWagmiConfig } from "~/lib/wagmi-config";

// Convex client — initialized once
const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 24 * 60 * 60 * 1000, // 24 hours
          },
        },
      }),
  );

  const [wagmiConfig] = useState(() => getWagmiConfig());

  let content = <>{children}</>;

  // Wrap in wagmi
  content = <WagmiProvider config={wagmiConfig}>{content}</WagmiProvider>;

  // Wrap in React Query
  content = (
    <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  );

  // Wrap in Convex (only if URL is configured)
  if (convex) {
    content = <ConvexProvider client={convex}>{content}</ConvexProvider>;
  }

  return content;
}
