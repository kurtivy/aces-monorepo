import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    submissions: 'src/api/v1/submissions.ts',
    bids: 'src/api/v1/bids.ts',
    admin: 'src/api/v1/admin.ts',
    webhooks: 'src/api/v1/webhooks.ts',
    health: 'src/api/v1/health.ts',
    listings: 'src/api/v1/listings.ts',
    tokens: 'src/api/v1/tokens.ts',
    users: 'src/api/v1/users.ts',
    'account-verification': 'src/api/v1/account-verification.ts',
    contact: 'src/api/v1/contact.ts',
  },
  outDir: 'api',
  format: ['cjs'],
  target: 'node18', // Changed from node22 - Vercel uses Node 18
  platform: 'node',
  bundle: true,
  minify: false,
  sourcemap: true,
  clean: true,
  treeshake: false,
  external: [
    // Core Node.js modules
    'crypto',
    'node:crypto',

    // Vercel runtime
    '@vercel/node',

    // Database
    'prisma',
    '@prisma/client',
    '.prisma/client',

    // Fastify ecosystem - bundle these instead of external
    // 'fastify',
    // '@fastify/cors',
    // '@fastify/helmet',
    // '@fastify/multipart',

    // Heavy packages that should stay external
    'sharp',
    'bcrypt',
    'pino',
    'pino-pretty',

    // Utility packages - bundle these
    // 'zod',
    // 'zod-to-json-schema',

    // Email service
    'resend',

    // Blockchain
    'viem',

    // Error handling
    '@hapi/boom',
  ],
  cjsInterop: true, // Enable CJS interop
  splitting: false,
  esbuildOptions(options) {
    // Reduce optimizations that might cause issues
    options.treeShaking = false;
    options.minifyIdentifiers = false;
    options.minifySyntax = false;
    options.minifyWhitespace = false;
  },
});
