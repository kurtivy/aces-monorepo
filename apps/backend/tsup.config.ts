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
