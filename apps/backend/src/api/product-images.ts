import { buildApp } from '../app.js';

// Export the handler for Vercel
export default async (req: any, res: any) => {
  const app = await buildApp();
  await app.ready();
  app.server.emit('request', req, res);
};
