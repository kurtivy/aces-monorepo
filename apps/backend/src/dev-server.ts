import { config } from 'dotenv';
import { join } from 'path';
import { buildApp } from './app';
import { existsSync } from 'fs';

// Load environment variables from .env file (for local development only)
// In production (Railway, Vercel), environment variables are injected directly
const envPath = join(process.cwd(), '.env');

if (existsSync(envPath)) {
  const result = config({ path: envPath });
  if (result.error) {
    console.warn('⚠️ Failed to load .env file from:', envPath);
    console.warn('Error:', result.error);
  } else {
    console.log('✅ Loaded .env file from:', envPath);
    console.log(`✅ Loaded ${Object.keys(result.parsed || {}).length} environment variables`);
  }
} else {
  console.log('ℹ️ No .env file found (expected in production environments like Railway/Vercel)');
  console.log('ℹ️ Using environment variables provided by hosting platform');
}

// Log important environment variables for debugging (without exposing secrets)
console.log('🔍 Environment check:');
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? '✓ set' : '✗ missing');
console.log('  - QUICKNODE_BASE_URL:', process.env.QUICKNODE_BASE_URL ? '✓ set' : '✗ missing');
console.log('  - BASE_MAINNET_RPC_URL:', process.env.BASE_MAINNET_RPC_URL ? '✓ set' : '✗ missing');
console.log('  - ACES_TOKEN_ADDRESS:', process.env.ACES_TOKEN_ADDRESS ? '✓ set' : '✗ missing');

async function start() {
  try {
    const server = await buildApp();

    // Start server
    await server.listen({
      port: Number(process.env.PORT) || 3002,
      host: '0.0.0.0',
    });

    console.log('🚀 Server started on http://localhost:3002');
  } catch (err) {
    console.error('❌ Error starting server:', err);
    process.exit(1);
  }
}

start();
