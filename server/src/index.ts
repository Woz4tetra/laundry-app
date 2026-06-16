import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerAuthGuard } from './auth.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/session.js';
import configRoutes from './routes/config.js';
import dryerRoutes from './routes/dryer.js';
import pushRoutes from './routes/push.js';
import labelRoutes from './routes/label.js';
import { startTimerLoop } from './push.js';

const PORT = Number(process.env.PORT || 23103);
const SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = resolve(__dirname, '../../web/dist');

const app = Fastify({
  logger: { transport: undefined, level: process.env.LOG_LEVEL || 'info' },
  bodyLimit: 12 * 1024 * 1024, // room for base64 label photos
});

await app.register(cookie, { secret: SECRET });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, { global: false });

// Auth gate for /api/* (must be before routes).
registerAuthGuard(app);

// API routes.
await app.register(authRoutes);
await app.register(sessionRoutes);
await app.register(configRoutes);
await app.register(dryerRoutes);
await app.register(pushRoutes);
await app.register(labelRoutes);

// Serve the built PWA and fall back to index.html for client-side routes.
if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, { root: WEB_DIST });
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    reply.code(404).send({ error: 'not found' });
  });
} else {
  app.log.warn(`web build not found at ${WEB_DIST}; run the web dev server separately`);
}

startTimerLoop();

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`laundry-app listening on :${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
