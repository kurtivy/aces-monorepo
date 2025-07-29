import { buildApp } from './app';

async function start() {
  try {
    const server = await buildApp();

    // Start server
    await server.listen({
      port: Number(process.env.PORT) || 3002,
      host: '0.0.0.0',
    });

    console.log('🚀 Server started on http://localhost:3002');
    console.log('📚 Routes registered:');
    console.log('  - POST /submissions/get-upload-url');
    console.log('  - POST /submissions/test');
    console.log('  - GET  /health/live');
    console.log('  - GET  /health/ready');
  } catch (err) {
    console.error('❌ Error starting server:', err);
    process.exit(1);
  }
}

start();
