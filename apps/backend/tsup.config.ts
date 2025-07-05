import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    admin: 'src/api/admin.ts',
    bids: 'src/api/bids.ts',
    submissions: 'src/api/submissions.ts',
    webhooks: 'src/api/webhooks.ts',
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
