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
  sourcemap: false,
  clean: true,
  treeshake: false,
  // Updated external dependencies
  external: [
    '.prisma/client',
    'sharp',
    'bcrypt',
    'pino-pretty',
    // Don't externalize @prisma/client so enums get bundled
  ],
  cjsInterop: true,
  splitting: false,
  esbuildOptions(options) {
    options.keepNames = true;
    options.mainFields = ['main', 'module'];
    options.conditions = ['node'];

    // Ensure Prisma enums are properly bundled
    options.define = {
      'process.env.NODE_ENV': '"production"',
    };

    // Better handling for Prisma client
    options.banner = {
      js: `
// Prisma runtime polyfill for serverless
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = require('node-fetch');
}
      `.trim(),
    };
  },
});
