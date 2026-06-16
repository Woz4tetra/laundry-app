// Shared-passcode auth. The app sits behind Tailscale, so a single signed
// cookie gate is "mildly secure" enough; we just keep the open internet out.

import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const COOKIE = 'laundry_sid';
const PASSCODE = process.env.APP_PASSCODE || 'changeme';
const PASSCODE_HASH = bcrypt.hashSync(PASSCODE, 10);

// Routes that do not require a valid session cookie.
const OPEN_PATHS = new Set(['/api/login', '/api/health']);

export function verifyPasscode(input: string): boolean {
  return bcrypt.compareSync(input, PASSCODE_HASH);
}

export function setSessionCookie(reply: FastifyReply): void {
  reply.setCookie(COOKIE, 'ok', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    signed: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE, { path: '/' });
}

export function isAuthed(req: FastifyRequest): boolean {
  const raw = req.cookies[COOKIE];
  if (!raw) return false;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid && unsigned.value === 'ok';
}

/** Guard all /api/* routes except the open ones. */
export function registerAuthGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return; // static assets are public
    const path = req.url.split('?')[0];
    if (OPEN_PATHS.has(path)) return;
    if (!isAuthed(req)) {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });
}
