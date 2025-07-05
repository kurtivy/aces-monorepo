import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    submissions: 'src/api/submissions.ts',
    bids: 'src/api/bids.ts',
    admin: 'src/api/admin.ts',
    webhooks: 'src/api/webhooks.ts',
  },
  outDir: 'api',
  format: ['cjs'],
  target: 'node22',
  platform: 'node',
  bundle: true,
  minify: true,
  sourcemap: false,
  clean: true,
  noExternal: ['fastify', '@fastify/cors', '@fastify/multipart', '@prisma/client', 'zod'],
  external: ['prisma'],
  cjsInterop: true,
  splitting: false,
  // Ensure proper module exports for Vercel serverless functions
  esbuildOptions(options) {
    options.footer = {
      js: 'module.exports = exports.default || exports;',
    };
  },
});
