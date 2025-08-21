import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    'account-verification': 'src/api/account-verification.ts',
    admin: 'src/api/admin.ts',
    bids: 'src/api/bids.ts',
    contact: 'src/api/contact.ts',
    health: 'src/api/health.ts',
    listings: 'src/api/listings.ts',
    submissions: 'src/api/submissions.ts',
    tokens: 'src/api/tokens.ts',
    users: 'src/api/users.ts',
    webhooks: 'src/api/webhooks.ts',
  },
  outDir: 'api',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  bundle: true, // RE-ENABLED - This resolves relative imports
  minify: false,
  sourcemap: true,
  clean: true,
  treeshake: false,
  external: [
    // Database & ORM
    '@prisma/client',
    '.prisma/client',
    'prisma',

    // Privy Auth (keep external to avoid crypto issues)
    '@privy-io/server-auth',

    // HPKE crypto libraries (the ones causing "Cannot find module" errors)
    '@hpke/common',
    '@hpke/chacha20poly1305',

    // Other externals that don't play well with bundling
    'sharp',
    'bcrypt',
    'pino-pretty',
  ],
  cjsInterop: true,
  splitting: false,
  esbuildOptions(options) {
    options.keepNames = true;
  },
});
