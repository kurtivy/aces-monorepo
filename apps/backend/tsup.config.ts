import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    submissions: 'src/api/submissions.ts',
    bids: 'src/api/bids.ts',
    admin: 'src/api/admin.ts',
    webhooks: 'src/api/webhooks.ts',
    health: 'src/api/health.ts',
    listings: 'src/api/listings.ts',
    tokens: 'src/api/tokens.ts',
    users: 'src/api/users.ts',
    'account-verification': 'src/api/account-verification.ts',
    contact: 'src/api/contact.ts',
  },
  outDir: 'api',
  format: ['cjs'],
  target: 'node22',
  platform: 'node',
  bundle: true,
  minify: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  // Optimize for smaller bundles
  noExternal: [],
  external: [
    'fastify',
    '@fastify/cors',
    '@fastify/helmet',
    '@fastify/multipart',
    'fastify-metrics',
    'prisma',
    '@prisma/client',
    '.prisma/client',
    'crypto',
    'node:crypto',
    '@vercel/node',
    // Google Cloud packages
    '@google-cloud/storage',
    '@google-cloud/vision',
    // Email service
    'resend',
    // Additional packages that should be external
    'sharp',
    'bcrypt',
    'pino',
    'pino-pretty',
    'zod',
    'zod-to-json-schema',
    '@hapi/boom',
    'viem',
  ],
  cjsInterop: false,
  splitting: false,
  esbuildOptions(options) {
    // Additional optimizations
    options.treeShaking = true;
    options.minifyIdentifiers = true;
    options.minifySyntax = true;
    options.minifyWhitespace = true;
  },
});
