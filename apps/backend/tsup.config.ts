import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    'v1/admin': 'src/api/admin.ts',
    'v1/bids': 'src/api/bids.ts',
    'v1/submissions': 'src/api/submissions.ts',
    'v1/webhooks': 'src/api/webhooks.ts',
  },
  outDir: 'api',
  format: ['cjs'],
  target: 'node18',
  bundle: true,
  minify: true,
  sourcemap: false,
  clean: true,
  noExternal: ['fastify', '@fastify/cors', '@fastify/multipart', '@prisma/client', 'zod'],
  external: ['prisma'],
  cjsInterop: true,
  splitting: false,
});
