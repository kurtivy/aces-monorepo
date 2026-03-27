/**
 * Vite config — pure SPA build (no SSR).
 * Replaced TanStack Start + Nitro with TanStack Router's Vite plugin
 * for file-based route generation without a server runtime.
 */
import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    // File-based route generation — auto-generates routeTree.gen.ts from src/routes/
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
  ],
});
