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
  sourcemap: true,
  clean: true,
  treeshake: false,
  // More aggressive external configuration
  external: [
    // Database
    '@prisma/client',
    '.prisma/client',
    'prisma',

    // ALL Privy and crypto related packages
    '@privy-io/server-auth',
    /^@privy-io\/.*/, // Regex pattern for all @privy-io packages
    /^@hpke\/.*/, // Regex pattern for all @hpke packages
    '@hpke/common',
    '@hpke/chacha20poly1305',
    '@hpke/dhkem-p256-hkdf-sha256',
    '@hpke/dhkem-p384-hkdf-sha384',
    '@hpke/dhkem-p521-hkdf-sha512',
    '@hpke/dhkem-x25519-hkdf-sha256',
    '@hpke/dhkem-x448-hkdf-sha512',
    '@hpke/hkdf-sha256',
    '@hpke/hkdf-sha384',
    '@hpke/hkdf-sha512',

    // Other problematic packages
    'sharp',
    'bcrypt',
    'pino-pretty',
  ],
  cjsInterop: true,
  splitting: false,
  esbuildOptions(options) {
    options.keepNames = true;
    // Additional esbuild external configuration
    options.external = [...(options.external || []), '@privy-io/*', '@hpke/*'];
  },
});
