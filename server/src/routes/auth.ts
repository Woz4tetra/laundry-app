import type { FastifyInstance } from 'fastify';
import {
  clearSessionCookie,
  isAuthed,
  setSessionCookie,
  verifyPasscode,
} from '../auth.js';

export default async function authRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/me', async (req) => ({ authed: isAuthed(req) }));

  // Rate-limited so the passcode can't be brute forced from the tailnet.
  app.post(
    '/api/login',
    {
      config: {
        rateLimit: { max: 8, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const { passcode } = (req.body as { passcode?: string }) ?? {};
      if (!passcode || !verifyPasscode(passcode)) {
        return reply.code(401).send({ error: 'wrong passcode' });
      }
      setSessionCookie(reply);
      return { ok: true };
    },
  );

  app.post('/api/logout', async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
