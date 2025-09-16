import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    verification: 'src/api/verification.ts',
    users: 'src/api/users.ts',
    contact: 'src/api/contact.ts',
    health: 'src/api/health.ts',
    submissions: 'src/api/submissions.ts',
    listings: 'src/api/listings.ts',
    'cron/sync-tokens': 'src/api/cron/sync-tokens.ts',
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
