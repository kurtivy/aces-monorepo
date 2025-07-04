import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    index: 'src/vercel.ts',
  },
  outDir: 'api',
  format: ['cjs'],
  target: 'node18',
  bundle: true,
  minify: false,
  sourcemap: false,
  clean: true,
  noExternal: ['fastify', '@fastify/cors', '@fastify/multipart', '@prisma/client', 'zod'],
  external: ['prisma'],
});
