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
  bundle: true,
  minify: false,
  sourcemap: false, // Disable to reduce bundle size
  clean: true,
  treeshake: false,
  // MINIMAL externals - let Privy 1.15.3 bundle normally
  external: [
    '@prisma/client',
    '.prisma/client',
    'sharp',
    'bcrypt',
    'pino-pretty',
    // REMOVED: All Privy and @hpke externals - let them bundle
  ],
  cjsInterop: true,
  splitting: false,
  esbuildOptions(options) {
    options.keepNames = true;
    options.mainFields = ['main', 'module'];
    options.conditions = ['node'];
    // REMOVED: external patterns that don't work
  },
});
