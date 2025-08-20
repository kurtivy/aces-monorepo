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
  target: 'node20',
  platform: 'node',
  bundle: true,
  minify: false,
  sourcemap: false, // Disable sourcemaps to reduce file size
  clean: true,
  treeshake: false,
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
  cjsInterop: true,
  splitting: false,
  esbuildOptions(options) {
    // Ensure proper module format for Vercel
    options.platform = 'node';
    options.target = 'node20';
    options.format = 'cjs';
  },
});
