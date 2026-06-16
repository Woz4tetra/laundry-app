import type { FastifyInstance } from 'fastify';
import {
  createSession,
  endSession,
  getActiveSession,
  getCategories,
  saveSession,
} from '../db.js';
import { buildLoads } from '../rules-engine.js';
import { broadcast, addClient, removeClient } from '../broadcast.js';
import { nanoid } from 'nanoid';
import type { LaundrySession } from '../types.js';

export default async function sessionRoutes(app: FastifyInstance) {
  app.get('/api/session', async () => {
    return { session: getActiveSession() };
  });

  app.post('/api/session', async () => {
    const session = createSession();
    broadcast('session', session);
    return { session };
  });

  app.post('/api/session/end', async () => {
    endSession();
    broadcast('session', null);
    return { ok: true };
  });

  // Client sends the full authoritative session document after an optimistic
  // edit. Last write wins, which is fine for a single family.
  app.patch('/api/session', async (req, reply) => {
    const body = req.body as { session?: LaundrySession };
    if (!body?.session?.id) {
      return reply.code(400).send({ error: 'missing session' });
    }
    const current = getActiveSession();
    if (!current || current.id !== body.session.id) {
      return reply.code(409).send({ error: 'no matching active session', session: current });
    }
    const next = { ...body.session, active: true };
    saveSession(next);
    broadcast('session', next);
    return { session: next };
  });

  // Run the rules engine over the current sort to propose loads.
  app.post('/api/session/build', async (_req, reply) => {
    const session = getActiveSession();
    if (!session) return reply.code(409).send({ error: 'no active session' });
    const { loads, service, notes } = buildLoads(
      session.sort,
      getCategories(),
      () => nanoid(8),
      Date.now(),
    );
    session.loads = loads;
    session.step = 'build';
    saveSession(session);
    broadcast('session', session);
    return { session, service, notes };
  });

  // Live state stream (Server-Sent Events).
  app.get('/api/session/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`event: session\ndata: ${JSON.stringify(getActiveSession())}\n\n`);
    addClient(reply);

    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(': keep-alive\n\n');
      } catch {
        /* ignore */
      }
    }, 25000);

    req.raw.on('close', () => {
      clearInterval(keepAlive);
      removeClient(reply);
    });
  });
}
