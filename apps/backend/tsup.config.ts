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
  noExternal: ['fastify', '@fastify/cors', '@fastify/multipart', 'zod'],
  external: ['prisma', '@prisma/client', '.prisma/client'],
  cjsInterop: true,
  splitting: false,
  esbuildOptions(options) {
    options.footer = {
      js: 'if (module.exports.default) module.exports = module.exports.default;',
    };
  },
});
