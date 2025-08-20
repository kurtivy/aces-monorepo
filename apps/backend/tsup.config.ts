import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: {
    submissions: 'src/api/submissions.ts',
    users: 'src/api/users.ts',
    // Add other endpoints as needed
  },
  outDir: 'api',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  bundle: true,
  minify: false, // Keep false for easier debugging
  sourcemap: true,
  clean: true,
  treeshake: false,
  external: ['@prisma/client', '.prisma/client', 'prisma', 'sharp', 'bcrypt', 'pino-pretty'],
  cjsInterop: true,
  splitting: false,
  esbuildOptions(options) {
    options.keepNames = true;
  },
});
