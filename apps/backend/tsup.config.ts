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
