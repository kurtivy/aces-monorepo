import { config } from 'dotenv';
import { join } from 'path';
import { buildApp } from './app';

// Load environment variables from root .env file
const envPath = join(process.cwd(), '.env');
const result = config({ path: envPath });
if (result.error) {
  console.error('❌ Failed to load .env file from:', envPath);
  console.error('Error:', result.error);
} else {
  console.log('✅ Loaded .env file from:', envPath);
  console.log(`✅ Loaded ${Object.keys(result.parsed || {}).length} environment variables`);
  console.log('🔍 DISABLE_BITQUERY =', process.env.DISABLE_BITQUERY);
  console.log('🔍 DISABLE_WEBSOCKET_POLLING =', process.env.DISABLE_WEBSOCKET_POLLING);
}

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
