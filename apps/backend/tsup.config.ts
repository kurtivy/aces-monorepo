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
  minify: false, // Disable minification to avoid module resolution issues
  sourcemap: true, // Enable sourcemaps for debugging
  clean: true,
  treeshake: false, // Disable tree shaking for now
  // Keep more packages external to avoid bundling issues
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
    // Privy server auth and HPKE crypto packages
    '@privy-io/server-auth',
    '@hpke/common',
    '@hpke/chacha20poly1305',
    '@hpke/core',
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
